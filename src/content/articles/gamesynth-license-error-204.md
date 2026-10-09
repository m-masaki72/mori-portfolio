---
title: "GameSynthが起動しない際の対応方法: A problem with your license has been encountered: code 204"
description: "効果音生成ツール GameSynth が「A problem with your license has been encountered: code 204」で起動しないときの対処。原因は JetBrains dotPeek でした。"
pubDate: 2025-02-25
tags: ["GameSynth", "サウンド"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2025/02/25/120408"
---
## A problem with your license has been encountered: code 204 が発生してGameSynthが起動しない

GameSynthを使用しているのだが、いつからか起動しなくなってしまった。 204のエラーが発生していることがわかったが何が起因になっているかわからず問い合わせしてみたところ以下の回答をいただいたので備忘録としてメモしておく。

[GameSynth ゲーム効果音生成ツール | Tsugi](https://tsugi-studio.com/web/jp/products-gamesynth.html)

## JetBrainのdotPeekを完全にアンインストールする

どうにもJetBrainのdotPeekの認証と相性が悪いらしくそちらをアンインストールする必要があるらしい。 以下対応手順を記載する。

- dotPeekをアンインストールする
  - プログラムの追加と削除から削除すればOK
  - 他のJetBrain製品はそのままでOK
- レジストリからdotPeekを削除する
  - レジストリエディタを開く
  - `HKEY_CURRENT_USER\Software\JetBrains\dotPeek` があれば右クリックから削除

この対応後にGameSynthを再起動したところ問題なく起動した。PCの再起動は必要なかった。

アンインストールする項目についてはこちらを参考にした 

[Uninstall dotPeek completely](https://dotnettools-support.jetbrains.com/hc/en-us/community/posts/360006897239-Uninstall-dotPeek-completely)

## まとめ

GameSynthとJetBrainツールを同時に使う人はそう多くないと思われるが、似たようなハマり方をした人のためにこの記事を書いておく。
