// --- Simple soft chain ropes (tilt driven) ---
// 横: 上の節に追従、縦: 基準yへバネ戻り（確実に下へ戻る）

const NUM_ROPES = 3;
const SEG = 12;
const REST = 28;               // 節間の基準間隔
const ANCHOR_Y = 140;
const SPACING = 90;            // 吊点の左右間隔
const SWAY_AMPL = 220;         // 傾き→左右最大振れ

// 調整パラメータ（効き順）
const KX = 0.35;               // 横追従の強さ（0.2〜0.6）
const KY = 0.12;               // 縦ばねの強さ（0.08〜0.2）
const DAMP = 0.90;             // 縦速度の減衰（0.85〜0.96）

let tiltX = 0;
let ropes = []; // ropes[r][i] = {x, y, vy}

function setup(){
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  initRopes();

  // iOSの許可ボタン
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      DeviceOrientationEvent.requestPermission) {
    const btn = createButton('Enable Tilt'); btn.position(12,12);
    btn.mousePressed(async ()=>{ try{await DeviceOrientationEvent.requestPermission();}catch(e){} btn.remove(); });
  }
  window.addEventListener('deviceorientation', e => { tiltX = e.gamma || 0; });
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

  // 傾き（-45..45°）→ (-1..1)
  const sway = constrain(tiltX/45, -1, 1);

  // 各ロープ更新
  for (let r=0; r<NUM_ROPES; r++){
    const rope = ropes[r];
    // 上端アンカー（xのみ傾きでスライド）
    rope[0].x = width/2 + (r-1)*SPACING + sway*SWAY_AMPL;
    rope[0].y = ANCHOR_Y;

    // 下へ順に更新：横=上に寄せる、縦=基準へバネ戻り+減衰
    for (let i=1; i<SEG; i++){
      // 横：上の節にゆっくり追従
      rope[i].x += (rope[i-1].x - rope[i].x) * KX;

      // 縦：基準位置へ戻るばね＋減衰（必ず下に戻る）
      const targetY = ANCHOR_Y + i*REST;
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
  text(`tilt:${nf(tiltX,1,2)}  KX:${KX} KY:${KY} DAMP:${DAMP}`, 12, height-14);
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
