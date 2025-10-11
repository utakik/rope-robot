// iPad用：傾き許可ボタン + 3本の関節ひも

let tilt = 0;                 // -1..1 の正規化傾き
let smoothTilt = 0;
const ropes = [];             // 3本分
const NUM_ROPES = 3;
const SEG_LEN = 28;
const NUM_SEG = 12;

let enableBtn;

function setup(){
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textSize(14);

  // 関節ひもを3本生成（黒・青・赤）
  const colors = [[0,0,0],[70,140,255],[230,60,60]];
  for (let r=0; r<NUM_ROPES; r++){
    const x0 = width/2 + (r-1)* (min(width,900)/6);  // 等間隔
    const y0 = height/2 - 160;
    const segs = [];
    for (let i=0; i<NUM_SEG; i++){
      segs.push(createVector(x0, y0 + i*SEG_LEN));
    }
    ropes.push({segs, col: colors[r]});
  }

  // iOS用：ユーザー操作でセンサー許可
  enableBtn = createButton('Enable Motion');
  enableBtn.position(16, 16);
  enableBtn.mousePressed(requestMotionPermission);

  // 画面スクロール抑止（任意）
  document.body.style.margin='0';
  document.body.style.overscrollBehavior='none';
}

async function requestMotionPermission(){
  try{
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function'){
      const res = await DeviceMotionEvent.requestPermission();
      // iOS17では DeviceOrientationEvent 側も必要な場合がある
    }
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'){
      await DeviceOrientationEvent.requestPermission().catch(()=>{});
    }
  }catch(e){ /* noop */ }
  // センサー購読開始
  window.addEventListener('deviceorientation', onOrient);
  enableBtn.remove();
}

function onOrient(e){
  // 縦向き: 左右=gamma（-90..90） / 横向き: 左右=beta を優先
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  let raw = isLandscape ? (e.beta ?? 0) : (e.gamma ?? 0);
  // ノイズ除去＆クリップ
  raw = constrain(raw, -60, 60);
  // -1..1 に正規化（左右反転を好みで）
  const norm = raw / 45; // 45度で最大
  tilt = norm;
}

function draw(){
  background(245);

  // スムージング（揺れをなめらかに）
  smoothTilt = lerp(smoothTilt, tilt, 0.15);

  // 3本のひもを更新・描画
  for (let idx=0; idx<NUM_ROPES; idx++){
    const rope = ropes[idx];
    const segs = rope.segs;

    // 上端を傾きに応じて左右へ（中央位置は生成時）
    const baseX = width/2 + (idx-1)* (min(width,900)/6);
    const baseY = height/2 - 160;
    const amp   = 220;                         // 振れ幅
    segs[0].x = baseX + smoothTilt * amp * (0.85 + 0.1*idx);
    segs[0].y = baseY;

    // 各節を前節へばね追従（しなり）
    for (let i=1; i<NUM_SEG; i++){
      const prev = segs[i-1], cur = segs[i];
      const dx = prev.x - cur.x;
      const dy = prev.y - cur.y;
      const dist = sqrt(dx*dx + dy*dy) || 0.0001;
      const diff = SEG_LEN - dist;
      const ax = (dx/dist) * diff * 0.35;   // 追従強度
      const ay = (dy/dist) * diff * 0.35;
      cur.x -= ax;
      cur.y -= ay;
      // ほんの少しの減衰で安定
      cur.x = lerp(cur.x, prev.x - dx/dist*SEG_LEN, 0.05);
      cur.y = lerp(cur.y, prev.y - dy/dist*SEG_LEN, 0.05);
    }

    // 描画
    stroke(rope.col[0], rope.col[1], rope.col[2]);
    strokeWeight(4);
    noFill();
    beginShape();
    for (const p of segs) vertex(p.x, p.y);
    endShape();

    // 先端の丸
    fill(rope.col[0], rope.col[1], rope.col[2]);
    noStroke();
    const tip = segs[segs.length-1];
    circle(tip.x, tip.y, 16);
  }

  // パネル
  fill(0); noStroke();
  text(`tilt: ${smoothTilt.toFixed(2)}   (turn on: Settings → Safari → Motion & Orientation)`, 12, height-16);
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); }
