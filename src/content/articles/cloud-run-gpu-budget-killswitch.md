---
title: "GCP の予算アラートで Cloud Run の GPU だけを自動停止する（maxInstanceCount: 0 では止まらなかった）"
description: "画像生成アプリの GPU 費用が予算を超えないよう、予算アラート → Pub/Sub → Cloud Functions で GPU ワーカーだけを止める仕組みを作りました。Cloud Run の設定を書き換える方式は効かず、GCS のフラグファイル方式に変えた経緯と、段階導入・90%しきい値の理由をまとめます。"
pubDate: 2026-10-15
tags: ["GCP", "Cloud Run", "GPU", "個人開発"]
---
GCP の予算アラートは、**予算を超えても通知が来るだけで、課金は止まりません**。

GPU を使う Web アプリを公開するにあたって、それでは不安だったので、予算に近づいたら GPU ワーカーだけを自動で止める「キルスイッチ」を作りました。

最初は Cloud Run の設定を書き換えて止めるつもりでしたが、本番で試すと **どの方法でも止まりませんでした**。最終的に、Cloud Storage に置いたフラグファイルを見て、アプリ側が自分で止まる方式にしています。

**前提**：画像生成 Web アプリ [Moeter](/projects/moeter/)。API サーバー（Cloud Run・CPU）と GPU ワーカー（Cloud Run・L4 GPU）の2つのサービスで構成しています。

## なぜ GPU だけを止めるのか

Cloud Run の GPU は、リクエストを処理していない待機時間も含めて、インスタンスが起動している間ずっと課金されます。費用の大部分は GPU ワーカーで、利用が増えるとそのまま費用が増えます。

一方、API サーバーは CPU のみで、リクエストがなければインスタンス数ゼロまで縮むので、ほとんど費用がかかりません。

そこで、止めるのは **GPU ワーカーだけ** にしました。予算に達しても、利用者は診断（質問への回答）を続けられて、最後の画像生成だけが一時停止になります。サービス全体を落とすより穏やかな止め方です。

## 全体の構成

```text
予算アラート（月 ¥10,000、50% / 90% / 100%）
  ↓ 通知
Pub/Sub トピック
  ↓ トリガー
Cloud Functions（budget-killswitch）
  ↓ 実費が予算の90%以上なら
Cloud Storage に停止フラグのファイルを作る
  ↑ 確認
API サーバー / GPU ワーカー（フラグがあれば生成しない）
```

予算は、通知先に Pub/Sub トピックを指定して作成します。

```sh
gcloud billing budgets create --billing-account=<請求アカウントID> --display-name="月額予算アラート" --budget-amount=10000JPY --filter-projects=projects/<プロジェクトID> --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 --notifications-rule-pubsub-topic=projects/<プロジェクトID>/topics/<トピック名>
```

`--filter-projects` で、このアプリのプロジェクトの費用だけを集計対象にしています。同じ請求アカウントで動いている他のサービスの費用で、誤って止まらないようにするためです。

## 失敗した方法：Cloud Run の設定を書き換える

最初は、Cloud Functions から Cloud Run Admin API を呼び出して、GPU ワーカーのサービス設定を書き換える方式にしていました。試したのは次の2つです。

- `scaling.maxInstanceCount` を `0` にする（インスタンスを起動させない）
- `traffic` を空の配列にする（どのリビジョンにもリクエストを流さない）

どちらも API 呼び出しはエラーにならず、成功したように見えます。ところが本番の GPU ワーカーで試すと、**サービスの状態は何も変わりませんでした**。

調べた結果、どちらも Cloud Run の不具合ではなく、指定の意味が想像と違っていたようです。

- `maxInstanceCount: 0` は「上限なし」として扱われる
- 空の `traffic` は「指定なし」として扱われ、デフォルト（最新のリビジョンに100%）になる

「0」や「空」で止まると思い込んでいたのが間違いでした。しかもエラーにならないので、本番で実際に確かめるまで気づけません。

## 採用した方法：フラグファイルを見て自分で止まる

Cloud Run の設定には触らないことにしました。キルスイッチは、Cloud Storage に **停止フラグのファイルを1つ作るだけ** です。

```python
def budget_killswitch(event, context):
    payload = json.loads(base64.b64decode(event["data"]).decode("utf-8"))

    cost = payload.get("costAmount", 0)
    budget = payload.get("budgetAmount", 0)
    ratio = cost / budget if budget else 0

    if ratio < STOP_THRESHOLD_RATIO:  # 0.9
        return

    if not KILLSWITCH_ENABLED:
        print("閾値到達だが KILLSWITCH_ENABLED が false のため停止処理はスキップ（ログのみ）")
        return

    bucket = storage.Client().bucket(OUTPUT_BUCKET)
    bucket.blob("_killswitch/stopped").upload_from_string(
        json.dumps({"reason": "budget threshold reached"}),
        content_type="application/json",
    )
```

