---
title: "GCS の画像を Cloudflare Worker で中継してエッジにキャッシュする（バケット名を変えずに独自ドメインで配る）"
description: "GCS の公開バケットにある画像を、Cloudflare Worker で中継して独自ドメインから配るようにしました。CNAME が使えなかった理由、40行ほどの Worker の中身、GCS のエラー本文を出さない処理、Vary: Origin を付け忘れて「画像を保存」が失敗した件をまとめます。"
pubDate: 2026-10-17
tags: ["Cloudflare Workers", "Google Cloud", "CORS", "Claude Code"]
---
個人で作っている画像生成の Web アプリでは、出題用の画像と生成した画像を、GCS（Google Cloud Storage）の公開バケットに置いています。これまでは `https://storage.googleapis.com/<バケット名>/...` の URL を、そのまま画面に出していました。

GCS は、外に出ていく転送量に課金されます。利用者が増えたときに備えて、**Cloudflare のエッジにキャッシュしてから配る** ようにしました。実装とデプロイは Claude Code に任せています。この記事では、その構成と、はまったところをまとめます（ドメインとバケット名は仮のものに置き換えています）。

**環境**：GCS（公開読み取りのバケット）/ Cloudflare 無料プラン / Cloudflare Workers / wrangler 4 / Claude Code（Opus）/ 2026年10月

## CNAME では配れなかった

最初の予定は、`img.example.com` を GCS に CNAME で向けて、Cloudflare のプロキシとキャッシュルールでキャッシュする、というものでした。

ところが、GCS をカスタムドメインで配るには、**バケット名をドメイン名と同じにする** 必要があります（`img.example.com` というバケットを作る）。今のバケットは別の名前で、アプリのあちこちから使われています。作り直して中身を移すのは避けたいところです。

検討した方法と、当時の調べで使えなかった理由です。

| 方法 | 使えなかった理由 |
|---|---|
| GCS に CNAME を向ける | バケット名＝ドメイン名が必要 |
| Cloudflare の Origin Rules で Host ヘッダを書き換える | 無料プランでは使えない |

そこで、**パスを付け替えて GCS に取りに行くだけの Worker** を置くことにしました。

## 構成

Worker が受け持つのは画像の配信だけです。画面と API はこれまでどおりで、Worker を通りません。

```
ブラウザ
 ├─ 画面  app.example.com → Cloudflare Pages（従来どおり）
 ├─ API   api.example.com → Cloud Run（従来どおり）
 └─ 画像  img.example.com → Worker → エッジキャッシュ → GCS バケット  ← 追加
```

`wrangler.toml` で、Worker にカスタムドメインを付けます。

```toml
name = "image-proxy"
main = "src/index.js"
compatibility_date = "2026-10-01"
workers_dev = false

# カスタムドメインは、DNS レコードと TLS 証明書を Workers 側で自動で作る
routes = [{ pattern = "img.example.com", custom_domain = true }]
```

`custom_domain = true` にすると、`npx wrangler deploy` だけで DNS レコードと証明書ができます。デプロイ直後は TLS のハンドシェイクで失敗しましたが、DNS は引けていたので、証明書の発行待ちでした。1〜2分ほど待つと 200 が返るようになりました。

## Worker の中身

全体で40行ほどです（説明用に名前を変えています）。

```js
const ORIGIN = "https://storage.googleapis.com/my-images";
// 中継するのは、出題画像と生成画像の webp だけ
const ALLOWED_PATH = /^\/(pregenerated\/[A-Za-z0-9_-]+|generated\/[0-9a-f]{32})\.webp$/;
// 生成画像はバケットのライフサイクルで30日後に消えるので、エッジにはそれより短く置く
const EDGE_TTL_SECONDS = { pregenerated: 30 * 24 * 60 * 60, generated: 7 * 24 * 60 * 60 };
const APP_ORIGIN = "https://app.example.com";

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const url = new URL(request.url);
    const match = url.pathname.match(ALLOWED_PATH);
    if (!match) return new Response("Not Found", { status: 404 });

    const kind = match[1].startsWith("generated/") ? "generated" : "pregenerated";
    // クエリは付けずに取りに行く（キャッシュキーを分散させない）
    const upstream = await fetch(`${ORIGIN}${url.pathname}`, {
      method: request.method,
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: { "200-299": EDGE_TTL_SECONDS[kind], "404": 60, "500-599": 0 },
      },
    });

    // GCS のエラー本文（XML）は中継しない
    if (!upstream.ok) {
      return upstream.status === 404
        ? new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } })
        : new Response("Bad Gateway", { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    const headers = new Headers();
    for (const name of ["Content-Type", "Content-Length", "ETag", "Last-Modified"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Vary", "Origin"); // 理由は後述
    if (request.headers.get("Origin") === APP_ORIGIN) {
      headers.set("Access-Control-Allow-Origin", APP_ORIGIN);
    }
    return new Response(upstream.body, { status: 200, headers });
  },
};
```

ポイントは次のとおりです。

