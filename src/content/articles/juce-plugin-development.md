---
title: "音源プラグインを作るなら JUCE をすすめる理由（SANA 8BIT VST の経験から）"
description: "チップチューン用の VST シンセ SANA 8BIT VST を JUCE で作った経験から、プラグイン開発で一番面倒な「フォーマット対応」と「Windows / macOS のビルド」を JUCE に任せられた話をまとめます。日本語の情報が少ない点と、2026年に Claude Code で CMake 化したときに詰まった3か所も書きます。"
pubDate: 2026-10-30
tags: ["JUCE", "C++", "VST", "個人開発"]
---
[SANA 8BIT VST](/projects/sana-8bit-vst/) は、ファミコンやゲームボーイのような音を DAW で鳴らすための、チップチューン用のシンセサイザーです。2018 年に作り始め、ソースコードは [GitHub](https://github.com/m-masaki72/SANA_8BIT_VST) で GPL-3.0 で公開しています（いまはスター 139・フォーク 10）。

このシンセは、C++ のフレームワーク [JUCE](https://juce.com/) で作りました。音源やエフェクトのプラグインを作ってみたい人には、まず JUCE をすすめています。理由は一つで、**プラグイン開発で一番面倒なところを JUCE が肩代わりしてくれる** からです。

この記事は、C++ を少し書けて、これからプラグインを作りたい人に向けて書いています。

## プラグイン開発で一番面倒なところ

自分の音源を作るとき、本当に時間をかけたいのは音の部分です。SANA 8BIT VST なら、矩形波の鳴らし方、ピッチスイープ、ビブラート、マウスで波形を描ける WAVEFORM MEMORY がそれにあたります。

ところが、プラグインとして配るには、音とは関係のない作業が大量にあります。

- **プラグインの形式に合わせる**：Windows では VST、macOS では VST と AU が使われていて、形式ごとに SDK も作法も違う
- **OS ごとにビルドする**：Windows は Visual Studio、macOS は Xcode で、プロジェクトの設定を別々に持つことになる

この 2 つを自分で書いていたら、音を作る前に力尽きていたと思います。

## JUCE に任せられたこと

### プラグインの形式

JUCE では、音を出す処理（`AudioProcessor`）と画面（`AudioProcessorEditor`）を一度書けば、VST・VST3・AU などの形式へは JUCE が変換してくれます。どの形式で出すかは、設定で選ぶだけです。

SANA 8BIT VST も、最初は Windows の VST と macOS の VST / AU を同じソースから出していました。2022 年の v2 では VST3 にも対応しました。そのコミットは、Projucer の設定の変更と、ほかの微修正を含めたソースの数十行の変更だけで済んでいます。

### Windows / macOS のビルド

JUCE には Projucer というプロジェクト管理ツールがあり、1 つのプロジェクトファイル（`.jucer`）から Visual Studio と Xcode のプロジェクトを作れます。ソースファイルを足したり設定を変えたりするのは Projucer の側だけで、OS ごとの設定を二重に管理せずに済みました。

Studio One・Cubase・FL Studio・Ableton Live・REAPER などで動作を確認できたのも、形式ごとの細かい違いを JUCE が吸収してくれていたからです。

## 日本語の情報が少ない

一方で、困ったのは **日本語の情報が少ない** ことでした。公式のドキュメントやチュートリアルは英語で、プラグイン開発自体も、日本語で書いている人が多い分野ではありません。

SANA 8BIT VST は、COx2 さんの [JUCE_JAPAN_DEMO](https://github.com/COx2/JUCE_JAPAN_DEMO) を出発点にしました。日本語で読める、実際に動くシンセのデモがあったことが、JUCE を選んだ決め手です。COx2 さんには、その後コントリビューターとしても参加してもらっています。

これから始めるなら、次の順で進めるのがおすすめです。

1. 動くデモや公式のサンプルをビルドして、DAW で鳴らす
2. 音の処理（`processBlock` や `SynthesiserVoice`）を少しずつ書き換える
3. 画面は後回しにして、最初は JUCE の標準の画面でパラメータを触る

最初から全部を理解しようとせず、動くものを改造していくのが近道でした。

## 2026年：Claude Code で CMake に移した

2026 年 2 月に、Claude Code を使って SANA 8BIT VST のビルドを Projucer から CMake に移し、GitHub Actions で Windows と macOS の両方をビルドできるようにしました。いまの JUCE では、Projucer のほかに CMake でもプロジェクトを組めます。

CMake の設定は、`juce_add_plugin` に出したい形式を並べるだけで、ほとんどが済みます。

```cmake
juce_add_plugin(SANA_8bit_VST
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    FORMATS VST3 AU Standalone
    VST3_CATEGORIES Instrument Synth
    AU_MAIN_TYPE kAudioUnitType_MusicDevice
    PRODUCT_NAME "SANA 8bit VST"
    # ほかの項目は省略
)
```

ここでも、面倒なところは JUCE が持っています。書く量が少なく、JUCE の情報（英語ですが）もネット上に多いので、**AI にとっても書きやすい構成** でした。macOS では Apple Silicon と Intel の両方で動く Universal Binary まで出せています。

ただし、Windows（MSVC）では 3 か所で詰まりました。

- **`JuceHeader.h` が見つからない**：古いソースは Projucer が作る `JuceHeader.h` を読み込んでいる。CMake では `juce_generate_juce_header()` で作らせ、その出力先をインクルードパスに足す必要があった
- **インクルードの順番でエラーになる**：複数のソースをまとめてコンパイルする Unity Build のせいで、読み込み順に依存したエラーが出た。`UNITY_BUILD OFF` にして解決した
- **日本語のコメントで壊れる**：ソースの日本語コメントを MSVC が UTF-8 として読まず、エラーになった。`/utf-8` を付けて解決した

```cmake
juce_generate_juce_header(SANA_8bit_VST)
set_target_properties(SANA_8bit_VST PROPERTIES UNITY_BUILD OFF)

if(MSVC)
    target_compile_options(SANA_8bit_VST PRIVATE /utf-8)
endif()
```

どれも、Projucer 時代の古いプロジェクトを CMake に移すときに出やすい問題です。新しく CMake で始めるなら、最初から `JuceHeader.h` を使わずに必要なモジュールだけを読み込み、ソースを UTF-8 で保存しておけば避けられます。日本語のコメントを書く人は、`/utf-8` だけは最初から付けておくと安心です。

## まとめ

- プラグイン開発で一番面倒なのは、音ではなく **形式への対応と OS ごとのビルド**
- JUCE を使えば、1 つのソースから VST・VST3・AU を、Windows と macOS の両方で出せる
- 困るのは日本語の情報が少ないこと。動くデモを改造するところから始めるのが近道
- いまなら CMake で組めて、AI にも書かせやすい。MSVC では `/utf-8` を忘れずに

なお、JUCE のライセンスはバージョンによって変わっています。作ったプラグインをどう公開・販売するかによって条件が違うので、使い始める前に公式のライセンスのページを確認してください。

## 参考リンク

- [JUCE](https://juce.com/)
- [JUCE CMake API（GitHub）](https://github.com/juce-framework/JUCE/blob/master/docs/CMake%20API.md)
- [JUCE_JAPAN_DEMO（COx2）](https://github.com/COx2/JUCE_JAPAN_DEMO)
- [SANA 8BIT VST（GitHub）](https://github.com/m-masaki72/SANA_8BIT_VST)
