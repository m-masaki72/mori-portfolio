---
title: "Claude Code に .env を読ませない deny 設定と、その限界"
description: "Claude Code に任せて作業するにあたり、.env や credentials を読ませないよう settings.json の permissions.deny を設定しています。実際の設定と、Bash コマンドのパターン指定ではすり抜けが防ぎきれない理由、ほかに重ねている対策をまとめます。"
pubDate: 2026-10-10
tags: ["Claude Code", "セキュリティ"]
---
Claude Code に作業を任せるとき、気になるのが `.env` です。API キーなどの秘密情報が入っているので、読まれると会話の中にそのまま表示されてしまいます。

実際に読まれたことはありませんが、許可確認を減らして任せる場面が増えてきたので、**予防として** `settings.json` の `permissions.deny` で読み取りを禁止しています。その設定と、それだけでは防ぎきれない理由をまとめます。

**環境**：Windows 10 / Git Bash / Claude Code

## 設定

ユーザー設定（`~/.claude/settings.json`）の `permissions.deny` に書いています。ユーザー設定に書いておけば、全プロジェクトで効きます。

```json
{
  "permissions": {
    "deny": [
      "Read(.env)",
      "Read(*.env)",
      "Read(.env.*)",
      "Read(**/.env)",
      "Read(**/*.env)",
      "Read(**/.env.*)",
      "Read(**/credentials/**)",

      "Bash(cat .env*)",
      "Bash(cat *.env*)",
      "Bash(grep .env*)",
      "Bash(grep *.env*)",
      "Bash(sed .env*)",
      "Bash(sed *.env*)",
      "Bash(cat **/credentials/**)"
    ]
  }
}
```

実際にはもっと長く、`cat` `grep` `sed` のほかに `head` `tail` `less` `more` `awk` `vim` `nano` `bat` `strings` `xxd` `od` `type` についても、`.env` と `credentials/` 向けに同じパターンを並べています。全部で40個ほどです。

### Read ツールの deny

`Read(...)` は、Claude Code の Read ツール（ファイルを開くツール）を止めます。

- `.env` そのものに加えて、`.env.local` のような `.env.*` と、`production.env` のような `*.env` も対象にしています
- `**/` を付けて、サブディレクトリにあるもの（`backend/.env` など）も止めます
- `credentials/` ディレクトリは、中身ごと止めています

### Bash ツールの deny

Read ツールを止めても、Claude は Bash で `cat .env` を実行すれば中身を見られます。そこで、ファイルの中身を表示できるコマンドを1つずつ止めています。

`Bash(cat .env*)` はカレントディレクトリの `.env` で始まるもの、`Bash(cat *.env*)` は `config/.env` のようにパスの途中に `.env` があるものを狙っています。

## 限界：Bash のパターンは文字列でしか判定していない

Read ツールの deny はファイルのパスで判定するので、比較的しっかり効きます。一方で Bash の deny は、**コマンドの文字列がパターンに合うかどうか** で判定しているだけです。なので、書き方を変えればすり抜けられます。

- 並べていないコマンドを使う：`python` や `node` でファイルを開く、PowerShell の `Get-Content`
- リダイレクトを使う：`cat < .env`
- 一度コピーしてから読む：`cp .env tmp.txt` してから `cat tmp.txt`
- 読み込んでから表示する：`source .env` してから `echo $API_KEY`、`printenv`
- ディレクトリごと検索する：`grep -r API_KEY .` のように、パスに `.env` が出てこない書き方

コマンドを40個並べても、すべての書き方をパターンで止めるのは無理です。**Bash の deny は「よくある読み方」を止める柵** で、壁ではないと割り切っています。これは、以前書いた [危険な git 操作を hooks で止める](/articles/claude-code-hooks-block-dangerous-git) と同じ考え方です。

## ほかに重ねている対策

deny だけに頼らず、いくつか重ねています。

- **CLAUDE.md にも書く**：グローバルの `CLAUDE.md` に「`.env` 読取禁止」と書いています。Claude はふつう指示に従うので、すり抜ける書き方をわざわざ探すことはまずありません。deny は、それでもうっかり読みにいったときの最後の止め役です
- **秘密情報は `.env` に集める**：コードや設定ファイルに直接書かず、`.env` と `credentials/` にまとめておけば、deny で守る範囲がはっきりします
- **漏れた前提で備える**：API キーはできるだけ権限を絞ったものを使い、表示されてしまったら再発行する

## まとめ

- `permissions.deny` で、Read ツールと、中身を表示する Bash コマンドから `.env` を守れる
- ただし Bash の deny は文字列のパターン判定なので、別のコマンドやリダイレクトですり抜けられる
- deny は柵として使い、CLAUDE.md の指示や、漏れたときの備えと重ねておく
