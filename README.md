# ひもロボット実験プロジェクト

## 概要
スマホの傾きセンサー値を WebSocket 経由で PC と ESP32 に送信し、
ログ保存やサーボ／SMA の制御につなげる実験プロジェクトです。

- スマホ → PC → CSV ログ保存 ✅
- スマホ → ESP32 → 受信成功 ✅
- 次のステップ: サーボ制御, SMA駆動, ログ可視化

## ディレクトリ構成
- `docs/` : 実験ログや説明
- `server/` : PC側のWebSocketロガーと送信用ページ
- `esp32/` : ESP32用スケッチ
- `logs/` : 実験で生成されるCSVファイル（git管理対象外）

## 進め方
1. PCで `server.js` を起動
2. PCで `http-server` を起動し、スマホから `index_sensor.html` にアクセス
3. ESP32をWi-Fiに接続し、宛先Bを `ws://<ESP32_IP>:81` に設定
4. サーボやSMAを接続して制御テスト
