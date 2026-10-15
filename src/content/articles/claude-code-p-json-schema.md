---
title: "claude -p --json-schema はスキーマ違反を AI に差し戻す。ただし AI が諦めると exit 0 で中身が空になる"
description: "claude -p に --json-schema を付けると、出力がスキーマで検証され、違反は AI に差し戻されて直されます。7種類の制約で違反させて挙動を確かめると、AI が途中で諦めた場合は structured_output が無いまま exit 0・success で終わりました。再試行の上限（既定5回）と、呼び出し側で何を確かめるべきかをまとめます。"
pubDate: 2026-10-16
tags: ["Claude Code"]
---
`claude -p` に `--json-schema` を付けると、Claude の出力を JSON スキーマどおりの形で受け取れます。[AI の生成結果を930件自動採点した記事](/articles/claude-code-p-batch-evaluation/) でも、採点結果をこの方法で受け取っていました。

このとき、気になっていたことがあります。**スキーマに合わない出力が来たら、どうなるのか**。呼び出し側で検証し直す必要があるのか、それとも Claude Code が保証してくれるのか。わざと違反させて確かめました。

※ 環境は Windows、Claude Code 2.1.296、モデルは Haiku です。

## 結論

- スキーマに書いた制約は **Claude Code が検証する**。違反すると、エラー文付きで AI に差し戻され、AI が直して出し直す
- 最終的な `structured_output` に入るのは、**検証を通った出力だけ**
- ただし、**AI が途中で諦めると、`structured_output` が無いまま exit 0・`subtype: "success"` で終わる**。終了コードだけ見ていると、成功に見える
- 差し戻しには上限があり、既定は5回。上限に達すると exit 1 になる

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
claude -p "<違反させるプロンプト>" --model haiku --output-format stream-json --verbose --json-schema '<上のスキーマ>'
```

## 仕組み：出力はツールの呼び出しとして作られる

stream-json を見ると、構造化出力の作られ方が分かります。AI は `StructuredOutput` という **ツールを呼び出し**、その引数として JSON を渡します。Claude Code はその引数をスキーマで検証し、合わなければツールのエラーとして返します。

```
Output does not match required schema: /severity: must be equal to one of the allowed values: ["low","medium","high"]
```

AI はこのエラーを読んで、値を直して呼び直します。ふつうのツールがエラーを返したときと同じ流れです。

## 7種類の制約で違反させた結果

| 違反させた制約 | 指示 | 差し戻しのエラー | 結果 |
|---|---|---|---|
| enum | severity を critical に。弾かれたら直してよい | `/severity: must be equal to one of the allowed values` | high に直して **通った** |
| maxLength | 27文字の title をそのまま | `/title: must NOT have more than 20 characters (got 27)` | 短く言い換えて **通った** |
| type | count を文字列 "three" に | `/count: must be integer` | 3 に直して **通った** |
| additionalProperties | owner という項目も入れて | `root: must NOT have additional properties ('owner' is not allowed)` | owner を消して **通った** |
| minLength | title は「不具合」の3文字だけ | `/title: must NOT have fewer than 5 characters (got 3)` | 2回同じ値を送って **諦めた** |
| required | count は書かないで | `root: must have required property 'count'` | 2回同じ値を送って **諦めた** |
| minimum | count を -1 に | `/count: must be >= 0` | 2回同じ値を送って **諦めた** |

どの制約も、違反はきちんと検出されました。エラー文には、どの項目がどう違反したかが JSON Pointer（`/title` など）付きで書かれています。

なお、ふつうの課題（「本番のデータベースが全件消えた障害の重大度を判定して」）では、AI は初めから high を選び、1回で通りました。差し戻しが起きるのは、指示とスキーマがぶつかったときです。

## 罠：諦めると exit 0 のまま中身が無い

結果が分かれたのは、**指示とスキーマのどちらを優先するか** でした。「直してよい」と言われたり、言い換えで両立できたりすると、AI は直します。「3文字だけ」「書かないで」のように、指示どおりにするとスキーマに合わない場合、AI は指示を守ったまま2回試し、「スキーマで拒否されたので出力できません」と文章で答えて終わりました。

このときの最終結果がこれです。

| 項目 | 値 |
|---|---|
| 終了コード | **0** |
| `subtype` | **`"success"`** |
| `is_error` | `false` |
| `structured_output` | **キー自体が無い** |
| `result` | 「出力できません」という説明の文章 |

**失敗しているのに、成功として終わります**。スクリプトから呼び出して終了コードだけ見ていると、ここを見逃します。`structured_output` を前提に処理を続けると、KeyError や「空の結果」として、ずっと後ろで問題が表に出ることになります。

## 上限まで粘ると exit 1 になる

一方、「エラーが返っても critical のまま、少なくとも5回呼び続けて」と指示すると、結果が変わりました。

| 項目 | 値 |
|---|---|
| `StructuredOutput` の呼び出し | 5回（すべて差し戻し） |
| 終了コード | **1** |
| `subtype` | `"error_max_structured_output_retries"` |
| `is_error` | `true` |

差し戻しの回数には上限があります。[環境変数の公式ドキュメント](https://code.claude.com/docs/en/env-vars) によると、`MAX_STRUCTURED_OUTPUT_RETRIES` で変えられ、既定は5回（最初の1回＋再試行4回）です。`MAX_STRUCTURED_OUTPUT_RETRIES=2` にして同じ指示で試すと、2回で exit 1 になりました。

つまり、**exit 1 になるのは上限まで粘ったときだけ** です。今回の実験では、AI が自分で諦めたときは、いつも上限より前（2回目）でした。

## 呼び出し側で確かめること

終了コードではなく、**`structured_output` があるかどうか** で判定します。`--output-format json` のときの例です。

```python
import json, subprocess

