---
title: "Claude Code に危ないことをさせない設定（git clean・force push は hooks で止め、.env は deny で読ませない）"
description: "Claude Code が実行した git clean で .env やデータが消えたのをきっかけに、PreToolUse フックで危険な git コマンドを止め、permissions.deny で .env や credentials を読ませないようにしました。実際の設定とスクリプト、どちらも文字列で判定しているためにすり抜けが防ぎきれない理由と、ほかに重ねている対策をまとめます。"
pubDate: 2026-10-10
updatedDate: 2026-11-18
tags: ["Claude Code", "hooks", "git", "セキュリティ"]
---
Claude Code に作業を任せていたら、`git clean` が実行されて **`.env` やデータファイルが消えました**。

復旧はできましたが、API キーを設定し直したりデータを戻したりと、かなり手間がかかりました。許可確認で毎回止める運用にすれば防げますが、それでは任せる意味が薄れます。

そこで、取り返しのつかない操作だけは機械的に止めるようにしました。使っている仕組みは2つです。

| 守りたいもの | 仕組み | 止めるもの |
|---|---|---|
| 作業ツリーとリモートの履歴 | **hooks**（`PreToolUse`） | `git clean`・`git reset --hard`・force push |
| `.env` などの秘密情報 | **`permissions.deny`** | `.env`・`credentials/` を読む操作 |

**環境**：Windows 10 / Git Bash / jq / Claude Code

## 危険な git 操作を hooks で止める

### 止めるコマンド

| コマンド | 何が危ないか |
|---|---|
| `git reset --hard` | 未コミットの変更が消える。`git add` しただけの新しいファイルも消える |
| `git clean` | 追跡していないファイル（`.env`、データ、`.claude/` など）が消える |
| `git push --force` / `-f` | リモートの履歴を上書きして壊す |

Git で追跡していないファイルは、`git reset --hard` では消えませんが、`git clean` では消えます。`.gitignore` に入れている `.env` も、`-x` を付けた `git clean -fdx` なら消えます。「作業ツリーをきれいにする」つもりで `git reset --hard` と `git clean` をセットで実行されると、未コミットの変更も追跡外のファイルもまとめて消えます。なので、この3つは全部止めることにしました。

`git push --force-with-lease` は、リモートが自分の知っている状態のときだけ上書きする安全寄りの force push なので、こちらは通します。

### 設定（settings.json）

`~/.claude/settings.json` に、Bash ツールの実行前（`PreToolUse`）に呼ばれるフックを登録します。ユーザー設定に書いておけば、全プロジェクトで効きます。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash C:/Users/<ユーザー名>/.claude/hooks/block-dangerous.sh",
            "shell": "bash"
          }
        ]
      }
    ]
  }
}
```

### スクリプト（block-dangerous.sh）

フックには、実行しようとしているツールの情報が JSON で標準入力に渡されます。Bash ツールなら `tool_input.command` にコマンド文字列が入っているので、それを `jq` で取り出して判定します。

```bash
#!/bin/bash
CMD=$(jq -r '.tool_input.command // ""')

case "$CMD" in
  *"git clean"*)
    jq -n '{"continue": false, "stopReason": "git clean はブロックされています。.env・data/・.claude/ 削除の危険があります。手動実行は ! git clean を使ってください。"}'
    ;;
  *"git push"*"--force-with-lease"*)
    echo '{"continue": true}'
    ;;
  *"git push"*"--force"*|*"git push"*" -f"*)
    jq -n '{"continue": false, "stopReason": "force push はブロックされています。リモート履歴破壊の危険があります。手動実行は ! git push --force を使ってください。"}'
    ;;
  "git reset --hard"*|*"git reset"*"--hard"*)
    jq -n '{"continue": false, "stopReason": "git reset --hard はブロックされています。未コミット変更が失われる危険があります。手動実行は ! git reset --hard を使ってください。"}'
    ;;
  *)
    echo '{"continue": true}'
    ;;
