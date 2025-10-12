// --- Camera-based input (full screen, flip toggle) ---
// version: 2025-10-12-02-clean

let video, prevFrame;
let swayLP = 0;
let flipDir = false;
window.tiltX = 0; // 外部公開（必要なら他ページで利用）

// 調整パラメータ
const SWAY_LP = 0.12;      // 平滑化
const MOTION_SCALE = 1.5;  // 傾き換算の倍率
const THRESH = 60;         // 差分閾値（暗所では40〜50に下げてもOK）
const VW = 240, VH = 180;  // 解析用の内部ビデオ解像度（軽量）

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noStroke(); fill(255);

  // カメラ（音声OFF）
  video = createCapture({ video: { facingMode: 'environment', width: VW, height: VH }, audio: false });
  video.size(VW, VH);
  video.hide();

  // 前フレーム（差分用）
  prevFrame = createImage(VW, VH);

  // 左右反転トグル
  const flipBtn = createButton('Flip: OFF');
  flipBtn.position(12, 12);
  flipBtn.mousePressed(() => {
    flipDir = !flipDir;
    flipBtn.html(flipDir ? 'Flip: ON' : 'Flip: OFF');
  });
}

function draw() {
  background(0);

  // カメラの描画（全面）
  if (video && video.elt && video.elt.readyState >= video.elt.HAVE_CURRENT_DATA) {
    image(video, 0, 0, width, height);
  }

  // 差分計算の準備
  video.loadPixels();
  prevFrame.loadPixels();
  if (video.pixels.length === 0 || prevFrame.pixels.length === 0) return;

  // フレーム差分から左右の重心を出す
  let sum = 0, sumX = 0;
  for (let y = 0; y < VH; y += 2) {
    for (let x = 0; x < VW; x += 2) {
      const i = (y * VW + x) * 4;
      const d =
        Math.abs(video.pixels[i] - prevFrame.pixels[i]) +
        Math.abs(video.pixels[i + 1] - prevFrame.pixels[i + 1]) +
        Math.abs(video.pixels[i + 2] - prevFrame.pixels[i + 2]);
      if (d > THRESH) { sum += d; sumX += d * x; }
    }
  }

  if (sum > 0) {
    const cx = sumX / sum;                       // 0..VW-1
    const norm = map(cx, 0, VW - 1, -1, 1);      // 左右正規化
    swayLP = lerp(swayLP, (flipDir ? -norm : norm), SWAY_LP);
  } else {
    swayLP *= 0.95; // 動きが無いときは減衰
  }

  // 角度に換算（度）
  window.tiltX = constrain(swayLP * 45 * MOTION_SCALE, -45, 45);

  // HUD
  drawHUD();

  // 次フレーム保存
  prevFrame.copy(video, 0, 0, VW, VH, 0, 0, VW, VH);
  prevFrame.updatePixels();
}

function drawHUD() {
  fill(0, 140); noStroke(); rect(10, 10, 200, 48, 8);
  fill(255); textSize(14);
  text(`tiltX: ${window.tiltX.toFixed(2)}°`, 20, 28);
  text(`Flip: ${flipDir ? 'ON' : 'OFF'}`, 20, 44);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
