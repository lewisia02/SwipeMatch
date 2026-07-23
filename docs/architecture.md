# 技術仕様書 (Architecture Design Document)

## テクノロジースタック

### 言語・ランタイム

| 技術 | バージョン |
|------|-----------|
| Node.js | 24.x |
| TypeScript | 5.x |
| npm | 同梱バージョン（Node.js 24.x標準） |

### フレームワーク・ライブラリ

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Next.js (App Router) | ^15.x | フロントエンド＋API(Route Handlers)の一体開発 | フロントとバックエンドを1リポジトリ・1デプロイで完結でき、社内イベント用の短期開発に最適。Vercelとの親和性も高い |
| React | ^19.x | UIコンポーネント構築 | Next.js 15の標準ランタイム |
| Tailwind CSS | ^3.x | スタイリング | ユーティリティクラスで短期間にモバイル最適なUIを組み立てられる |
| `react-tinder-card` | ^1.x | スワイプ式1次選考のカードUI | Tinder風スワイプ操作を低コストで実装できる |
| `framer-motion` | ^11.x | スワイプ時・結果発表時のアニメーション・演出 | キープ／次への操作フィードバックと、結果発表のランキングスライドイン・得票数カウントアップ（いずれもPRD記載の演出要件）を、追加ライブラリを増やさず滑らかに実装できる |
| `@supabase/supabase-js` | ^2.x | Supabase Database/Storageクライアント | Supabaseの公式SDKで、Database操作とStorageアップロードを統一的に扱える |
| `zod` | ^3.x | APIリクエストの入力検証 | TypeScriptの型と連動したスキーマ検証により、Route Handlersの入力バリデーションを簡潔に記述できる |
| `jose` | ^5.x | 管理者セッション用JWTの署名・検証 | 軽量な認証機構（本格的な認証基盤を持たない方針に合致）をhttpOnly Cookieで実現できる |
| `qrcode.react` | ^3.x | QRコード表示 | 管理者ダッシュボードでのアプリURL QRコード生成に使用 |
| `heic2any` | ^0.x | HEIC画像のクライアント側変換 | iOS端末で撮影されたHEIC画像を、アップロード前にブラウザ上でJPEGへ変換し、ブラウザ非対応リスクを回避する |

### 開発ツール

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| ESLint | ^9.x | 静的解析・コード品質チェック | Next.js公式のESLint設定(`eslint-config-next`)と統合しやすい |
| Prettier | ^3.x | コードフォーマット | ESLintと分離してフォーマットの一貫性を保つ、チーム標準として広く使われている |
| Vitest | ^2.x | ユニットテスト・統合テスト | Viteベースで高速に実行でき、TypeScript/ESMとの親和性が高い |
| Playwright | ^1.x | E2Eテスト | 実ブラウザ（モバイルビューポート含む）でのスワイプ・投票フローの検証に対応 |

## アーキテクチャパターン

### レイヤードアーキテクチャ

```
┌─────────────────────────┐
│   UIレイヤー             │ ← app/ 配下のPage/Client Components
├─────────────────────────┤
│   APIレイヤー            │ ← app/api/**/route.ts (Route Handlers)
├─────────────────────────┤
│   サービスレイヤー        │ ← lib/services/* (ビジネスロジック)
├─────────────────────────┤
│   データレイヤー          │ ← lib/repositories/* (Supabaseアクセス)
└─────────────────────────┘
```

#### UIレイヤー
- **責務**: ユーザー入力の受付、フォーム/スワイプ操作のバリデーション、結果の表示
- **許可される操作**: APIレイヤー（`fetch`によるRoute Handlers呼び出し）の利用
- **禁止される操作**: サービスレイヤー・データレイヤー（Supabaseクライアント）への直接アクセス
- 例外: 1次選考のキープ状態（`SwipeSessionManager`）はサーバーを介さずクライアントの`localStorage`のみで完結するため、UIレイヤー内で完結してよい
- **ルーティング**: 参加者向け画面は`app/c/[slug]/...`配下に配置し、`layout.tsx`（Server Component）でslugからコンペを解決してから配下のClient Componentsへ委譲する。管理者向け画面は`app/admin/...`配下（コンペ横断の一覧・開催は`app/admin/`直下、個別コンペの操作は`app/admin/competitions/[id]/...`）に配置する。詳細なディレクトリ構成は`docs/repository-structure.md`を正とする

