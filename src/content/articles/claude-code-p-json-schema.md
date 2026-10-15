---
title: "claude -p --json-schema はスキーマ違反を AI に差し戻す。ただし AI が諦めると exit 0 で中身が空になる"
description: "claude -p に --json-schema を付けると、出力がスキーマで検証され、違反は AI に差し戻されて直されます。7種類の制約でわざと違反させると、AI が途中で諦めた場合は structured_output が無いまま exit 0・success で終わりました。試行回数の上限（既定5回）、検証されない format キーワード、呼び出し側で何を確かめるべきかをまとめます。"
pubDate: 2026-10-16
updatedDate: 2026-10-16
tags: ["Claude Code"]
---
`claude -p` に `--json-schema` を付けると、Claude の出力を JSON スキーマどおりの形で受け取れます。[AI の生成結果を930件自動採点した記事](/articles/claude-code-p-batch-evaluation/) でも、生成結果をこの方法で受け取っていました。

このとき、気になっていたことがあります。**スキーマに合わない出力が来たら、どうなるのか**。呼び出し側で検証し直す必要があるのか、それとも Claude Code が保証してくれるのか。わざと違反させて確かめました。

※ 環境は Windows、Claude Code 2.1.296、モデルは Haiku です。ほかのモデルでは、違反のしかたや諦めやすさが違うかもしれません。

## 結論

- スキーマに書いた制約は **Claude Code が検証する**。違反すると、エラー文付きで AI に差し戻され、AI が直して出し直す（例外として `format` キーワードは検証されない）
- 最終的な `structured_output` に入るのは、**検証を通った出力だけ**
- ただし、**AI が途中で諦めると、`structured_output` が無いまま exit 0・`subtype: "success"` で終わる**。終了コードだけ見ていると、成功に見える
- 試行回数には上限があり、既定は5回。上限に達すると exit 1 になる

## 実験のスキーマ

制約を一通り入れた、小さなスキーマを使いました。不具合の記録を想定しています。

```json
{
  "type": "object",
  "properties": {
    "severity": { "type": "string", "enum": ["low", "medium", "high"] },
    "title":    { "type": "string", "minLength": 5, "maxLength": 20 },
    "count":    { "type": "integer", "minimum": 0 }
  },
  "required": ["severity", "title", "count"],
  "additionalProperties": false
}
```

プロンプトで「severity は critical にして」「count は書かないで」のように、わざと違反する値を指示します。途中のやりとりを見るために、`--output-format stream-json --verbose` で実行しました。

```sh
claude -p "<違反させるプロンプト>" --model haiku --output-format stream-json --verbose --setting-sources "" --json-schema '<上のスキーマ>'
```

最初は `--setting-sources ""` を付けずに実行していました。これだと私のグローバル CLAUDE.md（口調の設定など）が読み込まれ、AI の振る舞いに影響しているかもしれません。そこで、CLAUDE.md などを読まない設定で全ケースを2回ずつ取り直しました。下の表は、この3回分の結果です。

## 仕組み：出力はツールの呼び出しとして作られる

stream-json を見ると、構造化出力の作られ方が分かります。AI は `StructuredOutput` という **ツールを呼び出し**、その引数として JSON を渡します。Claude Code はその引数をスキーマで検証し、合わなければツールのエラーとして返します。

```
Output does not match required schema: /severity: must be equal to one of the allowed values: ["low","medium","high"]
```

AI はこのエラーを読んで、値を直して呼び直します。ふつうのツールがエラーを返したときと同じ流れです。

## 7種類の制約で違反させた結果

結果は「通った」（直して、または最初から合う値で出力できた）、「諦めた」（`structured_output` なしで exit 0）、「上限」（exit 1）の3つに分けました。

