---
description: docs/配下のドキュメント間で用語・数値・仕様の横断的な不整合がないかチェックする
---

# 横断整合性チェック

引数(任意): ドキュメントパス、または `--full`

## 実行方法

```bash
claude
> /check-consistency
> /check-consistency docs/architecture.md
> /check-consistency --full
```

## 手順

`Skill('consistency-check')` を実行する。

- 引数なし: 直近の変更(未コミットのdiff、または直前の会話での編集内容)に対してモードA(差分チェック)を行う
- ドキュメントパスを指定: そのドキュメントを起点にモードAを行う
- `--full`: モードB(全体スイープ)の実行をユーザーに確認してから行う

## 注意事項

- モードAは低コスト(Grep/Readのみ)で完結する
- モードBはサブエージェントを最大7回起動するため高コスト。実行前に必ずユーザーに確認する
