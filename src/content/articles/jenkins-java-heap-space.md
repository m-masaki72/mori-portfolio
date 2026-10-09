---
title: "Jenkinsの「OutOfMemoryError : Java heap space」の対応方法・調査まとめ"
description: "Jenkins で「OutOfMemoryError: Java heap space」が出たときの対応。Java のヒープサイズ指定と、プラグイン（Post Build Task）が原因のケースをまとめました。"
pubDate: 2023-11-10
tags: ["Jenkins", "CI"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2023/11/10/155330"
---
## 概要

- JavaのHeapサイズエラーに遭い、いくつか調べて対応方法を調べてみた
- 発生箇所やケースによって対応すべき箇所が違うので、いくつか参考文献含めてまとめていく

## 実行中のOutOfMemory

### 対応方法

**対応方法: Node・MasterのJavaのメモリ量を増やしてみる。**

実行中突然OutOfMemoryが発生する場合は実行メモリが足りないケースの可能性大です。

公式の対応方法Wikiも一読するのをおすすめしておきます。 

[Jenkins : Builds failing with OutOfMemoryErrors](https://wiki.jenkins.io/JENKINS/Builds-failing-with-OutOfMemoryErrors.html)

### 対応詳細

実際に対応するとして、どこを増やすのかについて詳細なメモを残しておきます。NodeやMasterでJavaで実行する際のオプションにメモリオプションを渡しておきます。 具体的には以下のようなオプションを指定するのが良いです。

```sh
# Java実行時の引数で最小メモリxmsと最大メモリxmxをMBで指定
java -Xms256m -Xmx256m <Jenkinsの実行パス>

# Java実行時の引数で最小メモリxmsと最大メモリxmxをGBでも指定できる
java -Xms2g -Xmx2g <Jenkinsの実行パス>
```

また上記のオプションでは固定メモリになりますが、Docker等で実行している場合はマシンの割合で指定するのが良いでしょう。

```sh
# Java実行時の引数で最小メモリと最大メモリをパーセンテージで指定する
java  -XX:InitialRAMPercentage=50 -XX:MaxRAMPercentage=75 <Jenkinsの実行パス>
```

場合によってはjenkins.xmlやサービスの実行ファイルで指定する場合もあるので各自の環境でそこは読み替えること。

## プラグイン実行時のOutOfMemory

### 対応方法

**対応方法: プラグインのエラーを怪しんでみる、違うプラグインを使う**

「Post Build Task」といった外部プラグイン処理が要因でメモリエラーが発生することもあるようです。私の環境では大きすぎるログ・ファイルとPost Build Taskプラグインという条件でメモリエラーが確認できました。（Post Build Taskでは内部でログの文字列比較をしているため、その処理部分が原因のようです）

メモリエラーが発生した場合、そのログが出ている箇所を確認し、プラグインが要因かもしれないと目星をつけることが可能かもしれません。ただしOutOfMemoryが発生している場合は突然処理が落ちるため、ログがある場合のない場合がありました。何度か実行してログを取ってみるのが良いでしょう。

## 参考リンク

- [Jenkins PostBuildTaskプラグインでエラーが発生する時の対処法 | hexacosa.net](https://www.hexacosa.net/blog/detail/152/)
- [Java VMのヒープサイズをパーセンテージで指定する（-XX:InitialRAMPercentage、-XX:MaxRAMPercentage） - CLOVER🍀](https://kazuhira-r.hatenablog.com/entry/2023/07/09/212521)
