# 概念マップ (Consistency Concept Map)

`consistency-check` スキルが横断チェックの起点として使う、プロジェクト内の横断的な概念の一覧。**チェックのたびに更新し続ける生きたドキュメント**であり、新しい概念が複数ドキュメントにまたがることが分かったら随時追記する。

**更新日**: 2026-07-22（PRESS PROOFデザイン刷新の横断レビューにより更新）

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
| イベントフェーズ(submission/voting/results/ended) | product-requirements.md, functional-design.md, ui-design.md, architecture.md, repository-structure.md, glossary.md, development-guidelines.md(命名規則の例示コードのみ) | EventPhase型。2026-07-20の複数コンペ対応で、アプリ全体で1つ(旧`app_settings`)からコンペごとに独立(`competitions.currentPhase`)に変更。2026-07-22のコンペ運用機能拡張で`ended`(コンペ終了)を追加、前方一方向遷移(逆行不可)は維持。`ended`は`CompetitionStatus`(active/closed)とは独立した概念。product-requirements.mdはPRDレベルの高レベル記述(投稿/投票フェーズの言及のみ)に留まり`ended`個別の受け入れ条件は追加していない(意図的。PRDは基本設計であり頻繁更新しない方針のため) |
| 参加者名/投稿者名の統合(NameGate) | ui-design.md, functional-design.md, glossary.md, repository-structure.md | 2026-07-22新設。`/c/[slug]`初回アクセス時に参加者名(何でもよい・匿名可)を`localStorage`(`lib/client/participantName.ts`)へ保存し、画像投稿フォームの投稿者名として自動使用。投稿フォーム自体の投稿者名入力欄は廃止(`createLogoSchema`等APIスキーマ自体は無変更) |
| コンペの完全削除 | ui-design.md, functional-design.md, glossary.md, repository-structure.md | 2026-07-22新設。`DELETE /api/admin/competitions/[id]`、`closed`なコンペのみ対象、コンペ名の入力一致をサーバー側でも検証。Storage画像→logos(votesはON DELETE CASCADEで連動)→vote_locks→competitionsの順で削除(`CompetitionService.remove`) |
| 管理者ダッシュボード集計(投稿状況/投票状況) | ui-design.md, functional-design.md, glossary.md | 2026-07-22新設。`GET /api/admin/competitions/[id]/stats`。`results`フェーズ以外でも取得可能な点が`getRankedResults`(resultsフェーズ限定)と異なる |
| グローバルトップ(`/`)の管理者リンク方針 | ui-design.md, repository-structure.md | 2026-07-22変更。従来「参加者向け画面から管理者画面へのリンクは設置しない」方針だったが、グローバルトップに限り「管理者はこちら」リンクを追加する方針に変更。`/c/[slug]`配下(S-01〜S-04)からは引き続きリンクしない。あわせて`/`の自動`redirect()`も廃止し、明示的な導線ボタン方式に変更 |
| マイグレーションファイルの番号管理 | architecture.md, scripts/migrations/ | `0001_add_competitions.sql`(2026-07-20)。architecture.mdは当初次の番号(`0002`)を`app_settings`削除用と予告していたが未実施のまま、2026-07-22に`0002_add_ended_phase.sql`(current_phase CHECK制約に`ended`追加)が先行して採番された。`app_settings`削除を今後行う場合は`0003`以降を使うこと |
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
| コンペ(Competition)エンティティとライフサイクル(active/closed) | product-requirements.md, functional-design.md, ui-design.md, architecture.md, repository-structure.md, glossary.md | 2026-07-20新設。常に1件のみactive(部分ユニークインデックスで保証)。新規開催時は既存activeを自動closed。旧`AppSettings`(シングルトン)を置き換え。2026-07-22に完全削除機能(`closed`のみ対象)を追加(「コンペの完全削除」の行を参照)。`status`(active/closed)とフェーズの`ended`は独立した別軸の状態 |
| コンペ専用URL/slug生成 | functional-design.md, ui-design.md, architecture.md, repository-structure.md, glossary.md | 2026-07-20新設。`/c/{slug}`形式、ランダムな英数字8文字程度、衝突時は再生成 |
| 画面ID S-06/S-07/S-08とルートの対応 | ui-design.md, repository-structure.md, glossary.md | 2026-07-20の複数コンペ対応でS-06(コンペ管理画面, 旧称:管理者ダッシュボード)が`app/admin/competitions/[id]/page.tsx`へ移動、S-08(管理者コンペ一覧画面、新設)が`app/admin/page.tsx`を引き継いだ |
| APIパス体系(/api/c/[slug]/..., /api/admin/competitions/...) | functional-design.md, repository-structure.md | 2026-07-20新設。参加者向けAPIは`/api/c/[slug]/...`、コンペ横断の管理者APIは`/api/admin/competitions`、個別コンペ操作は`/api/admin/competitions/[id]/...`。2026-07-22に`DELETE /api/admin/competitions/[id]`(削除)と`GET /api/admin/competitions/[id]/stats`(ダッシュボード集計)を追加。同日さらに`GET /api/admin/competitions/[id]/results/timeline`(投票タイムライン取得)を追加 |
| resultsフェーズガード(`results`以上を許可) | functional-design.md, glossary.md | 2026-07-22新設(`assertPhaseAtLeast`)。`getRankedResults`/`exportResultsCsv`/`getVoteTimeline`は「`currentPhase===results`」ではなく「`results`または`ended`(=`results`以上)」を許可するよう修正。glossary.md L405「`ended`到達後も管理者は結果・ダッシュボードを閲覧できる」という記述は本修正前から存在していたため変更なし(仕様の記述はそのまま、実装側のバグを修正した形)。`ui-design.md`のS-07エラー状態の文言も「`results`ではない」→「`results`未満」に修正済み |
| 結果発表画面のタイムラプス演出(VoteTimelapseChart) | ui-design.md, functional-design.md, repository-structure.md | 2026-07-22新設。「発表開始」タップ後、投票タイムライン(`GET /api/admin/competitions/[id]/results/timeline`)が1件以上あれば`VoteTimelapseChart`で投票を時系列に1票ずつ再生してから、既存の`AnimatedRankingList`(順位スライドイン)へ自動遷移する。投票0件のコンペはタイムラプスをスキップし直接`AnimatedRankingList`へ。再生時間は投票数に応じて自動調整(目標総尺12秒、1票あたり60〜1200msでクランプ)。ドメイン用語ではなくS-07固有のUI演出のため、glossary.mdへの追記は対象外と判断(2026-07-22判断) |
| S-06投稿状況セクションのスクロール化 | ui-design.md | 2026-07-22新設。投稿数が多くても画面全体が伸びないよう、投稿状況の一覧を最大高さ固定のスクロール領域として表示する(見出し「投稿状況(N件)」自体はスクロール対象外)。ロジック変更なし・表示のみの変更のため他ドキュメントへの波及なし |
| ビジュアルデザインコンセプト「PRESS PROOF」(配色/フォント/装飾コンポーネント) | ui-design.md, README.md | 2026-07-22新設。コーラル`#FF6B6B`×ティール`#4ECDC4`+システムフォントから全面刷新。配色(Ink/Paper/Proof Magenta/Proof Cyan/Proof Yellow/Slate)・フォント3種(見出し`Shippori Antique B1`/本文`Inter`/データ`IBM Plex Mono`)・装飾コンポーネント(`CropMarks`/`ColorBar`/検版スタンプ風ランクバッジ)を新設。ビジュアルのみの変更のため、意図的にproduct-requirements.md/functional-design.md/architecture.md/repository-structure.md/glossary.mdは対象外とした(requirements.mdのスコープ外セクション参照)。日本語グリフを持たないフォント(`Big Shoulders`等)は本アプリの見出しがほぼ全て日本語のため実質無効になる点に注意(ui-design.mdに注意書きを記載済み) |
