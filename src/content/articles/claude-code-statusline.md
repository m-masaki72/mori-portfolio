---
title: "私の Claude Code statusline 設定（利用上限・コンテキスト・モデルをバーで表示）"
description: "Claude Code の statusline に、5時間・7日の利用上限の使用率とリセットまでの残り時間、コンテキストの使用率、モデル名を表示しています。Node.js で書いたスクリプトの全文と、表示している項目を選んだ理由を紹介します。"
pubDate: 2026-10-10
tags: ["Claude Code", "statusline", "Node.js"]
---
Claude Code の画面下に出る **statusline** は、自分でスクリプトを書いて中身を変えられます。

わたしは、ここに **利用上限の使用率・コンテキストの使用率・モデル名** を出しています。作業中にいちばん気にする数字を、いつも目に入る場所に置いておくためです。

**環境**：Windows 10 / Node.js / Claude Code

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

[タスクの難しさでモデルを使い分けている](/articles/claude-code-model-selection) ので、今どのモデルで動いているかがすぐ分かるようにしています。軽い質問のために切り替えたモデルのまま、重い作業を始めてしまうのを防げます。

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

## PowerShell ではなく Node.js で書いている理由

最初は PowerShell で書いていましたが、**pwsh の起動が遅く、statusline が表示されない** ことがありました。statusline のスクリプトは更新のたびに起動されて、終わる前に次の更新が来ると取り消されてしまうためです。

Node.js に書き直したら、実行時間が約1.4秒から約0.14秒になり、表示が安定しました。原因の調べ方と計測結果は、別の記事に詳しく書いています。

→ [Claude Code の statusLine が表示されない原因は PowerShell の起動遅延](/articles/claude-code-statusline-powershell-slow)

## まとめ

- statusline は、標準入力の JSON を読んで文字列を出すだけのスクリプトで自由に作れる
- 利用上限（5h / 7d）は **使用率とリセットまでの残り時間をセットで** 出すと、作業の順番を決めやすい
- コンテキストの使用率とモデル名も出しておくと、compact のタイミングやモデルの切り替え忘れに気づける
- Windows では、起動の速い Node.js で書くのがおすすめ
