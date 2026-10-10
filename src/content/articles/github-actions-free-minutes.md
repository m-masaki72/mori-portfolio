---
title: "GitHub Actions の無料枠2000分を、ハングしたテスト4回で使い切った（timeout-minutes と concurrency）"
description: "非公開リポジトリの CI で Jest がまれにハングし、timeout を設定していなかったせいで既定の6時間上限まで走り続け、月2000分の無料枠を使い切りました。再発防止に入れた timeout-minutes・concurrency と、Dependabot を止めた話をまとめます。"
pubDate: 2026-10-10
tags: ["GitHub Actions", "CI", "個人開発"]
---
個人開発している Web アプリの CI（GitHub Actions）で、**月2000分の無料枠を使い切りました**。

原因は、テストがまれにハングすることと、ジョブに時間の上限を設定していなかったことです。ハングした実行が4回続いただけで、枠がなくなりました。

**前提**：非公開（private）リポジトリ / GitHub Free プラン / ubuntu-latest

GitHub Actions は、公開リポジトリなら標準のランナーを無料で使えます。一方、非公開リポジトリは Free プランだと **月2000分まで** です。商用にするつもりのアプリはリポジトリを公開していないので、この枠の中でやりくりする必要があります。

## 何が起きたか

CI では `npm test`（Jest）を走らせています。この Jest のワーカープロセスが、まれに正常に終了できずにハングしていました。

テストが終わらないので、ジョブも終わりません。そして `timeout-minutes` を設定していなかったので、ジョブは GitHub Actions の既定の上限である **6時間** まで走り続けます。

これが4回続き、実行が4つとも「実行中」のまま残って、その間ずっと分数が減り続けました。気づいたときには、月2000分を使い切っていました。

しかもこの CI は、テストと lint を Node.js の2バージョンで走らせるマトリックス構成で、1回の push で複数のジョブが動きます。ハングしたジョブが1つでもあると、その分だけ6時間ずつ持っていかれます。

## 対策1：timeout-minutes を全ジョブに付ける

一番効くのはこれです。ジョブごとに `timeout-minutes` を設定すると、その時間を超えたジョブは強制的にキャンセルされます。

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    # ...

  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    # ...
```

ふだんは数分で終わる CI なので、上限は10分にしました。ハングしても、最大で6時間ではなく10分で止まります。

`timeout-minutes` は、`jobs.<job_id>` に付けるとジョブ全体、`steps` の各ステップに付けるとそのステップだけの上限になります。全ジョブに付けておけば、どのステップでハングしても止まります。

## 対策2：concurrency で同じブランチの重複実行をキャンセルする

もうひとつ入れたのが `concurrency` です。

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

`group` が同じ実行は同時に1つしか動かず、`cancel-in-progress: true` にすると、新しい実行が始まった時点で古い実行がキャンセルされます。ここではワークフロー名とブランチ（`github.ref`）で group を作っているので、**同じブランチに続けて push したら、前の CI は止まって最新のものだけが走ります**。

続けて push すると、最後のもの以外の結果は見ないことがほとんどです。それなのに、全部が最後まで走ると分数がその分だけ減っていきます。これで、見ない CI に分数を使わなくなりました。

## 対策3：Dependabot を一時的に止めた

Dependabot は、依存パッケージの更新があると自動でプルリクエストを作ってくれます。便利ですが、プルリクエストが作られるたびに CI が走るので、これも分数を使います。

枠を使い切った月は、残りを少しでも節約するために、Dependabot の設定（`.github/dependabot.yml`）を一旦削除して自動のプルリクエストを止めました。

## まとめ

- 非公開リポジトリの GitHub Actions は、Free プランだと月2000分まで
- `timeout-minutes` を付けないと、ハングしたジョブは既定の6時間まで走り続ける。**全ジョブに付けておく**
- `concurrency` と `cancel-in-progress: true` で、同じブランチの古い実行を自動でキャンセルする
- Dependabot のプルリクエストも CI を動かすので、枠が厳しいときは止めるのも手

`timeout-minutes` は1行で書けて、付けて困ることもほとんどありません。新しくワークフローを作るときは、最初から入れておくのがおすすめです。
