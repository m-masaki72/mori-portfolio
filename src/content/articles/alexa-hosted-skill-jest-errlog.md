---
title: "Alexa-hosted スキルのビルドが jest で落ちた件と、ログを直接読めない環境でエラーを集計する方法"
description: "Alexa スキル「安眠ノイズ」に Jest のテストを足したら、Alexa-hosted のビルドが失敗するようになりました。原因の切り分けと、テストを lambda/ の外に出した構成、さらに CloudWatch Logs に直接アクセスできない Alexa-hosted で、エラーを Logs Insights で集計できる1行ログにした話をまとめます。"
pubDate: 2026-10-17
tags: ["Alexa", "AWS Lambda", "Jest", "Claude Code"]
---
[安眠ノイズ](/projects/anmin-noise/) は、雨音や焚き火などの環境音を流す Alexa スキルです。**Alexa-hosted**（Amazon がコードの置き場所・Lambda・DynamoDB をまとめて用意してくれる形）で動かしています。

2026年9月に、Claude Code と一緒にこのスキルを手入れしました。そのときにはまった2つのことをまとめます。

1. Jest のテストを足したら、デプロイのビルドが落ちた
2. エラーを調べたいのに、Lambda のログを手元から読めない

**環境**：Alexa-hosted スキル（Node.js）/ ask-sdk-core / ASK CLI v2 / Jest / Claude Code（Sonnet・Opus）

## Jest を足したらビルドが落ちた

### 何が起きたか

Alexa-hosted では、`lambda/` フォルダの中身が Lambda にデプロイされます。git に push すると、Amazon 側で `lambda/package.json` の依存をインストールしてビルドします。

レビューで見つかった不具合を直すついでに、`lambda/index.js` の純粋な関数（引数だけで結果が決まる関数）に Jest のテストを足しました。テストも `jest` の devDependency も、`lambda/` の中です。

push すると、ビルドが **FAILED** になりました。

### 切り分け

Claude Code と、次の順に試しました。どれも夜中の20分ほどの間のことです。

| 試したこと | 結果 |
|---|---|
| 何も変えずに再デプロイ（一時的な失敗かもしれない） | 失敗 |
| jest を 30 系から 29 系に下げる | 失敗 |
| テスト一式と devDependencies を `lambda/` から一時的に消す（切り分け用） | **成功** |

jest 30 は、`package.json` の `engines` で Node.js 18 以上を要求しています。コミットを書いた時点の調べでは、Alexa-hosted のビルド環境は Node.js 16 でした。そこで「jest を Node.js 16 対応の 29 系に下げれば通るはず」と考えましたが、通りませんでした。

テスト関連をまるごと消すと通ったので、**`lambda/package.json` に devDependencies があること自体** が問題だと判断しました。jest が連れてくる依存のどれかが、Node.js 18 以上を要求していたのだと思います。どのパッケージかまでは突き止めていません。

### 直し方：テストを lambda/ の外に出す

最終的に、テストを別のフォルダに分けました。

```
lambda/            ← Lambda にデプロイされる
  index.js
  package.json     ← 本番の依存だけ。devDependencies は置かない
test/              ← テスト専用
  index.test.js
  package.json     ← jest はここ
```

テストからは、`lambda/index.js` が書き出している関数を読み込みます。

```js
// lambda/index.js の末尾
exports._testables = { pickSound, parseMinutes /* …テストしたい関数 */ };

// test/index.test.js
const { _testables } = require('../lambda/index');
```

`lambda/` は Lambda のパッケージ専用、`test/` はテスト専用です。`lambda/` に何を足してよいかの線がはっきりします。

この理由は、スキルの `CLAUDE.md` に書いておきました。

> `lambda/package.json` は本番の依存だけ。devDependencies は置かない。Alexa-hosted のビルドはこれをそのままインストールするので、Node.js 18 以上を要求する jest があるとビルドが落ちる。テストが `test/` にあるのはこのため。

書いておかないと、次に Claude が「テストは `lambda/` に置くのが普通です」と戻してしまうかもしれないからです。

## ログを手元から読めない

### Alexa-hosted の Lambda は、自分の AWS アカウントにない

次に、スキルでどんなエラーが起きているかを調べようとしました。普通の Lambda なら、AWS CLI で CloudWatch Logs を読めば済みます。

ところが、Alexa-hosted の Lambda は **Amazon が管理する AWS アカウント** で動いています。自分の IAM キーを作って AWS CLI を設定しても、そのログには届きません（以前に試して、うまくいかなかったことがあります）。

Claude Code にも調べてもらいました。

- 古い ASK CLI（v0）には `ask lambda log` というログを読むコマンドがあった。いまの v2 には引き継がれていない（実際に試して確認）
- SMAPI の監査ログ API は、SMAPI を呼んだ記録で、Lambda のログではない
- 「Alexa-hosted スキルで自分の AWS リソースを使う」機能は、スキルから自分のアカウントの資源を使う向きで、逆向きではない

結局、ログを見られるのは **`ask smapi get-skill-status` が返す `logUrl`** だけでした。一時トークン付きの URL で、ブラウザで開くと AWS コンソールにログインした状態になります。CLI から本文を取ることはできません。

### 最初の設計は大きすぎた

「手元から読めないなら、エラーを DynamoDB に保存しておいて、あとで読めばいい」。最初はそう考えて、Claude（Opus）に設計してもらいました。ユーザーごとに直近のエラーを残し、デバッグ用のインテント（音声コマンド）で読み出す案です。

設計とレビューを、別々のサブエージェントに頼みました。1回目のレビューでは、こんな指摘が出ています。