#### APIレイヤー
- **責務**: HTTPリクエストの受付、`zod`による入力検証、フェーズ・認証状態のチェック、サービスレイヤーの呼び出し、レスポンス整形
- **許可される操作**: サービスレイヤーの呼び出し
- **禁止される操作**: データレイヤー（Supabaseクライアント）への直接アクセス、ビジネスロジックの実装
- **補足**: 匿名ID(`anon_id`)の発行のみはRoute Handlersより手前の`middleware.ts`（Next.js Edge Middleware）が担う。全リクエストに対しCookieの有無を確認し、なければ発行する

#### サービスレイヤー
- **責務**: ビジネスロジックの実装（`CompetitionService` / `UploadService` / `VoteService` / `AdminService` / `PhaseService`。詳細は`docs/functional-design.md`のコンポーネント設計を参照）
- **許可される操作**: データレイヤーの呼び出し
- **禁止される操作**: UIレイヤー・APIレイヤーへの依存（Requestオブジェクト等を受け取らない）
- **補足**: `PhaseService`/`UploadService`/`VoteService`/`AdminService`は特定のコンペに紐付かないステートレスな設計とし、各メソッドの引数として`competitionId`を受け取る（コンストラクタでコンペを固定しない）

#### データレイヤー
- **責務**: Supabase Database/Storageへのデータ永続化・取得（`CompetitionRepository` / `LogoRepository` / `VoteRepository`）
- **許可される操作**: `@supabase/supabase-js`を通じたDatabase/Storageアクセス
- **禁止される操作**: ビジネスロジックの実装（集計・バリデーション等はサービスレイヤーの責務）
- **補足**: 旧`AppSettingsRepository`は`CompetitionRepository`に統合され廃止する

## データ永続化戦略

### ストレージ方式

| データ種別 | ストレージ | フォーマット | 理由 |
|-----------|----------|-------------|------|
| コンペ（`competitions`テーブル） | Supabase Database (PostgreSQL) | リレーショナルテーブル | `status='active'`の部分ユニークインデックスにより「常に1件のみ開催中」というアプリ全体の不変条件をDB制約でも保証できる。旧`app_settings`（シングルトン）のフェーズ管理はこのテーブルの`current_phase`列に統合する |
| ロゴ投稿データ（`logos`テーブル） | Supabase Database (PostgreSQL) | リレーショナルテーブル、`competition_id` FK | 得票数集計・ランキング表示にSQLの集計クエリが利用でき、Storageと同一プラットフォームで完結する。`competition_id`でのフィルタにインデックスを張り、コンペ数が増えても一覧取得の速度を維持する |
| 投票データ（`votes`テーブル） | Supabase Database (PostgreSQL) | リレーショナルテーブル、`competition_id` FK | `logo_id`との結合、`competition_id`＋`voter_anon_id`単位での件数集計が容易 |
| 投票済み予約（`vote_locks`テーブル） | Supabase Database (PostgreSQL) | `(competition_id, voter_anon_id, round)`を複合PRIMARY KEYとするテーブル | 同一コンペ・同一anonId・同一ラウンドからの同時投票リクエストを一意制約で排他制御し、多重投票のTOCTOUレース条件を防ぐ。複合キー化により、多重投票防止の判定単位がコンペ×ラウンド単位になる（ランオフ機能導入により`round`を追加。`docs/functional-design.md`の匿名IDベースの多重投票防止アルゴリズムを参照） |
| ロゴ画像ファイル | Supabase Storage | jpg/png/heic/webp（バイナリ） | CDN配信されるURLをそのまま`logos.image_url`に保存でき、画像専用の管理が不要 |
| 1次選考（スワイプ）のキープ状態 | クライアント`localStorage` | JSON | PRD・機能設計書の方針通りMVPではサーバー保存を行わず、実装コストを抑える。キーに`competitionId`を含め、コンペをまたいだ混在を防ぐ |

### マイグレーション戦略（コンペ機能導入時）

