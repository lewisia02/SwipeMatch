# 概念マップ (Consistency Concept Map)

`consistency-check` スキルが横断チェックの起点として使う、プロジェクト内の横断的な概念の一覧。**チェックのたびに更新し続ける生きたドキュメント**であり、新しい概念が複数ドキュメントにまたがることが分かったら随時追記する。

**更新日**: 2026-07-20（複数コンペ対応の横断レビューにより更新）

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
| イベントフェーズ(submission/voting/results) | product-requirements.md, functional-design.md, ui-design.md, architecture.md, repository-structure.md, glossary.md | EventPhase型。2026-07-20の複数コンペ対応で、アプリ全体で1つ(旧`app_settings`)からコンペごとに独立(`competitions.currentPhase`)に変更 |
| 匿名IDによる投票制御 | product-requirements.md, functional-design.md, architecture.md, repository-structure.md, glossary.md, development-guidelines.md | 1端末最大3票。2026-07-17にhttpOnly Cookie(middleware.ts発行)方式へ変更、リクエストボディでの自己申告は廃止。2026-07-19に`vote_locks`テーブル(voterAnonIdをPRIMARY KEY)による原子的な予約(`VoteRepository.reserveVoteSlot`)を追加し、同時リクエストのTOCTOUレース条件を解消(`countByAnonId`による事前チェックのみでは不十分だったため) |
| 画像アップロード方式(署名付きURL) | functional-design.md, architecture.md | Vercelボディサイズ制約回避のため2026-07-17に直接アップロード方式へ変更。2026-07-20の複数コンペ対応でパスが`POST /api/c/[slug]/logos/upload-url`に変更(旧: POST /api/logos/upload-url) |
| PhaseService/Repositoryレイヤー | functional-design.md, architecture.md, repository-structure.md | 2026-07-17にfunctional-design.mdへ追記、レイヤー定義を整合 |
| 結果ランキングCSVエクスポート | product-requirements.md, functional-design.md, architecture.md, glossary.md | 2026-07-17にMVPスコープへ追加。2026-07-20の複数コンペ対応でパスが`GET /api/admin/competitions/[id]/results/export`に変更(旧: GET /api/admin/results/export) |
| 管理者認証(JWT/簡易パスワード) | product-requirements.md, functional-design.md, ui-design.md, architecture.md, development-guidelines.md, repository-structure.md | joseライブラリ、4時間有効。2026-07-17に検証主体を`AdminService.verifySession()`に統一(middleware.tsは匿名ID発行専用と明記)。2026-07-20に`lib/api/requireAdminSession.ts`(Cookie取得→verifySession委譲の薄いヘルパー)をrepository-structure.mdに追記。同日の複数コンペ対応で画面構成が変わり、事前アクセスガード対象は`app/admin/page.tsx`(S-08 管理者コンペ一覧画面)・`app/admin/competitions/[id]/page.tsx`(S-06 コンペ管理画面)・`app/admin/competitions/[id]/results/page.tsx`(S-07 結果発表画面)の3ページに拡大(旧: `app/admin/page.tsx`がS-06だった) |
| lib/api/レイヤー(Route Handler専用ヘルパー) | repository-structure.md | 2026-07-20新設。`requireAdminSession.ts`のみ配置、サービスレイヤー呼び出しに徹する薄いヘルパー(architecture.mdの4層モデル自体に変更なし、APIレイヤー内部実装の一部という位置付け) |
| テスト戦略(Vitest/Playwright、カバレッジ目標) | architecture.md, functional-design.md, development-guidelines.md | services/algorithms 80%以上。development-guidelines.mdを正とし、他2ドキュメントに参照注記を追加済み(2026-07-17) |
| 技術スタック(Next.js/Supabase等) | CLAUDE.md, product-requirements.md, functional-design.md, architecture.md, glossary.md | テスト/LintツールをCLAUDE.mdにも反映済み(2026-07-17) |
| lib/services/一覧(サービス名の正) | functional-design.md, architecture.md, repository-structure.md, glossary.md | repository-structure.mdの`SwipeService.ts`は幽霊参照だったため2026-07-17に削除。2026-07-20の複数コンペ対応で`CompetitionService`を新設し、UploadService/VoteService/AdminService/PhaseServiceと合わせた5つが正(旧: 4つ) |
| lib/errors.tsの配置 | development-guidelines.md, glossary.md, repository-structure.md | 2026-07-17にrepository-structure.mdへ追記 |
| コンペ(Competition)エンティティとライフサイクル(active/closed) | product-requirements.md, functional-design.md, ui-design.md, architecture.md, repository-structure.md, glossary.md | 2026-07-20新設。常に1件のみactive(部分ユニークインデックスで保証)。新規開催時は既存activeを自動closed。旧`AppSettings`(シングルトン)を置き換え |
| コンペ専用URL/slug生成 | functional-design.md, ui-design.md, architecture.md, repository-structure.md, glossary.md | 2026-07-20新設。`/c/{slug}`形式、ランダムな英数字8文字程度、衝突時は再生成 |
| 画面ID S-06/S-07/S-08とルートの対応 | ui-design.md, repository-structure.md, glossary.md | 2026-07-20の複数コンペ対応でS-06(コンペ管理画面, 旧称:管理者ダッシュボード)が`app/admin/competitions/[id]/page.tsx`へ移動、S-08(管理者コンペ一覧画面、新設)が`app/admin/page.tsx`を引き継いだ |
| APIパス体系(/api/c/[slug]/..., /api/admin/competitions/...) | functional-design.md, repository-structure.md | 2026-07-20新設。参加者向けAPIは`/api/c/[slug]/...`、コンペ横断の管理者APIは`/api/admin/competitions`、個別コンペ操作は`/api/admin/competitions/[id]/...` |
