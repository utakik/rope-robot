// --- Fixed anchor + soft chain (tilt) ---
// 根元は固定。上から2節目をswayで横に駆動。
// 改良点: ①縦ターゲットを相対化 ②横伝播2パス ③傾きスムージング

const NUM_ROPES = 3;
const SEG = 12;
const REST = 28;
const ANCHOR_Y = 140;
const SPACING = 90;

const SWAY_AMPL = 220; // 駆動点(2節目)の左右可動幅
const KX_TOP = 0.45;   // 2節目の横追従（根元に近いので強め）
const KX = 0.34;       // それ以降の横追従
const KY = 0.12;       // 縦のばね
const DAMP = 0.90;     // 縦速度の減衰

let tiltX = 0, swayLP = 0; // ← ③スムージング用
let ropes = []; // {x,y,vy}
let canvasRef;

function setup(){
  canvasRef = createCanvas(windowWidth, windowHeight);

  // キャンバス固定＆スクロール抑止
  canvasRef.position(0, 0);
  canvasRef.style('position', 'fixed');
  canvasRef.style('inset', '0');
  canvasRef.style('touch-action', 'none');
  document.body.style.margin = '0';
  document.body.style.overscrollBehavior = 'none';
  window.addEventListener('touchmove', e => e.preventDefault(), {passive:false});

  pixelDensity(1);
  initRopes();

  // iOSの許可
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      DeviceOrientationEvent.requestPermission) {
    const btn = createButton('Enable Tilt');
    btn.position(12,12);
    btn.mousePressed(async()=>{
      try{ await DeviceOrientationEvent.requestPermission(); }catch(e){}
      btn.remove();
    });
  }
  window.addEventListener('deviceorientation', e => { tiltX = e.gamma ?? 0; });
}

function initRopes(){
  ropes = [];
  const cx = width/2;
  for (let r=0; r<NUM_ROPES; r++){
    const arr = [];
    const ax = cx + (r-1)*SPACING;
    for (let i=0; i<SEG; i++){
      arr.push({ x: ax, y: ANCHOR_Y + i*REST, vy: 0 });
    }
    ropes.push(arr);
  }
}

function draw(){
  background(245);

  // ③ティルトのスムージング（-1..1）
  const sway = constrain(tiltX/45, -1, 1);
  swayLP = lerp(swayLP, sway, 0.15);

  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    const anchorX = width/2 + (r-1)*SPACING; // ルートは固定
    rope[0].x = anchorX;
    rope[0].y = ANCHOR_Y;

    // 駆動点 = 2節目(インデックス1) を左右に引く
    const driveX = anchorX + swayLP * SWAY_AMPL;
    rope[1].x += (driveX - rope[1].x) * KX_TOP;

    // ①縦ターゲットは「ひとつ上 + REST」の相対目標
    const targetY1 = rope[0].y + REST;
    rope[1].vy = (rope[1].vy + (targetY1 - rope[1].y) * KY) * DAMP;
    rope[1].y  += rope[1].vy;

    // ②横伝播を2パス（前→後 を2回）で角を減らす
    for (let pass=0; pass<2; pass++){
      for (let i=2; i<SEG; i++){
        rope[i].x += (rope[i-1].x - rope[i].x) * KX;
      }
    }

    // 3節目以降：縦ばね（相対）
    for (let i=2; i<SEG; i++){
      const targetY = rope[i-1].y + REST;   // ①相対に変更
      rope[i].vy = (rope[i].vy + (targetY - rope[i].y) * KY) * DAMP;
      rope[i].y  += rope[i].vy;
    }
  }

  // 描画
  const cols = [color(0,0,0,220), color(70,140,255,220), color(240,70,70,220)];
  strokeWeight(4); noFill();
  for (let r=0; r<NUM_ROPES; r++){
    stroke(cols[r]);
    beginShape();
    for (let i=0; i<SEG; i++) vertex(ropes[r][i].x, ropes[r][i].y);
    endShape();
    const tip = ropes[r][SEG-1];
    fill(cols[r]); noStroke(); circle(tip.x, tip.y, 16); noFill();
  }

  noStroke(); fill(0);
  text(`tilt:${nf(tiltX,1,2)}  (root fixed)`, 12, height-14);
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
