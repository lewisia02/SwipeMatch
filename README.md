# spec-driven-dev-template

AIアシスタント(Claude Codeなど)と協働する「スペック駆動開発」の仕組みを備えたプロジェクトテンプレートです。「何を作るか」を永続ドキュメント(`docs/`)で定義し、「今回何をするか」を作業単位(`.steering/`)で計画してから実装する、というワークフローをスキル・コマンド・サブエージェントとして組み込んでいます。

## 使い方

GitHubの「Use this template」からこのリポジトリを元に新しいリポジトリを作成してください。

## 全体像

```
.claude/
├── skills/        # 各ドキュメント作成・作業管理の専門知識(8種)
├── commands/      # 定型ワークフロー(/setup-project, /add-feature, /review-docs, /next)
├── agents/        # レビュー・検証を行うサブエージェント(3種)
└── settings.json  # 共有設定(スキル/コマンドの実行許可、横断チェックのリマインドhook)

CLAUDE.md          # プロジェクトの基本ルール(AIが最初に読む)
docs/              # 永続ドキュメント(プロジェクトの「北極星」)
├── ideas/         # 壁打ち・アイデアの下書き
├── product-requirements.md   # PRD
├── functional-design.md      # 機能設計書
├── ui-design.md              # 画面設計書(Web/GUIの場合)
├── architecture.md           # アーキテクチャ設計書
├── repository-structure.md   # リポジトリ構造定義書
├── development-guidelines.md # 開発ガイドライン
└── glossary.md               # 用語集
.devcontainer/     # Python(uv) + Node.js の開発コンテナ定義
scripts/           # 環境確認・依存関係セットアップスクリプト(Windows/Linux/macOS)
```

`.steering/`(作業単位のドキュメント)は作業ごとに新規作成され、`.gitignore`でGit管理対象外にしています。

## 3つの構成要素

- **スキル(skills)**: ドキュメント作成や作業管理の専門知識。AIが状況に応じて自動的に読み込みます。
  - 設計系7種: `prd-writing` / `functional-design` / `ui-design` / `architecture-design` / `repository-structure` / `development-guidelines` / `glossary-creation`
  - 作業管理2種: `steering`(作業計画・実装・振り返りを一元管理) / `consistency-check`(ドキュメント間の横断整合性チェック)
- **コマンド(commands)**: よく使う定型ワークフロー。`/` で起動します。
- **サブエージェント(agents)**: 独立したコンテキストで詳細な分析を行う専門役。
  - `doc-reviewer`(ドキュメントレビュー) / `implementation-validator`(実装検証) / `ui-reviewer`(UI検証)

## 開発の始め方

### 1. リポジトリのクローンと環境準備

```bash
git clone [新しく作成したリポジトリ]
cd [リポジトリ名]
```

Dev Containerを使う場合、VS Codeで「Reopen in Container」を選択すると `.devcontainer/devcontainer.json` に基づき自動的に環境構築されます。使わない場合は、以下のスクリプトで必要なツール(uv / Node.js)の有無を確認してください。

```bash
# Windows(ローカル)
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

# Linux / macOS / Dev Container
bash scripts/setup.sh
```

### 2. 永続ドキュメントの作成(初回セットアップ)

1. アイデアを `docs/ideas/` にまとめる(壁打ちの成果物など、自由形式)
2. `/setup-project` を実行し、7つの永続ドキュメントを対話的に作成する

```text
> /setup-project
```

### 3. 機能の追加

```text
> /add-feature ユーザープロフィール編集
```

`.steering/` にステアリングファイルを生成し、実装 → 検証(`implementation-validator`)→ テスト → 振り返りまでを自動で進めます。

### 4. 日常的な使い方

スペック駆動開発の詳細を意識する必要はありません。普通に会話で依頼すれば、AIが適切なスキルを判断して読み込みます。

```text
# ドキュメントの編集
> PRDに新機能を追加してください
> architecture.mdのパフォーマンス要件を見直して

# 詳細レビュー
> /review-docs docs/architecture.md

# 次に何をすべきか迷ったとき
> /next

# 複数ドキュメントにまたがる仕様変更をした後の横断チェック
> /check-consistency
```

## コマンド一覧

| コマンド | 説明 |
| --- | --- |
| `/setup-project` | 初回セットアップ。7つの永続ドキュメントを対話的に作成 |
| `/add-feature [機能名]` | 新機能を計画・実装・検証まで自動で実行 |
| `/review-docs [パス]` | 指定ドキュメントをサブエージェントで詳細レビュー |
| `/check-consistency` | docs配下のドキュメント間の横断整合性チェック |
| `/next` | 進捗を診断し、次に取るべきアクションを提案 |

## CLAUDE.mdについて

`CLAUDE.md` はこのテンプレートの基本ルールを定義したファイルです。技術スタック(2章)は現時点でのデフォルト値(Python 3.12 + uv、Node.js 24 + npm)なので、プロジェクトに合わせて書き換えてください。技術スタックやカスタムコマンド・スキル構成を変更した場合は、7章の更新ルールに従ってCLAUDE.md自体も更新してください。
