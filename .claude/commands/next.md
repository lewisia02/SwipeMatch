---
description: 開発の進捗を診断し、次に取るべきアクションを提案する
---

# 次アクション提案

このコマンドは、プロジェクトの現状（ドキュメント・作業・git）を診断し、
「次に何をすべきか」を優先度付きで提案します。ファイルの変更は行いません（読み取りのみ）。

## 実行方法

```bash
claude
> /next
```

## 手順

### ステップ1: 進捗シグナルの収集

以下を読み取り、現状を把握する。存在しないものは「未作成」として扱う。

1. **アイデア**: `docs/ideas/` にファイル（特に `initial-requirements.md`）があるか
2. **永続ドキュメント**: `docs/` 配下の7ドキュメントの有無
   - `product-requirements.md` / `functional-design.md` / `ui-design.md` / `architecture.md` / `repository-structure.md` / `development-guidelines.md` / `glossary.md`
   - ※ `ui-design.md` は Web/GUI の場合のみ必須。CLI ツールでは対象外として扱う
3. **進行中の作業**: `.steering/` 内で最新の作業ディレクトリを特定し、`tasklist.md` を読む
   - 未完了タスク（`[ ]`）の数
   - 「実装後の振り返り」セクションが記入済みか
4. **git 状態**:
   ```bash
   git branch --show-current
   git status --short
   git log --oneline -5
   ```
   - 現在ブランチ / 未コミット変更の件数 / 直近コミット

### ステップ2: 現状の判定と次アクションの決定

以下を**上から順に評価し、最初に該当した状態**を「次の一手」とする。

| 現状 | 次の一手 |
| --- | --- |
| `docs/ideas/` も `docs/` も空 | `docs/ideas/initial-requirements.md` にアイデア（課題・ターゲット・主要機能・MVP）をまとめる |
| ideas あり／`product-requirements.md` が無い | `/setup-project` を実行して永続ドキュメントを作成 |
| 永続ドキュメントが一部のみ作成済み | 不足しているドキュメントを作成（`/setup-project` の続き。次の未作成ドキュメントを提案） |
| docs 揃い＋進行中 steering に未完了タスクあり | 実装を継続（`tasklist.md` の先頭の未完了タスク。`steering` モード2） |
| 作業中なのに `main` / `develop` に直接いる | `feature/*` ブランチを作成（`docs/development-guidelines.md` の Git Flow に整合） |
| tasklist 全完了＋未コミット変更あり | 変更をコミットし、PR を作成 |
| tasklist 全完了＋振り返り未記入 | 振り返りを記録（`steering` モード3） |
| 振り返り済み＋設計変更が docs に未反映 | 関連する `docs/` を更新 |
| 進行中 steering 無し＋docs 揃い＋作業ツリーが clean | `/add-feature [機能名]` で次の機能に着手、または `/review-docs [パス]` でレビュー |

### ステップ3: 提案の出力

以下の形式でユーザーに報告する。

```markdown
## 現状: [フェーズ名]

- docs: [N]/7 作成済み（未作成: [リスト]）
- 進行中の作業: [.steering/... または「なし」]（未完了 [X] タスク）
- git: ブランチ [名前] / 未コミット [N] 件

## 次の一手（推奨）

→ **[具体的なアクション]**
   理由: [なぜ今これか]
   実行方法: [コマンド例または手順]

## 代替の選択肢

- [選択肢A]（[どんな時に選ぶか]）
- [選択肢B]（[どんな時に選ぶか]）
```

## 注意事項

- このコマンドは**診断と提案のみ**を行い、ドキュメントやコードは変更しない
- 提案は現状からの推定であり、最終的な判断はユーザーが行う
- git コマンドは読み取り専用のもの（`status` / `branch` / `log` / `diff`）のみ使用する
