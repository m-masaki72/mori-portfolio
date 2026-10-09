---
title: "Unity開発で便利な高機能エディタであるRiderが非商用に限り無料で使えるように"
description: "JetBrains Rider が非商用なら無料に。Unity 開発で VSCode から Rider に乗り換えてよかった点（静的解析・プラグイン・ドキュメント・キーマップ）を紹介します。"
pubDate: 2024-11-28
tags: ["Unity", "Rider", "C#"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2024/11/28/014827"
---
## JetBrainsからリリースされた公式AIサポートもありまする高機能IDE、RiderとWebStormが非商用に限り無償化になりました

- Riderは.NET開発、Unity開発で特に便利なものなので趣味開発している人はぜひ利用してみよう
- 特にUnity開発においてRider使ってみると手放せなくなること間違いなしです
- 本記事では私がUnityのEditorをVSCodeからRiderに変えて良かった部分をアピールしていきます

なお本記事は2024/11/28現在の情報のため今後変わっていく可能性はあります、あしからず 

[WebStorm and Rider Are Now Free for Non-Commercial Use | The JetBrains Blog](https://blog.jetbrains.com/blog/2024/10/24/webstorm-and-rider-are-now-free-for-non-commercial-use/)

## どこが変わったの？

Riderは年間約20,000円のプランが用意されていた有償のIDEでした。現在は以前の有償プランは引き継ぎつつ無償プランが追加されています。 条件は「個人用非商用」というだけ。普段の趣味開発でバリバリ使ってOKです。

[https://www.jetbrains.com/ja-jp/rider/buy/?section=personal&billing=yearly](https://www.jetbrains.com/ja-jp/rider/buy/?section=personal&billing=yearly)

## Riderとはなに？便利なところは？

Riderへの乗り換えを考えてみるうえでアピールしたいポイントですが、有料IDEならではの機能性の高い標準搭載機能です。正直なところ自分も使い切れてない部分は多いのですが、よく使う部分で役に立っている部分を抜粋して紹介したいと思います。もちろん標準のエディタ機能は十分にありますので、Riderならではの機能をいくつか載せます。

### 十分すぎる標準機能

**Riderはとにかくなんでも標準搭載されてます** 

[Unity の機能  | JetBrains Rider ドキュメント ](https://pleiades.io/help/rider/Features_Unity.html#inspections-and-quick-fixes)

以下がRiderを開いたところですが、とにかくいろんな機能が搭載されていてウィンドウが多いです。IDEなので当然といえば当然ですが。 

![](/articles/rider-free-non-commercial/1.png)

Riderの外観

よく使うウィンドウなら検索機能、ファイラー、デバッガなどが用意されていますがどれも標準機能で連携されているため使っていて不自由を感じません。 また色々な機能がありながら、VisutalStudioと比べても動作が軽い印象があります。

### 手厚い静的解析機能

**Riderではエディタ側で静的解析を実行してくれます**

Riderはとくに何も設定しなくても静的解析をサポートしてくれます。イメージはこんな感じです。 

![](/articles/rider-free-non-commercial/2.png)

ややこしく感じますが普段のコードを書いていて一番使う機能がここです。 

![](/articles/rider-free-non-commercial/3.png)

コードを書いていてRider側で改善できそうなところに 💡マークをつけてくれます。そこを右クリックすると、その問題点と改善コードをそのまま書いてくれます。 自分で書いたコードから💡マーク部分で右クリックするだけでより安全なコードに勝手に書き換えてくれます。

私がよく指摘される部分はこんな感じです。コードレビューで見落としがちなケアレスミス部分をかなり指摘してくれます。

- privateなどのアクセス装飾子がついてないのでつける
- publicにしているけどこれはprivateにしていい
- 使ってない変数があるので消す
- ここはintではなくvarで宣言したほうがいい
- 早期returnの形で書ける部分
- 単語のスペルミスがある
- 変数の綴りでキャメルケース、スネークケースの決まりミスがある
- 不要なusing,不要なアノテーションがある

思いつく限り書いてみましたがRiderを使うことでかなりケアレスミスを対応してくれました。

### ユニークなプラグイン

Riderにはユニークなプラグインがあり、職場の先輩から教えてくれたものがあります。ぜひ試してみましょう。

#### サイクロマティック複雑度・コグニティブ複雑度を計測してくれるプラグイン

コードのネストの深さだったり処理の**複雑さが高すぎる部分を計測して指摘してくれます** 参考

[JetBrains Riderでコードの複雑度を計測する - やらなイカ？](https://www.nowsprinting.com/entry/2020/01/12/230000)

#### メモリリークを気にしてくれるプラグイン

C#に移行した際に一番つまずきがちな**ヒープアロケーションを指摘してくれるプラグインです**。絶対入れましょう。 

[Heap Allocations Viewer - IntelliJ IDEs Plugin | Marketplace](https://plugins.jetbrains.com/plugin/9223-heap-allocations-viewer)

[RiderのHeap Allocations Viewerについて - SDD(Sleep-Driven Development)](https://crocus7724.hatenablog.jp/entry/2016/11/13/133940)

### 親切すぎる公式リファレンス

**Riderはとにかく公式ドキュメントが豊富です。** [ドキュメントと動画－ Rider](https://www.jetbrains.com/ja-jp/rider/documentation/)

「〇〇の機能」と調べるだけで公式の使い方が出てきますし、ちゃんと日本語対応されています。 ドキュメントが多いこともありChatGPTにRiderの機能について質問しても割と正しい結果が返ってきます。 また有料IDEとしてヘビーユーザの企業エンジニアも多いためかそういった人が書いているブログも多いです。

### 他エディタからも楽に乗り換えできるカスタマイズ性

**Riderは他のエディタの動作を再現するキーマップが標準搭載されています** 

[ キーボードショートカット:  キーマップの比較  (Windows) | JetBrains Rider ドキュメント ](https://pleiades.io/help/rider/Keymaps_Comparison_Windows.html)

VSCodeやVisutalStudioを再現したキーマップが用意されているので、シームレスに乗り換え可能です。

## 最後に

**Unity使うならRider使いましょう**
