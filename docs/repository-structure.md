# リポジトリ構造定義書 (Repository Structure Document)

## プロジェクト構造

Next.js (App Router) の規約に従い、`app/` がUIレイヤーとAPIレイヤー（Route Handlers）を兼ねる。ビジネスロジックとデータアクセスは `lib/` 配下に分離し、`docs/architecture.md` のレイヤードアーキテクチャ（UI → API → サービス → データ）をディレクトリ構造として表現する。

```
project-root/
├── middleware.ts           # 匿名ID(anon_id)のhttpOnly Cookie発行(Edge Middleware)
├── app/                    # UIレイヤー(ページ) + APIレイヤー(Route Handlers)
│   ├── page.tsx            # S-01 トップ画面
│   ├── upload/              # S-02 画像投稿画面
│   ├── vote/
│   │   ├── swipe/           # S-03 スワイプ1次選考画面
│   │   └── final/           # S-04 決選投票画面
│   ├── admin/
│   │   ├── login/           # S-05 管理者ログイン画面
│   │   ├── page.tsx         # S-06 管理者ダッシュボード
│   │   └── results/         # S-07 結果発表画面
│   └── api/                 # APIレイヤー(Route Handlers)
│       ├── logos/
│       │   └── upload-url/  # 署名付きアップロードURL発行
│       ├── votes/
│       ├── phase/
│       └── admin/
│           └── results/
│               └── export/  # 結果ランキングのCSVエクスポート
├── components/             # 共通UIコンポーネント
├── lib/                    # サービスレイヤー・データレイヤー・共通ロジック
│   ├── errors.ts            # カスタムエラークラス(ValidationError等。全レイヤーから参照可)
│   ├── services/            # ビジネスロジック(PhaseService含む)
│   ├── repositories/        # Supabaseアクセス(データレイヤー)
│   ├── supabase/             # Supabaseクライアント初期化
│   ├── api/                   # Route Handlers専用の薄いヘルパー(認証チェック等)
│   ├── validators/           # zodスキーマ
│   ├── algorithms/           # shuffle等の純粋関数アルゴリズム
│   ├── client/                # クライアント専用ロジック(localStorage等。匿名IDはmiddleware.tsに一元化したためlib/client/には含まない)
│   └── types/                 # 型定義
├── tests/                  # テストコード
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/                   # プロジェクトドキュメント
├── scripts/                # Supabaseスキーマ定義・開発補助スクリプト
└── public/                 # 静的アセット
```

## ディレクトリ詳細

### app/ (UIレイヤー + APIレイヤー)

#### app/(参加者向けページ)

**役割**: `docs/ui-design.md` の画面一覧(S-01〜S-04)に対応するページを配置する

**配置ファイル**:
- `app/page.tsx`: S-01 トップ画面
- `app/upload/page.tsx`: S-02 画像投稿画面
- `app/vote/swipe/page.tsx`: S-03 スワイプ1次選考画面
- `app/vote/final/page.tsx`: S-04 決選投票画面
- `app/layout.tsx`: 全画面共通レイアウト
- `app/globals.css`: グローバルスタイル(Tailwindのベース)

**命名規則**:
- Next.js App Routerの規約に従い、ルートは`page.tsx`固定
- 画面固有のコンポーネントは同一ディレクトリ内に`_components/`を作成して配置してもよい

**依存関係**:
- 依存可能: `components/`, `lib/client/`, `lib/types/`（`fetch`によるAPIレイヤー呼び出し）
- 依存禁止: `lib/services/`, `lib/repositories/`（サービス・データレイヤーへの直接アクセス）

#### app/admin/ (運営向けページ)

**役割**: `docs/ui-design.md` のS-05〜S-07に対応するページを配置する

**配置ファイル**:
- `app/admin/login/page.tsx`: S-05 管理者ログイン画面
- `app/admin/page.tsx`: S-06 管理者ダッシュボード
- `app/admin/results/page.tsx`: S-07 結果発表画面

**命名規則**: 参加者向けページと同様

