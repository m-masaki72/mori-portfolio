---
title: "Unity で敵1万体の Update をマネージャー1つにまとめたら2.8倍速く、空の Update はそれより重かった"
description: "AI に敵の動きを書かせると出てくる「敵ごとの Update」を、マネージャー1つの for ループで動かす形と、敵1万体・1000体のリリースビルドで比べました。中身が空の Update が残っているだけでも、1万体を実際に動かすマネージャーより重い結果に。計測方法と、まとめるべき場面の線引きを書きます。"
pubDate: 2026-11-04
tags: ["Unity", "C#"]
---
敵の動きを AI に書かせると、こういうコードが出てきます。

```csharp
using UnityEngine;

public class Enemy : MonoBehaviour
{
    public Vector3 velocity;

    void Start()
    {
    }

    void Update()
    {
        transform.position += velocity * Time.deltaTime;
    }
}
```

1体なら何の問題もありません。でも、敵が1万体いれば `Update` も1万個です。

`Update` は普通の関数呼び出しではなく、エンジン（C++ 側）がスクリプト1つずつを毎フレーム呼びに来ます。その1回ずつに、橋渡しのコストがかかります。これを、マネージャー1つの `Update` から for ループで全員を動かす形と比べました。

YouTube の「AIに任せる前に知るUnity」第13回と同じ計測です。動画では結果を2分にまとめ、この記事では計測の中身と、まとめるべき場面の線引きを詳しく書いています。

![第13回「Updateを1万個書いてない？」のサムネイル](/articles/unity-update-manager/ep13-thumb.webp)

