// --- 1-joint rope test (tilt) + distance constraint ---
// 根元(固定)–先端(可動)の2点だけ。最後に距離拘束で REST を厳密維持。

const NUM_ROPES = 3;
const SEG = 2;           // 関節1（点は0=根元,1=先端）
const REST = 60;         // 根元-先端の自然長
const ANCHOR_Y = 160;
const SPACING = 90;

const SWAY_AMPL = 160;   // 左右の最大振れ（控えめ推奨）
const KX_ONE = 0.24;     // 先端の横追従（小さいほど柔らか）
const KY_ONE = 0.11;     // 縦ばね（小さいほど“たるむ”）
const DAMP   = 0.95;     // 縦速度の減衰（大きいほどゆっくり止まる）
const SWAY_LP = 0.20;    // 傾きスムージング

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
    const root = { x: ax, y: ANCHOR_Y, vy: 0 };            // 根元（固定）
    const tip  = { x: ax, y: ANCHOR_Y + REST, vy: 0 };     // 先端（可動）
    ropes.push([root, tip]);
  }
}

function draw(){
  background(245);

  // 傾き → [-1..1] に正規化してLPF
  const sway = constrain(tiltX/45, -1, 1);
  swayLP = lerp(swayLP, sway, SWAY_LP);

  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    const root = rope[0];
    const tip  = rope[1];

    // 根元は固定（中央＋間隔）
    root.x = width/2 + (r-1)*SPACING;
    root.y = ANCHOR_Y;

    // 先端X：傾きで左右へ目標追従（やわらかく）
    const driveX = root.x + swayLP * SWAY_AMPL;
    tip.x += (driveX - tip.x) * KX_ONE;

    // 先端Y：根元+REST に戻るばね＋減衰
    const targetY = root.y + REST;
    tip.vy = (tip.vy + (targetY - tip.y) * KY_ONE) * DAMP;
    tip.y += tip.vy;

    // ===== 距離拘束（伸び防止・最重要）=====
    // 根元(固定)–先端 の距離を REST に“正確”に戻す
    enforceDistance(root, tip, REST, /*rootFixed=*/true);
    // ※ 安定性が足りなければ2回呼ぶ（軽く反復）
    // enforceDistance(root, tip, REST, true);
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

  // デバッグ
  noStroke(); fill(0);
  text(`tilt:${nf(tiltX,1,2)}  len=${nf(lengthOf(ropes[0][0], ropes[0][1]),1,1)}`, 12, height-16);
}

function enforceDistance(a, b, rest, rootFixed){
  let dx = b.x - a.x, dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  if (d < 1e-6) { // ゼロ割回避
    b.x += 0.001; d = Math.hypot(b.x - a.x, b.y - a.y);
    dx = b.x - a.x; dy = b.y - a.y;
  }
  const diff = (d - rest) / d;
  if (rootFixed){
    // 根元は固定 → 先端だけ戻す（“正確”に長さを保つ）
    b.x -= dx * diff;
    b.y -= dy * diff;
  }else{
    // 双方向に半々で戻す（多関節で使う）
    const corrX = dx * 0.5 * diff;
    const corrY = dy * 0.5 * diff;
    a.x += corrX; a.y += corrY;
    b.x -= corrX; b.y -= corrY;
  }
}

function lengthOf(a,b){ return Math.hypot(b.x - a.x, b.y - a.y); }

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
