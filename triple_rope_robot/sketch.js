// --- 3-joint ropes (tilt) — stable iOS-safe version ---

const VERSION = "2025-10-13-01";   // ★バージョン更新

const NUM_ROPES = 3;
const SEG = 4;               // 0=root,1=mid,2=lower,3=tip
const REST = 56;
const ANCHOR_Y = 160;
const SPACING = 90;

const SWAY_AMPL = 160;
const GAIN = [0.3, 1.6, 3.5];
const KX   = [0.18, 0.22, 0.26];
const KY   = [0.11, 0.13, 0.15];
const DAMP = [0.93, 0.92, 0.91];
const MAX_STEP = [12, 14, 18];
const ITER = 5;
const SWAY_LP = 0.1;
const TIP_BIAS = 0.7;

const DIR_DEADZONE = 10;     // px以内では向きを切り替えない
const MONO_BLEND0  = 12;
const MONO_BLEND1  = 60;

// --- new global vars for tilt ---
let betaDeg = 0, gammaDeg = 0, tiltX = 0; // 前後・左右・安定化後
let swayLP = 0, prevDir = 1;
let ropes = [];
let cnv;

// --- event listener outside setup() ---
window.addEventListener('deviceorientation', (e) => {
  betaDeg  = e.beta  ?? 0;   // 前後
  gammaDeg = e.gamma ?? 0;   // 左右
  tiltX    = computeStableLR(betaDeg, gammaDeg);
});

// --- helper: compute stable left/right tilt independent of orientation ---
function computeStableLR(beta, gamma){
  // 端末が上向き/下向きでも左右が反転しないよう安定化
  let g = constrain(gamma, -90, 90);
  let b = constrain(beta, -180, 180);
  // beta>0: 端末が前に倒れている。裏返し補正
  let sign = cos(radians(b)) >= 0 ? 1 : -1;
  return g * sign;
}

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

  // --- iOS permission button ---
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      DeviceOrientationEvent.requestPermission) {
    const btn = createButton('Enable Tilt');
    btn.position(12,12);
    btn.mousePressed(async()=>{
      try{ await DeviceOrientationEvent.requestPermission(); }
      catch(e){}
      btn.remove();
    });
  }

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
      { x: ax, y: ANCHOR_Y,          vy: 0 },
      { x: ax, y: ANCHOR_Y + REST,   vy: 0 },
      { x: ax, y: ANCHOR_Y + REST*2, vy: 0 },
      { x: ax, y: ANCHOR_Y + REST*3, vy: 0 },
    ]);
  }
}

function draw(){
  background(245);

  const sway = constrain(tiltX/45, -1, 1);
  swayLP = lerp(swayLP, sway, SWAY_LP);

  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    const root = rope[0];
    root.x = width/2 + (r-1)*SPACING;
    root.y = ANCHOR_Y;

    const baseX = root.x + swayLP * SWAY_AMPL;
    const delta = baseX - root.x;

    // 横方向追従
    for (let i=1; i<SEG; i++){
      const targetX = root.x + delta * GAIN[i-1];
      rope[i].x = stepToward(rope[i].x, targetX, KX[i-1], MAX_STEP[i-1]);
    }

    // 単調制約（反転防止）
    const dir = Math.abs(delta) > DIR_DEADZONE ? Math.sign(delta) : prevDir;
    prevDir = dir;
    const w = smoothstep(MONO_BLEND0, MONO_BLEND1, Math.abs(delta));
    enforceMonotonicXWeighted(rope, dir, w);

    // 縦方向ばね
    for (let i=1; i<SEG; i++){
      const targetY = rope[i-1].y + REST;
      rope[i].vy = (rope[i].vy + (targetY - rope[i].y) * KY[i-1]) * DAMP[i-1];
      rope[i].y  += rope[i].vy;
    }

    // 長さ拘束
    for (let k=0; k<ITER; k++){
      for (let i=1; i<SEG; i++){
        constraintBias(rope[i-1], rope[i], REST, (i===1), TIP_BIAS);
      }
    }
  }

  // 描画
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

  // バージョン表示
  noStroke(); fill(0,160);
  rect(10,10,150,36,8);
  fill(255); textSize(14); textAlign(LEFT,CENTER);
  text(`ver: ${VERSION}`, 20,28);
}

// --- utility functions ---
function stepToward(current, target, k, maxStep){
  let next = current + (target - current) * k;
  let d = next - current;
  if (Math.abs(d) > maxStep) next = current + Math.sign(d) * maxStep;
  return next;
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

function smoothstep(a, b, x){
  const t = constrain((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
