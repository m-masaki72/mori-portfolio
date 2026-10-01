---
title: "Chordpernicus"
description: "既存のコード進行を機能和声を保ったままAIがリハーモナイズするWebアプリ。理論解説付きでMIDI試聴・DL可能。"
liveUrl: https://chordpernicus.morilab-garage.com/
image: {
url: "/screenshots/chordpernicus.png",
alt: "Chordpernicus"
}
category: "音楽・オーディオ"
platform: "Web"
tech: ["Claude API", "JavaScript", "MIDI", "Cloud Run"]
order: 1
---

「C G Am F」のようなコード進行をテキストで入力すると、Claude APIがトニック/サブドミナント/ドミナントの機能を保ったまま複数のリハーモナイズ案を生成するWebアプリ。[Chord Eureka](/projects/chord-eureka)が「ゼロから作る」担当なら、Chordpernicusは「すでにある進行を磨く」担当。ジャジー・ポップ・シネマティック・ローファイなどのスタイルや、代理コード・裏コード・ネガティブハーモニーといった技法を指定でき、各案には「なぜそのコードに置き換えたのか」という理論解説が付く。自作のピアノロールプレイヤーで原曲とバリエーションを聴き比べ、気に入った案はMIDIとしてダウンロード（DAWへドラッグ&ドロップも可能）。技法カバレッジパネルで自分の作編曲の傾向も振り返れる。
