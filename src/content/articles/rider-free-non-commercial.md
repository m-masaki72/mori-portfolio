---
title: "Unity開発で便利な高機能エディタであるRiderが非商用に限り無料で使えるように"
description: "JetBrains Rider は非商用なら無料で使えます。無料ライセンスの条件（使用状況データの送信・1年ごとの自動更新・商用の線引き）と、Unity 開発で VSCode から Rider に乗り換えてよかった点（静的解析・プラグイン・ドキュメント・キーマップ）を紹介します。"
pubDate: 2024-11-28
updatedDate: 2026-10-21
tags: ["Unity", "Rider", "C#"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2024/11/28/014827"
---
2024年10月、JetBrains の IDE である Rider と WebStorm が、非商用に限り無料で使えるようになりました。Rider は .NET や Unity の開発で特に便利な IDE です。趣味で開発している人はぜひ使ってみてください。

この記事では、無料ライセンスの条件と、Unity のエディタを VSCode から Rider に変えてよかったところを紹介します。

2026年10月に内容を見直しました。無料ライセンスの条件は、公開時から大きくは変わっていません。細かい条件（使用状況データの送信・更新のしかた）を追記し、リンクを公式ドキュメントに差し替えています。

[WebStorm and Rider Are Now Free for Non-Commercial Use | The JetBrains Blog](https://blog.jetbrains.com/blog/2024/10/24/webstorm-and-rider-are-now-free-for-non-commercial-use/)

## 無料ライセンスの条件

Rider はもともと有償の IDE で、年間のサブスクリプションで使うものでした。今も有償のプランはそのままで、そこに非商用向けの無料ライセンスが加わった形です。

| 項目 | 内容 |
|---|---|
| 使える用途 | 学習、コンテンツ作り、オープンソース、趣味の開発 |
| 使えない用途 | 今または将来、作ったものでお金を得るつもりがある開発 |
| 期間 | 1年ごとに自動で更新。期間の最後の6か月に一度でも使っていることが条件 |
| 使用状況データ | 機能の使い方の匿名の統計が JetBrains に送られる。無料ライセンスではこれを止められない |
| 有効化 | JetBrains アカウントでログインし、ネット接続が必要（オフラインでの有効化はできない） |
| 対応バージョン | Rider 2024.2.7 以降 |

有効にするには、メニューの Help → Manage Licenses... から「Non-commercial use」を選び、規約に同意します。

気をつけたいのは **商用の線引き** です。最初は趣味のつもりでも、作ったゲームを販売するなど目的が変わったら、商用ライセンスに切り替える必要があります。迷うなら商用ライセンスにするよう、公式にも書かれています。

なお、このあと CLion・RubyMine・DataGrip なども非商用なら無料になりました。

[Register JetBrains Rider - JetBrains Rider Documentation](https://www.jetbrains.com/help/rider/Register.html)

## Rider の便利なところ

Rider の良さは、有償の IDE らしく、最初から入っている機能の多さです。正直なところ、私も使い切れていない部分は多いです。ここでは、普段よく使っていて役に立っているところを抜き出して紹介します。

### 十分すぎる標準機能

**Rider は、とにかくなんでも最初から入っています。**

[Unity | JetBrains Rider Documentation](https://www.jetbrains.com/help/rider/Unity.html)

Rider を開いたところです。いろいろな機能があって、ウィンドウが多いです。IDE なので当然といえば当然ですが。

![Rider を開いたところ](/articles/rider-free-non-commercial/1.png)

検索、ファイラー、デバッガなど、よく使うウィンドウはどれも標準の機能でつながっているので、使っていて不自由を感じません。機能が多いわりに、Visual Studio と比べても動作が軽い印象があります。

### 手厚い静的解析

**Rider は、エディタ側で静的解析をしてくれます。**

特に何も設定しなくても、静的解析が効きます。イメージはこんな感じです。

![静的解析の結果が表示されている画面](/articles/rider-free-non-commercial/2.png)

ややこしく見えますが、普段コードを書いていて一番使う機能がここです。

![💡マークから修正案を選ぶところ](/articles/rider-free-non-commercial/3.png)

改善できそうなところに 💡 マークを付けてくれます。そこを押すと、問題点と修正したコードを出してくれます。選ぶだけで、より安全なコードに書き換えてくれます。

私がよく指摘されるのはこんなところです。コードレビューで見落としがちなケアレスミスをかなり拾ってくれます。

- `private` などのアクセス修飾子が付いていない
- `public` にしているが、`private` でよい
- 使っていない変数がある
- `int` ではなく `var` で宣言したほうがよい
- 早期 return の形で書ける
- 単語のスペルミスがある
- 変数名のキャメルケース・スネークケースの決まりから外れている
- 不要な `using`、不要な属性がある

Unity 向けの検査もあります。たとえば、毎フレーム呼ばれる処理で重い API を使っていると教えてくれます（[NonAlloc 版の関数のメモ](/articles/unity-nonalloc-apis/) もこの警告がきっかけでした）。

### ユニークなプラグイン

職場の先輩に教えてもらったプラグインです。ぜひ試してみてください。

#### サイクロマティック複雑度・認知的複雑度を測るプラグイン

ネストの深さなど、**処理が複雑すぎるところを数値にして指摘してくれます。**

[JetBrains Riderでコードの複雑度を計測する - やらなイカ？](https://www.nowsprinting.com/entry/2020/01/12/230000)

#### ヒープアロケーションを教えてくれるプラグイン

C# に移ったときに一番つまずきやすい、**ヒープアロケーション（GC の原因になるメモリ確保）を指摘してくれるプラグインです。** Unity では特に効くので、絶対に入れましょう。2026年10月時点でも更新が続いていて、Rider 2026.2 に対応しています。

[Heap Allocations Viewer - JetBrains Marketplace](https://plugins.jetbrains.com/plugin/9223-heap-allocations-viewer)

[RiderのHeap Allocations Viewerについて - SDD(Sleep-Driven Development)](https://crocus7724.hatenablog.jp/entry/2016/11/13/133940)

### 親切すぎる公式ドキュメント

**Rider は公式ドキュメントがとても豊富です。**

[ドキュメントと動画 - Rider](https://www.jetbrains.com/ja-jp/rider/documentation/)

「〇〇の機能」と調べるだけで公式の使い方が出てきます。ドキュメントが多いからか、AI に Rider の機能を聞いても、わりと正しい答えが返ってきます。有償の IDE として使っている企業のエンジニアも多く、ブログの記事も見つけやすいです。

### ほかのエディタから乗り換えやすいキーマップ

**Rider には、ほかのエディタの操作を再現するキーマップが最初から入っています。**

[Keymaps comparison (Windows) | JetBrains Rider Documentation](https://www.jetbrains.com/help/rider/Keymaps_Comparison_Windows.html)

VSCode や Visual Studio のキーマップがあるので、手に慣れた操作のまま乗り換えられます。

## VSCode のままでもいい人

Unity の開発は、VSCode でもできます。Microsoft が Unity 向けの拡張機能を出していて、デバッグもできます。軽さを重視する人や、ほかの言語も同じエディタで書きたい人は VSCode のままでよいと思います。

それでも、静的解析の細かさと、Unity 向けの検査の多さは Rider が一歩上です。無料で試せるので、一度使ってみて比べるのがおすすめです。

## まとめ

- Rider は、学習・趣味・オープンソースなどの非商用なら無料で使える
- 無料ライセンスでは使用状況の匿名の統計が送られ、止められない。1年ごとに自動で更新される
- 作ったものでお金を得るなら商用ライセンスにする
- Unity 開発では、静的解析とプラグイン（Heap Allocations Viewer など）が特に便利

**Unity を使うなら、Rider を使いましょう。**
