// --- 2-joint ropes (tilt) — monotonic bend ---
// 目的: 下に行くほど角度が大きい（同方向で tip > mid）
// 手法: 目標Xに深さ係数を導入 (MID_GAIN < TIP_GAIN) + ばね + 長さ拘束

const NUM_ROPES = 3;
const SEG = 3;               // 0=root,1=mid,2=tip
const REST = 60;
const ANCHOR_Y = 160;
const SPACING = 90;

const SWAY_AMPL = 160;       // 基準振れ幅（root基準）
const MID_GAIN  = 0.85;      // 中節の深さ係数（<1）
const TIP_GAIN  = 1.20;      // 先端の深さ係数（>1）←ここで tip > mid を保証

const KX_MID = 0.20;         // mid の横追従
const KX_TIP = 0.24;         // tip の横追従（やや速く）
const MAX_STEP_MID = 14;     // mid 1フレーム最大移動
const MAX_STEP_TIP = 18;     // tip 1フレーム最大移動

const KY_MID = 0.12, DAMP_MID = 0.93; // 縦ばね/減衰（mid）
const KY_TIP = 0.14, DAMP_TIP = 0.92; // 縦ばね/減衰（tip）←軽めに

const ITER = 4;              // 長さ拘束の反復回数
const TIP_BIAS = 0.7;        // 拘束配分：tip側を多めに動かす
const SWAY_LP = 0.18;        // 傾きLPF

let tiltX = 0, swayLP = 0;
let ropes = []; // [ [root, mid, tip], ... ] 各点 {x,y,vy}
let cnv;

function setup(){
  cnv = createCanvas(windowWidth, windowHeight);
  cnv.position(0,0); cnv.style('position','fixed'); cnv.style('inset','0'); cnv.style('touch-action','none');
  document.body.style.margin='0'; document.body.style.overscrollBehavior='none';
  window.addEventListener('touchmove', e=>e.preventDefault(), {passive:false});
  pixelDensity(1);

  initRopes();

  // iOS 傾き許可
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      DeviceOrientationEvent.requestPermission) {
    const btn = createButton('Enable Tilt');
    btn.position(12,12);
    btn.mousePressed(async()=>{ try{await DeviceOrientationEvent.requestPermission();}catch(e){} btn.remove(); });
  }
  window.addEventListener('deviceorientation', e => { tiltX = e.gamma ?? 0; });
}

function initRopes(){
  ropes = [];
  const cx = width/2;
  for (let r=0; r<NUM_ROPES; r++){
    const ax = cx + (r-1)*SPACING;
    ropes.push([
      { x: ax, y: ANCHOR_Y,          vy: 0 },         // root
      { x: ax, y: ANCHOR_Y + REST,   vy: 0 },         // mid
      { x: ax, y: ANCHOR_Y + REST*2, vy: 0 },         // tip
    ]);
  }
}

function draw(){
  background(245);

  // 傾き [-1..1] → LPF
  const sway = constrain(tiltX/45, -1, 1);
  swayLP = lerp(swayLP, sway, SWAY_LP);

  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    const root = rope[0], mid = rope[1], tip = rope[2];

    // 根元固定
    root.x = width/2 + (r-1)*SPACING;
    root.y = ANCHOR_Y;

    // --- 目標X（深さ係数で mid < tip を保証）
    const baseX = root.x + swayLP * SWAY_AMPL;
    const targetMidX = root.x + (baseX - root.x) * MID_GAIN; // 同方向・小さめ
    const targetTipX = root.x + (baseX - root.x) * TIP_GAIN; // 同方向・大きめ

    // 横：追従（ステップ上限つき）
    mid.x = stepToward(mid.x, targetMidX, KX_MID, MAX_STEP_MID);
    tip.x = stepToward(tip.x, targetTipX, KX_TIP, MAX_STEP_TIP);

    // 縦：相対ばね + 減衰
    const targetY1 = root.y + REST;
    mid.vy = (mid.vy + (targetY1 - mid.y) * KY_MID) * DAMP_MID;  mid.y += mid.vy;

    const targetY2 = mid.y + REST;
    tip.vy = (tip.vy + (targetY2 - tip.y) * KY_TIP) * DAMP_TIP;  tip.y += tip.vy;

    // 長さ拘束（複数回）— tip側にバイアス
    for (let k=0; k<ITER; k++){
      constraintBias(root, mid, REST, /*lockA=*/true,  /*biasToB=*/1.0);      // root固定
      constraintBias(mid,  tip, REST, /*lockA=*/false, /*biasToB=*/TIP_BIAS); // tip多め
    }
  }

  // 描画
  const cols = [color(0,0,0,220), color(70,140,255,220), color(240,70,70,220)];
  strokeWeight(4); noFill();
  for (let r=0; r<NUM_ROPES; r++){
    const [a,b,c] = ropes[r];
    stroke(cols[r]); beginShape(); vertex(a.x,a.y); vertex(b.x,b.y); vertex(c.x,c.y); endShape();
    fill(cols[r]); noStroke(); circle(c.x, c.y, 18); noFill();
  }

  noStroke(); fill(0);
  text(`tilt:${nf(tiltX,1,2)}  gains M:${MID_GAIN} T:${TIP_GAIN}`, 12, height-16);
}

function stepToward(current, target, k, maxStep){
  let next = current + (target - current) * k;
  let d = next - current;
  if (Math.abs(d) > maxStep) next = current + Math.sign(d) * maxStep;
  return next;
}

function constraintBias(a, b, rest, lockA, biasToB){
  // biasToB: 0.5で等分、>0.5でb(下側)を多めに動かす
  let dx = b.x - a.x, dy = b.y - a.y;
  let dist = Math.hypot(dx, dy) || 1;
  let diff = (dist - rest) / dist;
  if (Math.abs(dist - rest) < 0.05) return;

  const wb = biasToB;
  const wa = lockA ? 0 : (1 - wb);
  b.x -= dx * wb * diff; b.y -= dy * wb * diff;
  if (!lockA){ a.x += dx * wa * diff; a.y += dy * wa * diff; }
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
