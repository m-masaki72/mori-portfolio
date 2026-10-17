---
title: "Claude Code の会話ログをブログのネタ帳にする（jsonl から体験を掘り出す）"
description: "Claude Code の会話ログには、自分が頼んだこと・Claude が実行したコマンド・その結果が残っています。このブログの記事のいくつかは、このログを掘って書きました。必要なところだけを抜き出すスクリプトと、auto mode に止められた話、文字化けの対処をまとめます。"
pubDate: 2026-10-17
tags: ["Claude Code", "ブログ運営", "Python"]
---
このブログでは「自分の体験・データを軸に書く」と決めています。ところが、体験はすぐに忘れます。「夜中に PC がスリープしてジョブが止まった」ことは覚えていても、何時に止まったのか、どのコマンドで直したのかは思い出せません。

そこで役に立つのが、**Claude Code の会話ログ** です。Claude と一緒にやった作業は、頼んだ文面も、実行したコマンドも、ログに残っています。

このブログでも、次の記事は会話ログから材料を集めて書きました。

- [auto mode で止められた操作を集計してみた](/articles/claude-code-auto-mode-denials/)
- [会話ログは30日で消える、compact で情報が落ちる](/articles/claude-code-memory-compact/)
- [PC のスリープを Claude Code に任せる](/articles/claude-code-pc-sleep/)
- [security-guidance フックは何に反応したか](/articles/claude-code-security-guidance-false-positives/)

**環境**：Windows 10 / Git Bash / Python 3 / Claude Code 2.1.302

## ログはどこにあるか

会話ログは `~/.claude/projects/<プロジェクト>/<セッション>.jsonl` にあります。プロジェクトのフォルダ名は、作業ディレクトリのパスの記号を `-` に置き換えたものです（例：`C--Users-me-Desktop-repos-mori-portfolio`）。

1行に1件の JSON が入っています。使うのは主に次の3種類です。

| 種類 | どこを見るか | 中身 |
|---|---|---|
| 自分の発言 | `message.role` が `user` で、`content` が文字列か `type: "text"` | 頼んだ文面 |
| Claude の発言 | `message.role` が `assistant` で、`type: "text"` | 説明・報告 |
| ツールの呼び出し | `type: "tool_use"` の `input` | 実行したコマンド、書いたファイル |

各行には `timestamp`（UTC）も付いているので、「いつ何をしたか」がそのまま分かります。

ログは既定で30日で消えます。書きたいネタがあるなら、早めに掘るのが大事です（期間は `cleanupPeriodDays` で変えられます）。

## まず grep で当たりをつける

最初は、キーワードでどのセッションに材料があるかを探します。

```sh
cd ~/.claude/projects && grep -l -i "SetSuspendState\|スリープ" */*.jsonl
```

これでファイルの一覧が出ます。ただ、jsonl を直接読むのは大変です。1行が数千文字あることも珍しくありません。

## 必要なところだけを抜き出す

そこで、キーワードを含む「自分の発言」「Claude の発言」「ツールの呼び出し」だけを、時刻つきで短く抜き出す Python スクリプトを Claude に書いてもらいました。

```python
import json, glob, os, re

root = os.path.expanduser("~/.claude/projects")
pat = re.compile(r"SetSuspendState|スリープ", re.I)

for f in sorted(glob.glob(os.path.join(root, "*", "*.jsonl"))):
    hits = []
    with open(f, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if not pat.search(line):
                continue
            d = json.loads(line)
            ts = d.get("timestamp", "")
            msg = d.get("message") or {}
            role = msg.get("role")
            content = msg.get("content")
            items = content if isinstance(content, list) else [{"type": "text", "text": content}]
            for it in items:
                if not isinstance(it, dict):
                    continue
                if it.get("type") == "text" and pat.search(str(it.get("text"))):
                    who = "USER" if role == "user" else "AI"
                    hits.append(f"[{ts}] {who}: {str(it['text'])[:300]!r}")
                elif it.get("type") == "tool_use":
                    s = json.dumps(it.get("input"), ensure_ascii=False)
                    if pat.search(s):
                        hits.append(f"[{ts}] TOOL: {s[:400]}")
    if hits:
        print("==", os.path.relpath(f, root))
        print("\n".join(hits[:25]))
```

ポイントは次のとおりです。

- **ツールの結果（`tool_result`）は拾わない**。コマンドの出力や読んだファイルの中身が入っていて、量が多いうえに、関係のない内容まで混ざります
- **文字数を切る**（300字・400字）。全体の流れが分かれば十分で、細部はあとで該当箇所だけ読みます
- **時刻を残す**。記事に「夜中の3時」「約30分後」と書けるのは、時刻があるからです

スリープの記事では、これで「画像生成が781枚目で止まっていた」「スリープ防止のスクリプトが3日間残っていた」「イベントログで 03:04 にスリープしたと確かめた」といった、忘れていた具体的な出来事を拾えました。

## つまずいたこと

### auto mode に止められた

最初にこのスクリプトを実行しようとしたら、auto mode に止められました。理由は「PII Data Handling」（個人情報の扱い）です。

会話ログには、作業中に読んだファイルの中身やメールアドレスなど、いろいろなものが入っています。全セッションのログをまとめて読み出す操作が、個人情報をかき集める動きに見えたのだと思います。

止められたあと、Claude は回避策を探さずに、何をしようとしていたのかを説明して確認を求めてきました。「スリープに関する部分だけを抜き出し、記事に使うのはコマンドと流れだけ」と確かめてから許可すると、実行できました。

自分のログとはいえ、まとめて読ませるのは強い操作です。止めてもらえるのは安心材料だと思っています。

### Windows で文字化け・エラー

許可したあと、今度はスクリプトがエラーで落ちました。

```
UnicodeEncodeError: 'cp932' codec can't encode character '�'
```

Windows の Python は、標準出力を cp932（Shift_JIS 系）で書こうとします。ログの中に cp932 で表せない文字があると、そこで落ちます。

実行するときに `PYTHONIOENCODING=utf-8` を付けると直ります。

```sh
PYTHONIOENCODING=utf-8 python3 extract.py > out.txt
```

出力が長くなるので、ファイルに書き出してから `grep` で読むのがおすすめです。

## 記事にするときに気をつけていること

ログには、記事に載せてはいけないものも入っています。

- **サーバーの IP・プロジェクト ID・鍵のパス**：コマンドの中にそのまま入っています。記事では伏せます
- **非公開リポジトリの名前や中身**：手法として一般化して書きます
- **仕事の作業**：家の作業だけを使います

それから、**ログの説明をそのまま信じない** ことも大事です。Claude の「〜が原因でした」という説明は、そのときの推測のこともあります。スリープの記事では、ログでは「どうしてスリープ防止が残ったのか」までは分かりませんでした。起動したときのコマンドを見て、PID を渡さずに起動していたことを確かめてから書きました。

## まとめ

- Claude Code の会話ログには、頼んだこと・実行したコマンド・時刻が残っていて、体験記事の材料になる
- 30日で消えるので、書きたいネタは早めに掘る
- grep で当たりをつけ、発言とツール呼び出しだけを短く抜き出す。ツールの結果は拾わない
- まとめて読み出すと auto mode に止められることがある。目的と範囲を確かめてから許可する
- Windows では `PYTHONIOENCODING=utf-8` を付ける

## 参考文献

- [Data usage - Claude Code Docs（会話ログの保存期間）](https://code.claude.com/docs/en/data-usage)
- [Claude Code settings - Claude Code Docs（cleanupPeriodDays）](https://code.claude.com/docs/en/settings)
