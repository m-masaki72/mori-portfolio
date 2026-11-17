---
title: "私の Claude Code statusline 設定（利用上限・コンテキストをバーで表示。PowerShell だと表示されない理由も）"
description: "Claude Code の statusline に、5時間・7日の利用上限の使用率とリセットまでの残り時間、コンテキストの使用率、モデル名を表示しています。Node.js で書いたスクリプトの全文と、PowerShell 版では statusline が空白になった原因（起動 1411ms で更新に間に合わずキャンセルされる）をまとめます。"
pubDate: 2026-10-10
updatedDate: 2026-11-18
tags: ["Claude Code", "statusline", "Node.js", "PowerShell", "Windows"]
---
Claude Code の画面下に出る **statusline** は、自分でスクリプトを書いて中身を変えられます。

わたしは、ここに **利用上限の使用率・コンテキストの使用率・モデル名** を出しています。作業中にいちばん気にする数字を、いつも目に入る場所に置いておくためです。

最初は PowerShell で書いていましたが、**statusline が空白のまま何も表示されない** 状態になり、Node.js に書き直しました。その原因も後半にまとめています。

**環境**：Windows 10 / Git Bash / Node.js / Claude Code

## 表示はこうなる

```text
5h:██████░░░░ 63% ~2h15m | 7d:█████████░ 91% ~3d04h | Context:████░░░░░░ 42% | Model: Opus 5.5 | C:\Users\me\repos\my-app | v2.1.300
```

実際の画面では色が付いています。

| 表示 | 中身 | 色 |
|---|---|---|
| `5h:` | 5時間ごとの利用上限の使用率と、リセットまでの残り時間 | シアン |
| `7d:` | 7日ごとの利用上限の使用率と、リセットまでの残り日数 | マゼンタ |
| `Context:` | コンテキストウィンドウの使用率 | 黄 |
| `Model:` | 今使っているモデル | なし |
| パス・`v...` | 作業ディレクトリと Claude Code のバージョン | なし |

どのバーも、90% を超えると太字になって目立つようにしています。

## なぜこの3つを見るのか

### 利用上限（5h / 7d）

一番よく見るのがここです。上限に近いときは重い作業を後回しにしたり、リセットまでの残り時間を見て「あと2時間で戻るから、それまで軽い作業をしよう」と決めたりします。

使用率だけだといつ戻るのか分からないので、**リセットまでの残り時間も一緒に出す** のがポイントです。

### Context

コンテキストの使用率が高くなると、そのうち自動で圧縮（compact）されます。大きな作業の途中で圧縮されるより、区切りのいいところで自分から `/compact` するか、新しい会話にしたいので、残りがどれくらいかを見ています。

### Model

[タスクの難しさでモデルを使い分けている](/articles/claude-code-model-selection/) ので、今どのモデルで動いているかがすぐ分かるようにしています。軽い質問のために切り替えたモデルのまま、重い作業を始めてしまうのを防げます。

## 設定

`~/.claude/settings.json` で、statusline を出すコマンドを指定します。

```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:/Users/<ユーザー名>/.claude/statusline.js"
  }
}
```

Claude Code は、セッションの情報を JSON にして、このコマンドの標準入力に渡してくれます。スクリプトはそれを読んで、表示したい文字列を標準出力に書くだけです。

## スクリプト全文（statusline.js）

