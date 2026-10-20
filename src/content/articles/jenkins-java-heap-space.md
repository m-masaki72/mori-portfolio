---
title: "Jenkinsの「OutOfMemoryError : Java heap space」の対応方法・調査まとめ"
description: "Jenkins で「OutOfMemoryError: Java heap space」が出たときの対応。まずどのプロセスのメモリが足りないのかを切り分け、コントローラー・エージェントのヒープ指定（systemd・Docker・Windows）、ビルドツール側の設定、プラグイン（Post Build Task）が原因のケースをまとめました。"
pubDate: 2023-11-10
updatedDate: 2026-10-21
tags: ["Jenkins", "CI"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2023/11/10/155330"
---
Jenkins で `OutOfMemoryError: Java heap space` に遭い、対応方法を調べました。同じエラーでも、**どの Java プロセスのメモリが足りないか** によって直す場所が違います。この記事では、切り分け方と、それぞれの直し方をまとめます。

2026年10月に、今の Jenkins に合わせて内容を見直しました（systemd での設定方法、ヒープを割合で指定する推奨値、ビルドツール側の設定を追加）。

## まず、どのプロセスが落ちたのかを見る

Jenkins まわりで Java が動いている場所は、主に3つあります。

| どこで落ちたか | ログの出どころ | 直す場所 |
|---|---|---|
| コントローラー（旧称 Master） | Jenkins 本体のログ。画面が重くなる・応答しなくなる | コントローラーの `JAVA_OPTS` |
| エージェント（旧称 Node） | エージェントのログ。接続が切れる | エージェント起動時の引数 |
| ビルドの中の Java（Maven・Gradle など） | ビルドのコンソール出力 | ビルドツールの設定 |

ビルドのコンソールに `OutOfMemoryError` が出ていても、Jenkins 本体ではなく、ビルドで動かした Maven や Gradle のメモリが足りないことがよくあります。この場合は Jenkins のヒープを増やしても直りません。

## コントローラー・エージェントのメモリを増やす

実行中に突然落ちる場合は、Jenkins を動かしている Java のメモリが足りない可能性が高いです。

### 指定のしかた

固定の値で指定するなら、最小 `-Xms` と最大 `-Xmx` を渡します。

```sh
# MB で指定
java -Xms256m -Xmx256m -jar jenkins.war

# GB でも指定できる
java -Xms2g -Xmx2g -jar jenkins.war
```

Docker などのコンテナで動かす場合は、マシンのメモリに対する割合で指定するほうが扱いやすいです。Jenkins の公式ブログ（2026年2月）では、Java 17 以降なら次のような値をすすめています。

```sh
# コントローラー：ヒープは最大60%まで。残りは OS やネイティブのメモリに回す
-XX:+UseG1GC -XX:MaxRAMPercentage=60.0 -XX:InitialRAMPercentage=20.0

# エージェント：もう少し多めでもよい
-XX:+UseG1GC -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0
```

ヒープをマシンのメモリいっぱいまで増やすと、今度は OS 側が足りなくなって不安定になります。ほかのアプリも同じマシンで動いているなら、そのぶんも差し引いて考えます。

### 環境ごとの設定場所

**Linux（systemd でサービスとして動かしている場合）**

ユニットファイルを直接書き換えず、`systemctl edit jenkins` で上書き用の設定を作ります。

```sh
sudo systemctl edit jenkins
```

開いたエディタに次のように書きます。

```ini
[Service]
Environment="JAVA_OPTS=-Xms2g -Xmx2g"
```

保存したら再起動します。

```sh
sudo systemctl restart jenkins
```

古いパッケージでは `/etc/default/jenkins` の `JAVA_ARGS` で指定していましたが、今の systemd の構成ではこちらは読まれません。

**Docker（公式イメージ）**

環境変数 `JAVA_OPTS` で渡します。

```sh
docker run -e JAVA_OPTS="-XX:MaxRAMPercentage=60.0" -p 8080:8080 jenkins/jenkins:lts
```

**Windows（サービスとして動かしている場合）**

インストール先の `jenkins.xml` にある `<arguments>` に、`-Xmx` などを足して、サービスを再起動します。

**エージェント**

エージェントを起動するコマンドの `java` の直後に `-Xmx` などを付けます。SSH で起動するエージェントなら、ノードの設定の「JVM オプション」に書けます。

### 効いているか確かめる

「Jenkins の管理 → システム情報」で、起動時の引数を確認できます。Linux なら `systemctl cat jenkins` で、上書きした設定が入っているかも見られます。

原因を調べたいときは、落ちたときにヒープの中身を残すオプションも付けておくと便利です。

```sh
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/var/lib/jenkins/heapdump
```

## ビルドツール側のメモリを増やす

ビルドの中で動く Java は、Jenkins とは別のプロセスです。ビルドツールの設定でメモリを指定します。

- **Maven**：環境変数 `MAVEN_OPTS="-Xmx2g"`
- **Gradle**：`gradle.properties` の `org.gradle.jvmargs=-Xmx2g`

パイプラインなら、`environment { MAVEN_OPTS = '-Xmx2g' }` のようにジョブごとに渡せます。

## プラグインが原因のケース

**対応方法：プラグインを疑ってみる。違うプラグインに置き換える**

外部のプラグインの処理が原因でメモリエラーになることもあります。私の環境では、**とても大きなログ** と **Post Build Task プラグイン** が重なったときにメモリエラーが起きました。Post Build Task はビルドのログを文字列として読み込んで比較しているので、その処理でメモリを使い切っていたようです。

メモリエラーが出たら、ログが出ている場所を見て、プラグインが原因かどうか目星をつけます。ただし `OutOfMemoryError` は処理が突然落ちるので、ログが残る場合と残らない場合がありました。何度か実行してログを取ってみるのがよいです。

ログの量を減らす（ビルドの出力を絞る・大きな出力はファイルに書いて成果物にする）だけで直ることもあります。Post Build Task でやっていた処理は、パイプラインの `post { }` ブロックでも書けます。

## まとめ

- まず、落ちたのがコントローラー・エージェント・ビルドツールのどれかを見る
- コントローラーとエージェントは `JAVA_OPTS` などでヒープを指定する。コンテナでは割合（`MaxRAMPercentage`）で指定し、コントローラーは60%程度までにとどめる
- systemd の環境では、ユニットファイルを直接書き換えず `systemctl edit jenkins` を使う
- Maven・Gradle のメモリ不足は、それぞれの設定で直す
- 大きなログとログを読むプラグインの組み合わせでも起きる

## 参考リンク

- [Tuning Jenkins Java Settings For Responsiveness and Stability with Large Instances - Jenkins Blog](https://www.jenkins.io/blog/2026/02/06/tuning-java-settings-for-higher-performance/)
- [Managing systemd services - Jenkins](https://www.jenkins.io/doc/book/system-administration/systemd-services/)
- [Post build task - Jenkins Plugins](https://plugins.jenkins.io/postbuild-task/)
- [Jenkins PostBuildTaskプラグインでエラーが発生する時の対処法 | hexacosa.net](https://www.hexacosa.net/blog/detail/152/)
- [Java VMのヒープサイズをパーセンテージで指定する（-XX:InitialRAMPercentage、-XX:MaxRAMPercentage） - CLOVER🍀](https://kazuhira-r.hatenablog.com/entry/2023/07/09/212521)
