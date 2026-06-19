---
title: "うちの子ID写真メーカー"
description: "ペットやキャラクターの証明写真風画像を作れるWebアプリ。背景色・位置を調整してダウンロード。"
liveUrl: https://uchinoko-id.morilab-garage.com/
githubUrl: https://github.com/m-masaki72/IdPhotoGenerator
image: {
url: "/screenshots/uchinoko-id.png",
alt: "うちの子ID写真メーカー"
}
---

ペットや推しキャラの「証明写真」が作れるブラウザアプリ。お手本画像1枚＋証明写真用画像6枚をアップロードすると、`@imgly/background-removal`がブラウザ内で背景除去（サーバー送信なし）。ドラッグ＆スライダーで位置・スケールを調整し、背景色・枠線レイアウトをカスタマイズして高解像度PNGでダウンロードできる。SharedArrayBufferが必要な制約を`_headers`で解決し、Cloudflare Pagesで配信している。
