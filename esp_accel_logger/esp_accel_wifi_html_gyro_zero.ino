#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_ICM20X.h>
#include <Adafruit_ICM20948.h>
#include <Adafruit_Sensor.h>

const char* ssid     = "Redmi14";
const char* password = "okok1234";

Adafruit_ICM20948 icm;
WebServer server(80);

volatile bool isRunning = true;

// --- サンプリング周期（ESP側で固定） ---
static const uint32_t SAMPLE_HZ = 50;
static const uint32_t SAMPLE_US = 1000000UL / SAMPLE_HZ;

// --- 角度推定（コンプリメンタリ） ---
static const float ALPHA = 0.98f; // 0.95〜0.99で調整

static uint32_t nextSampleUs = 0;
static uint32_t lastFilterUs = 0;
static float angleDeg = 0.0f;

// ★追加：ゼロ合わせ（オフセット）
static float offsetDeg = 0.0f;

// 最新値（RAMに保持：履歴は持たない）
static uint32_t t_us = 0;
static float ax=0, ay=0, az=0;
static float gx=0, gy=0, gz=0;

// 加速度から角度（pitch例）
static float accelAngleDeg(float ax_, float ay_, float az_) {
  float pitch = atan2f(-ax_, sqrtf(ay_*ay_ + az_*az_));
  return pitch * 180.0f / PI;
}

// ★追加：現姿勢をゼロ扱いにする
static void calibrateZero() {
  sensors_event_t a, g, temp, m;
  if (!icm.getEvent(&a, &g, &temp, &m)) return;

  float acc = accelAngleDeg(a.acceleration.x, a.acceleration.y, a.acceleration.z);

  // フィルタ内部状態も基準へ寄せる（起動直後の挙動が安定）
  angleDeg = acc;
  offsetDeg = acc;

  Serial.print("ZERO set. offsetDeg=");
  Serial.println(offsetDeg, 3);
}

void setup() {
  Serial.begin(115200);
  delay(300);

  // ESP32無印の定番I2C
  Wire.begin(21, 22);

  if (!icm.begin_I2C(0x68)) {
    Serial.println("ICM20948: NOT FOUND");
    while (1) delay(100);
  }
  icm.setAccelRange(ICM20948_ACCEL_RANGE_2_G);
  Serial.println("ICM20948: OK");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.printf("Connecting to %s", ssid);
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print("."); }
  Serial.println();
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  // 制御
  server.on("/start", [](){
    isRunning = true;
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/plain", "START");
  });

  server.on("/stop", [](){
    isRunning = false;
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/plain", "STOP");
  });

  // ★追加：ゼロ合わせ
  server.on("/zero", [](){
    calibrateZero();
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/plain", "ZERO");
  });

  // 最新値を返す（ここではセンサを読まない）
  server.on("/data", []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");

    // ★変更：ゼロ合わせ済み角度
    float angleZeroed = angleDeg - offsetDeg;
    // もし向きが逆だと感じたら↓に変更
    // float angleZeroed = -(angleDeg - offsetDeg);

    String j = "{";
    j += "\"running\":" + String(isRunning ? "true" : "false");
    j += ",\"t_us\":" + String(t_us);
    j += ",\"ax\":" + String(ax, 4);
    j += ",\"ay\":" + String(ay, 4);
    j += ",\"az\":" + String(az, 4);
    j += ",\"gx\":" + String(gx, 4);
    j += ",\"gy\":" + String(gy, 4);
    j += ",\"gz\":" + String(gz, 4);
    j += ",\"angle_deg\":" + String(angleZeroed, 3);
    j += "}";
    server.send(200, "application/json", j);
  });

  server.begin();

  // ★変更：起動時ゼロ合わせ（取り付け後に電源ON/ENがコツ）
  calibrateZero();

  nextSampleUs  = micros();
  lastFilterUs  = micros();
}

void loop() {
  server.handleClient();

  uint32_t nowUs = micros();
  if ((int32_t)(nowUs - nextSampleUs) < 0) return; // まだ
  nextSampleUs += SAMPLE_US;

  if (!isRunning) return; // 計測は止める（通信は生きてる）

  sensors_event_t a, g, temp, m;
  if (!icm.getEvent(&a, &g, &temp, &m)) return;

  // 最新値を更新
  t_us = nowUs;
  ax = a.acceleration.x;  ay = a.acceleration.y;  az = a.acceleration.z;
  gx = g.gyro.x;          gy = g.gyro.y;          gz = g.gyro.z;

  // dt（秒）
  float dt = (nowUs - lastFilterUs) * 1e-6f;
  if (dt <= 0) dt = 1.0f / SAMPLE_HZ;
  lastFilterUs = nowUs;

  // どの軸が振り子の回転か：まず gy を仮採用（合わなければ gx or gz に変更）
  float gyroRateDeg = gy * 180.0f / PI; // rad/s -> deg/s
  float angleGyro   = angleDeg + gyroRateDeg * dt;
  float angleAcc    = accelAngleDeg(ax, ay, az);

  angleDeg = ALPHA * angleGyro + (1.0f - ALPHA) * angleAcc;
}