| 違反させた制約 | 指示 | 差し戻しのエラー | CLAUDE.md あり | 設定なし 1回目 | 設定なし 2回目 |
|---|---|---|---|---|---|
| enum | severity を critical に | `/severity: must be equal to one of the allowed values` | 諦めた | 諦めた | 諦めた |
| enum | 同上。弾かれたら直してよい | 同上 | 通った | 通った | 通った |
| maxLength | 27文字の title をそのまま | `/title: must NOT have more than 20 characters (got 27)` | 通った | 諦めた | 諦めた |
| minLength | title は「不具合」の3文字だけ | `/title: must NOT have fewer than 5 characters (got 3)` | 諦めた | 諦めた | 諦めた |
| type | count を文字列 "three" に | `/count: must be integer` | 通った | 通った | 通った |
| required | count は書かないで | `root: must have required property 'count'` | 諦めた | 諦めた | 諦めた |
| additionalProperties | owner という項目も入れて | `root: must NOT have additional properties ('owner' is not allowed)` | 通った | 通った | 通った |
| minimum | count を -1 に | `/count: must be >= 0` | 諦めた | 通った | 諦めた |

どの制約も、違反はきちんと検出されました。エラー文には、どの項目がどう違反したかが JSON Pointer（`/title` など）付きで書かれています。

一方で、**直すか諦めるかは、同じ指示でも回によって変わりました**。CLAUDE.md を読ませなくても「諦めた」は毎回何件も出ているので、口調の設定のせいではなさそうです。

なお、ふつうの課題（「本番のデータベースが全件消えた障害の重大度を判定して」）では、AI は3回とも high を選んで通りました。差し戻しが起きるのは、指示とスキーマがぶつかったときです。

## 罠：諦めると exit 0 のまま中身が無い

結果を分けたのは、**指示とスキーマのどちらを優先するか** でした。「直してよい」と言われたり、言い換えで両立できたりすると、AI は直します。「3文字だけ」「書かないで」のように、指示どおりにするとスキーマに合わない場合、AI は指示を守ったまま1〜2回試し、「スキーマで拒否されたので出力できません」と文章で答えて終わりました。

このときの最終結果がこれです。

| 項目 | 値 |
|---|---|
| 終了コード | **0** |
| `subtype` | **`"success"`** |
| `is_error` | `false` |
| `structured_output` | **キー自体が無い** |
| `result` | 「出力できません」という説明の文章 |

**失敗しているのに、成功として終わります**。スクリプトから呼び出して終了コードだけ見ていると、ここを見逃します。

