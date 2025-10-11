// --- 2-joint ropes (tilt) - stiff-fix ---
// 対策:
//  A) 根元-中間 / 中間-先端 の長さ拘束を複数回 (ITER=3〜5)
//  B) driveX の1フレーム移動量を制限 (MAX_STEP)
//  C) 中間節の曲がりを軽く平滑化 (BEND = 0.08)

const NUM_ROPES = 3;
const SEG = 3;               // 0=root(固定),1=mid,2=tip
const REST = 60;             // 節間自然長
const ANCHOR_Y = 160;
const SPACING = 90;

const SWAY_AMPL = 160;       // ←少し控えめに（急激な目標で伸びが出やすい）
const MAX_STEP = 18;         // ←1フレームで mid.x が動ける最大px（抑制）
const KX1 = 0.16;            // mid 横追従（強すぎると角が出やすい）
const KX2 = 0.18;            // tip 横追従（midに遅れて追従）
const KY  = 0.12;            // 縦ばね
const DAMP= 0.93;            // 縦減衰
const SWAY_LP = 0.18;        // 傾きLPF

const ITER = 5;              // ← 長さ拘束の反復回数（まずは4、重ければ3）
const BEND = 0.08;           // ← 中間節の曲がり平滑化（0〜0.15くらい）

let tiltX = 0, swayLP = 0;
let ropes = []; // [ [root, mid, tip], ... ], 各点 {x,y,vy}
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
    const root = { x: ax, y: ANCHOR_Y,        vy: 0 };
    const mid  = { x: ax, y: ANCHOR_Y+REST,   vy: 0 };
    const tip  = { x: ax, y: ANCHOR_Y+REST*2, vy: 0 };
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

    // 目標位置（横）
    const targetX = root.x + swayLP * SWAY_AMPL;

    // ---- A. 横：追従（中間→目標、先端→中間）
    // ただし B. mid.x の1フレーム移動量を制限して急激な伸びを防ぐ
    let desiredMidX = mid.x + (targetX - mid.x) * KX1;
    let step = desiredMidX - mid.x;
    if (Math.abs(step) > MAX_STEP) desiredMidX = mid.x + Math.sign(step) * MAX_STEP;
    mid.x = desiredMidX;

    tip.x += (mid.x - tip.x) * KX2;

    // ---- 縦：相対ばね + 減衰（各点が1つ上+RESTへ）
    const targetY1 = root.y + REST;
    mid.vy = (mid.vy + (targetY1 - mid.y) * KY) * DAMP;
    mid.y += mid.vy;

    const targetY2 = mid.y + REST;
    tip.vy = (tip.vy + (targetY2 - tip.y) * KY) * DAMP;
    tip.y += tip.vy;

    // ---- C. 曲がりを軽く平滑化（midをroot&tipの中点へ少し引く）
    mid.x = lerp(mid.x, (root.x + tip.x) * 0.5, BEND);
    mid.y = lerp(mid.y, (root.y + tip.y) * 0.5, BEND*0.6); // yは弱め

    // ---- A. 仕上げ：長さ拘束を複数回
    for (let k=0; k<ITER; k++){
      lengthConstraint(root, mid, REST, /*lockA=*/true);  // root固定：midだけ動かす
      lengthConstraint(mid,  tip, REST, /*lockA=*/false); // 両側少しずつ
    }
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
  text(`tilt:${nf(tiltX,1,2)}  iter:${ITER}  stepCap:${MAX_STEP}`, 12, height-16);
}

function lengthConstraint(a, b, rest, lockA){
  let dx = b.x - a.x, dy = b.y - a.y;
  let dist = Math.hypot(dx, dy) || 1;
  let diff = (dist - rest) / dist;

  // 誤差が小さければスキップ（揺れた末端での微振動を抑える）
  if (Math.abs(dist - rest) < 0.05) return;

  const corrX = dx * 0.5 * diff;
  const corrY = dy * 0.5 * diff;
  if (!lockA){ a.x += corrX; a.y += corrY; }
  b.x -= corrX;  b.y -= corrY;
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
