---
title: "Claude Code でモデルバージョンを固定する方法まとめ【Opus4.6で固定したい】"
description: "Claude Code で使うモデルのバージョンを固定する方法。/model・起動フラグ・環境変数・settings.json の優先順位と、Default への逃げ道も塞ぐ完全固定の設定をまとめました。"
pubDate: 2026-06-20
tags: ["Claude Code", "AI"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2026/06/20/041922"
---
Claude Code で「常に特定バージョンの Opus を使いたい」といった**バージョン固定**をしたいケースは多い。指定方法が複数あって優先順位もあるので、エンジニア向けに端的にまとめておく。

> 例として `claude-opus-4-6` を使うが、`claude-opus-4-8` など任意のバージョンに読み替え可。

## 大前提：エイリアスは固定にならない

最初に押さえるべきポイント。

- `opus` のような**エイリアスは「移動する参照」**。プロバイダーごとの推奨バージョンを指し、新モデルが出ると自動で乗り換わる。つまり `opus` 指定では**バージョン固定にならない**。
- バージョンを固定するには、**フルモデル名**（`claude-opus-4-6`）か、`ANTHROPIC_DEFAULT_OPUS_MODEL` などの環境変数を使う。

参考：API 直結なら `opus` は Opus 4.8、`sonnet` は Sonnet 4.6 に解決される（Bedrock/Vertex/Foundry では別バージョン）。

## 指定方法一覧（優先順位の高い順）

ランタイムの上書きが静的設定より優先される、厳密な優先順位で動く。

| # | 方法 | 書き方 | 適用範囲 |
|---|---|---|---|
| 1 | セッション中の `/model` | `/model claude-opus-4-6` | v2.1.153+ はユーザー設定に保存され、新規セッションのデフォルトにもなる |
| 2 | 起動フラグ | `claude --model claude-opus-4-6` | そのセッションのみ |
| 3 | 環境変数 `ANTHROPIC_MODEL` | `export ANTHROPIC_MODEL=claude-opus-4-6` | シェル/セッション単位 |
| 4 | 設定ファイルの `model` | `~/.claude/settings.json`（or プロジェクトの `.claude/settings.json`） | 恒久（優先度は最も低い） |

設定ファイル例：

```json
{
  "model": "claude-opus-4-6"
}
```

### エイリアスの解決先を差し替える

`opus` エイリアス自体を特定バージョンに固定したい場合：

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4-6
export CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-4-6
```

`SONNET` / `HAIKU` / `FABLE` 版の環境変数も同様にある。

## 注意：`model` だけでは「強制」にならない

見落としやすいポイント。`model` 設定は**初期選択であって強制ではない**。ユーザーは `/model` から Default を選べてしまい、Default はプランの標準モデルに解決される。

完全に固定（逃げ道も塞ぐ）したいなら、3つを組み合わせる。

```json
{
  "model": "claude-opus-4-6",
  "availableModels": ["claude-opus-4-6"],
  "env": {
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-6"
  }
}
```

役割分担：

- `availableModels` … 切り替え可能なモデルを制限
- `model` … 開始時の初期選択
- `ANTHROPIC_DEFAULT_OPUS_MODEL` … Default オプションと `opus` エイリアスの解決先

`env` ブロックがないと、Default を選んだユーザーが最新版を引いてしまい、バージョン固定を回避できてしまう点に注意。

> `availableModels` を複数階層で設定すると配列はマージ・重複除去される。厳格な許可リストにするなら、最優先で適用される managed/policy 設定に書く。

## 第三者プロバイダー（Bedrock / Vertex / Foundry）の場合

プロバイダーごとにモデル ID が異なるため、ロールアウト前にバージョン固定推奨。

```bash
# Bedrock の例
export ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-8'
```

同一ファミリー内の複数バージョンを別々のプロバイダー ID にマッピングしたい場合は `modelOverrides` 設定を使う。

## まとめ

- **個人で恒久固定したいだけ** → 方法4（`~/.claude/settings.json` の `model` にフルモデル名）が最も簡潔。
- **Default への逃げ道も塞いで完全強制** → `model` + `availableModels` + `env` の3点セット。
- 共通の鉄則：**エイリアス（`opus`）ではなくフルモデル名（`claude-opus-4-6`）を使う**。

---

*情報は執筆時点のもの。バージョン番号や仕様は変わるため、最新は[公式ドキュメント](https://code.claude.com/docs/en/model-config)を参照。*
