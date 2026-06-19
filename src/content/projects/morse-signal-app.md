---
title: "Morse Signal App"
description: "日本語・英語対応のモールス信号変換・音声再生・放射状樹形図可視化Reactアプリ。"
liveUrl: https://m-masaki72.github.io/morse-signal-app/
githubUrl: https://github.com/m-masaki72/morse-signal-app
image: {
url: "/screenshots/morse-signal-app.png",
alt: "Morse Signal App"
}
---

和文・欧文モールス信号の学習・練習を目的に作ったReactアプリ。ひらがな入力すると自動でカタカナ変換し、濁音（ガ→カ＋゛）も正しく分解してモールス符号に変換する。Web Audio APIでビープ音を再生し、短点（青）・長点（オレンジ）で光の色が変わる視覚演出つき。放射状サンバースト樹形図でモールス符号の二分木構造をそのまま表現し、再生中はパスがアニメーションでハイライトされる——「なぜこの符号なのか」が構造として見えるのが特徴。
