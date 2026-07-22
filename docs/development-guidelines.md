# 開発ガイドライン (Development Guidelines)

本プロジェクトは Next.js (App Router) + TypeScript + Supabase で構成される。`docs/architecture.md` に記載の通り、Python は用いない（当初テンプレートはPython/TypeScript両対応だったが、実際の技術スタック決定に伴いTypeScriptのみを対象とする）。社内イベント向けの短期集中開発（個人開発に近いラフな進め方）であることを踏まえ、プロセスは必要最小限に絞る。

## コーディング規約

### 命名規則

**変数・関数**:
```typescript
// ✅ 良い例
const uploaderName = formData.get('uploaderName');
function calculateTotalScore(votes: Vote[]): number { }

// ❌ 悪い例
const data = formData.get('uploaderName');
function calc(v: any[]): number { }
```

**原則**:
- 変数: camelCase、名詞または名詞句
- 関数: camelCase、動詞で始める
- 定数: UPPER_SNAKE_CASE（例: `MAX_VOTES_PER_USER`）
- Boolean: `is`, `has`, `should`, `can` で始める（例: `isVotingPhase`, `hasAlreadyVoted`）

**クラス・型**:
```typescript
// サービス/リポジトリクラス: PascalCase + 役割接尾辞
class VoteService { }
class LogoRepository { }

// 型エイリアス・インターフェース: PascalCase
interface Logo { }
type EventPhase = 'submission' | 'voting' | 'results' | 'ended';
```

**ファイル名**（`docs/repository-structure.md` のファイル配置規則に準拠）:
- クラスファイル（Service/Repository/Manager）: PascalCase（例: `VoteService.ts`）
- 関数ファイル（algorithms/validators）: camelCase（例: `shuffle.ts`）
- Reactコンポーネント: PascalCase（例: `SwipeCard.tsx`）
- Next.js規約ファイル: `page.tsx` / `route.ts` / `layout.tsx` 固定

### コードフォーマット

- **インデント**: 2スペース
- **行の長さ**: 最大100文字
- 整形はPrettierに委譲し、手動での整形調整は行わない

### TypeScriptの型安全性

- `tsconfig.json`は`strict: true`を基本とする
- `any`の使用は原則禁止。外部ライブラリの型が提供されない等やむを得ない場合のみ、`// eslint-disable-next-line`とコメントで理由を明記した上で使用する

### Next.js固有の規約

- **Server Components をデフォルトとする**: データ取得や静的な表示はServer Componentsで実装し、`'use client'`はスワイプ操作・フォーム入力・状態管理など、インタラクティブ性が必須なコンポーネントにのみ付与する
- **Route Handlers は薄く保つ**: `app/api/**/route.ts` では、リクエストのパース・`zod`によるバリデーション・`lib/services/`の呼び出し・レスポンス整形のみを行い、ビジネスロジックを実装しない（`docs/architecture.md`のレイヤー分離に従う）
- **レイヤー依存を守る**: `docs/repository-structure.md`の依存関係ルール（`app/` → `app/api/` → `lib/services/` → `lib/repositories/`）に反する実装（例: ページから`lib/repositories/`を直接呼び出す）を行わない

### コメント規約

**TSDoc（公開関数・複雑なロジックのみ）**:
```typescript
/**
 * 得票数の同数判定を行い、ランオフ対象にフラグを立てる
 *
 * @param logos - 得票数を含むLogo一覧
 * @returns 順位とランオフ判定を付与したLogo一覧
 */
function rankWithTieDetection(logos: LogoWithVotes[]): RankedLogo[] { }
```

**インラインコメント**:
```typescript
// ✅ 良い例: なぜそうするかを説明
// Supabase Free枠には自動バックアップがないため、results移行時に手動エクスポートを促す
if (phase === 'results') { ... }

// ❌ 悪い例: コードを見れば分かることの説明
// phaseをvotingにする
setPhase('voting');
```

### エラーハンドリング

