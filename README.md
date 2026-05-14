# tacojiman（タコジマン）

朝の蛸島駅で繰り広げられる3分間の忍術バトルゲーム

## 🎮 ゲーム概要

毎朝迎えに来る幼馴染のタコ型ロボット軍団から家を守る、タップ操作のみのアクションゲーム。
蜂の忍術使いの末裔であるプレイヤーが、布団の中から敵を迎撃します。

### 特徴

- **ワンタップ操作**: 画面タップのみのシンプル操作
- **3分間勝負**: 電車の駅間で楽しめる短時間プレイ
- **戦略的ズームシステム**: ズームイン・アウトによる戦略的ゲームプレイ
- **SFC風ドット絵**: 懐かしいドット絵と現代的な色彩理論の融合

## 🎯 プロジェクトの目的

- フラッピーバード級のシンプルで中毒性のあるゲームプレイ
- 蛸島の魅力を世界に発信
- 能登半島支援（利益の50%を寄付）

## 🚀 技術スタック

- **描画エンジン**: PixiJS v8 (TypeScript)
- **ビルド**: Vite v8
- **テスト**: Vitest v4
- **アセット**: 開発中は `PIXI.Graphics`、最終版は SFC風ドット絵（WebP形式）
- **プラットフォーム**: Web（itch.io + Steam）

## 📁 プロジェクト構造

```
tacojiman/
├── src/
│   ├── constants/    # 色・表示定数
│   ├── game/         # PixiJS非依存のゲームロジック
│   ├── scenes/       # PixiJS Container ベースのシーン
│   └── types/        # GameState などのシリアライズ可能な型
├── legacy/
│   └── phaser-src/   # PixiJS移植前の Phaser 実装（参照用）
├── assets/           # ゲームアセット
├── .claude/          # Claude Code設定
├── CLAUDE.md         # 詳細仕様書
└── README.md         # このファイル
```

## 🔧 開発・ビルド

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# テスト実行
npm test

# 型・lint・format確認
npm run typecheck
npm run lint
npm run format:check
```

## 🧱 PixiJS移植方針

`GameState` はプレーンなオブジェクトとして定義し、`GameScene.initWithState(state)` で任意局面から起動できる構成にしています。これにより、今後の敵AI・ボム忍術・カメラ・UI実装でも「状態生成 → PixiJS描画」の流れを保ち、デバッグとテストを容易にします。

## 📖 詳細仕様

詳細なゲーム仕様については [CLAUDE.md](./CLAUDE.md) を参照してください。

## 🌟 社会貢献

このゲームの利益の50%は能登半島の復興支援に寄付されます。
ゲームを楽しみながら、地域復興にも貢献できます。

## 📞 連絡先

- プロジェクト: [GitHub Repository]
- 配布: [itch.io] | [Steam]

---

**All Your Wake Are Belong To Us!** 🌅
