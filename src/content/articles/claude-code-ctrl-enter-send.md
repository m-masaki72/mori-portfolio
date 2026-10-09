---
title: "Claude Code を「Ctrl+Enter / Cmd+Enter で送信」にする（Windows Terminal・iTerm2）"
description: "Claude Code を Enter で改行・Ctrl+Enter（Mac は Cmd+Enter）で送信にする設定。Windows Terminal と iTerm2 の両方で、ターミナル側と Claude Code 側に必要な設定とハマりどころをまとめました。"
pubDate: 2026-10-03
tags: ["Claude Code", "Windows Terminal", "iTerm2"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2026/10/03/014641"
---
送信キーを全部 Ctrl+Enter（Mac は Cmd+Enter）にそろえて、脳のコンテキストを減らしたい。そう思って、Claude Code（CLI）を **Enter で改行・Ctrl+Enter（Mac は Cmd+Enter）で送信** にしました。

Windows Terminal・iTerm2 のどちらも、ターミナル側と Claude Code 側の両方の設定が必要でした。

※ 2026-10-04 追記：Mac（iTerm2）の手順を記事の末尾に追加しました。

**環境**：Windows 10 / Windows Terminal 1.24 / PowerShell 7.6 / Claude Code 2.1.286

## 解決方法

### 1. Windows Terminal の settings.json

Ctrl+Enter を押したら「Ctrl+X → Enter」を送るようにします。

```json
"actions": [
    {
        "command": { "action": "sendInput", "input": "\u0018\r" },
        "id": "User.sendInput.CtrlEnter"
    }
],
"keybindings": [
    { "id": "User.sendInput.CtrlEnter", "keys": "ctrl+enter" }
]
```

### 2. Claude Code の ~/.claude/keybindings.json

Enter を改行にします。

```json
{
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "enter": "chat:newline"
      }
    }
  ]
}
```

これで完了です。タブを開き直すと反映されます。

## デメリット（動きへの影響）

- **Windows Terminal のすべてのタブで Ctrl+Enter が変わります**。プロファイルごとには設定できません。
- **PowerShell では Ctrl+Enter でコマンドが実行されます**。文字を選択したまま押すと、選択部分が切り取られてから実行されます。
- PowerShell 本来の Ctrl+Enter（上に行を挿入）は使えなくなります。
- WSL の bash など、ほかのシェルでも Ctrl+Enter の動きが変わります（Ctrl+X の意味がシェルごとに違うため）。
- Claude Code で補完候補が出ているときに Ctrl+Enter を押すと、候補を確定せずにそのまま送信します。

## 参考：中身の挙動

### なぜ両方の設定が必要か

Windows Terminal 1.24 + Windows 版 Claude Code では、Ctrl+Enter が Ctrl+Enter として認識されません（何も設定しないと改行になります）。Windows の入力の変換経路で修飾キーの情報が落ちるためと考えられ、Claude Code の設定だけでは解決できません。

そこで Windows Terminal 側で、Ctrl+Enter を別の信号「Ctrl+X → Enter」に置き換えています。

### なぜ「Ctrl+X → Enter」なのか

Claude Code には、**Ctrl+X → Enter で送信する割り当てが最初からあります**（`chat:queueSubmit`）。これを使えば、Claude Code 側には送信キーを追加しなくて済みます。

この送信は、Claude が作業中なら割り込まずに順番待ちになります。普段の Enter 送信と同じ感覚です。

### うまくいかなかった方法

| 方法 | 結果 |
|---|---|
| Claude Code に `"ctrl+enter": "chat:submit"` を書くだけ | Ctrl+Enter として認識されない |
| Windows Terminal から `\u001b[13;5u`（Ctrl+Enter を表す信号）を送る | 何も起きない |
| Windows Terminal から ESC+Enter を送り、Alt+Enter を送信に割り当てる | 改行になる |
| Claude Code で Ctrl+J を送信に割り当てる | Enter も Ctrl+Enter も改行になる |

### きれいな方法はまだ無い

2026年10月時点で、これといったベストプラクティスは見つかりませんでした。Windows Terminal か Claude Code のどちらかが Ctrl+Enter をそのまま扱えるようになれば、この回避策は要らなくなります。

## 追記：Mac（iTerm2）で「Cmd+Enter で送信」にする

Mac の iTerm2 でも、**Enter で改行・Cmd+Enter で送信** にしました。仕組みは Windows と同じで、Cmd+Enter を「Ctrl+X → Enter」に置き換えます。

**環境**：macOS 15.7.1 / iTerm2 3.7.3 / Claude Code 2.1.289

### 1. iTerm2 の Key Bindings

Settings → **Keys → Key Bindings**（Profiles の中ではなく、上部の Keys タブ）で `+` を押し、次のように設定します。

| 項目 | 値 |
|---|---|
| Keyboard Shortcut | `⌘↩` |
| Action | Send Hex Code |
| 値 | `0x18 0x0d`（Ctrl+X → Enter） |

### 2. Claude Code の ~/.claude/keybindings.json

Windows と同じです。Enter を改行にします。

```json
{
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "enter": "chat:newline"
      }
    }
  ]
}
```

Claude Code を再起動すると反映されます。Windows と同じく、Claude が作業中に送ると割り込まずに順番待ちになります。

### なぜ両方の設定が必要か

ターミナルは Cmd キーをアプリに渡しません。そのため Claude Code に `cmd+enter` を書いても反応しません。iTerm2 側で Cmd+Enter を、Claude Code にもともと用意されている送信キー「Ctrl+X → Enter」に置き換えています。

### ハマったところ

**iTerm2 では Cmd+Enter が最初からフルスクリーン切替に割り当てられています。** 割り当てが効いていないと、押すたびにウィンドウが最大化されます。全プロファイル共通の Keys → Key Bindings に入れたら、フルスクリーン切替より優先されました。

いきなり最終形にせず、まず値を `0x0d`（Enter）にして「Cmd+Enter で送信できるか」を確かめてから、`0x18 0x0d` に変えると、どこで失敗したのか切り分けやすいです。

### デメリット

- **iTerm2 のすべてのプロファイルで Cmd+Enter が変わります**。Cmd+Enter でのフルスクリーン切替は使えなくなります。
- シェルなど Claude Code 以外の画面で Cmd+Enter を押すと、Ctrl+X → Enter が送られます（Ctrl+X の意味はシェルごとに違います）。

### 参考文献

- [Customize keyboard shortcuts - Claude Code Docs](https://code.claude.com/docs/en/keybindings)
- [Configure your terminal for Claude Code - Claude Code Docs](https://code.claude.com/docs/en/terminal-config)
- [anthropics/claude-code #5064（Windows Terminal で Ctrl+Enter が改行になる件）](https://github.com/anthropics/claude-code/issues/5064)
- [anthropics/claude-code #92771（Windows 版で修飾キーが失われる件）](https://github.com/anthropics/claude-code/issues/92771)
- [microsoft/terminal #5790（プロファイル別キー設定の要望・未実装）](https://github.com/microsoft/terminal/issues/5790)
- [PSReadLine のキー割り当て一覧](https://learn.microsoft.com/en-us/powershell/module/psreadline/about/about_psreadline_functions)