**カスタムエラークラス（`lib/errors.ts`に集約）**:
```typescript
class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class PhaseMismatchError extends Error {
  constructor(public expectedPhase: EventPhase, public actualPhase: EventPhase) {
    super(`このフェーズ(${actualPhase})では実行できません`);
    this.name = 'PhaseMismatchError';
  }
}

class DuplicateVoteError extends Error {
  constructor(public anonId: string) {
    super('既に投票済みです');
    this.name = 'DuplicateVoteError';
  }
}

class UnauthorizedError extends Error {
  constructor() {
    super('認証が必要です');
    this.name = 'UnauthorizedError';
  }
}
```

**Route Handlersでのハンドリング方針**:
```typescript
try {
  await voteService.submitVotes(anonId, logoIds);
  return Response.json({ success: true });
} catch (error) {
  if (error instanceof ValidationError) {
    return Response.json({ message: error.message }, { status: 400 });
  }
  if (error instanceof DuplicateVoteError) {
    return Response.json({ message: error.message }, { status: 409 });
  }
  if (error instanceof PhaseMismatchError) {
    return Response.json({ message: error.message }, { status: 403 });
  }
  // 予期しないエラーはログに残し、詳細を返さない
  console.error(error);
  return Response.json({ message: 'エラーが発生しました。時間をおいて再度お試しください' }, { status: 500 });
}
```

エラーメッセージは`docs/functional-design.md`のエラーハンドリング表の文言と一致させる。

### セキュリティ

- **入力検証**: すべてのRoute Handlersで`zod`スキーマによる検証を先頭で実施し、クライアント側検証のみに依存しない
- **機密情報の管理**: `SUPABASE_SERVICE_ROLE_KEY` / `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` は環境変数（`.env.local`、Vercelの環境変数機能）で管理し、コード内にハードコードしない
- **管理者エンドポイントの保護**: `app/api/admin/**`はすべて`AdminService.verifySession()`（共通の認証ヘルパー関数）でJWT検証を行い、個々のRoute Handlerで認証チェックを重複実装しない。Next.jsのEdge Middleware（`middleware.ts`）は匿名ID(`anon_id`)発行専用であり、管理者認証には使用しない

### パフォーマンス

- Logo一覧はイベント規模（100〜200件程度）であれば1回のクエリで全件取得し、クライアント側でシャッフル・フィルタする（早期の最適化は行わない）
- 画像はNext.jsの`<Image>`コンポーネントとSupabase StorageのCDN配信を組み合わせ、リサイズ・遅延読み込みを活用する

### テストコード

**構造（Given-When-Then）**:
```typescript
describe('VoteService', () => {
  describe('submitVotes', () => {
    it('未投票のanonIdが3件以内のlogoIdsを送信した場合、投票が作成される', async () => {
      // Given
      const service = new VoteService(mockVoteRepository);
      // When
      await service.submitVotes('anon-1', ['logo-1', 'logo-2']);
      // Then
      expect(mockVoteRepository.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ logoId: 'logo-1', voterAnonId: 'anon-1' }),
        ])
      );
    });

    it('既に投票済みのanonIdの場合、DuplicateVoteErrorをスローする', async () => {
      // Given
      const service = new VoteService(mockVoteRepositoryWithExistingVote);
      // When / Then
      await expect(service.submitVotes('anon-1', ['logo-1'])).rejects.toThrow(DuplicateVoteError);
    });
  });
});
```

**テスト命名規則**: `[対象]_[条件]_[期待結果]`（例: `submitVotes_alreadyVoted_throwsDuplicateVoteError`）

**モック**: Supabaseクライアント・リポジトリはインターフェースに基づきモック化し、サービスレイヤーのロジックのみを検証する

## Git運用ルール

### ブランチ戦略

社内イベント向けの短期集中開発であり、リリースを段階管理する必要がないため、`develop`ブランチは設けずシンプルなトランクベース運用とする。

**ブランチ種別**:
- `main`: 常にデプロイ可能な状態を保つ
- `feature/[機能名]`: 新機能開発（例: `feature/image-upload`）
- `fix/[修正内容]`: バグ修正（例: `fix/vote-count-limit`）

**運用ルール**:
- `main`への直接コミットは禁止し、必ずPRを経由する
- `feature/*` / `fix/*` は `main` から分岐し、作業完了後にPRで `main` へマージする
- マージ方式は squash merge を基本とし、`main`のコミット履歴を機能単位で追いやすく保つ