- デバッグ用のインテントを対話モデルに足すと、Alexa の認定審査で落とされるおそれがある
- テーブル全体を読み出す Scan は、データが増えるとコストが跳ね上がる
- 古いエラーを自動で消す TTL を、Alexa-hosted のテーブルでは設定できない

設計し直して出した2回目のレビューでは、「エラー処理を async にすると既存のテストが落ちる」などの細かい指摘のあとに、こう問われました。

> CloudWatch Logs に構造化したログを出すだけで十分ではないか。DynamoDB への保存は本当に要るのか。

ログはブラウザ経由なら読めるのだから、**読みやすい形で出しておけば足りる** という指摘です。DynamoDB 案をやめれば、ほかの指摘もまとめて要らなくなります。この案に切り替えました。

### 1行の構造化ログにする

エラーを扱う3つのハンドラ（`ErrorHandler`、再生失敗の `PlaybackFailedHandler`、`SystemExceptionHandler`）で、いつもの `console.error` に加えて、決まった形の1行を出すようにしました。

```
[ERRLOG] kind=HANDLER_ERROR rt=IntentRequest et=null en=TypeError fn=Object.handle
```

| 項目 | 中身 |
|---|---|
| `kind` | どのハンドラで捕まえたか |
| `rt` | リクエストの種類（`IntentRequest`、`AudioPlayer.PlaybackFailed` など） |
| `et` | Alexa 側が返したエラーの種類 |
| `en` | JavaScript のエラーのクラス名（`TypeError` など） |
| `fn` | エラーが起きた関数の名前 |

`[ERRLOG]` という目印があるので、CloudWatch Logs Insights で次のように絞り込めます。

```
filter @message like /\[ERRLOG\]/
```

種類ごとの件数を数えるなら、たとえばこうです。

```
filter @message like /\[ERRLOG\]/
| parse @message /kind=(?<kind>\S+).* fn=(?<fn>\S+)/
| stats count(*) by kind, fn
```

### エラーの本文はログに出さない

ひとつ気をつけたのは、**エラーメッセージやスタックトレースの本文をそのまま出さない** ことです。メッセージには、ユーザーの発話など入力に由来する文字列が混ざることがあります。このスキルは、マニフェストで「個人情報を使わない」と申告しています。

そこで、スタックトレースからは **関数名だけ** を、決まった形に合う場合にだけ取り出します。

```js
// "    at Object.handle (/var/task/index.js:1489:16)" のような行から関数名だけを取る
const STACK_FRAME_PATTERN = /^\s*at\s+(?:async\s+)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/;

function extractSafeFunctionName(stack) {
  if (typeof stack !== 'string') return null;
  const lines = stack.split('\n');
  // lines[0] はエラーメッセージなので読まない
  for (let i = 1; i < lines.length; i++) {
    const m = lines[i].match(STACK_FRAME_PATTERN);
    if (m) return m[1];
  }
  return null; // 取れなければ null。メッセージ行で代用しない
}
```

レビューで強く言われたのが、「取れなかったときに1行目で代用しない」ことです。スタックトレースの1行目はエラーメッセージそのものなので、代用するとそこから本文が漏れます。

### デプロイしたあとにもう一度レビュー

実装してデプロイしたあと、`/code-review`（強度 xhigh）でもう一度見てもらいました。妥当な指摘が9件あり、すべて直しています。たとえば次のようなものです。

- `at Object.handle [as handle] (...)` のように、別名が付いた行から関数名が取れない
- リクエストの種類が取れないときに、`undefined` と空文字が混ざる
- 再生失敗などのログで、どの音声か（トークン）やリクエスト ID が抜けていて、ほかのログと突き合わせられない

テストは37件から51件に増えました。対話モデルとマニフェストは変えていないので、認定審査を受け直す必要はありません。

### ついでに見つかったこと

調査の途中で、Lambda の async ハンドラについての注意点も出てきました。ハンドラが返した Promise が解決した時点で、実行環境は止まります。`await` せずに投げっぱなしにした処理（`.catch()` だけ付けた DynamoDB への保存など）は、終わる前に止められて消えることがあります。

既存のコードにもこの書き方がありました。今回の作業の範囲外なので、報告だけ受けて、あとで直すことにしています。

## 集計はこれから

エラーログは、実際にスキルが使われてエラーが起きないと溜まりません。デプロイ直後に見ても何もないので、1か月ほど置いてから見ることにしました。いつ見るかは、Claude Code の memory に日付つきで残してあります。

## まとめ

- Alexa-hosted は `lambda/package.json` をそのままビルドする。devDependencies に jest があるとビルドが落ちたので、テストは `lambda/` の外の `test/` に分けた
- Alexa-hosted の Lambda は Amazon 管理の AWS アカウントにあり、自分の IAM ではログを読めない。入口はブラウザで開く `logUrl` だけ
- 「DynamoDB に保存する」案は、レビューで「ログを読みやすく出せば足りる」と言われて捨てた
- `[ERRLOG]` で始まる1行のログにして、Logs Insights で集計できるようにした。エラーの本文は出さず、関数名だけを取り出す

## 参考文献

- [Alexa-hosted スキルの概要 - Alexa Skills Kit](https://developer.amazon.com/ja-JP/docs/alexa/hosted-skills/build-a-skill-end-to-end-using-an-alexa-hosted-skill.html)
- [CloudWatch Logs Insights のクエリ構文 - Amazon CloudWatch](https://docs.aws.amazon.com/ja_jp/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- [Jest](https://jestjs.io/ja/)