- **前提**: 本プロダクトは既に単一イベント分の`logos`/`votes`/`app_settings`データが本番Supabaseプロジェクトに存在する状態でコンペ機能を導入する。データを破棄せず「最初の1件のコンペ」として引き継ぐ（PRDの既存データ移行方針を参照）
- **新規マイグレーションファイル**: `scripts/migrations/0001_add_competitions.sql`を新設し、以下を1本のSQLにまとめて実行する
  1. `competitions`テーブルを作成し、`status='active'`の部分ユニークインデックスを設定する
  2. 既存の`app_settings`（シングルトン行）の内容を基に、最初の`Competition`レコードを`status='active'`で挿入する（`slug`はサーバー側のロジックと同じ生成関数で発行、`title`は仮の初期値とする）
  3. 既存の`logos`/`votes`/`vote_locks`全件に、2で作成した`competition_id`を一括UPDATEで設定する（導入時点のデータは全件が単一コンペに属するため、条件分岐は不要）
  4. `competition_id`をNOT NULL化し、`vote_locks`の主キーを`(competition_id, voter_anon_id)`の複合キーに変更する
- **ロールバック余地**: `app_settings`テーブル自体はこのマイグレーションでは削除せず、動作確認後の別マイグレーションで削除する（`0002`は`ended`フェーズ追加、`0003`はランオフ機能導入に使用したため、`app_settings`削除は未実施のままなら`0004`以降の番号で行う）。新規Supabaseプロジェクトへのフルインストール用の`scripts/schema.sql`は、`competitions`を含む最終形（`app_settings`を含まない）に更新する
- **将来の再実行**: 2件目以降のコンペは通常のアプリケーションロジック（`CompetitionService.activate`）で作成されるため、上記マイグレーションは初回導入時の一度きりの手順である
- **`scripts/migrations/0002_add_ended_phase.sql`**: コンペ運用機能拡張（`ended`フェーズ追加）にあたり、`competitions.current_phase`のCHECK制約に`'ended'`を追加するマイグレーション。既存Supabaseプロジェクトでは`0001`適用後にこれも実行する必要がある（実行しない場合、`results`→`ended`のフェーズ切替はDBのCHECK制約違反で失敗する）。`scripts/schema.sql`（新規プロジェクト向け）は最初から`'ended'`を含む定義になっている
- **`scripts/migrations/0003_add_runoff.sql`**: ランオフ機能導入にあたり、`competitions.current_phase`のCHECK制約に`'runoff'`を追加し`runoff_round`列を新設、`votes`に`round`列を追加、`vote_locks`の複合PRIMARY KEYを`(competition_id, voter_anon_id, round)`へ変更、`runoff_rounds`テーブルを新設するマイグレーション。既存Supabaseプロジェクトでは`0001`・`0002`適用後にこれも実行する必要がある。`scripts/schema.sql`（新規プロジェクト向け）は最初からこれらを含む定義になっている

### バックアップ戦略

- **前提**: Supabaseの無料（Free）プランには自動バックアップ機能が含まれない（Point-in-Time Recovery等はPro以上のプラン機能）。本プロダクトは社内イベント用の低コスト運用を前提としており、この制約はコスト・開発期間とのトレードオフとして許容する
- **緩和策**: 各コンペの結果発表フェーズ（`results`）に入ったタイミングで、運営が管理者ダッシュボードから得票ランキングをCSVでエクスポートできる機能をMVPスコープに含める（`GET /api/admin/competitions/[id]/results/export`）。イベント本番のデータ喪失リスクに備える最低限の手段として位置付ける
- **復元方法**: 自動バックアップは行わないため、障害発生時はSupabaseプロジェクトの再構築＋（可能であれば）エクスポート済みCSVからの手動復旧を前提とする

## パフォーマンス要件

### レスポンスタイム

| 操作 | 目標時間 | 測定環境 |
|------|---------|---------|
| スワイプ操作から次カード表示まで | 200ms以内 | 一般的な社員用スマートフォン、Wi-Fi/4G回線 |
| 画像投稿（アップロード〜完了表示） | Wi-Fi接続時3秒以内（画像10MB時）。4G回線時はベストエフォート（進捗表示によりフリーズと誤解されないようにする） | 同上 |
| 決選投票の送信〜完了表示 | 1秒以内 | 同上 |
| 管理者結果画面の集計表示 | 2秒以内（投稿100〜200件、投票最大600件時） | 同上 |

### リソース使用量

| リソース | 上限 | 理由 |
|---------|------|------|
| Supabase Database容量 | 500MB以内（Free枠） | 画像本体はStorageに保存するため、DBはメタデータ・投票レコードのみで十分収まる想定 |
| Supabase Storage容量 | 1GB以内（Free枠） | 画像200件 × 平均5MB = 約1GB以内を目安に、アップロード時のサイズ上限(10MB)で制御する |
| Supabase同時接続 | Free枠の上限内 | 想定同時アクセス200名程度はFree枠のリクエスト数上限内に収まる見込み |

