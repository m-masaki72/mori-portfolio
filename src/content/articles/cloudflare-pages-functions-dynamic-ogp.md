---
title: "Cloudflare Pages Functions で共有リンクごとに OGP 画像を作る（workers-og・エッジキャッシュ・Server-Timing）"
description: "静的サイトのまま、共有リンクごとに中身入りの OGP 画像を出す仕組みを Cloudflare Pages Functions で作りました。クローラー向けの HTML とブラウザの転送、workers-og での画像生成、エッジキャッシュ、Server-Timing で測った生成時間と、render が 0ms になる理由までまとめます。"
pubDate: 2026-10-14
tags: ["Cloudflare", "OGP", "TypeScript"]
---
[非公式 学マス プレイリストメーカー](/projects/gakumasu-playlist-maker/) は、学マスの公式動画からプレイリストを作って共有できる Web アプリです。サーバーを持たない静的サイトで、Cloudflare Pages で配信しています。

共有リンクを X などに貼ったとき、どのリストでも同じ OGP 画像が出るのが不満でした。見た人が「何のテーマで、どんな曲が入っているか」で開くかどうかを決められるように、**リストごとに中身入りの画像** を出すことにしました。

静的サイトのままで、必要なところだけ **Pages Functions**（Pages に置ける Workers）で動的にしています。

## 全体の流れ

```text
共有リンク /s/<符号>
  ├ SNS のクローラー → リスト名・曲名入りの OGP の HTML を読む
  │                    og:image は /og/<符号>.png
  └ ブラウザ        → アプリ本体（/#l=<符号>）へすぐ移動

/og/<符号>.png
  → 符号からリストを復元 → 1200×630 の PNG を生成 → エッジにキャッシュ
```

符号には、リストの中身（動画 ID の連結と、リスト名）がそのまま入っています。データベースは無く、**URL だけでリストを復元** できるので、Functions 側も保存処理を持ちません。

## 共有リンク：クローラーには OGP、ブラウザには転送

`functions/s/[code].ts` に置くと、`/s/<符号>` へのアクセスをこの関数が受けます。

```ts
export function onRequestGet({ request, params }: Context) {
  const origin = new URL(request.url).origin;
  const list = readSharedList(param(params.code));
  if (!list) return Response.redirect(`${origin}/`, 302);

  const title = `${list.name}（${sizeLabel(list)}）| ${siteName}`;
  const html = `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:image" content="${origin}/og/${list.code}.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=${escapeHtml(target)}">
</head><body>
<a id="go" href="${escapeHtml(target)}">プレイリストを開く</a>
<script>location.replace(document.getElementById('go').href)</script>
</body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
```

（抜粋です。実際は description や og:image:alt なども出しています）

ポイントは次のとおりです。

- **クローラーは JavaScript を実行しない** ので、`<meta>` を読んでカードを作る。ブラウザはスクリプトですぐアプリへ移る
- リスト名は利用者が自由に付けられるので、**HTML に入れる前に必ずエスケープ** する
- 共有ページが検索結果に大量に出ないよう `noindex` を付ける
- 説明文は SNS のカードで2行ほどに切られるので、曲名を短くして先頭4曲までにする

## OGP 画像：workers-og で生成する

画像は [workers-og](https://github.com/kvnang/workers-og) で作っています。Vercel の `@vercel/og` と同じく、JSX 風の要素ツリーを渡すと PNG にしてくれるライブラリで、Workers で動きます。

```ts
import { ImageResponse, loadGoogleFont } from 'workers-og';

const font = await loadGoogleFont({ family: 'Noto Sans JP', weight: 700, text });
const image = new ImageResponse(element, {
  width: 1200,
  height: 630,
  fonts: [{ name: 'Noto Sans JP', data: font, weight: 700, style: 'normal' }],
});
```

画像には、リスト名・曲数と時間・先頭5曲（＋ほか○曲）・1曲目のサムネイルを載せています。いちばん多く出るアイドルのテーマカラーを、上の帯と曲目の線に使っています。

### 日本語フォントは「使う文字だけ」取る

日本語フォントを丸ごと読み込むと数 MB になり、Workers では重すぎます。`loadGoogleFont` に `text` を渡すと、Google Fonts が **その文字だけを含むフォント** を返してくれます。

```ts
const text = [...new Set(`★${siteName}${name}${size}${songs.join('')}${more}0123456789… `)].join('');
```

画像に出る文字をすべてつなげ、重複を除いて渡しています。数字や「…」など、あとから足す文字を入れ忘れると、そこだけ豆腐（□）になるので注意です。

### サムネイルは data URL にして渡す

YouTube のサムネイルは取得して base64 の data URL にし、`<img>` の `src` に入れています。大きな配列を `String.fromCharCode(...bytes)` に一度に渡すと引数の上限を超えるので、32KB ずつに分けて変換しています。

```ts
let binary = '';
for (let i = 0; i < bytes.length; i += 0x8000)
  binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
