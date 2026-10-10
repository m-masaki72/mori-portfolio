---
title: "Claude Code の危険な git 操作を hooks で止める（git clean・force push・reset --hard）"
description: "Claude Code が実行した git clean で .env やデータが消えたのをきっかけに、PreToolUse フックで危険な git コマンドをブロックするようにしました。設定とスクリプト、文字列マッチならではの限界をまとめます。"
pubDate: 2026-10-10
tags: ["Claude Code", "hooks", "git"]
---
Claude Code に作業を任せていたら、`git clean` が実行されて **`.env` やデータファイルが消えました**。

復旧はできましたが、API キーを設定し直したりデータを戻したりと、かなり手間がかかりました。許可確認で毎回止める運用にすれば防げますが、それでは任せる意味が薄れます。

そこで Claude Code の **hooks** を使い、取り返しのつかない git コマンドだけは、実行される前に機械的に止めるようにしました。

**環境**：Windows 10 / Git Bash / jq / Claude Code

## 止めるコマンド

| コマンド | 何が危ないか |
|---|---|
| `git reset --hard` | 未コミットの変更が消える。`git add` しただけの新しいファイルも消える |
| `git clean` | 追跡していないファイル（`.env`、データ、`.claude/` など）が消える |
| `git push --force` / `-f` | リモートの履歴を上書きして壊す |

Git で追跡していないファイルは、`git reset --hard` では消えませんが、`git clean` では消えます。`.gitignore` に入れている `.env` も、`-x` を付けた `git clean -fdx` なら消えます。「作業ツリーをきれいにする」つもりで `git reset --hard` と `git clean` をセットで実行されると、未コミットの変更も追跡外のファイルもまとめて消えます。なので、この3つは全部止めることにしました。

`git push --force-with-lease` は、リモートが自分の知っている状態のときだけ上書きする安全寄りの force push なので、こちらは通します。

## 設定（settings.json）

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

## スクリプト（block-dangerous.sh）

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

## 文字列マッチの限界

このスクリプトは、コマンド文字列に特定の文字列が含まれるかを見ているだけです。なので、次のような書き方はすり抜けます。

- `git -C path clean -fd` のように、`git` とサブコマンドの間にオプションが入る
- `git push origin +main` のように、refspec の `+` で force push する
- git のエイリアスや、シェルスクリプト経由での実行

逆に、コミットメッセージに `git clean` という文字列が入っているだけでも止まってしまいます。

**すべての危険な操作を防ぐ仕組みではなく、「AI がよくやる書き方」をうっかり実行させないための安全柵** と割り切っています。それでも、`git clean` 一発で消える事故は、これで防げるようになりました。

## まとめ

- Claude Code の `PreToolUse` フックで、Bash ツールのコマンドを実行前にチェックできる
- `git reset --hard`・`git clean`・force push を止め、`--force-with-lease` は通す
- 文字列マッチなのですり抜けはあるが、うっかり事故を防ぐ柵としては十分役に立っている