## セキュリティアーキテクチャ

### データ保護

- **暗号化**: Supabase・Vercel間の通信はHTTPS/TLSで暗号化される（プラットフォーム標準機能に準拠、独自実装は行わない）
- **アクセス制御**: 管理者専用のRoute Handlers（`/api/admin/*`）は、各Route Handlerの先頭で共通の認証ヘルパー関数`AdminService.verifySession()`を呼び出し、ログイン成功時に発行したJWT（`jose`で署名、有効期限4時間程度）をhttpOnly・Secure Cookieとして検証する。未認証・期限切れの場合は401を返す。個々のRoute Handlerでの検証ロジックの重複実装は禁止する。なお`middleware.ts`（Edge Middleware）は匿名ID(`anon_id`)発行専用であり、管理者認証には使用しない
- **管理者画面の事前アクセスガード**: `/admin`（コンペ一覧）・`/admin/competitions/[id]`・`/admin/competitions/[id]/results`は、いずれも`page.tsx`をServer Componentとし、`lib/api/requireAdminSession.ts`の`hasValidAdminSession()`（内部で`AdminService.verifySession()`を呼び出す）によりレンダリング前にセッションを検証する。未認証の場合は`redirect('/admin/login')`でページ本体を送信せずリダイレクトする。検証ロジック自体はRoute Handlers用と共通化されており、独自実装は行わない
- **匿名IDの発行**: 決選投票の多重投票防止に用いる`anon_id`は、クライアントの自己申告を信頼せず、Next.js Edge Middleware（`middleware.ts`）がリクエスト時にhttpOnly Cookieとして発行・管理する。クライアントJSからは参照・改ざんできない
- **Supabaseアクセス制御**: 本プロダクトはSupabase Authを使用しない完全匿名構成のため、`auth.uid()`を前提としたRLSポリシーが組めない。DatabaseテーブルとStorageバケットのRLSは全面deny-allとし、Service Role Keyを保持するサーバー（`lib/repositories/`経由）からのみ読み書き・署名付きURL発行を許可する。クライアントから直接Supabaseへアクセスする経路は存在しない
- **機密情報管理**: `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` はすべて環境変数（Vercelの環境変数機能、ローカルは`.env.local`）で管理し、リポジトリにはコミットしない

### 入力検証

- **バリデーション**: すべてのRoute Handlersで`zod`スキーマによるリクエストボディの検証を行う（クライアント側のバリデーションのみに依存しない）
- **サニタイゼーション**: 画像ファイルはMIMEタイプとファイルサイズをサーバー側で再検証してからStorageへアップロードする。投稿者名・一口メモはHTML等の埋め込みを想定せずプレーンテキストとして扱い、表示時にエスケープする（Reactのデフォルト挙動に準拠）
- **エラーハンドリング**: エラーメッセージには内部実装の詳細（SQLエラー内容、スタックトレース等）を含めず、`docs/functional-design.md`のエラーハンドリング表に定義したユーザー向けメッセージのみを返す

## スケーラビリティ設計

### データ増加への対応

- **想定データ量**: コンペ1回あたり参加者最大200名、ロゴ投稿100〜200件、決選投票データ最大600件（200名 × 最大3票）。`competition_id`によるフィルタが常に効くため、コンペ単体のクエリ量はコンペ回数が増えても変化しない
- **パフォーマンス劣化対策**: コンペ単体のデータ量が小規模なため、ページネーションや複雑なインデックス設計は不要。コンペ単位の`logos`一覧取得は全件取得で十分対応できる。ただし過去コンペが蓄積すると`logos`/`votes`テーブル全体の行数は増え続けるため、`competition_id`へのインデックスは必須とする
- **アーカイブ戦略**: 過去コンペのデータは自動削除・自動アーカイブを行わない（PRDのスコープ外）。長期的にSupabase無料枠の容量を圧迫する場合は、運営が手動で古いコンペのデータを削除する運用を想定する（自動化は将来検討）

### 機能拡張性