**依存関係**:
- 依存可能: `components/`, `lib/types/`
- 依存禁止: `lib/services/`, `lib/repositories/`

#### app/api/ (APIレイヤー)

**役割**: `docs/functional-design.md` のAPI設計に対応するRoute Handlersを配置する

**配置ファイル**:
- `app/api/logos/upload-url/route.ts`: `POST /api/logos/upload-url`
- `app/api/logos/route.ts`: `POST /api/logos`
- `app/api/logos/route.ts`: `GET /api/logos`
- `app/api/votes/route.ts`: `POST /api/votes`
- `app/api/phase/route.ts`: `GET /api/phase`
- `app/api/admin/login/route.ts`: `POST /api/admin/login`
- `app/api/admin/phase/route.ts`: `POST /api/admin/phase`
- `app/api/admin/results/route.ts`: `GET /api/admin/results`
- `app/api/admin/results/export/route.ts`: `GET /api/admin/results/export`

**命名規則**:
- Next.js App Routerの規約に従い、ファイル名は`route.ts`固定
- HTTPメソッドごとに`export async function GET/POST(...)`を実装する

**依存関係**:
- 依存可能: `lib/services/`, `lib/validators/`, `lib/api/`
- 依存禁止: `lib/repositories/`（サービスレイヤーを介さないデータアクセス）、`components/`

### lib/api/ (Route Handlers専用の薄いヘルパー)

**役割**: 複数の`app/api/**/route.ts`にまたがる横断的な処理のうち、`NextRequest`を直接扱うためサービスレイヤーには置けないものを配置する。ビジネスロジックは持たず、サービスレイヤーの呼び出しに徹する

**配置ファイル**:
- `requireAdminSession.ts`: Cookieから管理者トークンを取得し`AdminService.verifySession()`へ委譲する共通ヘルパー。`app/api/admin/**/route.ts`の3ハンドラ（phase / results / results/export）が個別に認証チェックを重複実装しないために使う

**命名規則**: camelCase、動詞で始める（`lib/algorithms/`と同様の関数ファイル規約）

**依存関係**:
- 依存可能: `lib/services/`
- 依存禁止: `lib/repositories/`, `components/`

### components/ (共通UIコンポーネント)

**役割**: `docs/ui-design.md` の共通コンポーネント一覧に対応するReactコンポーネントを配置する

**配置ファイル**:
- `Button.tsx`, `Input.tsx`, `Textarea.tsx`, `Toast.tsx`, `ProgressBar.tsx`, `Badge.tsx`, `ConfirmDialog.tsx`, `SwipeCard.tsx`, `SelectableGrid.tsx`, `QRCodeDisplay.tsx`（画面固有, S-06）, `RankingList.tsx`（画面固有, S-07）

**命名規則**:
- PascalCase（例: `SwipeCard.tsx`）
- 1コンポーネント1ファイル

**依存関係**:
- 依存可能: `lib/types/`
- 依存禁止: `lib/services/`, `lib/repositories/`, `app/api/`

### lib/services/ (サービスレイヤー)

**役割**: `docs/functional-design.md` のコンポーネント設計で定義したビジネスロジックを実装する

**配置ファイル**:
- `UploadService.ts`, `VoteService.ts`, `AdminService.ts`, `PhaseService.ts`
- `container.ts`: 各サービスとRepositoryを組み立てて返すDIファクトリ（`app/api/`から利用し、Route Handlerを薄く保つ）

**命名規則**: PascalCase + `Service`接尾辞（`container.ts`のみ例外）

**依存関係**:
- 依存可能: `lib/repositories/`, `lib/algorithms/`, `lib/types/`
- 依存禁止: `app/`, `components/`（UI/APIレイヤーへの依存）

**例**:
```
lib/services/
├── UploadService.ts
├── VoteService.ts
├── AdminService.ts
└── PhaseService.ts
```

### lib/repositories/ (データレイヤー)

**役割**: Supabase Database/Storageへのアクセスをカプセル化する。`LogoRepository`は画像アップロード用の署名付きURL発行・Storageオブジェクト削除も担い、`UploadService`を含むサービスレイヤーがSupabaseクライアントへ直接アクセスしないようにする

