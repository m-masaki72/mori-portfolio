---
title: "Claude Code から Unreal Editor を操作する：UnrealMCP で毎回落ちていた Blueprint のコンパイルが、UE5.8 公式の MCP では落ちなかった"
description: "UE5.5 と UE5.6 では、Claude Code から UnrealMCP 経由で Blueprint をコンパイルすると、毎回エディタがクラッシュしていました。3日かけて原因を追い、最後は UE5.8 に標準で入った公式の MCP プラグインに移行しました。セットアップの手順と、調査で外れた仮説をまとめます。"
pubDate: 2026-10-17
tags: ["Unreal Engine", "MCP", "Claude Code"]
---
Unreal Engine のエディタを Claude Code から操作できるようにしようとしました。「コインを集めるミニゲームを作って」と頼んで、Blueprint（UE のビジュアルスクリプト）の作成からコンパイルまで任せるのが目標です。

使ったのは、MCP（Model Context Protocol）で UE とつなぐプラグインです。最初はコミュニティ製の UnrealMCP を使いましたが、**Blueprint をコンパイルするたびにエディタが落ちる** 問題に3日ほどはまりました。最後は、UE5.8 に標準で入った公式の MCP プラグインに移行して解決しています。その経緯をまとめます。

**環境**：Windows 10 / UE 5.5.4 → 5.6 → 5.8 / Visual Studio 2022 / Claude Code（Sonnet）/ 2026年9月15日〜17日

## 最初の構成：UnrealMCP（コミュニティ製）