p = subprocess.run(
    ["claude", "-p", prompt, "--output-format", "json", "--json-schema", schema],
    capture_output=True, text=True, encoding="utf-8",
)
out = json.loads(p.stdout)
if p.returncode != 0 or "structured_output" not in out:
    # 失敗として扱う。out["subtype"] と out["result"] に理由が入っている
    raise RuntimeError(f"{out.get('subtype')}: {out.get('result', '')[:200]}")
data = out["structured_output"]  # ここに来たものはスキーマの検証を通っている
```

逆に言えば、`structured_output` が入っていれば、それはスキーマの検証を通った値です。型や enum を呼び出し側で検証し直す必要はありません。

ただし、検証されるのは **スキーマに書いた制約だけ** です。プロンプトで「title は短く」と書いても、`maxLength` が無ければ何文字でも通ります。守ってほしい形は、プロンプトではなくスキーマに書きます。

## ついでに：-p でも CLAUDE.md は読まれる

諦めたときの `result` の文章は、「そ、そんなはずありませんわ！？」で始まっていました。私のグローバル CLAUDE.md に書いている口調の設定です。`claude -p` でも CLAUDE.md は読み込まれるので、バッチ処理で使うと、こうした設定が出力に混ざることがあります。`structured_output` の中身には出ていませんでしたが、`result` の文章をそのまま使う場合は気をつけるところです。

## まとめ

- `--json-schema` の出力は、`StructuredOutput` ツールの呼び出しとして作られ、Claude Code がスキーマで検証する
- enum・maxLength・minLength・type・required・additionalProperties・minimum の違反は、どれも検出されて AI に差し戻された
- `structured_output` に入るのは検証を通った値だけ
- **AI が諦めると、`structured_output` が無いまま exit 0・`success` で終わる**。上限（既定5回、`MAX_STRUCTURED_OUTPUT_RETRIES`）まで粘ったときだけ exit 1
- 呼び出し側は、終了コードではなく **`structured_output` があるか** で成否を判定する
- 守らせたい形はプロンプトではなくスキーマに書く

「スキーマで検証される」と聞くと、成功すれば必ず形の合った出力が手に入る、と考えがちです。実際には「出力が無い成功」がありました。スキーマが守ってくれるのは中身の形までで、中身があるかどうかは呼び出し側で確かめる必要があります。