**配置ファイル**:
- `LogoRepository.ts`, `VoteRepository.ts`, `AppSettingsRepository.ts`

**命名規則**: PascalCase + `Repository`接尾辞

**依存関係**:
- 依存可能: `lib/supabase/`, `lib/types/`
- 依存禁止: `lib/services/`, `app/`, `components/`

### lib/supabase/ (Supabaseクライアント初期化)

**役割**: `@supabase/supabase-js`クライアントの初期化と環境変数読み込みを一元化する

**配置ファイル**:
- `client.ts`: `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を用いたクライアント生成（Route Handlersから利用）

本プロジェクトはSupabase Authを使用せず全参加者が匿名であるため、`auth.uid()`を前提としたRLSポリシーが組めない。そのため、DatabaseテーブルとStorageバケットのRLSは全面deny-allとし、Service Role Keyを持つサーバー（Route Handlers経由の`lib/repositories/`）からのみ書き込み・署名付きURL発行を許可する設計とする。クライアントから直接Supabaseへアクセスする経路は存在しない。

**依存関係**:
- 依存可能: なし（環境変数のみ）
- 依存禁止: `lib/services/`, `lib/repositories/`より上位への依存

### lib/validators/ (入力検証)

**役割**: `zod`によるAPIリクエストのスキーマ定義

**配置ファイル**:
- `uploadSchema.ts`, `voteSchema.ts`, `adminSchema.ts`

**命名規則**: camelCase + `Schema`接尾辞

**依存関係**:
- 依存可能: `lib/types/`
- 依存禁止: `lib/services/`, `lib/repositories/`

### lib/algorithms/ (純粋関数アルゴリズム)

**役割**: `docs/functional-design.md` のアルゴリズム設計に対応する副作用のない関数を配置する

**配置ファイル**:
- `shuffle.ts`: Fisher-Yatesシャッフル
- `rankWithTieDetection.ts`: 同数得票のランオフ判定

**命名規則**: camelCase、動詞で始める

**依存関係**:
- 依存可能: `lib/types/`
- 依存禁止: それ以外すべて（純粋関数として独立させる）

### lib/client/ (クライアント専用ロジック)

**役割**: ブラウザの`localStorage`のみで完結するロジックを配置する（サーバーには送信しない）。匿名ID(`anon_id`)はサーバー側の`middleware.ts`がhttpOnly Cookieとして一元的に発行・管理するため、ここには含めない

**配置ファイル**:
- `SwipeSessionManager.ts`: 1次選考のキープ状態管理

**命名規則**: PascalCase + `Manager`接尾辞

**依存関係**:
- 依存可能: `lib/types/`, `lib/algorithms/`(シャッフル処理の利用)
- 依存禁止: `lib/repositories/`, `app/api/`

**例**:
```
lib/client/
└── SwipeSessionManager.ts
```

### lib/types/ (型定義)

**役割**: `docs/functional-design.md` のデータモデル定義(`Logo` / `Vote` / `AppSettings`等)をTypeScriptの型として配置する

**配置ファイル**:
- `Logo.ts`, `Vote.ts`, `AppSettings.ts`, `RankedLogo.ts`（結果発表のランキング表示用。`Logo`を拡張し`voteCount`/`rank`/`isTiedForRunoff`を追加）

**命名規則**: PascalCase（エンティティ名と一致させる）

**依存関係**:
- 依存可能: なし
- 依存禁止: すべて（型定義のみを持ち、他モジュールに依存しない）

### lib/errors.ts (共通エラークラス)

**役割**: `docs/development-guidelines.md`・`docs/glossary.md`で定義するカスタムエラークラス（`ValidationError` / `PhaseMismatchError` / `DuplicateVoteError` / `UnauthorizedError`）を配置する単一ファイル

**命名規則**: PascalCase + `Error`接尾辞のクラスをファイル内にまとめて定義する

**依存関係**:
- 依存可能: なし
- 依存禁止: `lib/types/`以外のすべて（全レイヤーから参照される共通基盤のため、他モジュールには依存しない）
- 参照可能元: `app/api/`, `lib/services/`, `lib/repositories/` のいずれからも参照してよい

### tests/ (テストディレクトリ)

#### unit/

**役割**: `lib/algorithms/`, `lib/services/`, `lib/validators/` のユニットテストを配置する

**構造**:
```
tests/unit/
└── lib/                     # libディレクトリと同じ構造
    ├── algorithms/
    │   └── shuffle.test.ts
    └── services/
        └── VoteService.test.ts
