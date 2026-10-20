---
title: "npm 版の Claude Code は更新が遅いと思って移行したら、原因は自分の設定だった"
description: "新しいモデルがすぐ使えないのは npm 版のせいだと思い、Claude Code をネイティブ版に移行しました。ところが公式ドキュメントでは npm 版も中身は同じで、自動更新もあります。claude doctor で調べると、自動更新を止めていたのは自分で入れた環境変数でした。npm 版の残りの消し方と合わせてまとめます。"
pubDate: 2026-10-15
tags: ["Claude Code", "Windows"]
---
Claude Code を使い始めたころ、インストールといえば `npm install -g @anthropic-ai/claude-code` でした。昔から使っている人なら、いまも npm 版のままかもしれません。私もそうでした。

npm 版を使っていて、**更新が届くのが遅い** と感じることがありました。はっきり覚えているのは、Opus 5.5 が出たときに、手元の Claude Code ですぐには使えなかったことです。「npm 版だから遅いのだろう」と考えて、2026年10月にネイティブ版へ移行しました。

ところが、この記事を書くために公式ドキュメントを読み直すと、**npm 版だから遅い、という話はどこにもありませんでした**。原因は自分の設定でした。順に書きます。

## 公式ドキュメントでの npm 版とネイティブ版の違い

