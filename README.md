# SwipeMatch

社内AIイベント「ロゴ作成大会」向けの、ロゴ投票アプリです。認証機構を持たず、URLベースで手早く展開できる社内イベント用のワンショットなシステムとして開発しています。

## コンセプト

- **スワイプで迷わない1次選考**: 100〜200枚規模の作品でも、Tinder風スワイプUIで直感的にサクサク選べ、表示順による有利不利をなくす
- **心理的ハードルを下げる投票体験**: 「Dislike」ではなく「キープして温存する」という前向きな操作に置き換え、同僚の作品を無下に扱う罪悪感を解消する
- **認証なしで手早く回せる運営**: 複雑な認証機構を持たずに運用できる

詳細な背景・KPIは [`docs/product-requirements.md`](docs/product-requirements.md) を参照してください。

## 画面構成

| ID | 画面 | 概要 | 状態 |
| --- | --- | --- | --- |
| S-01 | トップ画面 | イベント概要と投稿/投票への導線 | ✅ 実装済み |
| S-02 | 画像投稿画面 | ロゴ画像・投稿者名・一口メモを投稿 | ✅ 実装済み |
| S-03 | スワイプ1次選考画面 | 画像をランダム順に表示し、キープ／次へで仕分け | ✅ 実装済み |
| S-04 | 決選投票画面 | キープした画像から上位3つまで選んで投票 | ✅ 実装済み |
| S-05 | 管理者ログイン画面 | 運営が管理者機能にアクセスするための認証 | 未実装 |
| S-06 | 管理者ダッシュボード | フェーズ切り替え、QRコード表示など運営操作 | 未実装 |
| S-07 | 結果発表画面 | 得票ランキングと投稿者名を表示 | 未実装 |

画面遷移・ワイヤーフレームの詳細は [`docs/ui-design.md`](docs/ui-design.md) を参照してください。

## 技術スタック

| 分類 | 技術 |
| --- | --- |
| フレームワーク | Next.js (App Router) |
| 言語 | TypeScript 5.x |
| スタイリング | Tailwind CSS |
| スワイプUI | framer-motion |
| バックエンド/DB | Supabase (Database) |
| ストレージ | Supabase Storage |
| テスト | Vitest（ユニット/統合）、Playwright（E2E） |
| Lint/Format | ESLint、Prettier |

詳細は [`docs/architecture.md`](docs/architecture.md) を参照してください。

## セットアップ

### 1. 環境準備

Dev Containerを使う場合、VS Codeで「Reopen in Container」を選択すると `.devcontainer/devcontainer.json` に基づき自動的に環境構築されます。使わない場合は、以下のスクリプトでNode.js(24.x)の有無を確認してください。

```bash
# Windows(ローカル)
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

# Linux / macOS / Dev Container
bash scripts/setup.sh
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example` を `.env.local` にコピーし、Supabaseプロジェクトの情報を設定してください。

```bash
cp .env.example .env.local
```

| 変数名 | 用途 |
| --- | --- |
| `SUPABASE_URL` | SupabaseプロジェクトのURL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key（本アプリはSupabase Authを使わない匿名構成のため、サーバー側のみがService Role Keyで読み書きする） |
| `ADMIN_PASSWORD` | 管理者画面のログインパスワード |
| `ADMIN_SESSION_SECRET` | 管理者セッション(JWT)の署名用シークレット |

### 4. データベーススキーマの適用

Supabaseプロジェクトの SQL Editor で [`scripts/schema.sql`](scripts/schema.sql) を実行し、`logos` / `votes` / `vote_locks` / `app_settings` テーブルを作成してください（RLSは全面deny-allで、サーバーのみService Role Keyで読み書きします）。

### 5. 開発サーバーの起動

```bash
npm run dev
```

## 開発コマンド

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番ビルド |
| `npm test` | Vitestによるユニット/統合テストを実行 |
| `npm run lint` | ESLintによる静的解析 |
| `npm run typecheck` | TypeScriptの型チェック |
| `npm run format` | Prettierによるフォーマット |

## ドキュメント

このプロジェクトは「スペック駆動開発」のワークフローに従っています。「何を作るか」を定義する永続ドキュメントは `docs/` 配下にあります。

```
docs/
├── product-requirements.md   # プロダクト要求定義書(PRD)
├── functional-design.md      # 機能設計書
├── ui-design.md              # 画面設計書
├── architecture.md           # アーキテクチャ設計書
├── repository-structure.md   # リポジトリ構造定義書
├── development-guidelines.md # 開発ガイドライン
└── glossary.md                # 用語集
```

開発の基本ルールは [`CLAUDE.md`](CLAUDE.md) を参照してください。
