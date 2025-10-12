# rope-robot
ひもロボット開発記 / Rope robot development log

スマホの傾きやカメラから得た入力を WebSocket 経由で PC / ESP32 に送り、  
CSVログ保存 や サーボ／SMA 制御 に接続する実験プロジェクト。

---

## 🔗 公開リンク（GitHub Pages）

- ホーム: https://utakik.github.io/rope-robot/  
- Swing Robot（ブランコ実験）: https://utakik.github.io/rope-robot/swing_robot/  
- Triple Rope Robot（3連ひも）: https://utakik.github.io/rope-robot/triple_rope_robot/  
- Camera Input（カメラ入力テスト）: https://utakik.github.io/rope-robot/triple_rope_robot/cam.html  
　スマホやPCのカメラ映像を取得するためのテストページ。  
　今後、画像解析や動作検知をロープ制御に組み込む予定。  
- Common（共通コード／手順）: https://utakik.github.io/rope-robot/common/  

※ Pages 未設定の場合は、  
Settings → Pages → “Deploy from a branch / main / root” を有効化してください。

---

## 📦 プロジェクト構成

| ディレクトリ | 内容 |
|---------------|------|
| `swing_robot/` | ブランコロボット実験と記録 / Swing robot experiments |
| `triple_rope_robot/` | 3連ひもロボット実験と記録 / Triple rope robot experiments |
| `common/` | 共通コード・手順（PCロガー、ESP32基本スケッチなど） |

---

## ✅ 現状ステータス

- ✅ スマホ → PC → CSV ログ保存 成功  
- ✅ ESP32でWebSocket受信 成功  
- ⏳ ESP32 → サーボ