フラグを確認する側は2か所です。

- **GPU ワーカー**：画像生成とウォームアップのリクエストのたびにフラグの有無を確認し、あれば 503 を返す（確認結果は最大30秒キャッシュ）
- **API サーバー**：GPU ワーカーを呼び出す **前に** 同じフラグを確認し、あれば GPU ワーカーを呼ばない

### GPU ワーカー側だけでは足りない

最初は GPU ワーカー側の確認だけで十分だと思っていました。でも、GPU ワーカーが 503 を返せるのは、**コンテナが起動した後** です。

Cloud Run はリクエストが来ると、インスタンスがなければ起動します。つまり、止まっているはずの GPU ワーカーでも、リクエストが来るたびに L4 GPU のインスタンスが起動して、その分の課金が発生します。

そのため、API サーバーの方でも確認して、**そもそも GPU ワーカーを起こさない** ようにしました。

### フラグの確認方法

フラグは、生成画像を置いている公開読み取りのバケットに置いています。API サーバーは、認証なしで Cloud Storage の JSON API を呼んで、ファイルの有無を確認します。

ここで XML API（`https://storage.googleapis.com/<バケット>/<パス>`）を使うと、公開オブジェクトはエッジでキャッシュされることがあります。**フラグを削除して復旧したのに、キャッシュのせいで停止が続く** といったことが起こりうるので、JSON API を使っています。

確認自体に失敗したとき（ネットワークエラーなど）は、API サーバーは通常どおり GPU ワーカーを呼びます。最終的な判断は GPU ワーカー側の確認に任せる形です。

## しきい値は100%ではなく90%

最初は予算の100%で止める設定でしたが、**90%** に下げました。

予算の通知は、実際の費用の発生から **数時間遅れて** 届きます。その間も GPU の課金は進むので、100%の通知を受けてから止めると、止まった時点ではもう予算を超えています。少し手前で止めることで、通知の遅れを吸収しています。

50%の通知は止めるためではなく、メールで状況を確認するためのものです。

## いきなり有効にしない：段階導入

キルスイッチが誤って作動すると、サービスが止まります。そこで、3段階に分けて導入しました。

1. 予算アラートの通知だけを設定する
2. キルスイッチを `KILLSWITCH_ENABLED=false` でデプロイし、「止めるはずだった」というログだけを出す
3. 誤作動がないことを確認してから、`KILLSWITCH_ENABLED=true` にする

いまは本番で有効になっています。

もう1つ、Cloud Functions の実行サービスアカウントは **専用のもの** を作りました。デフォルトの Compute Engine サービスアカウントはプロジェクトの編集者権限を持っていて、キルスイッチに渡すには強すぎます。専用のアカウントには、フラグを書き込むバケットへの書き込み権限だけを付けています。

## 復旧方法

原因を確認して再開するときは、フラグのファイルを消すだけです。

```sh
gcloud storage rm gs://<バケット名>/_killswitch/stopped
```

GPU ワーカー側は確認結果を最大30秒キャッシュしているので、消してから30秒ほどで生成が再開します。

## 対象外にしたもの

この GPU ワーカーとは別に、アプリの中で Anthropic の API（Claude）も使っています。これは GCP の請求とは別なので、キルスイッチの対象外です。

Anthropic の API は前払いのクレジットだけで運用していて、自動チャージは使っていません。クレジットを使い切れば API がエラーになって止まるので、費用の上限はチャージした額で決まります。

## まとめ

- GCP の予算アラートは通知だけ。**止めるには自分で仕組みを作る** 必要がある。
- Cloud Run の `maxInstanceCount: 0` や空の `traffic` では止まらない。**エラーにならないので、本番で確かめるまで気づけない**。
- 止める側がフラグを置き、動く側が自分で確認する方式なら、Cloud Run の設定に依存しない。
- GPU を **起こさない** ところまでやらないと、止めたつもりでも起動のたびに課金される。
- 予算通知は遅れて届くので、しきい値は100%より手前にする。

GCP の費用見直し全体の流れは、[Claude Code に GCP の課金を棚卸しさせたら、月1万円が半分になった](/articles/claude-code-gcp-cost-review/) にまとめています。