### コミットメッセージ規約

Conventional Commitsに従う。

```
<type>(<scope>): <subject>

<body>
```

**Type**: `feat` / `fix` / `docs` / `style` / `refactor` / `test` / `chore`

**例**:
```
feat(vote): 決選投票の上位3件選択機能を追加

キープした画像から最大3件まで選択して投票できるようにした。
- SelectableGridコンポーネントを追加
- POST /api/c/[slug]/votes に選択件数バリデーションを実装
```

### プルリクエストプロセス

**作成前のチェック**:
- [ ] `npm run lint` / `npm run typecheck` / `npm test` がすべてパス
- [ ] 競合が解決されている

**PRテンプレート**:
```markdown
## 概要
[変更内容の簡潔な説明]

## 変更理由
[なぜこの変更が必要か]

## テスト
- [ ] ユニットテスト追加
- [ ] 手動確認実施（スマートフォン実機 or ブラウザのモバイルビューポート）

## 関連ドキュメント
[docs/functional-design.md 等、対応する仕様箇所へのリンク]
```

**レビュープロセス**: セルフレビュー → CI（lint/typecheck/test）通過確認 → レビュー → 承認後マージ

## テスト戦略

### テストの種類とカバレッジ目標

| テスト種別 | 対象 | 目標比率/カバレッジ |
|-----------|------|---------------------|
| ユニットテスト | `lib/services/`, `lib/algorithms/`, `lib/validators/` | 全体の70%、`lib/services/`と`lib/algorithms/`は80%以上 |
| 統合テスト | `app/api/**/route.ts` | 全体の20%、主要エンドポイントの正常系・異常系を網羅 |
| E2Eテスト | 参加者・運営の主要シナリオ | 全体の10%、`docs/functional-design.md`のE2Eテスト項に列挙された3シナリオ（投稿〜決選投票、決選投票〜管理者結果確認、リロード後のスワイプ状態復元）を最低限カバーする |

理由: 小規模なアプリケーションであり、UIの細部よりも投票の公平性・データ整合性に関わるサービスレイヤーとAPIの品質を優先する。

## コードレビュー基準

**レビューポイント**:
- [ ] `docs/functional-design.md` のエラーハンドリング・バリデーション仕様を満たしているか
- [ ] レイヤー間の依存関係ルール（`docs/repository-structure.md`）を破っていないか
- [ ] 機密情報がハードコードされていないか
- [ ] 匿名IDベースの多重投票防止など、公平性に関わるロジックにテストがあるか

**コメントの優先度表記**: `[必須]` / `[推奨]` / `[提案]` / `[質問]`

## 開発環境セットアップ

### 必要なツール

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Node.js | 24.x | ランタイム |
| npm | Node.js 24.x同梱 | パッケージ管理 |
| Supabaseアカウント | - | Database/Storageの利用（`docs/ideas/setup_guide.md`のセットアップ手順を参照） |

### セットアップ手順

```bash
# 1. リポジトリのクローン
git clone [URL]
cd SwipeMatch

# 2. 依存関係のインストール
npm install

# 3. 環境変数の設定
cp .env.example .env.local
# .env.local に SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY /
# ADMIN_PASSWORD / ADMIN_SESSION_SECRET を設定

# 4. Supabaseスキーマの適用
# scripts/schema.sql の内容をSupabaseダッシュボードのSQLエディタで実行し、
# competitions / logos / votes / vote_locks テーブルを作成する（手順は docs/ideas/setup_guide.md も参照）

# 5. 開発サーバーの起動
npm run dev
```

## 自動化(CI/CD)

### 品質チェックの自動化

- **Lint**: ESLint 9.x（`eslint-config-next`ベース） + `@typescript-eslint`
- **フォーマット**: Prettier 3.x（ESLintと競合しないよう`eslint-config-prettier`を併用）
- **型チェック**: `tsc --noEmit`
- **テスト**: Vitest（ユニット/統合）、Playwright（E2E）

**CI（GitHub Actions）**:
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

**pre-commitフック（Husky + lint-staged）**:
```json
{
  "scripts": {
    "prepare": "husky",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```
