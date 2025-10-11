// === Tilt-driven hanging ropes with gravity (Verlet) ===

const NUM_ROPES = 3;         // 3本
const SEGMENTS = 12;         // 節の数
const REST_LEN = 28;         // 節間の自然長(px)
const GRAVITY = 0.35;        // 重力加速度
const DAMPING = 0.996;       // 速度減衰(1に近いほど慣性大)
const SOLVE_ITERS = 5;       // 拘束(距離)の反復回数
const ANCHOR_Y = 140;        // 吊点の高さ
const ANCHOR_SPACING = 90;   // 吊点の左右間隔
const SWAY_AMPL = 220;       // 傾きによる左右振れ最大

let tiltX = 0;               // デバイスの左右傾き(度)
let ropes = [];              // 各ロープ: [{pos, prev}, ...]
let anchors = [];            // 各ロープのアンカー位置

function setup(){
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  initRopes();

  // iOSは許可ダイアログ
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      DeviceOrientationEvent.requestPermission) {
    let btn = createButton('Enable Tilt');
    btn.position(12, 12);
    btn.mousePressed(async ()=>{
      try { await DeviceOrientationEvent.requestPermission(); } catch(e){}
      btn.remove();
    });
  }
  window.addEventListener('deviceorientation', e => { tiltX = e.gamma || 0; });
}

function initRopes(){
  anchors.length = 0; ropes.length = 0;
  const cx = width/2;
  for (let r=0; r<NUM_ROPES; r++){
    anchors.push(createVector(cx + (r-1)*ANCHOR_SPACING, ANCHOR_Y));
    let nodes = [];
    for (let i=0; i<SEGMENTS; i++){
      const p = createVector(anchors[r].x, ANCHOR_Y + i*REST_LEN);
      nodes.push({ pos: p.copy(), prev: p.copy() });
    }
    ropes.push(nodes);
  }
}

function draw(){
  background(245);

  // 1) アンカーを傾きで左右に（-45..45度→-1..1に正規化）
  const sway = constrain(tiltX/45, -1, 1);
  for (let r=0; r<NUM_ROPES; r++){
    anchors[r].x = width/2 + (r-1)*ANCHOR_SPACING + sway*SWAY_AMPL;
    anchors[r].y = ANCHOR_Y;
  }

  // 2) 物理更新（Verlet）
  for (let r=0; r<NUM_ROPES; r++){
    const chain = ropes[r];

    // アンカー固定
    chain[0].pos.set(anchors[r].x, anchors[r].y);

    // 速度=pos-prev / 慣性 / 重力
    for (let i=1; i<SEGMENTS; i++){
      const n = chain[i];
      let vx = (n.pos.x - n.prev.x) * DAMPING;
      let vy = (n.pos.y - n.prev.y) * DAMPING + GRAVITY;

      n.prev.set(n.pos.x, n.pos.y);
      n.pos.x += vx;
      n.pos.y += vy;
    }

    // 距離拘束をSOLVE_ITERS回
    for (let k=0; k<SOLVE_ITERS; k++){
      // 節間長をREST_LENに保つ
      for (let i=0; i<SEGMENTS-1; i++){
        let a = chain[i], b = chain[i+1];
        let dx = b.pos.x - a.pos.x;
        let dy = b.pos.y - a.pos.y;
        let dist = sqrt(dx*dx + dy*dy) || 0.0001;
        let diff = (dist - REST_LEN) / dist;
        // aはアンカー（i==0）なので動かさない
        const corrX = dx * 0.5 * diff;
        const corrY = dy * 0.5 * diff;
        if (i>0){ a.pos.x += corrX; a.pos.y += corrY; }
        b.pos.x -= corrX; b.pos.y -= corrY;
      }
      // アンカーに再ピン留め
      chain[0].pos.set(anchors[r].x, anchors[r].y);
    }
  }

  // 3) 描画
  const colors = [
    color(0,0,0,220),        // 黒
    color(70,140,255,220),   // 青
    color(240,70,70,220)     // 赤
  ];
  strokeWeight(4);
  noFill();

  for (let r=0; r<NUM_ROPES; r++){
    stroke(colors[r]);
    beginShape();
    for (let i=0; i<SEGMENTS; i++){
      vertex(ropes[r][i].pos.x, ropes[r][i].pos.y);
    }
    endShape();

    // 先端の重り
    const tip = ropes[r][SEGMENTS-1].pos;
    fill(colors[r]); noStroke();
    circle(tip.x, tip.y, 16);
    noFill();
  }

  // UI
  noStroke(); fill(0);
  text(`tilt: ${nf(tiltX,1,2)}   gravity:${GRAVITY}  len:${REST_LEN}`, 12, height-16);
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); initRopes(); }