```

**命名規則**:
- パターン: `[テスト対象ファイル名].test.ts`
- 例: `VoteService.ts` → `VoteService.test.ts`

#### integration/

**役割**: `app/api/` のRoute Handlersに対する統合テストを配置する

**構造**:
```
tests/integration/
└── api/                     # 機能単位でディレクトリ分割
    ├── logos.test.ts
    ├── votes.test.ts
    └── admin.test.ts
```

#### e2e/

**役割**: Playwrightによるユーザーシナリオ単位のE2Eテストを配置する

**構造**:
```
tests/e2e/
└── event-flow/              # ユーザーシナリオ単位
    └── submission-to-results.spec.ts
```

### docs/ (ドキュメントディレクトリ)

**配置ドキュメント**:
- `product-requirements.md`: プロダクト要求定義書
- `functional-design.md`: 機能設計書
- `ui-design.md`: 画面設計書
- `architecture.md`: アーキテクチャ設計書
- `repository-structure.md`: リポジトリ構造定義書(本ドキュメント)
- `development-guidelines.md`: 開発ガイドライン
- `glossary.md`: 用語集
- `ideas/`: 壁打ち・初期アイデアメモ

### scripts/ (スクリプトディレクトリ)

**配置ファイル**:
- Supabaseの`logos` / `votes` / `vote_locks` / `app_settings`テーブル作成用SQL
- 開発補助スクリプト（例: ローカル環境でのシード投入）

**例**:
```
scripts/
├── schema.sql              # テーブル作成用SQL
└── seed.ts                 # 開発用ダミーデータ投入
```

### public/ (静的アセット)

**役割**: ファビコン、OGP画像など、Next.jsが配信する静的ファイルを配置する

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| ページ(UIレイヤー) | `app/**/page.tsx` | Next.js規約(`page.tsx`固定) | `app/upload/page.tsx` |
| APIエンドポイント | `app/api/**/route.ts` | Next.js規約(`route.ts`固定) | `app/api/votes/route.ts` |
| 共通UIコンポーネント | `components/` | PascalCase | `SwipeCard.tsx` |
| サービスクラス | `lib/services/` | PascalCase + `Service` | `VoteService.ts` |
| リポジトリクラス | `lib/repositories/` | PascalCase + `Repository` | `VoteRepository.ts` |
| バリデーションスキーマ | `lib/validators/` | camelCase + `Schema` | `voteSchema.ts` |
| アルゴリズム関数 | `lib/algorithms/` | camelCase、動詞始まり | `shuffle.ts` |
| クライアント専用ロジック | `lib/client/` | PascalCase + `Manager` | `SwipeSessionManager.ts` |
| Edge Middleware | プロジェクトルート | Next.js規約(`middleware.ts`固定) | `middleware.ts` |
| 型定義 | `lib/types/` | PascalCase | `Logo.ts` |

### テストファイル

| テスト種別 | 配置先 | 命名規則 | 例 |
|-----------|--------|---------|-----|
| ユニットテスト | `tests/unit/` | `[対象].test.ts` | `VoteService.test.ts` |
| 統合テスト | `tests/integration/` | `[機能].test.ts` | `votes.test.ts` |
| E2Eテスト | `tests/e2e/` | `[シナリオ].spec.ts` | `submission-to-results.spec.ts` |

### 設定ファイル

| ファイル種別 | 配置先 | 命名規則 |
|------------|--------|---------|
| Next.js設定 | プロジェクトルート | `next.config.ts` |
| Tailwind設定 | プロジェクトルート | `tailwind.config.ts` |
| TypeScript設定 | プロジェクトルート | `tsconfig.json` |
| ESLint/Prettier設定 | プロジェクトルート | `eslint.config.js` / `.prettierrc` |
| テスト設定 | プロジェクトルート | `vitest.config.ts` / `playwright.config.ts` |
| 環境変数 | プロジェクトルート | `.env.local`(Git管理外) |

> 独立した`config/`ディレクトリは設けない。Next.js/Tailwind/ESLint等のツールはプロジェクトルート直下の設定ファイル配置がエコシステムの標準であるため、それに従う。

## 命名規則

### ディレクトリ名

- **レイヤーディレクトリ**: 複数形、kebab-case（例: `services/`, `repositories/`）
- **画面ディレクトリ(app/配下)**: Next.jsのルーティングに従い、URLパスと一致させる（例: `vote/swipe/`, `admin/results/`）

### ファイル名

- **ページファイル**: Next.js規約により`page.tsx`固定
- **APIファイル**: Next.js規約により`route.ts`固定
- **クラスファイル(Service/Repository/Manager)**: PascalCase
- **関数ファイル(algorithms/validators)**: camelCase
- **型定義ファイル**: PascalCase（エンティティ名と一致）

### テストファイル名

- パターン: `[テスト対象].test.ts`(unit/integration) または `[シナリオ].spec.ts`(e2e)

## 依存関係のルール

### レイヤー間の依存

```
app/(ページ)          → components/, lib/client/, lib/types/ (fetch経由でapp/api/を呼ぶ)
app/api/(Route Handlers) → lib/services/, lib/validators/
lib/services/          → lib/repositories/, lib/algorithms/, lib/types/
lib/repositories/      → lib/supabase/, lib/types/
```

**禁止される依存**:
- `lib/repositories/` → `lib/services/` (❌)
- `lib/services/` → `app/` (❌)
- `app/`(ページ) → `lib/services/` / `lib/repositories/` を直接呼ぶ (❌ 必ず`app/api/`を経由する)

### モジュール間の依存

- `lib/services/`間での循環依存を避けるため、複数サービスから共通利用するロジックは`lib/algorithms/`または`lib/types/`に抽出する
- `lib/client/`（`SwipeSessionManager`）はサーバー側のいかなるモジュールからも参照されない（ブラウザ専用）
- `middleware.ts`はプロジェクトルートに配置し、`lib/`配下のいずれのモジュールからも参照されない（Next.jsのEdge Runtimeで独立して動作する）

## スケーリング戦略

### 機能の追加

- **小規模機能**: 既存の`lib/services/`, `app/api/`に追記
- **中規模機能**（例: 副賞カテゴリ機能を追加する場合）: `lib/services/awards/`のようにサブディレクトリを作成
- **大規模機能**（例: 別イベント向けの再利用を本格化する場合）: マルチテナント化を見据えた`lib/services/events/`等への再構成を検討（現時点ではスコープ外）

### ファイルサイズの管理

- 1ファイル300行以下を推奨。特に`app/api/admin/results/route.ts`のような集計処理は、300行を超える場合`lib/services/AdminService.ts`側にロジックを移し、Route Handler側は薄く保つ

## 特殊ディレクトリ

### .steering/ (ステアリングファイル)

**役割**: 特定の開発作業における「今回何をするか」を定義

**構造**:
```
.steering/
└── [YYYYMMDD]-[task-name]/
    ├── requirements.md
    ├── design.md
    └── tasklist.md
```

**命名規則**: `20260717-add-image-upload` 形式

### .claude/ (Claude Code設定)

**役割**: Claude Code設定とカスタマイズ

**構造**:
```
.claude/
├── commands/
├── skills/
└── agents/
```

## 除外設定

### .gitignore

- `node_modules/`
- `.next/`
- `.env` / `.env.local`
- `.steering/`（タスク管理用の一時ファイル）
- `*.log`
- `.DS_Store`
- `coverage/`

### .prettierignore, .eslintignore

- `.next/`
- `node_modules/`
- `.steering/`
- `coverage/`