esac
```

ポイントは次のとおりです。

- **`--force-with-lease` を先に判定する**：`--force-with-lease` の文字列には `--force` が含まれるので、順番を逆にすると安全な方まで止まります。`case` は上から順に見るので、許可する方を先に書いています
- **`"continue": false` で Claude ごと止める**：コマンドが実行されないだけでなく、Claude の処理自体がそこで止まり、`stopReason` が表示されます。「別の方法で消そうとする」前に、人間が状況を見て判断できるようにしたかったので、あえて止める方にしています
- **止めたメッセージに手動実行の方法を書く**：本当に必要なときは、プロンプトで `! git reset --hard` のように `!` を付けて自分で実行します。止められたときに次に何をすればいいか迷わないよう、メッセージに書いておきました

## .env を deny で読ませない

`.env` には API キーなどの秘密情報が入っているので、読まれると会話の中にそのまま表示されてしまいます。実際に読まれたことはありませんが、許可確認を減らして任せる場面が増えてきたので、**予防として** 読み取りを禁止しています。

### 設定

同じく `~/.claude/settings.json` の `permissions.deny` に書いています。

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

## どちらも「柵」であって「壁」ではない

hooks のスクリプトも、Bash の deny も、**コマンドの文字列にパターンが含まれるかどうか** を見ているだけです。なので、書き方を変えればすり抜けられます。

hooks（git）の場合：

- `git -C path clean -fd` のように、`git` とサブコマンドの間にオプションが入る
- `git push origin +main` のように、refspec の `+` で force push する
- git のエイリアスや、シェルスクリプト経由での実行

逆に、コミットメッセージに `git clean` という文字列が入っているだけでも止まってしまいます。

deny（.env）の場合：

- 並べていないコマンドを使う：`python` や `node` でファイルを開く、PowerShell の `Get-Content`
- リダイレクトを使う：`cat < .env`
- 一度コピーしてから読む：`cp .env tmp.txt` してから `cat tmp.txt`
- 読み込んでから表示する：`source .env` してから `echo $API_KEY`、`printenv`
- ディレクトリごと検索する：`grep -r API_KEY .` のように、パスに `.env` が出てこない書き方

なお Read ツールの deny はファイルのパスで判定するので、こちらは比較的しっかり効きます。

すべての書き方をパターンで止めるのは無理なので、どちらも **「AI がよくやる書き方」をうっかり実行させないための柵** と割り切っています。それでも、`git clean` 一発で消える事故は、これで防げるようになりました。

## ほかに重ねている対策

柵だけに頼らず、いくつか重ねています。

- **CLAUDE.md にも書く**：グローバルの `CLAUDE.md` に「`.env` 読取禁止」と書いています。Claude はふつう指示に従うので、すり抜ける書き方をわざわざ探すことはまずありません。hooks や deny は、それでもうっかり実行したときの最後の止め役です
- **秘密情報は `.env` に集める**：コードや設定ファイルに直接書かず、`.env` と `credentials/` にまとめておけば、deny で守る範囲がはっきりします
- **漏れた前提で備える**：API キーはできるだけ権限を絞ったものを使い、表示されてしまったら再発行する
- **こまめにコミットする**：`git reset --hard` がすり抜けても、コミット済みのものは戻せます

## まとめ

- `PreToolUse` フックで、Bash のコマンドを実行前にチェックできる。`git reset --hard`・`git clean`・force push を止め、`--force-with-lease` は通す
- `permissions.deny` で、Read ツールと、中身を表示する Bash コマンドから `.env` を守れる
- どちらも文字列のパターン判定なので、すり抜けはある。うっかり事故を防ぐ柵として使い、CLAUDE.md の指示や漏れたときの備えと重ねておく

ほかの設定も含めた全体像は、[私の Claude Code 設定ツアー](/articles/claude-code-settings-tour/) にまとめています。
