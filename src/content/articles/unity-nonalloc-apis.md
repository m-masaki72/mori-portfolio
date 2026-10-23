---
title: "Unityメモ 〇〇NonAllocが用意されているもの"
description: "Unity の Physics（3D）にある NonAlloc 版の関数一覧と、All 版との違い・使い分け。Physics2D の NonAlloc は Unity 6 で非推奨になり、結果の配列や List を渡す通常の関数に置き換わっています。GC アロケーションを減らすためのメモです。"
pubDate: 2025-03-03
updatedDate: 2026-10-24
tags: ["Unity", "C#"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2025/03/03/004039"
---
Unity のレイキャストや衝突判定の関数には、`All` が付くものと `NonAlloc` が付くものがあります。`NonAlloc` 版は結果を入れる配列を自分で渡すので、呼ぶたびに配列が作られず、GC（ガベージコレクション）の負担を減らせます。

2026年10月に内容を見直しました。**Physics2D の NonAlloc 版は Unity 6 では非推奨（Obsolete）になっている** ので、その置き換え方を追加し、一覧の誤記も直しています。

## NonAlloc 版がある関数（Physics・3D）

| 配列を返す版 | NonAlloc 版 |
|---|---|
| `Physics.BoxCastAll` | `Physics.BoxCastNonAlloc` |
| `Physics.CapsuleCastAll` | `Physics.CapsuleCastNonAlloc` |
| `Physics.RaycastAll` | `Physics.RaycastNonAlloc` |
| `Physics.SphereCastAll` | `Physics.SphereCastNonAlloc` |
| `Physics.OverlapBox` | `Physics.OverlapBoxNonAlloc` |
| `Physics.OverlapCapsule` | `Physics.OverlapCapsuleNonAlloc` |
| `Physics.OverlapSphere` | `Physics.OverlapSphereNonAlloc` |

3D 側は Unity 6 でも非推奨にはなっておらず、そのまま使えます。

JetBrains の Rider は、なるべく NonAlloc 版を使うように警告を出してくれます（Rider は非商用なら無料です → [Rider が非商用に限り無料で使えるように](/articles/rider-free-non-commercial/)）。

[Avoid using allocating versions of Physics Raycast functions](https://github.com/JetBrains/resharper-unity/wiki/Avoid-using-allocating-versions-of-Physics-Raycast-functions)

## All 版と NonAlloc 版の違い

All 版は、呼ぶたびに新しい配列を作って返します。

```csharp
using UnityEngine;

public class BoxCastAllExample : MonoBehaviour
{
    // ボックスキャストのパラメータ
    public Vector3 boxCenter = Vector3.zero;
    public Vector3 boxHalfExtents = new Vector3(1f, 1f, 1f);
    public Vector3 castDirection = Vector3.forward;
    public float maxDistance = 10f;
    public Quaternion orientation = Quaternion.identity;
    public LayerMask layerMask;

    void Update()
    {
        // BoxCastAll は、結果を新しく作った配列で返す
        RaycastHit[] hits = Physics.BoxCastAll(
            boxCenter,
            boxHalfExtents,
            castDirection,
            orientation,
            maxDistance,
            layerMask
        );

        Debug.Log($"BoxCastAll hits count: {hits.Length}");

        foreach (RaycastHit hit in hits)
        {
            Debug.Log($"Hit object: {hit.collider.name} at distance: {hit.distance}");
        }
    }
}
```

NonAlloc 版は、先に用意した配列に結果を書き込み、書き込んだ数を返します。

```csharp
using UnityEngine;

public class BoxCastNonAllocExample : MonoBehaviour
{
    // ボックスキャストのパラメータ
    public Vector3 boxCenter = Vector3.zero;
    public Vector3 boxHalfExtents = new Vector3(1f, 1f, 1f);
    public Vector3 castDirection = Vector3.forward;
    public float maxDistance = 10f;
    public Quaternion orientation = Quaternion.identity;
    public LayerMask layerMask;

    // 結果を入れる配列を事前に用意しておく
    private RaycastHit[] results = new RaycastHit[10];

    void Update()
    {
        // BoxCastNonAlloc は、渡した配列にヒット情報を書き込み、書き込んだ数を返す
        int hitCount = Physics.BoxCastNonAlloc(
            boxCenter,
            boxHalfExtents,
            castDirection,
            results,
            orientation,
            maxDistance,
            layerMask
        );

        Debug.Log($"BoxCastNonAlloc hits count: {hitCount}");

        // 有効なのは配列の先頭から hitCount 個まで
        for (int i = 0; i < hitCount; i++)
        {
            RaycastHit hit = results[i];
            Debug.Log($"Hit object: {hit.collider.name} at distance: {hit.distance}");
        }
    }
}
```

## 使い分けと注意点

毎フレーム呼ぶような処理では、基本的に NonAlloc 版を使えば大丈夫です。配列を毎回作らないので、GC によるカクつきを防げます。

ただし、注意点が2つあります。

- **配列が埋まると、そこで打ち切られる**：配列の長さより多くヒットしても、残りは返ってきません。十分な長さを用意するか、打ち切られても困らない処理にしておきます
- **結果の順番は決まっていない**：Unity のドキュメントでは、`RaycastNonAlloc` の結果の順番は未定義で、配列が埋まったときに近いものから入っている保証もないとされています。一番近いものが欲しいときは、`hit.distance` で自分で比べます

## Physics2D は「NonAlloc を付けない」関数に置き換える

以前は Physics2D にも `Physics2D.RaycastNonAlloc` や `Physics2D.OverlapCircleNonAlloc` などがありました。これらは Unity 2022 のころから「将来非推奨になるので、通常の関数を使うように」とドキュメントに書かれていて、Unity 6 では使うとコンパイル時に非推奨の警告（CS0618）が出ます。

置き換え先は、名前から `NonAlloc` を外した関数です。Physics2D の検索系の関数には、結果の配列か `List` を渡せるオーバーロードがあり、こちらもアロケーションは起きません。レイヤーなどの条件は `ContactFilter2D` で指定します。

```csharp
using System.Collections.Generic;
using UnityEngine;

public class Raycast2DExample : MonoBehaviour
{
    public LayerMask layerMask;

    private ContactFilter2D filter;
    private readonly List<RaycastHit2D> results = new List<RaycastHit2D>();

    void Start()
    {
        filter.SetLayerMask(layerMask);
    }

    void Update()
    {
        // 以前の Physics2D.RaycastNonAlloc の代わり。List は中で使い回される
        int hitCount = Physics2D.Raycast(transform.position, Vector2.down, filter, results, 10f);

        for (int i = 0; i < hitCount; i++)
        {
            Debug.Log($"Hit object: {results[i].collider.name}");
        }
    }
}
```

`List` を渡すと、ヒット数に合わせて伸びるので、配列の長さを気にしなくて済みます（一度伸びたあとは使い回されます）。配列を渡した場合は、3D の NonAlloc 版と同じく、長さを超えたぶんは打ち切られます。

同じように、`OverlapCircleNonAlloc` → `OverlapCircle`、`BoxCastNonAlloc` → `BoxCast`、`LinecastNonAlloc` → `Linecast` と置き換えます。

なお、Rider の検査が Physics2D でも NonAlloc 版をすすめてくる、という報告が以前ありました。2D では警告に従わず、通常の関数のオーバーロードを使います。

ほかの最適化については、Unity のマニュアルにまとまっています。

[Unity - Manual: General Optimizations](https://docs.unity3d.com/Manual/UnderstandingPerformanceGeneralOptimizations.html)

## 動画でも解説しています

こうした「AI に書かせると普通に出てくるけれど、知っておくと避けられる書き方」を、YouTube チャンネル「[AIに任せる前に知るUnity](https://www.youtube.com/@unity_before_ai)」で 1 本 90〜150 秒の動画にしています。問題のあるコード → 何が起きるか（実測）→ その書き方の名前 → 使わないほうがいい場面 → Claude Code への頼み方、の順で説明します。

第 1 回は、弾を毎回 `Instantiate` して `Destroy` する書き方と、オブジェクトプールの比較です。この記事の NonAlloc と同じく、GC アロケーションを減らす話です。

[弾を毎回Instantiate→Destroyでいい？ 測って決めるオブジェクトプール【Unity #01】](https://www.youtube.com/watch?v=tTrdyZvxj_Y)

## 参考リンク

- [Physics.RaycastNonAlloc - Unity Scripting API](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Physics.RaycastNonAlloc.html)
- [Physics2D - Unity Scripting API](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Physics2D.html)
- [Physics2D.LinecastNonAlloc - Unity Scripting API（2022.3）](https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Physics2D.LinecastNonAlloc.html)
- [Why do Physics2D NonAlloc functions get deprecated? - Unity Discussions](https://discussions.unity.com/t/why-do-physics2d-nonalloc-functions-get-deprecated/250015)
