// --- Camera-based input (full screen, flip toggle) ---
const VERSION = "2025-10-12-02";

let video, prevFrame, swayLP = 0;
let flipDir = false;
window.tiltX = 0;        // ← ロープ用に外へ公開

const SWAY_LP = 0.12;
const MOTION_SCALE = 1.5;
const THRESH = 60;

function setup(){
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  noStroke(); fill(255);

  // カメラ（音声オフ）
  video = createCapture({ video:{ facingMode:'environment' }, audio:false });
  video.size(240,180);    // 内部解析用の解像度（軽量）
  video.hide();
  prevFrame = createImage(video.width, video.height);

  const flipBtn = createButton('Flip: OFF');
  flipBtn.position(12,12);
  flipBtn.mousePressed(()=>{ flipDir = !flipDir; flipBtn.html(flipDir?'Flip: ON':'Flip: OFF'); });
}

function draw(){
  // まずカメラを全面に描画
  background(0);
  if (video.loadedmetadata) {
    // 解析は低解像度、表示は全面
    image(video, 0, 0, width, height);
  }

  // 差分で左右重心を計算
  video.loadPixels(); prevFrame.loadPixels();
  let sum=0, sumX=0;
  for (let y=0; y<video.height; y+=2){
    for (let x=0; x<video.width; x+=2){
      const i=(y*video.width+x)*4;
      const d = Math.abs(video.pixels[i]-prevFrame.pixels[i])
              + Math.abs(video.pixels[i+1]-prevFrame.pixels[i+1])
              + Math.abs(video.pixels[i+2]-prevFrame.pixels[i+2]);
      if (d>THRESH){ sum+=d; sumX+=d*x; }
    }
  }
  if (sum>0){
    const cx = sumX/sum;                    // 0..video.width
    const norm = map(cx, 0, video.width, -1, 1);
    swayLP = lerp(swayLP, (flipDir ? -norm : norm), SWAY_LP);
  } else {
    swayLP *= 0.95;
  }

  // ひも側へ渡す角度（度）
  window.tiltX = constrain(swayLP * 45 * MOTION_SCALE, -45, 45);

  // HUD
  fill(0,140); noStroke(); rect(10,10,180,46,8);
  fill(255); textSize(14);
  text(`tiltX: ${window.tiltX.toFixed(2)}°`, 20, 28);
  text(`Flip: ${flipDir?'ON':'OFF'}`, 20, 44);

  // 次フレーム保持
  prevFrame.copy(video,0,0,video.width,video.height,0,0,video.width,video.height);
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); }        cx += x * diff;
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