- **プラグインシステム**: なし（スコープ外）
- **設定のカスタマイズ**: イベントフェーズは旧`app_settings`（アプリ全体で1つ）から`competitions.current_phase`（コンペごとに独立）へ移行済みであり、複数コンペの繰り返し開催はコード変更なしに運用できる。ただし常に1つのみが`active`となる制約（PRD参照）はDB制約とアプリロジックの両方で維持する
- **API拡張性**: Route Handlersは機能（投稿・投票・フェーズ・コンペ管理・管理者認証）ごとにファイルを分離しているため、新規エンドポイントの追加が既存コードに影響しにくい

## テスト戦略

詳細なテスト種別ごとの比率（ユニット70%/統合20%/E2E10%）・カバレッジ目標・命名規則は`docs/development-guidelines.md`の「テスト戦略」を正とする。以下は技術選定と対象範囲の要約。

### ユニットテスト
- **フレームワーク**: Vitest
- **対象**: `shuffle`（Fisher-Yatesシャッフル）、`rankWithTieDetection`（ランオフ判定）、`zod`バリデーションスキーマ、サービスレイヤーの関数群
- **カバレッジ目標**: サービスレイヤー・アルゴリズム関数を中心に80%以上

### 統合テスト
- **方法**: Vitest上でRoute Handlersを直接呼び出し、Supabaseのテスト用プロジェクト（またはローカルSupabase CLI環境）に対してリクエスト〜レスポンスを検証
- **対象**: 投稿API（正常系・フェーズ不一致・サイズ超過・存在しないslug・closedコンペ）、投票API（正常系・多重投票・4件以上選択・コンペをまたいだ独立カウント）、コンペ管理API（新規開催時の既存active自動クローズ、常に1件のみactiveであること）、管理者API（未認証拒否・フェーズ切替反映・存在しないコンペIDへの404）

### E2Eテスト
- **ツール**: Playwright（モバイルビューポート設定を含む）
- **シナリオ**: 投稿フェーズでの投稿→フェーズ切替→スワイプ1次選考→決選投票→管理者結果画面確認、という一連のイベントフローを通しで検証

## 技術的制約

### 環境要件
- **OS**: サーバーサイドはVercel（Node.js 24.x実行環境）でホスティング。クライアントはiOS/Android各種スマートフォンの最新ブラウザ（Chrome/Safari）
- **最小メモリ/ディスク容量**: Vercel/Supabaseのマネージドサービス上で動作するため、開発者のローカル環境要件のみ考慮（Node.js 24.x実行に必要な標準的なスペックで十分）
- **必要な外部依存**: Supabaseプロジェクト（Database・Storage）、Vercelアカウント（デプロイ先）

### パフォーマンス制約
- Supabase Free枠のAPI呼び出し回数・Storage容量(1GB)・Database容量(500MB)の範囲内で運用することを前提とする
- Vercel Hobbyプラン（無料枠）の関数実行時間・帯域幅制限内で運用する。特にRoute Handlersのリクエストボディサイズ上限（目安4.5MB程度）が10MB画像アップロード要件と衝突するため、画像本体はSupabase Storageへの署名付きURL経由でクライアントから直接アップロードし、Next.jsサーバーを経由させない設計とする（詳細は`docs/functional-design.md`のAPI設計を参照）

### セキュリティ制約
- 本格的なユーザー認証基盤（SSO等）は導入しない（PRDのスコープ外）
- 管理者認証は簡易パスワード＋短命JWTによるものであり、社内イベント用途の低リスク前提で許容する

## 依存関係管理

| ライブラリ | 用途 | バージョン管理方針 |
|-----------|------|-------------------|
| next / react / react-dom | フレームワーク本体 | `^`でマイナーバージョンアップまで許可（破壊的変更が疑われる場合は固定に切り替え） |
| @supabase/supabase-js | Supabaseクライアント | `^`でマイナーバージョンアップまで許可 |
| react-tinder-card / framer-motion | スワイプUI・アニメーション | `^`でマイナーバージョンアップまで許可 |
| zod / jose / qrcode.react | 検証・認証・QRコード表示 | `^`でマイナーバージョンアップまで許可 |
| tailwindcss | スタイリング | `^`でマイナーバージョンアップまで許可 |
| typescript / eslint / prettier / vitest / @playwright/test | 開発ツール(devDependencies) | `^`でマイナーバージョンアップまで許可、破壊的変更を伴うメジャーアップデートは動作確認の上で個別に対応 |