[Updateを1万個書いてない？ 敵ごとの Update とマネージャー1つの for ループ、空の Update が残っているだけの重さ【Unity #13】](https://www.youtube.com/watch?v=oPNf1quP8bc)

## 比べた4通り

敵を1万体並べ、毎フレーム少しずつ動かします。

| 書き方 | やっていること |
|---|---|
| 敵ごとに Update | 上のコードそのまま。敵それぞれの `Update` で自分を動かす |
| マネージャーで一括 | 敵は `Tick(dt)` だけを持ち、マネージャー1つの `Update` が for ループで全員の `Tick` を呼ぶ |
| 空の Update が残っている | 敵に中身が空の `Update()` だけが残っている（テンプレートの消し忘れ）。何も動かさない |
| Update なし | 敵に `Update` が無い |

動かす中身（`transform.position += velocity * dt`）は、「敵ごとに Update」と「マネージャーで一括」で同じです。違うのは、呼び出しがエンジンから1万回来るか、C# の for ループで1万回回すかだけです。

「空の Update」と「Update なし」の差は、**何もしない `Update` を呼ぶだけの費用** になります。

### 測り方

- Unity 6000.6.7f1、Mono のプレイヤービルド（リリースビルド）
- AMD Ryzen 9 3900XT
- 敵は Transform とスクリプトだけで、Renderer は付けていません（描画の負荷を混ぜないため）
- 実行順を一番早くしたスクリプト（`[DefaultExecutionOrder(-32000)]`）と一番遅くしたスクリプト（`32000`）を置き、その間を `Stopwatch` で測って「1フレームの Update 時間」にしました
- 各条件30秒間、3回測って平均。3回とも傾向が同じことを確認
- 配置と速度は乱数の種を固定して、どの条件でも同じにしています

## 結果

| 書き方 | 敵1万体 | 敵1000体 |
|---|---|---|
| 敵ごとに Update | **4.29ms** | 0.34ms |
| マネージャーで一括 | 1.52ms | 0.14ms |
| 空の Update が残っている | **1.79ms** | — |
| Update なし | 0.00ms | — |

（1フレームあたりの Update 時間）

### 1万体なら、まとめると約2.8倍速い

動かす中身は同じなのに、4.29ms と 1.52ms で約2.8倍の差がつきました。60fps の1フレームは 16.7ms なので、敵ごとの `Update` だけで4分の1を使っています。

### 1000体なら、気にしなくていい

敵1000体では 0.34ms と 0.14ms で、差は 0.2ms です。1フレームの1％ほどなので、読みやすさを優先して敵ごとの `Update` のままで構いません。まとめる手間とリストの管理（後で書く外し忘れ）のほうが、割に合わなくなります。

### 空の Update が、1万体を動かすより重い

一番意外だったのはここです。中身が空の `Update` が残っているだけで、1.79ms かかりました。**1万体を実際に動かしているマネージャー（1.52ms）より重い** のです。

`Update` を消せば 0ms です。1回あたりにすると、空の `Update` を呼ぶだけで約0.18µs かかっている計算になります。中身が空でも、書いてあればエンジンは毎フレーム呼びに来ます。

Unity が新しいスクリプトを作るときのテンプレートには、空の `Start` と `Update` が入っています。AI が書くコードにも、使わない空の `Update` が残っていることがよくあります。

## マネージャーで一括に直す

マネージャーには `Update` を1つだけ置き、リストに並んだ敵の `Tick` を順に呼びます。

```csharp
using System.Collections.Generic;
using UnityEngine;

public class EnemyManager : MonoBehaviour
{
    public static readonly List<Enemy> All = new List<Enemy>();

    void Update()
    {
        float dt = Time.deltaTime;
        for (int i = 0; i < All.Count; i++)
            All[i].Tick(dt);
    }
}

public class Enemy : MonoBehaviour
{
    public Vector3 velocity;

    void OnEnable() => EnemyManager.All.Add(this);
    void OnDisable() => EnemyManager.All.Remove(this);

    public void Tick(float dt)
    {
        transform.position += velocity * dt;
    }
}
```

敵は `Update` を持たず、`OnEnable` でリストに入り、`OnDisable` で抜けます。`Time.deltaTime` もループの前に1回だけ読んでいます。

### 外し忘れに注意

消えた敵は、`OnDisable` で必ずリストから外します。外し忘れると、`Destroy` した敵の `Tick` を呼んで `MissingReferenceException` になります。`OnDestroy` ではなく `OnDisable` にしておけば、オブジェクトプールで非アクティブにしたときも止まります。

なお、`List.Remove` はリストを先頭から探すので、敵が多い状態で一度に大量に消える場面では、それ自体が重くなることがあります（今回は測っていません）。そういう場面では、敵に自分の番号を持たせて末尾と入れ替えて消す方法があります。

## どこまでまとめるか

計測から、こう線を引きました。

- **同じスクリプトが数千個以上並ぶもの**（敵・弾・パーティクル代わりのオブジェクトなど）は、マネージャーでまとめる
- **数百個まで** なら、差はわずか。敵ごとの `Update` のままでよい
- **中身が空の `Update` と `Start`** は、数に関係なく消す

最後の1つは、まとめる・まとめないの判断がいりません。見つけたら消すだけで、確実に速くなります。

## Claude Code への頼み方

> このプロジェクトで、同じスクリプトが数千個以上並ぶ MonoBehaviour の Update を探して、マネージャー1つの Update から for ループで呼ぶ形に直して。リストへの登録は OnEnable、解除は OnDisable で行うこと。数が少ないスクリプトはそのままでいい。中身が空の Update と Start は、どのスクリプトでも消して。

ポイントは、**数が多いスクリプトだけをまとめることと、空の Update はどこでも消すことを、分けて伝える** ことです。「Update をまとめて」とだけ頼むと、数個しかないスクリプトまでマネージャー化されて、コードが読みにくくなるだけです。

## まとめ

- `Update` はエンジンがスクリプト1つずつ呼びに来る。1万体なら、マネージャー1つの for ループで約2.8倍速い（4.29ms → 1.52ms）
- 1000体なら差は 0.2ms。読みやすさを優先してよい
- 中身が空の `Update` が残っているだけで 1.79ms。見つけたら消す
- マネージャーに直すなら、リストからの解除は `OnDisable` で

次の回（第14回）では、敵1万体にダメージを伝える `SendMessage` を、インターフェースや UnityEvent と比べました。記事は「[Unity の SendMessage は何が遅いのか](/articles/unity-sendmessage-interface/)」です。チャンネルを始めた理由と動画の作り方は「[YouTube で「AIに任せる前に知るUnity」を始めました](/articles/unity-before-ai-youtube/)」に書きました。

### 参考

- [10000 Update() calls - Unity Blog](https://unity.com/blog/engine-platform/10000-update-calls)
- [MonoBehaviour.Update - Unity スクリプトリファレンス](https://docs.unity3d.com/ScriptReference/MonoBehaviour.Update.html)
