// --- tilt-ropes (4 bones) with presets ---
// 2025-10-12-01

const VERSION = "2025-10-23";
const NUM_ROPES = 3;
const SEG = 5;               // ← 骨4本（節点5個）
const ANCHOR_Y = 160;
const SPACING = 90;
const SWAY_AMPL = 160;
const SWAY_LP = 0.1;

// === プリセット群 ===
const PRESETS = {
  soft: {
    KX:   [0.15,0.17,0.19,0.21,0.30],
    KY:   [0.10,0.11,0.12,0.13,0.14],
    DAMP: [0.94,0.94,0.94,0.93,0.93],
    REST: 48, ITER: 6, TIP_BIAS: 0.7
  },
  crisp: {
    KX:   [0.18,0.20,0.22,0.25,0.28],
    KY:   [0.11,0.12,0.13,0.14,0.15],
    DAMP: [0.93,0.93,0.92,0.92,0.91],
    REST: 44, ITER: 5, TIP_BIAS: 0.7
  },
  tail: {
    KX:   [0.16,0.18,0.20,0.23,0.27],
    KY:   [0.10,0.11,0.12,0.13,0.15],
    DAMP: [0.94,0.94,0.93,0.93,0.92],
    REST: 48, ITER: 6, TIP_BIAS: 0.75
  }
};

// === モード選択（1=soft, 2=crisp, 3=tail） ===
let MODE = "tail";
let cfg = PRESETS[MODE];

// === 一般パラメータ ===
const GAIN = [0.3, 1.3, 2.4, 3.5];
const DIR_DEADZONE = 10;
const MONO_BLEND0 = 12;
const MONO_BLEND1 = 60;

let tiltX = 0, swayLP = 0, prevDir = 1;
let ropes = [];
let cnv;

function setup(){
  cnv = createCanvas(windowWidth, windowHeight);
  cnv.position(0,0); cnv.style('position','fixed'); cnv.style('inset','0'); cnv.style('touch-action','none');
  document.body.style.margin='0'; document.body.style.overscrollBehavior='none';
  window.addEventListener('touchmove', e=>e.preventDefault(), {passive:false});
  pixelDensity(1);

  initRopes();

  // iOS tilt permission
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      DeviceOrientationEvent.requestPermission) {
    const btn = createButton('Enable Tilt');
    btn.position(12,12);
    btn.mousePressed(async()=>{ try{await DeviceOrientationEvent.requestPermission();}catch(e){} btn.remove(); });
  }
  window.addEventListener('deviceorientation', e => { tiltX = e.gamma ?? 0; });

  document.title = `tilt-ropes ${VERSION}`;
  console.log("App version:", VERSION);
}

function initRopes(){
  ropes = [];
  const cx = width/2;
  for (let r=0; r<NUM_ROPES; r++){
    const ax = cx + (r-1)*SPACING;
    const arr = [];
    for (let i=0; i<SEG; i++){
      arr.push({ x: ax, y: ANCHOR_Y + i*cfg.REST, vy: 0 });
    }
    ropes.push(arr);
  }
}

function draw(){
  background(245);
  swayLP = lerp(swayLP, constrain(tiltX/45,-1,1), SWAY_LP);

  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    const root = rope[0];
    root.x = width/2 + (r-1)*SPACING;
    root.y = ANCHOR_Y;
    const baseX = root.x + swayLP * SWAY_AMPL;
    const delta = baseX - root.x;

    // --- 横追従 ---
    for (let i=1; i<SEG; i++){
      const targetX = root.x + delta * GAIN[i-1];
      rope[i].x += (targetX - rope[i].x) * cfg.KX[i-1];
    }

    // ★ 単調性補正
    const dir = Math.abs(delta)>DIR_DEADZONE?Math.sign(delta):prevDir;
    prevDir = dir;
    const w = smoothstep(MONO_BLEND0, MONO_BLEND1, Math.abs(delta));
    enforceMonotonicXWeighted(rope, dir, w*0.8);

    // --- 縦のばね ---
    for (let i=1; i<SEG; i++){
      const targetY = rope[i-1].y + cfg.REST;
      rope[i].vy = (rope[i].vy + (targetY - rope[i].y) * cfg.KY[i-1]) * cfg.DAMP[i-1];
      rope[i].y  += rope[i].vy;
    }

    // --- 拘束ITER回 ---
    for (let k=0; k<cfg.ITER; k++){
      for (let i=1; i<SEG; i++){
        constraintBias(rope[i-1], rope[i], cfg.REST, (i===1), cfg.TIP_BIAS);
      }
    }
  }

  drawRopes();
  drawHUD();
}

// --- 描画まわり ---
function drawRopes(){
  const cols = [color(0,0,0,220), color(70,140,255,220), color(240,70,70,220)];
  strokeWeight(4); noFill();
  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    stroke(cols[r]); beginShape();
    for (let i=0; i<SEG; i++) vertex(rope[i].x, rope[i].y);
    endShape();
    const tip = rope[SEG-1];
    fill(cols[r]); noStroke(); circle(tip.x, tip.y, 18); noFill();
  }
}

function drawHUD(){
  noStroke(); fill(0,160);
  rect(10,10,200,44,8);
  fill(255); textSize(14); textAlign(LEFT,CENTER);
  text(`ver: ${VERSION}`, 20,26);
  text(`mode: ${MODE}`, 20,42);
}

function enforceMonotonicXWeighted(rope, dir, w){
  if (w <= 0) return;
  for (let i=1; i<rope.length; i++){
    const prev = rope[i-1].x;
    let clampX = rope[i].x;
    if (dir > 0 && clampX < prev) clampX = prev;
    if (dir < 0 && clampX > prev) clampX = prev;
    rope[i].x = lerp(rope[i].x, clampX, w);
  }
}

function constraintBias(a,b,rest,lockA,biasToB){
  let dx=b.x-a.x, dy=b.y-a.y;
  let dist=Math.hypot(dx,dy)||1;
  let diff=(dist-rest)/dist;
  if(Math.abs(dist-rest)<0.05)return;
  const wb=biasToB;
  const wa=lockA?0:(1-wb);
  b.x-=dx*wb*diff; b.y-=dy*wb*diff;
  if(!lockA){ a.x+=dx*wa*diff; a.y+=dy*wa*diff; }
}

function smoothstep(a,b,x){
  const t=constrain((x-a)/(b-a),0,1);
  return t*t*(3-2*t);
}

function keyPressed(){
  if(key==='1') MODE="soft";
  if(key==='2') MODE="crisp";
  if(key==='3') MODE="tail";
  cfg = PRESETS[MODE];
  console.log("Switched to:", MODE);
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