```js
#!/usr/bin/env node
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let data = {};
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }

  const esc = '\x1b';
  const color = (text, code) => `${esc}[${code}m${text}${esc}[0m`;

  const model = data?.model?.display_name || 'Unknown';
  const version = data?.version || '?';
  const cwd = data?.workspace?.current_dir || data?.cwd || '';
  const contextPct = Math.round(Number(data?.context_window?.used_percentage ?? 0));

  function makeBar(pct, code) {
    const width = 10;
    const filled = Math.floor((pct * width) / 100);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty) + ` ${pct}%`;
    if (pct >= 90) code = `${code};1`;
    return color(bar, code);
  }

  function formatRemain(resetsAt, unit) {
    if (!resetsAt) return '';
    const now = Math.floor(Date.now() / 1000);
    const remain = Number(resetsAt) - now;
    if (remain <= 0) return '';
    if (unit === 'h') {
      const hours = Math.floor(remain / 3600);
      const mins = Math.floor((remain % 3600) / 60);
      return ` ~${hours}h${String(mins).padStart(2, '0')}m`;
    }
    const days = Math.floor(remain / 86400);
    const hours = Math.floor((remain % 86400) / 3600);
    return ` ~${days}d${String(hours).padStart(2, '0')}h`;
  }

  const cyan = 96;
  const magenta = 95;
  const yellow = 93;

  const rateParts = [];

  const fivePct = data?.rate_limits?.five_hour?.used_percentage;
  if (fivePct != null) {
    const fiveInt = Math.round(Number(fivePct));
    const suffix = formatRemain(data?.rate_limits?.five_hour?.resets_at, 'h');
    rateParts.push(color('5h:', cyan) + makeBar(fiveInt, cyan) + suffix);
  }

  const sevenPct = data?.rate_limits?.seven_day?.used_percentage;
  if (sevenPct != null) {
    const sevenInt = Math.round(Number(sevenPct));
    const suffix = formatRemain(data?.rate_limits?.seven_day?.resets_at, 'd');
    rateParts.push(color('7d:', magenta) + makeBar(sevenInt, magenta) + suffix);
  }

  const rateStr = rateParts.length > 0 ? rateParts.join(' | ') + ' | ' : '';
  const contextStr = color('Context:', yellow) + makeBar(contextPct, yellow);

  process.stdout.write(`${rateStr}${contextStr} | Model: ${model} | ${cwd} | v${version}`);
});
```

### 読み取っている項目

| JSON のキー | 使い道 |
|---|---|
| `model.display_name` | モデル名 |
| `context_window.used_percentage` | コンテキストの使用率 |
| `rate_limits.five_hour.used_percentage` / `resets_at` | 5時間枠の使用率とリセット時刻（UNIX 秒） |
| `rate_limits.seven_day.used_percentage` / `resets_at` | 7日枠の使用率とリセット時刻（UNIX 秒） |
| `workspace.current_dir` | 作業ディレクトリ |
| `version` | Claude Code のバージョン |

`rate_limits` が入力に無いときは、5h・7d の表示ごと省くようにしています。JSON が読めなかったときも、空のデータとして最後まで表示できるようにしてあります。

## PowerShell で書いたら statusline が空白になった

### 症状

最初は同じ内容を PowerShell で書いて、こう指定していました。

```json
"statusLine": {
  "type": "command",
  "command": "/c/Program Files/PowerShell/7/pwsh.exe -NoProfile -File ~/.claude/statusline.ps1"
}
```

すると、statusline が **完全に空白** になりました。エラーは一切出ません。

### スクリプトは正しく、遅いだけだった

スクリプトを単体で実行すると、出力は正しく出ます。

```sh
$ echo '{"model":{"display_name":"Sonnet"},"context_window":{"used_percentage":10}}' \
  | "/c/Program Files/PowerShell/7/pwsh.exe" -NoProfile -File statusline.ps1

5h:███████░░░ 5% | Context:█░░░░░░░░░ 10% | Model: Sonnet | v1.0
```

そこで実行時間を測ると、原因はロジックではなく、**プロセスの起動そのもの** にありました。中身は変えずに、ランタイムだけを変えて比べた結果です。

| コマンド | 実行時間 |
|---|---|
| `pwsh.exe -Command "1"`（何もしない） | 687ms |
| `pwsh.exe -File statusline.ps1`（実処理） | 1411ms |
| `bash -c 'echo hi'`（何もしない） | 65ms |
| `node -e "console.log(1)"`（何もしない） | 118ms |
| `node statusline.js`（実処理） | 143ms |

`pwsh.exe` は、何もしないだけで、Node.js の実処理込みより遅いことが分かります。

### 遅いと表示されない仕組み

[公式ドキュメント](https://code.claude.com/docs/en/statusline) のトラブルシューティングに、この挙動が書かれています。

```text
Your script runs after each new assistant message, after /compact finishes,
when the permission mode changes, or when vim mode toggles. Updates are
debounced at 300ms, meaning rapid changes batch together and your script
runs once things settle. If a new update triggers while your script is
still running, the in-flight execution is cancelled.
```

statusline のスクリプトは、新しいメッセージが来るたびなどに起動されます。そして **実行中に次の更新が来ると、その実行はキャンセル** されます。1.4秒かかる PowerShell 版は、出力ができあがる前に毎回キャンセルされていたわけです。

ロジックはそのままで Node.js に移したところ、**1411ms → 143ms** になり、表示が安定しました。上で紹介したスクリプトがその Node.js 版です。

### 同じ症状の報告

「PowerShell の statusline が何も言わずに表示されない」という報告は、ほかにもあります。

- [anthropics/claude-code #30725](https://github.com/anthropics/claude-code/issues/30725)：v2.1.68 にしてから描画されなくなった。bash + python に切り替えて復旧
- [anthropics/claude-code #6526](https://github.com/anthropics/claude-code/issues/6526)：スクリプトは実行されているのに、画面に反映されない
- [PowerShell/PowerShell #17734](https://github.com/PowerShell/PowerShell/issues/17734)：PowerShell 7 自体の起動が遅いという Issue。Microsoft の記事には、プロファイルの見直しで 1465ms → 217ms になった例もあります（[Optimizing your $Profile](https://devblogs.microsoft.com/powershell/optimizing-your-profile/)）

hooks でも同じような計測があり（[netnerds.net](https://blog.netnerds.net/2026/02/claude-code-powershell-hooks/)）、`pwsh` は約300〜500ms、`bash` は約10〜50ms だそうです。statusline に限らず、**処理のたびにプロセスを起動する仕組み** では、ロジックが正しいことより先に、起動が更新の間隔より速いことが前提になります。

## まとめ

- statusline は、標準入力の JSON を読んで文字列を出すだけのスクリプトで自由に作れる
- 利用上限（5h / 7d）は **使用率とリセットまでの残り時間をセットで** 出すと、作業の順番を決めやすい
- コンテキストの使用率とモデル名も出しておくと、compact のタイミングやモデルの切り替え忘れに気づける
- PowerShell 版は起動に 1.4秒かかり、次の更新でキャンセルされて空白になった。Windows でも Node.js で書くのがおすすめ

ほかの設定も含めた全体像は、[私の Claude Code 設定ツアー](/articles/claude-code-settings-tour/) にまとめています。

## 参考文献

- [Customize your status line - Claude Code Docs](https://code.claude.com/docs/en/statusline)
- [Troubleshoot PowerShell startup issues - Microsoft Learn](https://learn.microsoft.com/en-us/powershell/scripting/dev-cross-plat/performance/startup-performance?view=powershell-7.6)
- [Optimizing your $Profile - PowerShell Team](https://devblogs.microsoft.com/powershell/optimizing-your-profile/)
- [Fixing Claude Code's PowerShell Problem with Hooks - netnerds.net](https://blog.netnerds.net/2026/02/claude-code-powershell-hooks/)
