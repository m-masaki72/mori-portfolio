---
title: "Chord Eureka"
description: "キーワードと気分を選ぶだけでAIがコード進行を生成。ピアノロール表示・MIDIエクスポート対応。"
liveUrl: https://chordeureka.morilab-garage.com
githubUrl: https://github.com/m-masaki72/ChordEureka
image: {
url: "/screenshots/chord-eureka.png",
alt: "Chord Eureka"
}
---

「切ない」「ジャズ」「疾走感」などのキーワードを入力すると、Claude Sonnet APIがコード進行を生成するWebアプリ。Tonal.jsで音楽理論的に正しいボイシングに変換し、midi-writer-jsでMIDIデータを生成、ブラウザ上でそのまま試聴できる。生成結果はMIDIファイルとしてエクスポートしてDAWに読み込める。バックエンドはExpress.js、フロントエンドはDAW風のサイバーデザインに仕上げた。
