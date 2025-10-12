// --- Camera-based rope input (with Flip toggle) ---
// version: 2025-10-12-01

let video;
let prevFrame;
let motionX = 0;
let swayLP = 0;
let flipDir = false; // ← 左右反転モード（false=通常, true=反転）

// rope 側と共有する入力
let tiltX = 0;

// 感度・平滑化パラメータ
const MOTION_SCALE = 1.5;  // 動き量→揺れ幅
const SWAY_LP = 0.12;      // スムージング係数
const MOTION_CLAMP = 1.0;  // 最大入力制限

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noStroke();
  fill(255);

  // カメラ取得
  video = createCapture({
    video: { facingMode: 'environment' }  // 背面カメラ
  });
  video.size(160, 120);
  video.hide();

  // 左右反転ボタン
  const flipBtn = createButton('Flip LR');
  flipBtn.position(12, 12);
  flipBtn.mousePressed(() => {
    flipDir = !flipDir;
    flipBtn.html(flipDir ? 'Flip: ON' : 'Flip: OFF');
  });

  prevFrame = createImage(video.width, video.height);
}

function draw() {
  background(0);

  video.loadPixels();
  prevFrame.loadPixels();

  let totalDiff = 0;
  let count = 0;
  let cx = 0;

  // --- 差分検出 ---
  for (let y = 0; y < video.height; y += 2) {
    for (let x = 0; x < video.width; x += 2) {
      const i = (y * video.width + x) * 4;
      const diff =
        abs(video.pixels[i] - prevFrame.pixels[i]) +
        abs(video.pixels[i + 1] - prevFrame.pixels[i + 1]) +
        abs(video.pixels[i + 2] - prevFrame.pixels[i + 2]);
      if (diff > 60) { // 動き閾値
        totalDiff += diff;
        cx += x * diff;
        count += diff;
      }
    }
  }

  if (count > 0) {
    const avgX = cx / count;
    const norm = map(avgX, 0, video.width, -1, 1);
    // ← 左右切替に応じて符号反転
    swayLP = lerp(swayLP, (flipDir ? -norm : norm), SWAY_LP);
  } else {
    swayLP *= 0.95; // 動きがないときは徐々に減衰
  }

  // rope用 tilt入力へ変換
  tiltX = constrain(swayLP * 45 * MOTION_SCALE, -45, 45);

  // --- 可視化 ---
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, width - video.width - 10, height - video.height - 10, video.width * 2, video.height * 2);
  pop();

  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text(`tiltX: ${tiltX.toFixed(2)}°`, 20, 60);
  text(`Flip: ${flipDir ? "ON" : "OFF"}`, 20, 80);

  // 次フレーム更新
  prevFrame.copy(video, 0, 0, video.width, video.height, 0, 0, video.width, video.height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
