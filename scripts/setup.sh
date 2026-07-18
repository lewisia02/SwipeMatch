#!/usr/bin/env bash
# 環境整理スクリプト（Linux / Dev Container 用）
# uv と Node.js の有無・バージョンを確認し、依存関係をインストールする。
# ツールが未インストールの場合は導入方法を案内する（自動インストールはしない）。

set -euo pipefail

REQUIRED_NODE_MAJOR=24

info() { printf '\033[36m[INFO]\033[0m %s\n' "$1"; }
ok()   { printf '\033[32m[ OK ]\033[0m %s\n' "$1"; }
warn() { printf '\033[33m[WARN]\033[0m %s\n' "$1"; }

# リポジトリルートへ移動（このスクリプトの1つ上の階層）
cd "$(dirname "$0")/.."

echo "=== 開発環境の確認 ==="

# --- uv ---
if command -v uv >/dev/null 2>&1; then
	ok "uv: $(uv --version)"
else
	warn "uv が見つかりません。次のいずれかで導入してください:"
	warn "  - pip install uv"
	warn "  - curl -LsSf https://astral.sh/uv/install.sh | sh"
	warn "  参考: https://docs.astral.sh/uv/"
fi

# --- Node.js ---
if command -v node >/dev/null 2>&1; then
	node_version="$(node --version)"
	node_major="${node_version#v}"
	node_major="${node_major%%.*}"
	if [ "$node_major" -eq "$REQUIRED_NODE_MAJOR" ]; then
		ok "Node.js: $node_version"
	else
		warn "Node.js $node_version を検出しました（推奨: ${REQUIRED_NODE_MAJOR}.x）。"
	fi
else
	warn "Node.js が見つかりません。24.x の導入を推奨します（https://nodejs.org/）。"
fi

echo "=== 依存関係のセットアップ ==="

# --- Python 依存（backend/） ---
if [ -f backend/pyproject.toml ]; then
	if command -v uv >/dev/null 2>&1; then
		info "backend/ で uv sync を実行します..."
		( cd backend && uv sync )
		ok "Python 依存関係を同期しました。"
	else
		warn "backend/pyproject.toml がありますが uv が無いためスキップしました。"
	fi
else
	info "backend/pyproject.toml が無いため Python 依存の同期はスキップします。"
fi

# --- Node 依存（frontend/） ---
if [ -f frontend/package.json ]; then
	if command -v npm >/dev/null 2>&1; then
		info "frontend/ で npm install を実行します..."
		( cd frontend && npm install )
		ok "Node 依存関係をインストールしました。"
	else
		warn "frontend/package.json がありますが npm が無いためスキップしました。"
	fi
else
	info "frontend/package.json が無いため Node 依存のインストールはスキップします。"
fi

ok "環境の確認が完了しました。"
