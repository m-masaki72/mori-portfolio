---
title: "個人開発の Windows アプリを Microsoft Store に出すまで（MSIX パッケージ・wapproj のハマりどころ・審査メモ）"
description: "WPF で作ったデスクトップアプリ HeatDesk を Microsoft Store に公開しました。Partner Center での名前の予約、wapproj と Package.appxmanifest の設定、MSBuild で出たエラーと直し方、審査担当者へのメモ、ストア用の画像まで、つまずいた順にまとめます。"
pubDate: 2026-10-14
tags: ["Windows", "Microsoft Store", "MSIX"]
---
[HeatDesk](/projects/heatdesk/) は、PC の CPU・メモリの使用状況を壁紙のヒートマップとして表示する Windows アプリです。これを [Microsoft Store](https://apps.microsoft.com/detail/9nn135pc38f9) で公開しました。

デスクトップアプリをストアに出すのは初めてで、パッケージ作りでかなりつまずきました。この記事では、公開までの流れと、ハマったところをまとめます。

**環境**：Windows 10 / .NET（WPF）/ Visual Studio 2022 / Windows Application Packaging Project（wapproj）

## 全体の流れ

| 日 | やったこと |
|---|---|
| 1日目 | Partner Center でアプリ名を予約、ストア用の画像と説明文を用意、wapproj を追加 |
| 3日目 | コマンドラインのビルドが通らず、wapproj を書き直す。ロゴのサイズエラーを直す |
| 5日目 | 署名・言語・最小バージョンのエラーを直してパッケージ完成、提出 |
| 8日目 | 公開 |

1週間ほどで公開できました。時間がかかったのは、ほぼパッケージ作りです。

## 1. Partner Center でアプリ名を予約する

まず [Partner Center](https://partner.microsoft.com/dashboard) に開発者アカウントを作り、アプリ名を予約します。予約すると、パッケージに書く **Identity**（パッケージ名・発行元）が発行されます。

```xml
<Identity Name="MasakiMori.HeatDesk"
          Publisher="CN=..."
          Version="1.0.1.0" />
```

この値は Partner Center の「製品 ID」のページに出ているものを **そのままコピー** します。自分で考えた名前にすると、提出時に弾かれます。

## 2. wapproj でデスクトップアプリを MSIX にする

WPF などのふつうのデスクトップアプリは、**Windows Application Packaging Project**（拡張子 `.wapproj`）を足すと MSIX パッケージにできます。Visual Studio の「新しいプロジェクト」から追加し、参照にアプリ本体のプロジェクトを入れます。

`Package.appxmanifest` で大事なのは次のあたりです。

```xml
<Dependencies>
  <TargetDeviceFamily Name="Windows.Desktop"
                      MinVersion="10.0.19041.0"
                      MaxVersionTested="10.0.22621.0" />
</Dependencies>

<Applications>
  <Application Id="App"
               Executable="$targetnametoken$.exe"
               EntryPoint="Windows.FullTrustApplication">
    ...
  </Application>
</Applications>

<Capabilities>
  <rescap:Capability Name="runFullTrust" />
</Capabilities>
```

- **`Windows.FullTrustApplication` と `runFullTrust`**：ふつうのデスクトップアプリとして（サンドボックスなしで）動かすための指定です。HeatDesk はほかのプロセスの CPU 使用率を読むので、これが必要でした
- **`MinVersion`**：アプリ本体の `TargetFramework`（`net8.0-windows10.0.19041.0` など）と **同じ値にそろえる** 必要があります（後述）

## 3. ビルドで出たエラーと直し方

ここからが本番でした。Visual Studio からは動くのに、コマンドライン（MSBuild）からだと通らない、ということが何度もありました。

### SDK 形式の wapproj がコマンドラインでビルドできない

最初は、ほかのプロジェクトに合わせて wapproj を **SDK 形式**（`<Project Sdk="...">`）で書いていました。ところが MSBuild で、`GetFrameworkSdkPackages` タスクが見つからないというエラーになります。

Visual Studio が作る **従来の形式**（`ToolsVersion="15.0"`）に書き直したら通りました。

```xml
<Project ToolsVersion="15.0" DefaultTargets="Build"
         xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <PropertyGroup>
    <WapProjPath Condition="'$(WapProjPath)'==''">$(MSBuildExtensionsPath)\Microsoft\DesktopBridge\</WapProjPath>
  </PropertyGroup>
  <Import Project="$(WapProjPath)\Microsoft.DesktopBridge.props" />
  ...
  <Import Project="$(WapProjPath)\Microsoft.DesktopBridge.targets" />
</Project>
```

wapproj は新しい SDK 形式にはまだ対応しきれていないので、**Visual Studio が生成した形のまま使う** のが無難です。

また、`dotnet build` ではなく、**Visual Studio に付いている MSBuild**（`MSBuild.exe`）でビルドする必要があります。

### DesktopBridge.props を二重に読み込んでいた

書き直しの途中で `Microsoft.DesktopBridge.props` の `Import` が2か所に入り、警告とおかしな挙動が出ました。props と targets は **1回ずつ** にします。

### APPX1619：ロゴの画像サイズが合わない

```text
error APPX1619: The image ... has an invalid size.
```

マニフェストの `<Properties>` にある `<Logo>` に、150×150 のタイルの画像を指定していたのが原因でした。ここは **ストアロゴ（50×50 の `StoreLogo.png`）** を指定する場所です。

```xml
<Properties>
  <DisplayName>HeatDesk</DisplayName>
  <PublisherDisplayName>...</PublisherDisplayName>
  <Logo>Images\StoreLogo.png</Logo>
</Properties>
```

タイル用の画像（`Square150x150Logo` など）は `<uap:VisualElements>` のほうに書きます。名前が似ていて取り違えやすいところです。

### 署名の証明書がないと言われる

ストアに出すパッケージは、提出後に Microsoft が署名し直してくれます。手元でストア提出用のパッケージを作るだけなら、署名は要りません。

```xml
<AppxPackageSigningEnabled>false</AppxPackageSigningEnabled>
```

これを入れずにいると、証明書がないというエラーで止まりました。

### DefaultLanguage がない

`ja-JP` のリソースしかないアプリでも、wapproj に既定の言語を書いておく必要があります。

```xml
<DefaultLanguage>ja-JP</DefaultLanguage>
```

### 最小バージョンが合わない

マニフェストの `MinVersion` が `10.0.17763.0`、アプリ本体の `TargetFramework` が `10.0.19041.0` で食い違っていて、エラーになりました。**同じ値にそろえる** と通ります。

### ソリューションの構成がおかしくなる

wapproj を消したり足したりしているうちに、`.sln` の `ProjectConfigurationPlatforms` に同じ行が重複したり、wapproj の「ビルド」「配置」のチェックが外れたりしていました。おかしなエラーが出たら、`.sln` を開いて確かめると早いです。

### 最終的な設定

wapproj の主な設定はこうなりました。

```xml
<AppxBundle>Always</AppxBundle>
<AppxBundlePlatforms>x64</AppxBundlePlatforms>
<AppxPackageSigningEnabled>false</AppxPackageSigningEnabled>
<DefaultLanguage>ja-JP</DefaultLanguage>
<TargetPlatformMinVersion>10.0.19041.0</TargetPlatformMinVersion>
```

x64 だけに絞り、Release 構成で `.msixupload` を作って Partner Center に上げています。

## 4. 審査担当者へのメモ（Notes for certification）

提出画面には、審査担当者に向けたメモを書く欄があります。HeatDesk は **ほかのプロセスの情報を読み、壁紙を書き換える** アプリなので、スパイウェアや設定を勝手に変えるアプリと誤解されないかが心配でした。

そこで、次のことを英語で書いています。

- 読むのはプロセス名・CPU 使用率・メモリ使用量だけで、ほかのプロセスへの注入・記録・送信はしない
- ネットワーク通信はしない
- 元の壁紙はバックアップしておき、終了時に戻す。異常終了したときも次の起動で戻す
- 壁紙を変えたくない人向けに、壁紙を変えずに重ねて表示するモードもある
- アプリ内課金はない
- 動作を確かめる手順（起動 → 何を見ればよいか → 終了で壁紙が戻ること）

審査では特に何も言われずに通りました。何をしているかを先に説明しておくのは、効いたと思っています。

## 5. ストア用の画像と説明文

ストアのページ用に、次のものを用意しました。

- スクリーンショット
- ストアロゴ・タイルの画像（各サイズ）
- ヒーロー画像（1920×1080 と 2560×1440）
- ボックスアート・ポスターアート
- 説明文・機能の一覧・キーワード

キーワードは最初10個考えましたが、**Partner Center の上限は7個** だったので削りました。紹介用の短い動画は [Remotion](https://www.remotion.dev/) で作っています。

## 6. 提出後に気をつけること

最初の 1.0.0.0 は審査を通ったあと、公開の前に直したいところが見つかったので止め、1.0.1.0 として出し直しました。

- 審査に通っても、**公開のタイミングは自分で選べる**（すぐ公開／手動で公開）。手動にしておくと、最後に見直す時間が取れる
- 出し直すときは、マニフェストの `Version` を必ず上げる。同じ番号のパッケージは上げられない

## まとめ

- アプリ名は Partner Center で先に予約し、発行された Identity をそのまま使う
- wapproj は Visual Studio が作る従来の形式（`ToolsVersion="15.0"`）のまま使い、Visual Studio の MSBuild でビルドする
- `<Logo>` は 50×50 のストアロゴ。`MinVersion` はアプリ本体とそろえる。ストア提出用なら署名は切る
- 審査担当者へのメモで、何をして何をしないかを先に説明しておく
- キーワードは7個まで