- **中継するパスを正規表現で絞る**：バケットには画像以外のファイル（設定の YAML など）も入っています。パスをそのまま GCS に渡すと、それも `img.example.com` から読めてしまいます。決まった形の webp 以外は、GCS に問い合わせる前に 404 にします
- **キャッシュの期間を画像の寿命に合わせる**：生成画像はバケットのライフサイクルで30日後に消えます。エッジに30日置くと、消えたはずの画像が配られ続けるかもしれません。そこで生成画像は7日、消えない出題画像は30日にしました。404 は60秒だけ、5xx はキャッシュしません
- **クエリを捨てる**：`?v=1` のようなクエリを付けたまま取りに行くと、クエリごとに別のキャッシュになります。パスだけで取りに行けば、キャッシュは1つにまとまります
- **応答ヘッダは選んで写す**：GCS の応答ヘッダをまるごと返さず、必要な4つだけを写します

## GCS のエラー本文をそのまま返していた

最初の版では、GCS が 404 を返したとき、その応答をそのまま中継していました。デプロイ後に存在しないファイルを curl で取ると、こうなりました。

```
generated/0123...cdef.webp  404  application/xml; charset=UTF-8  233
```

GCS の 404 は、XML のエラー本文です。中にはバケット名などが入ります。せっかく `img.example.com` で配っているのに、裏が GCS だと分かってしまいます。そこで、`upstream.ok` でなければ自前の素っ気ない 404／502 を返すように直しました。

```
generated/0123...cdef.webp  404  text/plain;charset=UTF-8  9
```

## 「画像を保存」だけが失敗した

### 症状

アプリには「画像を保存」ボタンがあります。表示中の画像を `fetch` で取り直して、加工してからダウンロードさせる作りです。`fetch` で別オリジンの画像を読むので、CORS の許可が要ります。Worker では、アプリのオリジンからのリクエストにだけ `Access-Control-Allow-Origin` を付けていました。

curl で確かめると、Origin ヘッダを付けたリクエストには許可が返ってきます。ところが実際のブラウザでは、保存が失敗しました。

### 原因

最初の版では、`Vary: Origin` を **Origin ヘッダがあるときにだけ** 付けていました。

```
Origin なし（<img> の表示）  → Vary なし、CORS 許可なし
Origin あり（保存の fetch）  → Vary: Origin、CORS 許可あり
```

ブラウザは、まず `<img>` で画像を表示します。このリクエストには Origin ヘッダが付かないので、CORS 許可のない応答が返り、それがブラウザのキャッシュに入ります。`Vary` が無いので、ブラウザから見ると「この URL の応答は Origin に関係なく同じ」です。

続いて保存ボタンの `fetch` が、同じ URL をキャッシュから使い回します。中身は CORS 許可のない応答なので、CORS エラーになります。

### 直し方

2か所を直しました。

1. Worker で、**Origin の有無にかかわらず、いつも `Vary: Origin` を付ける**。これで、ブラウザは Origin が違えば別の応答として扱います
2. 保存ボタンの `fetch` に `{ cache: "no-store" }` を付けて、ブラウザのキャッシュを通さない。直す前に表示した画像のキャッシュが残っている人の分も、これで取り直せます

```js
const res = await fetch(imageUrl, { cache: "no-store" });
```

curl では、リクエストのたびに Origin ヘッダを付けるか付けないかを自分で決めるので、この問題は再現しません。**同じ URL を `<img>` と `fetch` の両方で読む** ときには、Origin の有無で応答が変わるなら、いつも `Vary: Origin` を付けておく必要があります。

## 切り替えの順番

本番への切り替えは、次の順にしました。

1. Worker をデプロイして、`img.example.com` から画像が取れることを確かめる
2. フロントの CSP（`img-src` と、保存で使う `connect-src`）に `img.example.com` を足してデプロイする
3. API の環境変数（画像 URL の頭）を `https://img.example.com` に変える

API は、この環境変数が未設定なら GCS の URL を返します。2より先に3をすると、CSP に弾かれて画像が出なくなります。元に戻すときは、環境変数を外すだけです。

キャッシュに乗ったあとは、同じ画像を2回目に取ると 0.63 秒から 0.09 秒になりました（東京のエッジから）。

## 注意：Workers の無料枠

Workers の無料枠は **1日10万リクエスト** です。この数には、エッジのキャッシュから返した分も含まれます。

画像の1枚1枚がリクエストになるので、ページを表示するたびに何枚も数えます。今の利用者数なら十分ですが、増えてきたら有料プランにするか、別の方法を考えることにしています。この理由は、アプリの判断記録（`docs/decisions.md`）に書いておきました。

## まとめ

- GCS をカスタムドメインで配るにはバケット名＝ドメイン名が必要。既存のバケットのままにしたかったので、パスを付け替えるだけの Worker で中継した
- 中継するパスは正規表現で絞る。エッジに置く期間は、画像の寿命（ライフサイクル）より短くする
- GCS のエラー本文（XML）は中継せず、自前の 404／502 にする
- 同じ URL を `<img>` と CORS 付きの `fetch` の両方で読むなら、`Vary: Origin` はいつも付ける
- Workers の無料枠は、キャッシュヒットも数える

## 参考文献

- [Custom domains（Workers）- Cloudflare Docs](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Fetch の cf プロパティ - Cloudflare Docs](https://developers.cloudflare.com/workers/runtime-apis/request/#the-cf-property-requestinitcfproperties)
- [Workers の料金 - Cloudflare Docs](https://developers.cloudflare.com/workers/platform/pricing/)
- [Vary - HTTP | MDN](https://developer.mozilla.org/ja/docs/Web/HTTP/Reference/Headers/Vary)
