# rope-robot
ひもロボット開発記 / Rope robot development log

スマホの傾きやカメラから得た入力を **WebSocket** 経由で PC / ESP32 に送り、  
**CSVログ保存** や **サーボ／SMA 制御** に接続する実験プロジェクト。

---

## 🔗 公開リンク（GitHub Pages）
- ホーム: https://utakik.github.io/rope-robot/
- Swing Robot（ブランコ実験）: https://utakik.github.io/rope-robot/swing_robot/
- Triple Rope Robot（3連ひも）: https://utakik.github.io/rope-robot/triple_rope_robot/
- Common（共通コード／手順）: https://utakik.github.io/rope-robot/common/

> ※ Pages 未設定なら、Settings → Pages → “Deploy from a branch / main / root” を有効化してください。

---

## 📦 プロジェクト一覧
- `swing_robot/` — ブランコロボット実験と記録 / *Swing robot experiments*
- `triple_rope_robot/` — 3連ひもロボット実験と記録 / *Triple rope robot experiments*
- `common/` — 共通コード・手順（PCロガー、ESP32基本スケッチなど）

---

## ✅ 現状
- ✅ スマホ → PC → **CSV ログ保存** 成功  
- ✅ **ESP32でWebSocket受信** 成功  
- ⏳ ESP32 → **サーボ制御の最小ループ** 実装中  
- 📝 **SMA駆動** と **ログ可視化** は今後の課題

---

## 🗓 進捗ログ
- 2025-09-20: README更新、ブランコロボット・3連ひもロボットの項目を追加  
- 2025-09-15: ESP32でWebSocket受信に成功  
- 2025-09-10: スマホ → PC ログ保存が安定動作

---

## 🗂 ディレクトリ構成
