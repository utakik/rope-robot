// --- 2-joint ropes (tilt) ---
// 各ロープ = 根元(0,固定) + 中間(1) + 先端(2)
// 横: 追従（係数違いで遅れを作る） / 縦: 相対ばね + 減衰
// 仕上げに各ペア(0-1, 1-2)へ長さ拘束(1ステップ)で突っ張り低減

const NUM_ROPES = 3;
const SEG = 3;             // ★ 関節2つ = 点3つ（0=root,1=mid,2=tip）
const REST = 60;           // 節間の自然長
const ANCHOR_Y = 160;
const SPACING = 90;

const SWAY_AMPL = 180;     // 傾き→左右の最大振れ
const KX1 = 0.28;          // 中間(1)の横追従
const KX2 = 0.22;          // 先端(2)の横追従（より遅らせる）
const KY  = 0.12;          // 縦ばね（共通）
const DAMP= 0.93;          // 縦減衰
const SWAY_LP = 0.18;      // 傾きLPF

let tiltX = 0, swayLP = 0;
let ropes = []; // ropes[r][i] = {x,y,vy}
let cnv;

function setup(){
  cnv = createCanvas(windowWidth, windowHeight);
  cnv.position(0,0); cnv.style('position','fixed'); cnv.style('inset','0'); cnv.style('touch-action','none');
  document.body.style.margin='0'; document.body.style.overscrollBehavior='none';
  window.addEventListener('touchmove', e=>e.preventDefault(), {passive:false});
  pixelDensity(1);

  initRopes();

  // iOSの傾き許可
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
    const root = { x: ax, y: ANCHOR_Y,       vy: 0 };
    const mid  = { x: ax, y: ANCHOR_Y+REST,  vy: 0 };
    const tip  = { x: ax, y: ANCHOR_Y+REST*2,vy: 0 };
    ropes.push([root, mid, tip]);
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

    // ---- 横：追従（係数で“遅れ”を作る）
    const driveX = root.x + swayLP * SWAY_AMPL; // 目標
    mid.x += (driveX - mid.x) * KX1;            // 中間は目標に
    tip.x += (mid.x  - tip.x) * KX2;            // 先端は中間に追従

    // ---- 縦：相対ばね + 減衰（各点が1つ上+RESTへ戻る）
    const targetY1 = root.y + REST;
    mid.vy = (mid.vy + (targetY1 - mid.y) * KY) * DAMP;
    mid.y += mid.vy;

    const targetY2 = mid.y + REST;
    tip.vy = (tip.vy + (targetY2 - tip.y) * KY) * DAMP;
    tip.y += tip.vy;

    // ---- 仕上げ：長さ拘束を各ペアに1回（角の残りを減らす）
    lengthConstraint(root, mid, REST, /*lockA=*/true);  // root固定
    lengthConstraint(mid,  tip, REST, /*lockA=*/false); // 両側少しずつ
  }

  // 描画
  const cols = [color(0,0,0,220), color(70,140,255,220), color(240,70,70,220)];
  strokeWeight(4); noFill();
  for (let r=0; r<NUM_ROPES; r++){
    stroke(cols[r]);
    const a = ropes[r][0], b = ropes[r][1], c = ropes[r][2];
    beginShape(); vertex(a.x,a.y); vertex(b.x,b.y); vertex(c.x,c.y); endShape();
    fill(cols[r]); noStroke(); circle(c.x, c.y, 18); noFill();
  }

  noStroke(); fill(0);
  text(`tilt:${nf(tiltX,1,2)}  joints:2`, 12, height-16);
}

function lengthConstraint(a, b, rest, lockA){
  let dx = b.x - a.x, dy = b.y - a.y;
  let dist = Math.hypot(dx, dy) || 1;
  let diff = (dist - rest) / dist;
  const corrX = dx * 0.5 * diff;
  const corrY = dy * 0.5 * diff;
  if (!lockA){ a.x += corrX; a.y += corrY; } // 根元側も少し寄せる（lockAなら固定）
  b.x -= corrX;  b.y -= corrY;
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
