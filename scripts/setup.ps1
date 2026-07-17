#!/usr/bin/env pwsh
# 環境整理スクリプト（Windows / ローカル用）
# uv と Node.js の有無・バージョンを確認し、依存関係をインストールする。
# ツールが未インストールの場合は導入方法を案内する（自動インストールはしない）。

$ErrorActionPreference = 'Stop'
$RequiredNodeMajor = 24

function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Message) Write-Host "[ OK ] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }

# リポジトリルートへ移動（このスクリプトの1つ上の階層）
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host "=== 開発環境の確認 ==="

# --- uv ---
if (Get-Command uv -ErrorAction SilentlyContinue) {
	Write-Ok "uv: $(uv --version)"
} else {
	Write-Warn "uv が見つかりません。次のいずれかで導入してください:"
	Write-Warn "  - pip install uv"
	Write-Warn '  - powershell -c "irm https://astral.sh/uv/install.ps1 | iex"'
	Write-Warn "  参考: https://docs.astral.sh/uv/"
}

# --- Node.js ---
if (Get-Command node -ErrorAction SilentlyContinue) {
	$nodeVersion = (node --version)
	$nodeMajor = [int]($nodeVersion.TrimStart('v').Split('.')[0])
	if ($nodeMajor -eq $RequiredNodeMajor) {
		Write-Ok "Node.js: $nodeVersion"
	} else {
		Write-Warn "Node.js $nodeVersion を検出しました（推奨: $RequiredNodeMajor.x）。"
	}
} else {
	Write-Warn "Node.js が見つかりません。24.x の導入を推奨します（https://nodejs.org/）。"
}

Write-Host "=== 依存関係のセットアップ ==="

# --- Python 依存 ---
if (Test-Path pyproject.toml) {
	if (Get-Command uv -ErrorAction SilentlyContinue) {
		Write-Info "uv sync を実行します..."
		uv sync
		Write-Ok "Python 依存関係を同期しました。"
	} else {
		Write-Warn "pyproject.toml がありますが uv が無いためスキップしました。"
	}
} else {
	Write-Info "pyproject.toml が無いため Python 依存の同期はスキップします。"
}

# --- Node 依存 ---
if (Test-Path package.json) {
	if (Get-Command npm -ErrorAction SilentlyContinue) {
		Write-Info "npm install を実行します..."
		npm install
		Write-Ok "Node 依存関係をインストールしました。"
	} else {
		Write-Warn "package.json がありますが npm が無いためスキップしました。"
	}
} else {
	Write-Info "package.json が無いため Node 依存のインストールはスキップします。"
}

Write-Ok "環境の確認が完了しました。"
