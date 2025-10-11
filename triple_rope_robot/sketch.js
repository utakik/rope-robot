// --- 1-joint rope test (tilt) ---
// 各ロープは「根元(固定) + 先端(可動)」の2点だけ。
// xは傾きで目標に追従、yはばね＋減衰で安定させる。

const NUM_ROPES = 3;
const SEG = 2;           // ← 関節数1（節は2点：0=根元,1=先端）
const REST = 60;         // 根元-先端の自然長（見やすく少し長めに）
const ANCHOR_Y = 160;
const SPACING = 90;

const SWAY_AMPL = 180;   // 傾き→左右の最大振れ
const KX_ONE = 0.28;     // 先端の横追従（大きい=速いが硬い）
const KY_ONE = 0.12;     // 縦のばね（大きい=戻りが強い）
const DAMP = 0.93;       // 縦速度の減衰（大きい=ゆっくり止まる）
const SWAY_LP = 0.18;    // 傾きスムージング

let tiltX = 0, swayLP = 0;
let ropes = []; // ropes[r] = [{x,y,vy},{x,y,vy}]
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
    const root = { x: ax, y: ANCHOR_Y, vy: 0 };            // 根元（描画には使うが固定）
    const tip  = { x: ax, y: ANCHOR_Y + REST, vy: 0 };     // 先端（可動）
    ropes.push([root, tip]);
  }
}

function draw(){
  background(245);

  // 傾き→[-1..1] に正規化してLPF
  const sway = constrain(tiltX/45, -1, 1);
  swayLP = lerp(swayLP, sway, SWAY_LP);

  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    const root = rope[0];
    const tip  = rope[1];

    // 根元は固定（中央+間隔）
    root.x = width/2 + (r-1)*SPACING;
    root.y = ANCHOR_Y;

    // 先端X：傾きで左右へ目標追従
    const driveX = root.x + swayLP * SWAY_AMPL;
    tip.x += (driveX - tip.x) * KX_ONE;

    // 先端Y：根元＋REST に戻るばね＋減衰
    const targetY = root.y + REST;
    tip.vy = (tip.vy + (targetY - tip.y) * KY_ONE) * DAMP;
    tip.y += tip.vy;
  }

  // 描画
  const cols = [color(0,0,0,220), color(70,140,255,220), color(240,70,70,220)];
  strokeWeight(4); noFill();
  for (let r=0; r<NUM_ROPES; r++){
    stroke(cols[r]);
    const root = ropes[r][0], tip = ropes[r][1];
    line(root.x, root.y, tip.x, tip.y);
    fill(cols[r]); noStroke(); circle(tip.x, tip.y, 18); noFill();
  }

  // デバッグ（目標位置のガイド）
  noStroke(); fill(0);
  text(`tilt:${nf(tiltX,1,2)}  SWAY_LP:${SWAY_LP}`, 12, height-16);
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
