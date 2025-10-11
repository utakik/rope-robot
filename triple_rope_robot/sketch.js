// iPad用：傾き許可 + 3本ロープ + 各ロープに関節2つ

let tilt = 0, smoothTilt = 0;
const NUM_ROPES = 3;
const SEG_LEN = 28;
const NUM_SEG = 14;          // 節を少し増やす
const HINGES = [4, 9];       // ← 関節の節番号（上から数える0始まり）

const ropes = [];
let enableBtn;

function setup(){
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textSize(14);

  const colors = [[0,0,0],[70,140,255],[230,60,60]];
  const gap = min(width, 900) / 6;

  for(let r=0; r<NUM_ROPES; r++){
    const x0 = width/2 + (r-1)*gap;
    const y0 = height/2 - 160;
    const segs = [];
    for(let i=0;i<NUM_SEG;i++) segs.push(createVector(x0, y0 + i*SEG_LEN));
    ropes.push({ segs, col: colors[r], baseX: x0, baseY: y0 });
  }

  enableBtn = createButton('Enable Motion');
  enableBtn.position(16,16);
  enableBtn.mousePressed(requestMotionPermission);

  document.body.style.margin='0';
  document.body.style.overscrollBehavior='none';
}

async function requestMotionPermission(){
  try{
    if (typeof DeviceMotionEvent !== 'undefined' &&
        typeof DeviceMotionEvent.requestPermission === 'function'){
      await DeviceMotionEvent.requestPermission().catch(()=>{});
    }
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function'){
      await DeviceOrientationEvent.requestPermission().catch(()=>{});
    }
  }catch(e){}
  window.addEventListener('deviceorientation', onOrient);
  enableBtn.remove();
}

function onOrient(e){
  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  let raw = isLandscape ? (e.beta ?? 0) : (e.gamma ?? 0);
  raw = constrain(raw, -60, 60);
  tilt = raw / 45; // -1..1
}

function draw(){
  background(245);
  smoothTilt = lerp(smoothTilt, tilt, 0.15);

  for(const rope of ropes){
    const segs = rope.segs;

    // 上端を傾きで左右へ
    const amp = 220;
    segs[0].x = rope.baseX + smoothTilt * amp;
    segs[0].y = rope.baseY;

    // 節ごとの追従。関節の節は柔らかめ（係数小さめ）
    for(let i=1;i<NUM_SEG;i++){
      const prev = segs[i-1], cur = segs[i];

      // 目標位置（前節からSEG_LENだけ離れた点）
      const dx = prev.x - cur.x, dy = prev.y - cur.y;
      const dist = sqrt(dx*dx + dy*dy) || 0.0001;
      const ux = dx/dist, uy = dy/dist;

      // 係数（硬さ）：通常0.35、関節周辺は0.18に
      let k = 0.35;
      if (HINGES.includes(i) || HINGES.includes(i-1)) k = 0.18;

      // ばね的に近づける
      const diff = SEG_LEN - dist;
      cur.x -= ux * diff * k;
      cur.y -= uy * diff * k;

      // わずかな減衰（発散防止）
      const tx = prev.x - ux*SEG_LEN, ty = prev.y - uy*SEG_LEN;
      cur.x = lerp(cur.x, tx, 0.05);
      cur.y = lerp(cur.y, ty, 0.05);
    }

    // ロープ描画
    stroke(rope.col[0], rope.col[1], rope.col[2]);
    strokeWeight(4);
    noFill();
    beginShape();
    for(const p of segs) vertex(p.x, p.y);
    endShape();

    // 先端の丸
    noStroke(); fill(rope.col[0], rope.col[1], rope.col[2]);
    const tip = segs[NUM_SEG-1];
    circle(tip.x, tip.y, 16);

    // 関節マーカー（視覚化）
    fill(rope.col[0], rope.col[1], rope.col[2], 180);
    for(const h of HINGES){
      const p = segs[h];
      circle(p.x, p.y, 12);
    }
  }

  // ラベル
  fill(0); noStroke();
  text(`tilt: ${smoothTilt.toFixed(2)}   hinges at seg ${HINGES.join(', ')}`, 10, height-14);
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); }
