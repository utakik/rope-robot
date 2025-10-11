let ropes = [];
let inputAngle = 0;
let outputAngle = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100);
  strokeWeight(6);
  
  ropes.push(new Rope(width*0.3, color(0, 0, 0)));     // 黒
  ropes.push(new Rope(width*0.5, color(210, 80, 90))); // 青（入力）
  ropes.push(new Rope(width*0.7, color(0, 80, 90)));   // 赤（出力）
  
  // スマホの傾きイベントを取得
  if (typeof DeviceOrientationEvent !== "undefined") {
    window.addEventListener("deviceorientation", e => {
      inputAngle = radians(e.gamma || 0); // 左右傾き（-90〜90°）
    });
  }
}

function draw() {
  background(0, 0, 95);
  
  // 出力は入力に少し遅れて追従
  outputAngle = lerp(outputAngle, inputAngle * 0.8, 0.05);
  
  ropes[0].display(0);             // 左（固定）
  ropes[1].display(inputAngle);    // 青（入力）
  ropes[2].display(outputAngle);   // 赤（出力）
}

class Rope {
  constructor(x, c) {
    this.x0 = x;
    this.len = height * 0.7;
    this.c = c;
  }
  
  display(angle) {
    let sway = sin(angle) * 100;
    let x1 = this.x0 + sway;
    let y1 = this.len;
    
    stroke(this.c);
    line(this.x0, 0, x1, y1);
    fill(this.c);
    noStroke();
    ellipse(x1, y1, 30);
  }
}