[公式のセットアップのページ](https://code.claude.com/docs/en/setup)（2026年10月時点）から、関係するところをまとめます。

| 項目 | ネイティブ版 | npm 版 |
|---|---|---|
| 位置づけ | 推奨（Native Install (Recommended)） | 「ほかの入れ方」の一つ |
| 中身 | 単体の実行ファイル | **ネイティブ版と同じ実行ファイル**。npm がプラットフォーム別のパッケージから取ってきて配置する。起動した `claude` は Node.js を使わない |
| Node.js | 不要 | インストールに Node.js 22 以上が必要 |
| 自動更新 | バックグラウンドで自動更新 | **自動更新あり**。npm の global の場所に書き込めないときだけ、起動時に一度通知が出る |
| 手動での更新 | `claude update` | `npm install -g @anthropic-ai/claude-code@latest`（`npm update -g` は最新まで上がらないことがある） |

npm 版も、中身は同じ実行ファイルで、自動更新もあります。少なくともドキュメント上は、**npm 版だから新しい版が届くのが遅い、ということはありません**。

届く時期を分けているのは、入れ方ではなく **リリースチャネル** です。

- `latest`（既定）：新しい版が出たらすぐ届く
- `stable`：だいたい1週間前の版で、大きな不具合のあった版は飛ばす

ドキュメントには、「新しく出たモデルが、stable の版より新しい Claude Code を必要とすることがある。すぐ使いたいなら latest にする」とも書かれています。新しいモデルがすぐ使えないなら、まずはここを疑うところでした。

## claude doctor で調べたら、自動更新が止まっていた

私の設定は `latest` でした。では、なぜ遅かったのか。`claude doctor` を実行すると、答えが出ました。

```
Running: native (2.1.296)
Auto-updates: disabled (set by env: CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC)
Auto-update channel: latest
```

**自動更新が無効になっていました**。しかも、ネイティブ版に移行したあとの今もです。

原因は `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` という環境変数でした。以前、テレメトリ（利用状況の送信）やエラー報告を止めたくて、`DISABLE_TELEMETRY` などと一緒に `~/.claude.json` の `env` に入れていたものです。

[環境変数の公式ドキュメント](https://code.claude.com/docs/en/env-vars) を見ると、この変数は「必須ではない通信」をまとめて止めるもので、次のものが含まれます。

- **自動更新**
- テレメトリ、エラー報告、`/feedback` コマンド
- リリースノート、PR のステータス表示の確認、fast mode の利用可否の確認など
- 機能フラグの取得（Remote Control など、機能フラグが必要な機能が使えなくなる）

テレメトリを止めるつもりで、**自動更新まで止めていた** わけです。これなら、npm 版でもネイティブ版でも更新は届きません。npm 版を使っていた当時にもこの変数が入っていたかは記録が残っていないので断定はできませんが、遅かった原因はおそらくこれです。

ドキュメントには、もう一つ注意が書かれていました。この変数は **`0` や `false` を入れても無効にはならず**、止めたままになります。元に戻すには、変数そのものを消す必要があります。

## 自動更新だけを戻す

テレメトリとエラー報告は止めたまま、自動更新だけを戻すことにしました。`DISABLE_TELEMETRY` と `DISABLE_ERROR_REPORTING` はそれぞれ単独でも効くので、`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` だけを消します。

```json
"env": {
  "DISABLE_TELEMETRY": "1",
  "DISABLE_BUG_COMMAND": "1",
  "DISABLE_ERROR_REPORTING": "1"
}
```

環境変数は起動時に読み込まれるので、Claude Code を起動し直してから、もう一度 `claude doctor` で `Auto-updates` の行を確認します。

ただし、この変数を消すと、リリースノートの取得なども戻ります。何を止めたいのかで選ぶところです。なお、機能フラグの取得は `DISABLE_TELEMETRY` でも止まります（[公式ドキュメント](https://code.claude.com/docs/en/data-usage#telemetry-services)）。`DISABLE_TELEMETRY` を残した私の設定では、機能フラグが必要な機能は使えないままです。逆に「自動更新だけを止めたい」なら、`DISABLE_AUTOUPDATER` という専用の変数があります。

## それでも移行してよかったこと：古い npm 版が残っていた

移行のきっかけは勘違いでしたが、やってよかったこともあります。

ネイティブ版を入れたあと、念のため Claude Code に「npm 版をちゃんとアンインストールできているか」を調べてもらいました。結果は **半分だけ消えている** でした。

- いまの npm（scoop で入れた Node.js）の global には、Claude Code は入っていない
- PATH 上の `claude` も、ネイティブ版の `~/.local/bin/claude` だけ
- ところが、**以前の npm の置き場所** `%APPDATA%\npm` に、`claude`・`claude.cmd`・`claude.ps1` と本体のフォルダが残っていた

途中で Node.js の入れ方を変えていたのが原因だと思います。最初は npm の global が `%APPDATA%\npm` でしたが、Node.js を scoop で入れ直したときに、global の置き場所が scoop 側に変わっていました。

`npm uninstall -g` は、**いまの npm が見ている場所** しか探しません。古い場所に入っている Claude Code には届かず、残ったままになります。もし古い場所が PATH に残っていたら、更新されない古い `claude` が起動されるところでした。

公式ドキュメントにも、「アンインストールしたのに `claude` が動くなら、別のインストールが残っている可能性がある」と書かれています。自分がどれを使っているかは、次のコマンドで確かめられます。

```sh
which -a claude     # Git Bash。PATH 上の claude を見つかった順にすべて表示
claude doctor       # 実行中のインストール方法・パス・自動更新の状態を表示
```

`claude doctor` の `Running:` の行に、`native` か `npm` かが出ます。

## まとめ

- 公式ドキュメントでは、**npm 版も中身はネイティブ版と同じ実行ファイルで、自動更新もある**。npm 版だから更新が遅い、という記述はない
- 新しい版が届く時期を決めるのは **リリースチャネル**（`latest` / `stable`）
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` は、テレメトリと一緒に **自動更新も止める**。`0` を入れても止まったままなので、戻すには変数を消す
- 更新が遅いと感じたら、入れ方を変える前に **`claude doctor` の `Auto-updates` の行を見る**
- npm 版から移行するときは、古い npm の置き場所に残っている Claude Code にも注意する

「npm 版だから遅い」は、確かめずに思い込んでいただけでした。設定を一つ入れたことを忘れて、その影響を別のもののせいにしていたわけです。何かがおかしいと感じたら、まず `claude doctor` を打ってみてください。

ほかの設定も含めた全体像は、[私の Claude Code 設定ツアー](/articles/claude-code-settings-tour/) にまとめています。