最初は、GitHub で一番使われていた [chongdashu/unreal-mcp](https://github.com/chongdashu/unreal-mcp) を入れました。2つの部品でできています。

- **C++ のプラグイン**：UE のプロジェクトに入れてビルドする。エディタの中で TCP（127.0.0.1:55557）を待ち受ける
- **Python の MCP サーバー**：Claude Code から起動され、プラグインに TCP でコマンドを送る

Claude Code には、Python のサーバーを起動するコマンドとして登録します。

```sh
claude mcp add unrealMCP --scope local -- uv --directory <Python のディレクトリ> run unreal_mcp_server.py
```

セットアップでつまずいたのは次の3つです。

- **Python 3.14 だと依存のインストールに失敗する**：`pydantic-core` のビルド済みパッケージがなく、Rust でのビルドが始まって失敗しました。`uv venv --python 3.11` で作り直したら通りました
- **登録したあと、同じセッションではツールが出てこない**：`claude mcp list` では「Connected」と出るのに、ツールは使えません。Claude Code を起動し直す必要があります
- **ビルド中はエディタを閉じる**：開いたままだと Live Coding がビルドを止めます

Visual Studio のプロジェクトファイルは、エクスプローラーの右クリックメニューが出なかったので、`UnrealBuildTool.exe -projectfiles -project=...` をコマンドで叩いて作りました。

## コンパイルするたびに落ちる

アクターの出現や Blueprint の作成はできました。ところが、次の手順を通しでやると、**最後のコンパイルで必ずエディタが落ちます**。

1. Blueprint を作る
2. StaticMeshComponent を足して、メッシュを設定する
3. SphereComponent を足す
4. コンポーネントのプロパティ（大きさ・半径）を変える
5. Blueprint をコンパイルする

エラーは `EXCEPTION_ACCESS_VIOLATION` です。空の Blueprint では落ちず、コンポーネントを足してプロパティを変えたときだけ落ちました。

## 外れた仮説

ここから Claude Code と原因を追いました。仮説を立てては外れる、の繰り返しです。

| 仮説 | 結果 |
|---|---|
| コマンドを実行するスレッドの仕組みが悪い | **一部当たり**。1種類目のクラッシュは消えた |
| クラッシュ時のコールスタックに出てくる MassEntityEditor が原因 | 外れ。巻き添えで出ていただけ |
| ツールを並行で呼んでいるせい | 外れ。1つずつ呼んでも落ちる |
| プロパティを変えたあとの後処理が足りない | 外れ。後処理を足したら、別のクラッシュが増えた |
| UE5.5 のバグで、UE5.6 で直っている | 外れ。UE5.6 でも同じように落ちる |

### スレッドの仕組み（一部当たり）

プラグインは、MCP のコマンドを `AsyncTask(ENamedThreads::GameThread, ...)` でゲームスレッドに投げていました。Blueprint のコンパイル中に、エディタは中で Tick を回すことがあります。そこで、投げたタスクがコンパイルの途中に割り込んでしまう、という見立てです。

`FTSTicker::GetCoreTicker().AddTicker(...)`（毎フレームの頭で実行する仕組み）に切り替えると、コールスタックに MassEntityEditor が出てくるタイプのクラッシュは消えました。最初は「MassEntityEditor が Blueprint のコンパイルを見張っていて、そこで落ちている」と考えていましたが、ソースを grep すると、MassEntityEditor は Blueprint 関係のイベントを何も見張っていませんでした。割り込みに巻き込まれていただけです。

### 後処理を足す（外れ）

それでも、コンパイル自体で落ちるクラッシュが残りました。次に、プロパティを変えたあとに `Modify()` と `PostEditChange()` を呼んでいないのが原因ではないか、と考えて足しました。

結果は、**足した `PostEditChange()` の行で新しいクラッシュが起きる** でした。Blueprint のコンポーネントのテンプレートは、まだワールドに置かれていない状態です。そこにコリジョンの作り直しが走って落ちたようです。外して元に戻しました。

外したあと、もう一度同じ手順で試すと、やはりコンパイルで落ちます。コールスタックを読むと、プラグインのコードではなく、**エンジンの中の Blueprint コンパイラ（Kismet）の中で落ちて** いました。プラグイン側をいじっても直らない、と分かったのがここです。

### UE5.6 に上げる（外れ）

UE5.5 の既知の不具合なら、UE5.6 で直っているかもしれない。そう考えてアップグレードしました。

UE5.6 ではプラグインのビルドが1か所で失敗しました。プラグインの中のグローバル定数 `BufferSize` が、UE5.6 のエンジン側のローカル変数と名前がぶつかって、警告 C4459 がエラー扱いになったためです。`MCPServerBufferSize` に名前を変えて通しました。あとで調べると、プラグインの GitHub Issue（#27）で、ほかの人も同じ修正をしていました。

ビルドは通りましたが、コンパイルすると **UE5.5 とまったく同じ場所で落ちました**。

### エンジンのバグ報告を探す（手詰まり）

Epic のバグトラッカーに、Blueprint の再インスタンス化（コンパイル後に既存のインスタンスを作り直す処理）で落ちる報告（UE-200254）がありました。症状は似ていますが、詳細ページは 403 で読めず、検索結果の断片はほかの報告と混ざっていて、回避策は分かりませんでした。

### 別の MCP 実装に乗り換える（却下）

C++ プラグインを使わない別の MCP 実装も調べました。UE 標準の Python API で Blueprint をコンパイルするものです。

でも、その Python API も、中では同じ `FKismetEditorUtilities::CompileBlueprint()` を呼んでいます。**包み方を変えても、最後に同じエンジンの関数を呼ぶなら、同じところで落ちるはず** です。乗り換えはやめました。

ちなみにこの調査中、「調べるだけ」と頼んだサブエージェントが、別の候補を勝手にクローンして `npm install` までしていました。サブエージェントには「調査のみ。クローン・インストールはしない」と、やらないことまで書いて渡すようにしています。

## UE5.8 には公式の MCP が入っていた

手詰まりになったところで、UE5.8 には Epic 公式の MCP サーバーが標準で入っている、という記事を見つけました。UE5.8 に移行して、試すことにしました。

### セットアップ

1. `.uproject` の `EngineAssociation` を `"5.8"` にして、UnrealMCP を無効にする（フォルダは残して、戻せるようにした）
2. `.uproject` の `Plugins` に、`ModelContextProtocol` と `AllToolsets` を有効で足す

```json
"Plugins": [
  { "Name": "ModelContextProtocol", "Enabled": true },
  { "Name": "AllToolsets", "Enabled": true }
]
```

3. `Source/` の `MyUE5.Target.cs` と `MyUE5Editor.Target.cs` を UE5.8 の設定に上げる（両方とも必要。片方だけだと、ビルド環境が食い違うというエラーで UnrealBuildTool が止まります）

```csharp
DefaultBuildSettings = BuildSettingsVersion.V7;
IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_8;
```

4. MCP サーバーは既定では起動しないので、`Saved/Config/WindowsEditor/EditorPerProjectUserSettings.ini` に自動起動の設定を足す

```ini
[/Script/ModelContextProtocolEngine.ModelContextProtocolSettings]
bAutoStartServer=True
```

5. エディタを起動すると、ポート8000で MCP サーバーが立ち上がる。Claude Code には HTTP のサーバーとして登録する

```sh
claude mcp add ue58 --transport http http://127.0.0.1:8000/mcp
```

Python のサーバーも、プラグインのビルドも要りません。エディタが MCP サーバーそのものになります。登録したあと、Claude Code を起動し直すと、52個のツールセットが見えました。

### 試す前に、ソースを読んだ

実は、試す前に少し不安がありました。公式のツールセットのソースを読むと、Blueprint のコンパイルは **同じ `FKismetEditorUtilities::CompileBlueprint()` を同期で呼んで** いたからです。上の「包み方を変えても同じ」という理屈なら、これも落ちるかもしれません。

一方で、公式の MCP サーバーがコマンドを実行する仕組みは `FTSTicker` でした。UnrealMCP で1種類目のクラッシュを消したのと同じやり方です。

どちらに転ぶかは、試すまで分かりません。「バージョンを上げれば直るはず」は UE5.6 で一度外れているので、期待だけで「直った」とは書かないことにしました。

### 結果：落ちなかった

公式のツールで、同じ流れを2回試しました。

1. `BlueprintTools.create` で Blueprint を作る
2. `PrimitiveTools.add_cube` でコンポーネントを足す
3. `PrimitiveTools.add_sphere` でもう1つ足す
4. `ObjectTools.set_properties` で大きさを変える
5. `BlueprintTools.compile_blueprint` でコンパイルする

**2回とも、コンパイルは正常に終わりました**。直後にほかのツールを呼んで、エディタが生きていることも確かめています。UE5.5・5.6 では毎回落ちていた流れです。

ただし、手順は完全に同じではありません。公式の `add_sphere` が足すのは、球のメッシュを持った StaticMeshComponent で、UnrealMCP で使った SphereComponent（当たり判定用）ではありませんでした。そのため半径は設定できていません。「コンポーネントを足して、プロパティを変えて、コンパイルする」という流れは同じなので、移行してよいと判断しました。

なぜ落ちなくなったのかは、分かっていません。エンジン側が直ったのか、呼び出し方の違いなのかは、確かめていません。

移行が決まったあと、UnrealMCP のプラグイン一式（約5,200行）はリポジトリから消しました。

## 公式 MCP の呼び出しのクセ

公式の MCP は、ツールを直接並べるのではなく、`call_tool` という1つのツールに「ツールセット名」と「ツール名」を渡して呼ぶ形です。使ってみて、Claude がつまずいたところを memory に残しています。

- **ツール名は短い名前、ツールセット名はフルパスで分けて渡す**。`tool_name` は `compile_blueprint`、`toolset_name` は `editor_toolset.toolsets.blueprint.BlueprintTools` です。`describe_toolset` が返す名前はフルパス込みですが、そのまま `tool_name` に入れるとエラーになります
- **オブジェクトの指定は `{"refPath": "..."}`**。クラスも `{"refPath": "/Script/Engine.Actor"}` のように書きます
- **`set_properties` の `values` は、辞書ではなく JSON の文字列**
- **大きなツールセットの `describe_toolset` は、結果が長すぎてファイルに保存される**。必要なツールセットだけ個別に呼びます

## 振り返り

- 落ちる場所がエンジンの中だと分かってからも、プラグイン側の修正を何度か試してしまいました。**コールスタックでどこで落ちているかを先に確かめる** べきでした
- 「別の実装に乗り換える」は、最後に同じ関数を呼ぶなら意味がありません。乗り換える前に、中で何を呼んでいるかを読むと無駄が省けます
- 「バージョンを上げれば直るかも」は、試すまで当てにしない。UE5.6 では外れ、UE5.8 では当たりました
- 調査の経緯は、Claude Code の memory に日付つきで書かせていました。PC の再起動で何度も中断しましたが、そのたびに続きから再開できました

## まとめ

- UnrealMCP（コミュニティ製）は、UE5.5・5.6 で Blueprint をコンパイルすると毎回落ちた。落ちる場所はエンジンの Blueprint コンパイラの中だった
- UE5.8 には公式の MCP プラグインが入っている。`ModelContextProtocol` と `AllToolsets` を有効にし、自動起動を設定して、HTTP で `claude mcp add` するだけで使える
- 公式の MCP では、同じ流れのコンパイルが2回とも落ちなかった。理由は分かっていない
- 呼び出すときは、ツール名とツールセット名を分ける、`refPath` で指定する、`values` は JSON 文字列、の3点に注意する

## 参考文献

- [chongdashu/unreal-mcp](https://github.com/chongdashu/unreal-mcp)
- [Connect Claude Code to tools via MCP - Claude Code Docs](https://code.claude.com/docs/en/mcp)
