---
title: "Astro で外部スクリプトなしの SNS シェアボタンを作る（simple-icons でアイコンとブランドカラー）"
description: "X・Bluesky・Threads・Facebook・はてブ・LINE のシェアボタンを、公式ウィジェットを使わずリンクだけで実装しました。アイコンは simple-icons からビルド時に SVG を埋め込み、ボタンの色も各サービスのブランドカラーに合わせています。"
pubDate: 2026-10-10
tags: ["Astro", "simple-icons", "個人開発"]
---
このサイトの記事ページに、SNS のシェアボタンを付けました。

はてなブログから記事を移してきたとき、はてなでは標準で付いていたシェアボタンが無いことに気づきました。オリジナルの記事も書き始めたので、読んでくれた人に広めてもらいやすくしたいと思ったのがきっかけです。

ただし、公式のシェアウィジェットは使いたくありませんでした。各サービスのスクリプトを読み込むとページが重くなりますし、外部のスクリプトが動く分だけプライバシーポリシーに書くことも増えます。そこで **外部スクリプトを一切読み込まない、リンクだけのシェアボタン** にしました。

**環境**：Astro 6.1 / Tailwind CSS 4.2 / simple-icons 16.34

## 完成形

記事の末尾に、次の6つのボタンを並べています。

- X / Bluesky / Threads / Facebook / はてなブックマーク / LINE
- それぞれのロゴアイコン付き
- 背景はそれぞれのブランドカラー、文字とアイコンは白

この記事の下にあるボタンが、実際に動いているものです。

## シェアはリンクだけでできる

各サービスには、URL にパラメータを付けて開くと投稿画面が出る「シェア用 URL」があります。シェアボタンの正体は、これへのリンクだけです。

| サービス | シェア用 URL |
|---|---|
| X | `https://x.com/intent/post?text=タイトル&url=URL` |
| Bluesky | `https://bsky.app/intent/compose?text=本文` |
| Threads | `https://www.threads.net/intent/post?text=本文` |
| Facebook | `https://www.facebook.com/sharer/sharer.php?u=URL` |
| はてなブックマーク | `https://b.hatena.ne.jp/entry/panel/?url=URL` |
| LINE | `https://social-plugins.line.me/lineit/share?url=URL` |

Bluesky と Threads は URL 専用のパラメータが無いので、本文にタイトルと URL をまとめて入れます。どのパラメータも `encodeURIComponent` でエンコードしておきます。

## アイコンは simple-icons をビルド時に埋め込む

ロゴは自分で描くと形が崩れるので、[simple-icons](https://simpleicons.org/) を使いました。各ブランドの SVG パスとブランドカラーが入った npm パッケージです。

```sh
npm i -D simple-icons
```

`siX` のような名前で import すると、`path`（SVG のパス）と `hex`（ブランドカラー）が取れます。

```js
import { siX } from "simple-icons";

siX.hex;  // "000000"
siX.path; // "M18.901 1.153h3.68l-8.04 9.19L24 ..."
```

Astro コンポーネントのフロントマターで import すれば、使われるのはビルド時だけです。出力される HTML にはインラインの `<svg>` が入るだけで、ブラウザで動く JavaScript はありません。

## コンポーネント全体

`src/components/ArticleShare.astro` です。

```astro
---
import { siBluesky, siFacebook, siHatenabookmark, siLine, siThreads, siX } from "simple-icons";

interface Props {
    title: string;
    url: string;
}

const { title, url } = Astro.props;
const encodedUrl = encodeURIComponent(url);
const encodedText = encodeURIComponent(`${title} ${url}`);

const shares = [
    { name: "X", icon: siX, href: `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodedUrl}` },
    { name: "Bluesky", icon: siBluesky, href: `https://bsky.app/intent/compose?text=${encodedText}` },
    { name: "Threads", icon: siThreads, href: `https://www.threads.net/intent/post?text=${encodedText}` },
    { name: "Facebook", icon: siFacebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: "はてブ", icon: siHatenabookmark, href: `https://b.hatena.ne.jp/entry/panel/?url=${encodedUrl}` },
    { name: "LINE", icon: siLine, href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}` },
];
---

<section class="mt-12">
    <p class="mb-3">この記事をシェア</p>
    <ul class="flex flex-wrap gap-2">
        {
            shares.map((s) => (
                <li>
                    <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white transition hover:opacity-80"
                        style={`background-color: #${s.icon.hex}`}
                    >
                        <svg role="img" viewBox="0 0 24 24" class="size-4 fill-current" aria-hidden="true">
                            <path d={s.icon.path} />
                        </svg>
                        {s.name}
                    </a>
                </li>
            ))
        }
    </ul>
</section>
```

ポイントは次の3つです。

- **ブランドカラーは `style` で入れる**：Tailwind のクラスは動的に組み立てるとビルド時に検出されないので、`hex` はインラインの `style` で渡しています
- **アイコンは `fill-current`**：SVG の塗りを文字色に合わせて、白い文字と同じ色にしています
- **`aria-hidden="true"`**：ボタンには「X」などの文字があるので、アイコンは読み上げ対象から外しています

記事ページ側では、記事の URL を組み立てて渡すだけです。

```astro
<ArticleShare title={title} url={pageURL} />
```

## 気をつけたところ

- **X と Threads はどちらも黒**：ブランドカラーがどちらも `000000` なので、黒いボタンが2つ並びます。ロゴと文字で区別がつくので、そのままにしました
- **ロゴは各社の商標**：simple-icons のアイコンデータ自体は CC0 ですが、ロゴは各社の商標です。シェアボタンのように「そのサービスへのリンク」として使う範囲にとどめています

## まとめ

シェアボタンは、各サービスのシェア用 URL へのリンクを並べるだけで作れます。simple-icons を使えば、アイコンとブランドカラーもビルド時に埋め込めるので、外部スクリプトなしでも見た目はしっかりしたボタンになりました。
