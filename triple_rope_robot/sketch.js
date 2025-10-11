// --- 5-joint ropes (tilt) — monotonic w/ soft center ---
// 下に行くほど同方向で角度が深くなる。中央付近はガクつき防止のソフト強制。
// 構造: 0=root, 1..5=joint1..joint5(最後がtip)

const VERSION = "2025-10-11-09";  // ← index.html の ?v と合わせて更新

const NUM_ROPES = 3;
const SEG = 6;                 // 0=root, 1..5=節（5関節）
const REST = 48;               // 節間長（5関節に増えたので少し短め推奨）
const ANCHOR_Y = 160;
const SPACING  = 90;

const SWAY_AMPL = 160;
const SWAY_LP   = 0.10;        // 入力LPF（そのまま）

// 深さ係数: 下ほど大→ 同方向で角度が深くなる
// （必要なら全体スケールだけ変えてOK）
const GAIN = [0.35, 0.80, 1.25, 2.00, 3.00];

// 横方向の追従（下ほど速め）
const KX   = [0.16, 0.18, 0.20, 0.23, 0.26];

// 縦ばね＆減衰（下ほど少し強め/軽め）
const KY   = [0.10, 0.11, 0.12, 0.13, 0.14];
const DAMP = [0.94, 0.93, 0.93, 0.92, 0.92];

// 1フレームの最大移動量（暴れ防止）
const MAX_STEP = [10, 12, 14, 16, 18];

// 拘束と見た目調整
const ITER     = 6;            // 長さ拘束の反復回数（関節増で1つ上げ）
const TIP_BIAS = 0.70;         // 下側を多めに動かす

// 中央ガクつき対策（ヒステリシス＋強制ブレンド）
const DIR_DEADZONE = 10;       // px以内は向きを切り替えない
const MONO_BLEND0  = 12;       // 強制開始距離
const MONO_BLEND1  = 60;       // ここを超えるとフル強制

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
    const chain = [];
    for (let i=0; i<SEG; i++){
      chain.push({ x: ax, y: ANCHOR_Y + i*REST, vy: 0 });
    }
    ropes.push(chain);
  }
}

function draw(){
  background(245);

  const sway = constrain(tiltX/45, -1, 1);
  swayLP = lerp(swayLP, sway, SWAY_LP);

  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    const root = rope[0];

    // 根元固定
    root.x = width/2 + (r-1)*SPACING;
    root.y = ANCHOR_Y;

    // 目標x
    const baseX = root.x + swayLP * SWAY_AMPL;
    const delta = baseX - root.x;

    // 横：各節の目標xに追従（ステップ上限つき）
    for (let i=1; i<SEG; i++){
      const targetX = root.x + delta * GAIN[i-1];
      rope[i].x = stepToward(rope[i].x, targetX, KX[i-1], MAX_STEP[i-1]);
    }

    // 単調性の“重み付き”強制（中心は弱く、離れると強く）
    const dir = Math.abs(delta) > DIR_DEADZONE ? Math.sign(delta) : prevDir;
    prevDir = dir;
    const w = smoothstep(MONO_BLEND0, MONO_BLEND1, Math.abs(delta)); // 0..1
    enforceMonotonicXWeighted(rope, dir, w);

    // 縦：相対ばね＋減衰
    for (let i=1; i<SEG; i++){
      const targetY = rope[i-1].y + REST;
      rope[i].vy = (rope[i].vy + (targetY - rope[i].y) * KY[i-1]) * DAMP[i-1];
      rope[i].y  += rope[i].vy;
    }

    // 長さ拘束（1-2-…-5、下ほど優先 / 反復）
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

function stepToward(current, target, k, maxStep){
  let next = current + (target - current) * k;
  let d = next - current;
  if (Math.abs(d) > maxStep) next = current + Math.sign(d) * maxStep;
  return next;
}

// 重み付きで単調なxへ寄せる（w=0で無効, w=1で完全）
function enforceMonotonicXWeighted(rope, dir, w){
  if (w <= 0) return;
  const eps = 0;
  for (let i=1; i<rope.length; i++){
    const prev = rope[i-1].x;
    let clampX = rope[i].x;
    if (dir > 0 && clampX < prev + eps) clampX = prev + eps;
    if (dir < 0 && clampX > prev - eps) clampX = prev - eps;
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
