---
title: "Claude Code の statusLine が表示されない原因は PowerShell の起動遅延"
description: "Windows + Git Bash 環境で Claude Code の statusLine が空白になる問題。原因はスクリプトのロジックではなく pwsh.exe の起動の遅さで、完了前に次の更新が来て実行がキャンセルされていました。Node.js に移植して 1411ms → 143ms に短縮し、表示が安定しました。"
pubDate: 2026-06-27
tags: ["Claude Code", "PowerShell", "Node.js", "Windows"]
originalUrl: "https://zenn.dev/masaki_mori72/articles/851b1580cb72b6"
---
## 症状

Windows + Git Bash 環境で、Claude Code のステータスラインが完全に空白になりました。エラーは一切出ません。

```json
// ~/.claude/settings.json
{
  "statusLine": {
    "type": "command",
    "command": "/c/Program Files/PowerShell/7/pwsh.exe -NoProfile -File ~/.claude/statusline.ps1"
  }
}
```

## 対応

結論から言うと、statusLine のスクリプトを PowerShell から Node.js に移植したら直りました。ロジックは同じで、ランタイムだけを変えています。

```js
#!/usr/bin/env node
// statusline.js
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  const data = JSON.parse(raw || '{}');
  const model = data?.model?.display_name || 'Unknown';
  const pct = Math.round(Number(data?.context_window?.used_percentage ?? 0));

  const bar = (p) => '█'.repeat(Math.floor(p / 10)) + '░'.repeat(10 - Math.floor(p / 10));
  process.stdout.write(`Context:${bar(pct)} ${pct}% | Model: ${model}`);
});
```

```diff
  "statusLine": {
    "type": "command",
-   "command": "/c/Program Files/PowerShell/7/pwsh.exe -NoProfile -File ~/.claude/statusline.ps1"
+   "command": "node ~/.claude/statusline.js"
  },
```

```sh
$ time (echo '...' | node statusline.js)
real    0m0.143s
```

PowerShell 版は 1411ms、Node.js 版は 143ms。約10倍速くなり、表示も安定しました。なぜ実行時間の差が症状に直結するのか、以下で確かめます。

※ 今使っている statusLine の全体（利用上限の表示なども入ったもの）は、[私の Claude Code statusline 設定](/articles/claude-code-statusline) で紹介しています。

## 調査

スクリプト単体は正しく動きます。出力内容にも問題はありません。

```sh
$ echo '{"model":{"display_name":"Sonnet"},"context_window":{"used_percentage":10}}' \
  | "/c/Program Files/PowerShell/7/pwsh.exe" -NoProfile -File statusline.ps1

5h:███████░░░ 5% | Context:█░░░░░░░░░ 10% | Model: Sonnet | v1.0
```

実行時間を計測すると、原因はロジックではなく、プロセスの起動そのものにあると分かりました。

```sh
$ time (echo '...' | pwsh.exe -NoProfile -File statusline.ps1)
real    0m1.411s

$ time (pwsh.exe -NoProfile -Command "1")   # 何もしないコマンド
real    0m0.687s
```

何もしないコマンドでも 687ms かかります。スクリプトの内容は変えずに、ランタイムだけを変えて比較しました。

| コマンド | 実行時間 |
|---|---|
| `pwsh.exe -Command "1"`（何もしない） | 687ms |
| `pwsh.exe -File statusline.ps1`（実処理） | 1411ms |
| `bash -c 'echo hi'`（何もしない） | 65ms |
| `node -e "console.log(1)"`（何もしない） | 118ms |
| `node statusline.js`（実処理） | 143ms |

`pwsh.exe` は、何もしない状態だけで、ほかのランタイムの実処理込みより遅いことが分かります。

## 原因の仕組み

[公式ドキュメント](https://code.claude.com/docs/en/statusline) のトラブルシューティングの項目に、この挙動が書かれています。

```text
Your script runs after each new assistant message, after /compact finishes,
when the permission mode changes, or when vim mode toggles. Updates are
debounced at 300ms, meaning rapid changes batch together and your script
runs once things settle. If a new update triggers while your script is
still running, the in-flight execution is cancelled.

Slow scripts block the status line from updating until they complete.
Keep scripts fast to avoid stale output.
```

スクリプトは「新しいアシスタントメッセージ」「`/compact` の完了」など、会話の進行に応じて起動されます。そして、スクリプトが実行中のまま次の更新が来ると、その実行は強制的にキャンセルされます。

1.4秒かかる PowerShell の起動は、この更新の間隔より遅いため、出力ができあがる前に毎回キャンセルされていました。

## 類似の Issue

同じように「PowerShell の statusLine が何も言わずに表示されなくなる」パターンは、ほかにも報告されています。

- [anthropics/claude-code #30725](https://github.com/anthropics/claude-code/issues/30725) — v2.1.68 にアップグレードしたあと描画されなくなった。bash + python に切り替えて復旧
- [anthropics/claude-code #6526](https://github.com/anthropics/claude-code/issues/6526) — PowerShell / Batch / Bash のどれでも表示されない。スクリプト自体は実行されているが、画面に反映されない
- [PowerShell/PowerShell #17734](https://github.com/PowerShell/PowerShell/issues/17734) — PowerShell Core 自体の起動が遅いという Issue。Microsoft のチューニング記事には「プロファイルの最適化で 1465ms → 217ms」という例もあります（[Optimizing your $Profile](https://devblogs.microsoft.com/powershell/optimizing-your-profile/)）

hooks でも同じような計測結果があります（[netnerds.net](https://blog.netnerds.net/2026/02/claude-code-powershell-hooks/)）。`pwsh` は約300〜500ms、`bash` は約10〜50ms です。statusLine に限らず、処理のたびにプロセスを起動するもの全般で、同じ問題が起こり得ます。

## まとめ

| 項目 | 内容 |
|---|---|
| 症状 | statusLine が常に空白。エラーは出ない |
| 原因 | `pwsh.exe` の起動に1.4秒かかり、完了前に次の更新が来て、実行中の処理がキャンセルされる |
| 対応 | Node.js に移植し、143ms まで短縮 |

外部コマンドを毎回起動して結果を待つ仕組み（statusLine や hooks など）では、ロジックが正しいことより先に、**起動にかかる時間が更新の間隔より短いこと** が前提になります。

## 参考文献

- [Customize your status line - Claude Code Docs](https://code.claude.com/docs/en/statusline)
- [Troubleshoot PowerShell startup issues - Microsoft Learn](https://learn.microsoft.com/en-us/powershell/scripting/dev-cross-plat/performance/startup-performance?view=powershell-7.6)
- [Optimizing your $Profile - PowerShell Team](https://devblogs.microsoft.com/powershell/optimizing-your-profile/)
- [anthropics/claude-code #30725](https://github.com/anthropics/claude-code/issues/30725)
- [anthropics/claude-code #6526](https://github.com/anthropics/claude-code/issues/6526)
- [PowerShell/PowerShell #17734](https://github.com/PowerShell/PowerShell/issues/17734)
- [Fixing Claude Code's PowerShell Problem with Hooks - netnerds.net](https://blog.netnerds.net/2026/02/claude-code-powershell-hooks/)