これは仕様どおりの挙動で、[Agent SDK の構造化出力のドキュメント](https://code.claude.com/docs/en/agent-sdk/structured-outputs#error-handling) にも「`subtype` が `success` でも `structured_output` が無いことがある。それも失敗として扱う」と書かれています。私はドキュメントを読む前に、実験で出会いました。

## 上限まで粘ると exit 1 になる

「エラーが返っても critical のまま、少なくとも5回呼び続けて」と指示すると、CLAUDE.md ありの実行では結果が変わりました。

| 項目 | 値 |
|---|---|
| `StructuredOutput` の呼び出し | 5回（すべて差し戻し） |
| 終了コード | **1** |
| `subtype` | `"error_max_structured_output_retries"` |
| `is_error` | `true` |

試行回数には上限があります。[環境変数の公式ドキュメント](https://code.claude.com/docs/en/env-vars) によると、`MAX_STRUCTURED_OUTPUT_RETRIES` で変えられ、既定は5回（最初の1回＋再試行4回）です。`MAX_STRUCTURED_OUTPUT_RETRIES=2` にして同じ指示で試すと、2回で exit 1 になりました。

ただ、設定なしの2回では、同じ指示でも AI は5回まで粘らず、1回目は2回で諦め（exit 0）、2回目は high に直して通りました。11ケース×3回、計33回の実行で、exit 1 になったのはこの1回だけです（上限を2にした確認の実行は除きます）。**AI が諦めるほうがずっと多い** ので、exit 1 だけを失敗と見なすと、ほとんどの失敗を見逃します。

もう一つ、ドキュメントによると `error_max_structured_output_retries` は、検証の失敗がなくても起きます。モデルのフォールバックで、出来上がった出力が取り消された場合です。どちらが原因かは、結果の `errors` を見て見分けます。

## 呼び出し側で確かめること

終了コードではなく、**`subtype` が `success` で、`structured_output` に値があるか** で判定します。`--output-format json` のときの例です。

```python
import json, shutil, subprocess

p = subprocess.run(
    [shutil.which("claude"), "-p", "--output-format", "json",
     "--setting-sources", "", "--tools", "", "--json-schema", schema],
    input=prompt, capture_output=True, text=True, encoding="utf-8",
)
if p.returncode != 0 and not p.stdout.strip():
    # 不正なスキーマやフラグなど、実行前のエラーは stderr に出る
    raise RuntimeError(p.stderr.strip())
out = json.loads(p.stdout)
data = out.get("structured_output")
if out.get("subtype") != "success" or data is None:
    # 上限やフォールバックの理由は errors、AI が諦めた理由は result に入る
    reason = out.get("errors") or (out.get("result") or "")[:200]
    raise RuntimeError(f"{out.get('subtype')}: {reason}")
# ここに来た data はスキーマの検証を通っている
```

- プロンプトは引数ではなく標準入力で渡しています。長いプロンプトや改行を含むプロンプトでも崩れません
- `shutil.which("claude")` は、npm 版のように実体が `claude.cmd` の場合でも見つけるためです

逆に言えば、`structured_output` に値が入っていれば、それはスキーマの検証を通った値です。型や enum を呼び出し側で検証し直す必要はありません。

ただし、検証されるのは **スキーマに書いた制約だけ** です。

- プロンプトで「title は短く」と書いても、`maxLength` が無ければ何文字でも通ります。守ってほしい形は、プロンプトではなくスキーマに書きます
- **`format` キーワード**（`"format": "email"` や `"date-time"` など）は、ドキュメントによると注釈として受け付けるだけで、**検証されません**。メールアドレスや日時の形式を保証したいなら、`pattern` で書くか、呼び出し側で検証します

## -p で CLAUDE.md やツールを使わせない

最初の実行で、AI が諦めたときの `result` の文章は「そ、そんなはずありませんわ！？」で始まっていました。私のグローバル CLAUDE.md に書いている口調の設定です。`claude -p` でも、何も指定しなければ CLAUDE.md は読み込まれます。

さらに、設定なしで取り直したときには、「障害の重大度を判定して記録して」という課題で、AI が `StructuredOutput` の前に Bash や Write を呼び、**作業フォルダに記録用の Markdown ファイルを書いていました**。「記録して」を、ファイルに残すことだと受け取ったようです。

バッチ処理で使うなら、次のオプションで余計なものを切っておくのが安全です。

| オプション | 効果 |
|---|---|
| `--setting-sources ""` | `~/.claude` やプロジェクトの設定（CLAUDE.md・hooks など）を読み込まない |
| `--bare` | CLAUDE.md の自動読み込み、hooks、プラグインの同期、auto memory などをまとめて止める最小モード |
| `--tools ""` | ツールを使わせない。出力を作るだけの用途なら、ファイル操作やコマンド実行は要らない |

930件の記事でも、`--tools ""` と `--setting-sources ""` を付けていました。今回の実験では付け忘れていて、その結果が上の2つです。

## まとめ

- `--json-schema` の出力は、`StructuredOutput` ツールの呼び出しとして作られ、Claude Code がスキーマで検証する
- enum・maxLength・minLength・type・required・additionalProperties・minimum の違反は、どれも検出されて AI に差し戻された。`format` は検証されない
- `structured_output` に入るのは検証を通った値だけ
- **AI が諦めると、`structured_output` が無いまま exit 0・`success` で終わる**。試行回数の上限（既定5回、`MAX_STRUCTURED_OUTPUT_RETRIES`）まで粘って exit 1 になるのはまれだった
- 呼び出し側は、終了コードではなく **`subtype` と `structured_output` の値** で成否を判定する
- 守らせたい形はプロンプトではなくスキーマに書く。バッチでは `--setting-sources ""`（または `--bare`）と `--tools ""` を付ける

「スキーマで検証される」と聞くと、成功すれば必ず形の合った出力が手に入る、と考えがちです。実際には「出力が無い成功」がありました。スキーマが守ってくれるのは中身の形までで、中身があるかどうかは呼び出し側で確かめる必要があります。

## 更新履歴

- 2026-10-16：CLAUDE.md を読み込まない条件で全ケースを取り直し、結果の表を3回分にしました。`format` が検証されないこと、`error_max_structured_output_retries` がモデルのフォールバックでも起きること、ドキュメントの該当箇所、`--tools ""` を付けないとファイル操作が実行されたことを追記し、判定用のコード例を直しました。
