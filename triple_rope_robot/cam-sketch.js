// --- cam-sketch.js : camera + 4-bone rope (standalone) ---
const VERSION = "2025-10-12-standalone-cam";
const NUM_ROPES = 3;
const SEG = 5;                 // 骨4本（節点5）
const ANCHOR_Y = 160;
const SPACING = 90;

// 見た目と動きの軽いプリセット
const KX=[0.16,0.18,0.20,0.23];
const KY=[0.10,0.11,0.12,0.13];
const DAMP=[0.94,0.94,0.93,0.93];
const REST=48, ITER=6, TIP_BIAS=0.72;

// カメラ → 横揺れ
const SWAY_AMPL = 180;
const SWAY_LP   = 0.18;
const DIR_DEADZONE=10, MONO_BLEND0=12, MONO_BLEND1=60;
const GAIN = [0.3, 1.3, 2.4, 3.5];

let ropes=[], swayLP=0, prevDir=1;
let cnv, video, startBtn;
let prevGfx, vw=240, vh=180;

function setup(){
  pixelDensity(1);
  cnv = createCanvas(windowWidth, windowHeight);
  cnv.position(0,0); cnv.style('position','fixed'); cnv.style('inset','0'); cnv.style('touch-action','none');
  document.body.style.margin='0'; document.body.style.overscrollBehavior='none';
  window.addEventListener('touchmove', e=>e.preventDefault(), {passive:false});

  initRopes();

  // カメラ許可ボタン（iOS含む）
  startBtn = createButton('Enable Camera');
  startBtn.position(12,12);
  startBtn.mousePressed(async ()=>{
    try{
      video = createCapture({video:{facingMode:'environment', width:vw, height:vh}, audio:false});
      video.size(vw,vh);
      video.hide();
      prevGfx = createGraphics(vw,vh);
      startBtn.remove();
    }catch(e){ console.error(e); }
  });

  document.title = `rope-cam ${VERSION}`;
}

function initRopes(){
  ropes = [];
  const cx = width/2;
  for (let r=0; r<NUM_ROPES; r++){
    const ax = cx + (r-1)*SPACING;
    const arr=[];
    for (let i=0;i<SEG;i++){
      arr.push({x:ax, y:ANCHOR_Y + i*REST, vy:0});
    }
    ropes.push(arr);
  }
}

function draw(){
  // 背景：カメラ映像（存在すれば）
  if (video){
    image(video, 0, 0, width, height);
    updateSwayFromCamera(); // カメラ動き→横揺れに変換
  }else{
    background(0); // カメラ未許可時は黒
  }

  // ロープ運動
  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    const root = rope[0];
    root.x = width/2 + (r-1)*SPACING;
    root.y = ANCHOR_Y;

    const baseX = root.x + constrain(swayLP,-1,1)*SWAY_AMPL;
    const delta = baseX - root.x;

    // 横追従
    for (let i=1; i<SEG; i++){
      const targetX = root.x + delta * GAIN[i-1];
      rope[i].x += (targetX - rope[i].x) * KX[i-1];
    }

    // 単調性（反転つぶし）
    const dir = Math.abs(delta)>DIR_DEADZONE ? Math.sign(delta) : prevDir;
    prevDir = dir;
    const wMono = smoothstep(MONO_BLEND0, MONO_BLEND1, Math.abs(delta));
    enforceMonotonicXWeighted(rope, dir, wMono*0.7);

    // 縦ばね
    for (let i=1;i<SEG;i++){
      const targetY = rope[i-1].y + REST;
      rope[i].vy = (rope[i].vy + (targetY - rope[i].y)*KY[i-1]) * DAMP[i-1];
      rope[i].y += rope[i].vy;
    }

    // 長さ拘束（骨を保つ）
    for (let k=0;k<ITER;k++){
      for (let i=1;i<SEG;i++){
        constraintBias(rope[i-1], rope[i], REST, (i===1), TIP_BIAS);
      }
    }
  }

  // 描画（オーバーレイ）
  drawRopes();
  drawHUD();
}

function updateSwayFromCamera(){
  video.loadPixels();
  prevGfx.loadPixels();
  let sum=0, sumX=0;
  for (let y=0; y<vh; y+=2){
    for (let x=0; x<vw; x+=2){
      const idx=(y*vw+x)*4;
      const r=video.pixels[idx], g=video.pixels[idx+1], b=video.pixels[idx+2];
      const pr=prevGfx.pixels[idx], pg=prevGfx.pixels[idx+1], pb=prevGfx.pixels[idx+2];
      const d=Math.abs(r-pr)+Math.abs(g-pg)+Math.abs(b-pb);
      if (d>60){ sum+=d; sumX+=d*x; }
    }
  }
  prevGfx.copy(video,0,0,vw,vh,0,0,vw,vh); prevGfx.updatePixels();
  if (sum>1){
    const cx = sumX/sum;                 // 0..vw-1
    const norm = map(cx, 0, vw-1, -1, 1); // 左=-1 右=+1
    swayLP = lerp(swayLP, -norm, SWAY_LP);  // ← 左右を反転！
  }
}

function drawRopes(){
  const cols=[color(0,0,0,220), color(70,140,255,220), color(240,70,70,220)];
  strokeWeight(4); noFill();
  for (let r=0; r<NUM_ROPES; r++){
    const rope=ropes[r];
    stroke(cols[r]); beginShape();
    for (let i=0;i<SEG;i++) vertex(rope[i].x, rope[i].y);
    endShape();
    const tip=rope[SEG-1];
    fill(cols[r]); noStroke(); circle(tip.x, tip.y, 18); noFill();
  }
}

function drawHUD(){
  noStroke(); fill(0,140);
  rect(10,10,260,50,8);
  fill(255); textSize(14); textAlign(LEFT,CENTER);
  text(`ver: ${VERSION}`, 20,26);
  text(`cam:${video?'on':'off'}  sway:${nf(swayLP,1,2)}`, 20,44);
}

// --- helpers ---
function enforceMonotonicXWeighted(rope, dir, w){
  if (w<=0) return;
  for (let i=1;i<rope.length;i++){
    const prev=rope[i-1].x;
    let clampX=rope[i].x;
    if (dir>0 && clampX<prev) clampX=prev;
    if (dir<0 && clampX>prev) clampX=prev;
    rope[i].x = lerp(rope[i].x, clampX, w);
  }
}
function constraintBias(a,b,rest,lockA,biasToB){
  let dx=b.x-a.x, dy=b.y-a.y, dist=Math.hypot(dx,dy)||1;
  let diff=(dist-rest)/dist;
  if (Math.abs(dist-rest)<0.05) return;
  const wb=biasToB, wa=lockA?0:(1-wb);
  b.x-=dx*wb*diff; b.y-=dy*wb*diff;
  if (!lockA){ a.x+=dx*wa*diff; a.y+=dy*wa*diff; }
}
function smoothstep(a,b,x){ const t=constrain((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
