# 概念マップ (Consistency Concept Map)

`consistency-check` スキルが横断チェックの起点として使う、プロジェクト内の横断的な概念の一覧。**チェックのたびに更新し続ける生きたドキュメント**であり、新しい概念が複数ドキュメントにまたがることが分かったら随時追記する。

**更新日**: 2026-07-20

## 使い方

1. モードAのチェック時、変更内容とこの表の「概念/キーワード」列を照合する
2. マッチした行の「影響するドキュメント」列を `Grep` で確認する
3. 表にない新しい横断概念を見つけたら、行を追加する(完全な記述でなくてよい。まず「登場するドキュメント」を書き留めることが重要)

## マップ本体

`/setup-project` でドキュメントを作成した後、複数ドキュメントにまたがる概念(用語・数値・仕様)が見つかり次第、以下に追記していく。

| 概念/キーワード | 影響するドキュメント | 備考 |
|---|---|---|
| 画像アップロード制限(サイズ/形式) | product-requirements.md, functional-design.md, ui-design.md, architecture.md | 10MB/jpg,png,heic,webpで確定(2026-07-17) |
| 決選投票の上限(3件) | product-requirements.md, functional-design.md, ui-design.md, glossary.md | |
| イベントフェーズ(submission/voting/results) | functional-design.md, ui-design.md, architecture.md, repository-structure.md, glossary.md | EventPhase型 |
| 匿名IDによる投票制御 | product-requirements.md, functional-design.md, architecture.md, repository-structure.md, glossary.md, development-guidelines.md | 1端末最大3票。2026-07-17にhttpOnly Cookie(middleware.ts発行)方式へ変更、リクエストボディでの自己申告は廃止。2026-07-19に`vote_locks`テーブル(voterAnonIdをPRIMARY KEY)による原子的な予約(`VoteRepository.reserveVoteSlot`)を追加し、同時リクエストのTOCTOUレース条件を解消(`countByAnonId`による事前チェックのみでは不十分だったため) |
| 画像アップロード方式(署名付きURL) | functional-design.md, architecture.md | Vercelボディサイズ制約回避のため2026-07-17に直接アップロード方式へ変更。POST /api/logos/upload-url |
| PhaseService/Repositoryレイヤー | functional-design.md, architecture.md, repository-structure.md | 2026-07-17にfunctional-design.mdへ追記、レイヤー定義を整合 |
| 結果ランキングCSVエクスポート | product-requirements.md, functional-design.md, architecture.md, glossary.md | 2026-07-17にMVPスコープへ追加(GET /api/admin/results/export) |
| 管理者認証(JWT/簡易パスワード) | product-requirements.md, functional-design.md, ui-design.md, architecture.md, development-guidelines.md, repository-structure.md | joseライブラリ、4時間有効。2026-07-17に検証主体を`AdminService.verifySession()`に統一(middleware.tsは匿名ID発行専用と明記)。2026-07-20に`lib/api/requireAdminSession.ts`(Cookie取得→verifySession委譲の薄いヘルパー)をrepository-structure.mdに追記、実装場所は`app/admin/page.tsx`(S-06、repository-structure.mdの既存記載通り) |
| lib/api/レイヤー(Route Handler専用ヘルパー) | repository-structure.md | 2026-07-20新設。`requireAdminSession.ts`のみ配置、サービスレイヤー呼び出しに徹する薄いヘルパー(architecture.mdの4層モデル自体に変更なし、APIレイヤー内部実装の一部という位置付け) |
| テスト戦略(Vitest/Playwright、カバレッジ目標) | architecture.md, functional-design.md, development-guidelines.md | services/algorithms 80%以上。development-guidelines.mdを正とし、他2ドキュメントに参照注記を追加済み(2026-07-17) |
| 技術スタック(Next.js/Supabase等) | CLAUDE.md, product-requirements.md, functional-design.md, architecture.md, glossary.md | テスト/LintツールをCLAUDE.mdにも反映済み(2026-07-17) |
| lib/services/一覧(サービス名の正) | functional-design.md, architecture.md, repository-structure.md, glossary.md | UploadService/VoteService/AdminService/PhaseServiceの4つが正。repository-structure.mdの`SwipeService.ts`は幽霊参照だったため2026-07-17に削除 |
| lib/errors.tsの配置 | development-guidelines.md, glossary.md, repository-structure.md | 2026-07-17にrepository-structure.mdへ追記 |
