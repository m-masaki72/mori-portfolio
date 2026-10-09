---
title: "Unityメモ 〇〇NonAllocが用意されているもの"
description: "Unity の Physics・Physics2D にある NonAlloc 版の関数一覧と、All 版との違い・使い分け。GC アロケーションを減らすためのメモです。"
pubDate: 2025-03-03
tags: ["Unity", "C#"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2025/03/03/004039"
---
## UnityのNonAlloc関数が存在するものがある

Unityのレイキャスト判定、衝突判定の検出にはAllとつくものとNonAllocとつくものが用意されていることを知った。 Unity 5.3のだいぶ昔から用意されているようで、以下の関数が用意されているようである。

- Physics
  - Physics.BoxCastAll→Physics.BoxCastNonAlloc
  - Physics.CapsuleCastAll→Physics.CapsuleCastNonAlloc
  - Physics.RaycastAll→Physics.RaycastNonAlloc
  - Physics.SphereCastAll→Physics.SphereCastNonAlloc
  - Physics.OverlapBox→Physics.OverlapBoxNonAlloc
  - Physics.OverlapCapsule→Physics.OverlapCapsureNonAlloc
  - Physics.OverlapSphere→Physics.OverlapSphereNonAlloc
- Physics2D
  - Physics2D.BoxCastAll→Physics2D.BoxCastNonAlloc
  - Physics2D.CapsuleCastAll→Physics2D.CapsuleCastNonAlloc
  - Physics2D.CircleCastAll→Physics2D.CircleCastNonAlloc
  - Physics2D.LinecastAll→Physics2D.CapsuleCastNonAlloc
  - Physics2D.RaycastAll→Physics2D.RaycastNonAlloc
  - Physics2D.GetRayIntersectionAll→Physics2D.GetRayIntersectionNonAlloc
  - Physics2D.OverlapAreaAll→Physics2D.OverlapAreaNonAlloc
  - Physics2D.OverlapBoxAll→Physics2D.OverlapBoxNonAlloc
  - Physics2D.OverlapCapsuleAll→Physics2D.OverlapCapsuleNonAlloc
  - Physics2D.OverlapCircleAll→Physics2D.OverlapCircleNonAlloc
  - Physics2D.OverlapPointAll→Physics2D.OverlapPointNonAlloc

JetBrainのRiderではなるべくNonAlloc版の関数を使うように警告を出すようになっている。

[Avoid using allocating versions of Physics Raycast functions](https://github.com/JetBrains/resharper-unity/wiki/Avoid-using-allocating-versions-of-Physics-Raycast-functions)

## AllocとNonAllocの違い

NonAllocではメモリアロケーションを発生させない（ガベージコレクションが不要）というそのままの名前の通り。 使い方もちょっと違う。

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
        // BoxCastAllは、結果を新しく生成された配列で返す
        RaycastHit[] hits = Physics.BoxCastAll(
            boxCenter,
            boxHalfExtents,
            castDirection,
            orientation,
            maxDistance,
            layerMask
        );

        // 配列の要素数分だけヒットしている
        Debug.Log($"BoxCastAll hits count: {hits.Length}");

        // ヒット情報をループで処理
        foreach (RaycastHit hit in hits)
        {
            Debug.Log($"Hit object: {hit.collider.name} at distance: {hit.distance}");
        }
    }
}
```

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

    // 結果を格納するための配列を事前に用意しておく
    private RaycastHit[] results = new RaycastHit[10];

    void Update()
    {
        // BoxCastNonAlloc は、指定した配列にヒット情報を書き込み、書き込まれた数を返す
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

        // 実際のヒット情報は配列resultsの先頭からhitCount分だけ有効
        for (int i = 0; i < hitCount; i++)
        {
            RaycastHit hit = results[i];
            Debug.Log($"Hit object: {hit.collider.name} at distance: {hit.distance}");
        }
    }
}
```

## 使い分けについて

基本的にはNonAlloc版を使うでOK。速度面でもメモリアロケーションでヒープ領域を無駄にしないサイズ面でもNonAlloc版が優れている。

ただしNonAlloc版は結果の要素数を事前に渡しておくため、結果が切り捨てられる恐れがあることに注意しましょうということらしい。十分な要素数を渡すのか、切り捨てられてもOKな処理にしておく必要があるそうだ。

他にもUnityの有効化についてメモがあるのでこちらも見ておこう → 

[Unity - Manual: General Optimizations](https://docs.unity3d.com/Manual/UnderstandingPerformanceGeneralOptimizations.html)
