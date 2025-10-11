// === Tilt-driven hanging ropes (full Verlet) ===
// ・各節は pos / prev を持ち、Verlet積分で慣性＋重力
// ・距離拘束を複数回解いて突っ張りを解消
// ・駆動はアンカー(節0)の位置を左右に動かすのみ
// ・3本ロープ

const NUM_ROPES   = 3;
const SEGMENTS    = 12;
const REST_LEN    = 28;    // 節間距離
const GRAVITY     = 0.35;  // 重力
const DAMPING     = 0.997; // 速度減衰(Verletのpos-prevに掛ける)
const SOLVE_ITERS = 10;    // 拘束反復回数（重要）
const ANCHOR_Y    = 140;
const SPACING     = 90;
const SWAY_AMPL   = 220;

let tiltX = 0, swayLP = 0;
let ropes = [];  // ropes[r][i] = {pos:{x,y}, prev:{x,y}}
let anchors = []; // createVector

function setup(){
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight);
  initRopes();

  // iOSの許可UI
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

  // 画面固定
  document.body.style.margin = '0';
  document.body.style.overscrollBehavior = 'none';
  window.addEventListener('touchmove', e => e.preventDefault(), {passive:false});
}

function initRopes(){
  anchors = [];
  ropes = [];
  const cx = width/2;
  for (let r=0; r<NUM_ROPES; r++){
    anchors.push(createVector(cx + (r-1)*SPACING, ANCHOR_Y));
    const chain = [];
    for (let i=0; i<SEGMENTS; i++){
      const x = anchors[r].x;
      const y = ANCHOR_Y + i*REST_LEN;
      chain.push({ pos:{x, y}, prev:{x, y} });
    }
    ropes.push(chain);
  }
}

function draw(){
  background(245);

  // 傾き（-1..1）をスムージング
  const sway = constrain(tiltX/45, -1, 1);
  swayLP = lerp(swayLP, sway, 0.15);

  // アンカーを左右に（根元のみ動かす）
  for (let r=0; r<NUM_ROPES; r++){
    anchors[r].x = width/2 + (r-1)*SPACING + swayLP*SWAY_AMPL;
    anchors[r].y = ANCHOR_Y;
  }

  // ==== 物理更新（Verlet）====
  for (let r=0; r<NUM_ROPES; r++){
    const chain = ropes[r];

    // 1) 節の自由落下（節0は後で固定するので飛ばす）
    for (let i=1; i<SEGMENTS; i++){
      const p  = chain[i].pos;
      const pp = chain[i].prev;

      // 現在速度 = pos - prev
      let vx = (p.x - pp.x) * DAMPING;
      let vy = (p.y - pp.y) * DAMPING + GRAVITY;

      // Verlet update
      chain[i].prev = { x: p.x, y: p.y };
      chain[i].pos  = { x: p.x + vx, y: p.y + vy };
    }

    // 2) 拘束を複数回解く（節間距離=REST_LEN）
    for (let k=0; k<SOLVE_ITERS; k++){
      // a=節i, b=節i+1をREST_LENに
      for (let i=0; i<SEGMENTS-1; i++){
        const a = chain[i].pos;
        const b = chain[i+1].pos;

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy) || 1e-6;
        const diff = (dist - REST_LEN) / dist;

        // 根元(節0)はアンカー固定なので動かさない
        if (i === 0){
          // a固定 → bだけ戻す
          b.x -= dx * diff;
          b.y -= dy * diff;
        } else {
          // aとbを半分ずつ寄せる
          const corrX = dx * 0.5 * diff;
          const corrY = dy * 0.5 * diff;
          a.x += corrX; a.y += corrY;
          b.x -= corrX; b.y -= corrY;
        }
      }

      // 3) アンカーに再ピン留め（毎反復）
      chain[0].pos.x = anchors[r].x;
      chain[0].pos.y = anchors[r].y;
      chain[0].prev.x = anchors[r].x; // 根元の速度をゼロに
      chain[0].prev.y = anchors[r].y;
    }
  }

  // ==== 描画 ====
  const cols = [color(0,0,0,220), color(70,140,255,220), color(240,70,70,220)];
  strokeWeight(4); noFill();
  for (let r=0; r<NUM_ROPES; r++){
    stroke(cols[r]);
    beginShape();
    for (let i=0; i<SEGMENTS; i++){
      vertex(ropes[r][i].pos.x, ropes[r][i].pos.y);
    }
    endShape();

    // 先端の重り
    const tip = ropes[r][SEGMENTS-1].pos;
    fill(cols[r]); noStroke(); circle(tip.x, tip.y, 16); noFill();
  }

  // UI
  noStroke(); fill(0);
  text(`tilt:${nf(tiltX,1,2)}  solve:${SOLVE_ITERS}  g:${GRAVITY}`, 12, height-14);
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
