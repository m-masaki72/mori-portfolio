---
title: "Windows で Claude Code を使うときのハマりどころ（Git Bash・ヒアドキュメント・CRLF・子プロセス）"
description: "Windows で Claude Code を毎日使っていて実際に踏んだハマりどころを4つまとめました。Bash ツールの正体が Git Bash であること、ヒアドキュメントの崩れ、CRLF、止めたはずの子プロセスが残る問題と、それぞれ CLAUDE.md にどう書いて防いでいるかを紹介します。"
pubDate: 2026-10-10
tags: ["Claude Code", "Windows", "Git Bash"]
---
Windows で Claude Code を使っていると、Mac や Linux ではまず起きないところでつまずきます。

ここでは、実際に踏んだものを4つまとめます。どれも一度踏んだあとで、グローバルの `CLAUDE.md`（`~/.claude/CLAUDE.md`）にルールとして書き、Claude に毎回守らせるようにしています。

**環境**：Windows 10 / Git Bash / PowerShell 7 / Claude Code

## 1. Bash ツールの正体は Git Bash

Windows の Claude Code で Bash ツールを使うと、実際に動くのは **Git Bash** です。PowerShell でも cmd でもありません。

ところが Claude は「Windows だから」と、つい PowerShell や cmd の書き方を混ぜてきます。

| 混ざりがちな書き方 | Git Bash での正しい書き方 |
|---|---|
| `$env:HOME` / `%USERPROFILE%` | `$HOME` / `$USERPROFILE` |
| `> NUL` | `> /dev/null` |
| `C:\Users\...` | `/c/Users/...` |

もうひとつのクセが、`/` で始まる引数の扱いです。Git Bash は `/PID` のような引数をパスだと思って変換してしまうので、Windows のコマンドにオプションを渡すときは `//PID` のようにスラッシュを2つ重ねます。

```sh
taskkill //PID 1234 //F
```

`CLAUDE.md` にはこう書いています。

```md
- bashツールはGit Bash（POSIX sh）なのでUnixパス・`$VAR`構文を使う。PowerShell/cmd構文はファイル内容（Windowsパス指定時など）でのみ使用
```

## 2. ヒアドキュメントや `python -c` が崩れる

Claude はファイルを作るときや短い Python を実行するとき、ヒアドキュメント（`<<EOF`）や `python -c "..."` に複数行のコードを埋め込みがちです。

これが Windows の環境だと崩れることがありました。特に複数行の Python は、インデントがずれて `IndentationError` になりやすいです。

対策は「埋め込まずにファイルにする」です。Claude Code には Write ツールがあるので、スクリプトをファイルとして書かせてから実行させれば、崩れる余地がありません。

```md
- ヒアドキュメント（`<<EOF`等）は崩れやすい。使わず、Write/Editツールでスクリプトファイル（.sh/.py）を作成→実行する方式に統一する
- python -c や複数行コマンドの埋め込みも避け、一時スクリプトファイル化する
```

## 3. CRLF でスクリプトが壊れる

Windows 側で作ったり編集したりしたシェルスクリプトが、改行コード **CRLF** になっていることがあります。見た目は同じでも、Bash から見ると各行の末尾に `\r` が付いているので、

- シェバン（`#!/bin/bash`）が `bash\r` と解釈されて実行できない
- `for` ループや `xargs` に渡す値に `\r` が混ざり、ファイルが見つからない

といった、原因が分かりにくい壊れ方をします。

改行は LF に統一しておくのが一番です。リポジトリなら `.gitattributes` で固定できます。

```gitattributes
*.sh text eol=lf
```

すでに CRLF になってしまったファイルは、次のコマンドで直せます。

```sh
sed -i 's/\r$//' script.sh
```

## 4. 止めたはずの子プロセスが残る

これが一番痛かったものです。

Claude Code では、時間のかかる処理をバックグラウンドタスクとして走らせて、途中で止められます。ところが Windows では、**タスクを止めても、その中で起動した子プロセス（python など）が残り続ける** ことがありました。

GPU で画像を生成する処理を止めて、設定を変えてもう一度走らせたところ、前の python がまだ GPU を使っていて、**生成が二重に走って遅くなる** ということが起きました。止めたつもりなので、遅い原因になかなか気づけません。

今は、タスクを止めた直後と、新しい処理を始める前に、残っているプロセスを確認させています。

```sh
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"name='python3.exe'\" | Select-Object ProcessId,CommandLine"
```

コマンドラインまで表示されるので、どのスクリプトの残りかが分かります。残っていたら `taskkill //PID <pid> //F` で終了させます。

## まとめ

- Windows の Bash ツールは Git Bash。PowerShell・cmd の書き方は使わない。`/` で始まる引数は `//` にする
- ヒアドキュメントや `python -c` に複数行を埋め込まず、ファイルに書いてから実行する
- 改行は LF に統一する。CRLF は `sed -i 's/\r$//'` で直せる
- バックグラウンドタスクを止めたら、子プロセスが残っていないか確認する

どれも一度踏めば対策は簡単です。ただ、Claude は会話をまたぐと忘れてしまうので、グローバルの `CLAUDE.md` に書いておくのが確実でした。
