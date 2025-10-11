// --- 3-joint ropes (tilt) — monotonic bend (cascade targets) ---
const VERSION = "2025-10-11-03";

const NUM_ROPES = 3;
const SEG = 4;               // 0=root,1=mid,2=lower,3=tip
const REST = 56;
const ANCHOR_Y = 160;
const SPACING = 90;

const SWAY_AMPL = 160;
const REL_GAIN = [0.55, 0.65, 0.80]; // ← 残り距離に対する割合（mid < lower < tip）

const KX  = [0.18, 0.20, 0.24];      // 横追従（mid < lower < tip）
const KY  = [0.11, 0.13, 0.15];      // 縦ばね
const DAMP= [0.93, 0.92, 0.91];      // 減衰
const MAX_STEP = [12, 14, 18];       // 一歩の上限
const ITER = 5;
const SWAY_LP = 0.18;
const TIP_BIAS = 0.7;                // 拘束の配分：下側を多め
const MONO_MARGIN = 1.06;            // 単調性ガード：下ほど 6% 以上大きく

let tiltX = 0, swayLP = 0;
let ropes = [];
let cnv;

function setup(){
  cnv = createCanvas(windowWidth, windowHeight);
  cnv.position(0,0);
  cnv.style('position','fixed');
  cnv.style('inset','0');
  cnv.style('touch-action','none');
  document.body.style.margin='0';
  document.body.style.overscrollBehavior='none';
  window.addEventListener('touchmove', e=>e.preventDefault(), {passive:false});
  pixelDensity(1);

  initRopes();

  if (typeof DeviceOrientationEvent !== 'undefined' &&
      DeviceOrientationEvent.requestPermission) {
    const btn = createButton('Enable Tilt');
    btn.position(12,12);
    btn.mousePressed(async()=>{ try{await DeviceOrientationEvent.requestPermission();}catch(e){} btn.remove(); });
  }
  window.addEventListener('deviceorientation', e => { tiltX = e.gamma ?? 0; });

  window.__APP_VERSION__ = VERSION;
  document.title = `tilt-ropes ${VERSION}`;
  console.log("App version:", VERSION);
}

function initRopes(){
  ropes = [];
  const cx = width/2;
  for (let r=0; r<NUM_ROPES; r++){
    const ax = cx + (r-1)*SPACING;
    ropes.push([
      { x: ax, y: ANCHOR_Y,          vy: 0 },         // root
      { x: ax, y: ANCHOR_Y + REST,   vy: 0 },         // mid
      { x: ax, y: ANCHOR_Y + REST*2, vy: 0 },         // lower
      { x: ax, y: ANCHOR_Y + REST*3, vy: 0 },         // tip
    ]);
  }
}

function draw(){
  background(245);

  const sway = constrain(tiltX/45, -1, 1);
  swayLP = lerp(swayLP, sway, SWAY_LP);

  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];

    // 根元固定
    rope[0].x = width/2 + (r-1)*SPACING;
    rope[0].y = ANCHOR_Y;

    const rootX = rope[0].x;
    const baseX = rootX + swayLP * SWAY_AMPL;

    // --- 1) カスケード目標X（root→mid→lower→tip の順で“残り距離”の割合）
    let targ = [rootX, 0, 0, 0];
    for (let i=1; i<SEG; i++){
      targ[i] = targ[i-1] + (baseX - targ[i-1]) * REL_GAIN[i-1];
    }
    // ここで |targ[1]-rootX| < |targ[2]-rootX| < |targ[3]-rootX| が必ず成立

    // --- 2) 横：各節を target に追従（ステップ上限つき）
    for (let i=1; i<SEG; i++){
      rope[i].x = stepToward(rope[i].x, targ[i], KX[i-1], MAX_STEP[i-1]);
    }

    // --- 3) 縦：ばね＋減衰（相対）
    for (let i=1; i<SEG; i++){
      const ty = rope[i-1].y + REST;
      rope[i].vy = (rope[i].vy + (ty - rope[i].y) * KY[i-1]) * DAMP[i-1];
      rope[i].y  += rope[i].vy;
    }

    // --- 4) 長さ拘束（複数回）
    for (let k=0; k<ITER; k++){
      for (let i=1; i<SEG; i++){
        constraintBias(rope[i-1], rope[i], REST, (i==1), TIP_BIAS);
      }
    }

    // --- 5) 単調性ガード（角度が必ず増えるよう微調整）
    enforceMonotone(rope, rootX);
  }

  // 描画
  const cols = [color(0,0,0,220), color(70,140,255,220), color(240,70,70,220)];
  strokeWeight(4); noFill();
  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    stroke(cols[r]);
    beginShape();
    for (let i=0; i<SEG; i++) vertex(rope[i].x, rope[i].y);
    endShape();
    const tip = rope[SEG-1];
    fill(cols[r]); noStroke(); circle(tip.x, tip.y, 18); noFill();
  }

  // バージョン表示
  noStroke(); fill(0,160);
  rect(10,10,180,36,8);
  fill(255); textSize(14); textAlign(LEFT,CENTER);
  text(`ver: ${VERSION}`, 20,28);
}

function stepToward(current, target, k, maxStep){
  let next = current + (target - current) * k;
  let d = next - current;
  if (Math.abs(d) > maxStep) next = current + Math.sign(d) * maxStep;
  return next;
}

function constraintBias(a, b, rest, lockA, biasToB){
  let dx = b.x - a.x, dy = b.y - a.y;
  let dist = Math.hypot(dx, dy) || 1;
  let diff = (dist - rest) / dist;
  if (Math.abs(dist - rest) < 0.05) return;

  const wb = biasToB;
  const wa = lockA ? 0 : (1 - wb);
  b.x -= dx * wb * diff; b.y -= dy * wb * diff;
  if (!lockA){ a.x += dx * wa * diff; a.y += dy * wa * diff; }
}

// 角度（実際は水平変位の大きさ）を単調増加に揃える
function enforceMonotone(rope, rootX){
  const dx1 = Math.abs(rope[1].x - rootX);
  const dx2 = Math.abs(rope[2].x - rootX);
  const dx3 = Math.abs(rope[3].x - rootX);

  // mid → lower
  if (dx2 < dx1 * MONO_MARGIN){
    const want = Math.sign(rope[2].x - rootX) * (dx1 * MONO_MARGIN);
    rope[2].x = lerp(rope[2].x, rootX + want, 0.35);
  }
  // lower → tip
  const newDx2 = Math.abs(rope[2].x - rootX);
  if (dx3 < newDx2 * MONO_MARGIN){
    const want = Math.sign(rope[3].x - rootX) * (newDx2 * MONO_MARGIN);
    rope[3].x = lerp(rope[3].x, rootX + want, 0.35);
  }
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
