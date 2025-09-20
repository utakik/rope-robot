# rope-robot
ひもロボット開発記 / Rope robot development log  

スマホの傾きセンサー値を WebSocket 経由で PC と ESP32 に送り、  
ログ保存やサーボ／SMA 制御につなげる実験プロジェクトです。  

---

## プロジェクト一覧
- **swing_robot**  
  ブランコロボット実験と記録 / Swing robot experiments  

- **triple_rope_robot**  
  3連ひもロボット実験と記録 / Triple rope robot experiments  

- **common**  
  共通コード・手順（PCロガー、ESP32基本スケッチなど）  

---

## 現状
- ✅ スマホ → PC → CSV ログ保存成功  
- ✅ ESP32でWebSocket受信成功  
- ⏳ ESP32 → サーボ制御の最小ループを実装中  
- 📝 SMA駆動とログ可視化は今後の課題  

---

## 進捗ログ
- **2025-09-20**: README更新、ブランコロボット・3連ひもロボットの項目を追加  
- **2025-09-15**: ESP32でWebSocket受信に成功  
- **2025-09-10**: スマホ → PC ログ保存が安定動作  

---

## ディレクトリ構成