return `data:image/jpeg;base64,${btoa(binary)}`;
```

## エッジにキャッシュする

同じ符号なら同じ画像なので、生成結果は Cache API でエッジに置きます。

```ts
const cache = caches.default;
const cached = await cache.match(request);
if (cached) return cached;

// ……生成……

waitUntil(cache.put(request, response.clone()));
return response;
```

`waitUntil` を使うと、キャッシュへの書き込みを待たずにレスポンスを返せます。

失敗したときは、共通の OGP 画像（`/og.png`）へ転送しています。カードが壊れて出るよりは、共通画像のほうがましだからです。また、`ImageResponse` は**ストリームで返る** ので、途中で失敗するとエラーに気づけません。一度 `arrayBuffer()` で読み切ってから返すようにしました。

## 生成時間を Server-Timing で測る

初回の生成が遅いと、SNS のクローラーが画像を取りに来たときにタイムアウトするかもしれません。そこで、内訳を `Server-Timing` ヘッダーに出すようにしました。

```ts
'Server-Timing': `thumb;dur=${thumbMs}, font;dur=${fontMs}, render;dur=${renderMs}`
```

最初はサムネイルとフォントを順番に取っていましたが、互いに関係ないので `Promise.all` で並行して取るように変えました。

本番で、毎回ちがうリスト（キャッシュに無い符号）を3つ作って測った結果です。

| | 合計（手元から計測） | thumb | font | render |
|---|---|---|---|---|
| リスト A（初回） | 1304ms | 28ms | 152ms | 0ms |
| リスト B（初回） | 798ms | 56ms | 145ms | 0ms |
| リスト C（初回） | 469ms | 60ms | 99ms | 0ms |
| 2回目（キャッシュから） | 12〜58ms | | | |

キャッシュに載ってしまえば十数 ms で返ります。初回でも 0.5〜1.3 秒ほどで、クローラーに困る長さではありませんでした。

### render が 0ms になる理由

表を見ると、画像の描画（render）が毎回 **0ms** になっています。描画が一瞬で終わっているわけではありません。

Cloudflare Workers では、タイミング攻撃（Spectre など）への対策で、**`Date.now()` は CPU で計算している間は進みません**。時計が進むのは、fetch などの I/O をしたときだけです。描画は CPU だけの処理なので、前後で `Date.now()` を取っても差が 0 になります。

合計の時間から thumb と font を引くと、描画とそれ以外の処理（起動など）に数百 ms かかっていることが分かります。Workers の中で CPU 処理の時間を正確に測るのは難しく、**I/O の内訳を測る用途** と割り切って使っています。

## 気をつけたこと

- **明かしたくない情報は画像に出さない**：アプリには隠し要素の曲があり、その曲名やサムネイルは OGP に出さないようにしています（曲数と時間には含めます）
- **顔画像は使わない**：アイドルは名前とテーマカラーだけで表し、キャラクターの画像は載せていません
- **Workers で読めないコードに注意**：アプリ側のモジュールが `process.env` を読んでいて、Functions から import できませんでした。サイト名だけを複製しています

## まとめ

- 静的サイトでも、Pages Functions を2本足すだけで共有リンクごとの OGP を出せる
- リストの中身を URL に入れておけば、データベースなしで画像を作れる
- 日本語フォントは使う文字だけ取得する
- 生成結果はエッジにキャッシュする。初回 0.5〜1.3 秒、2回目以降は十数 ms
- Workers の `Date.now()` は CPU 処理中に進まないので、Server-Timing で測れるのは I/O の時間だけ
