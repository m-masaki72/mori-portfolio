---
title: "Unity の SendMessage は何が遅いのか：インターフェース・UnityEvent・C# event と1万体で比べた"
description: "AI に Unity のダメージ処理を書かせると出てくる SendMessage を、インターフェース（毎回 TryGetComponent／参照を持つ）・直接呼び出し・UnityEvent・C# の event と、敵1万体に毎フレーム伝える条件で測りました。処理時間・GC Alloc・名前を打ち間違えたときの挙動と、使い分けをまとめます。"
pubDate: 2026-11-05
tags: ["Unity", "C#"]
---
弾が当たった相手にダメージを与える処理を AI に書かせると、こういうコードが出てくることがあります。

```csharp
void OnTriggerEnter(Collider other)
{
    other.SendMessage("TakeDamage", 10);
}
```

相手の型を知らなくても、関数の名前だけで呼べる手軽な書き方です。ただ、`SendMessage` は **文字列の名前で関数を探し**、渡す値を **`object` として箱に詰めて** から呼びます。どれくらい遅いのか、ほかの呼び方と比べて測りました。

YouTube の「AIに任せる前に知るUnity」第14回と同じ計測です。動画では結果を2分にまとめ、この記事では計測コードと使い分けを詳しく書いています。

![第14回「SendMessageで呼んでない？」のサムネイル](/articles/unity-sendmessage-interface/ep14-thumb.webp)

[SendMessageで呼んでない？ 名前で探して箱に詰める呼び出しと、インターフェース・UnityEvent・C# event の時間と確保量【Unity #14】](https://www.youtube.com/watch?v=pcq7dQbE7Ow)

## 比べた6通り

敵を1万体並べ、攻撃役が毎フレーム、敵1体ずつに「ダメージ 10」を1回伝えます。伝え方を変えて6通り測りました。

| 呼び方 | やっていること |
|---|---|
| SendMessage | `go.SendMessage("TakeDamage", 10)` |
| 毎回 TryGetComponent | `go.TryGetComponent(out IDamageable d)` で取ってから `d.TakeDamage(10)` |
| 参照を持っておく | 最初に取った `IDamageable` をリストに持っておき、`TakeDamage(10)` |
| 直接呼び出し | `Enemy` 型の参照を持っておき、`enemy.TakeDamage(10)` |
| UnityEvent | 敵の `UnityEvent<int>` に `TakeDamage` を登録しておき、`Invoke(10)` |
| C# の event | 敵の `event Action<int>` に `TakeDamage` を登録しておき、呼ぶ |

「毎回 TryGetComponent」は、弾が当たった相手に伝える場面の形です。当たる相手は毎回違うので、そのつど取り出すことになります。「参照を持っておく」は、同じ相手に何度も伝える場面の形です。

攻撃役の `Update` はこうなっています（抜粋）。

```csharp
void Update()
{
    int n = enemies.Count;
    switch (mode)
    {
        case "send":
            for (int i = 0; i < n; i++) objects[i].SendMessage("TakeDamage", 10);
            break;
        case "iface-get":
            for (int i = 0; i < n; i++)
                if (objects[i].TryGetComponent(out IDamageable d)) d.TakeDamage(10);
            break;
        case "iface":
            for (int i = 0; i < n; i++) damageables[i].TakeDamage(10);
            break;
        case "direct":
            for (int i = 0; i < n; i++) enemies[i].TakeDamage(10);
            break;
        case "unityevent":
            for (int i = 0; i < n; i++) enemies[i].onDamage.Invoke(10);
            break;
        case "csevent":
            for (int i = 0; i < n; i++) enemies[i].RaiseDamaged(10);
            break;
    }
}
```

### 測定環境

- Unity 6000.6.7f1、Mono のプレイヤービルド
- AMD Ryzen 9 3900XT
- 処理時間はリリースビルド、確保量は Development Build で測定（`ProfilerRecorder`・`Stopwatch`）
- 各条件30秒間、3回測って平均。3回とも傾向が同じことを確認

条件ごとにビルドしたプレイヤーを1本ずつ起動して測っています。同時に動かすと結果が乱れるためです。IL2CPP では測っていません。

## 結果

| 呼び方 | 1フレームの処理時間 | 1秒あたりの確保量 |
|---|---|---|
| SendMessage | **4.91ms** | **26.1MB** |
| 毎回 TryGetComponent | 2.22ms | 0MB |
| 参照を持っておく | 0.10ms | 0MB |
| 直接呼び出し | 0.09ms | 0MB |
| UnityEvent | 0.83ms | 0MB |
| C# の event | 0.21ms | 0MB |

分かったことは3つです。

**SendMessage は時間も確保量も飛び抜けている。** 1万回で約4.9ms、60fps の1フレーム（16.7ms）の3割近くを使います。メモリを確保するのは6通りのうち SendMessage だけで、1秒に約26MB です。引数の `10` は `object` として渡すので、呼ぶたびに箱に詰められます（ボクシング）。これだけ確保が続くと、GC が頻繁に走ることになります。

**毎回 TryGetComponent しても、SendMessage の半分以下。** 当たった相手から毎回取り出す形でも 2.22ms で、確保はありません。ただ、この時間のほとんどは `TryGetComponent` で取り出す部分です。取った参照を持っておけば 0.10ms になり、直接呼び出し（0.09ms）とほぼ同じになります。インターフェースを通すこと自体のコストは、ほとんどありません。

**UnityEvent と C# の event も確保はゼロ。** UnityEvent は 0.83ms で、参照を持つ形の8倍ほどかかります。それでも SendMessage よりはずっと速いです。C# の event は 0.21ms でした。

## 名前を打ち間違えると、黙って届かない

時間より怖いのはこちらです。`"TakeDamage"` を `"TakeDamge"` と1文字打ち間違えた SendMessage も測りました。

```csharp
go.SendMessage("TakeDamge", 10, SendMessageOptions.DontRequireReceiver);
```

| | 1フレームに届いた回数 | 処理時間 |
|---|---|---|
| 正しい名前 | 10,000回 | 4.91ms |
| 打ち間違い | **0回** | 2.32ms |

1回も届いていないのに、約2.3ms かかっています。名前で関数を探す処理は、見つからなくても毎回走るからです。

`SendMessageOptions.DontRequireReceiver` を付けていると、受け取る関数が見つからなくてもエラーになりません。文字列なのでコンパイルも通ります。「ダメージが入らない」というバグになって、原因を探すのに時間がかかります。

インターフェースで呼ぶ形なら、名前を間違えた時点でコンパイルエラーになります。

## インターフェースに直す

`TakeDamage` を持つことを約束するインターフェースを作ります。

```csharp
public interface IDamageable
{
    void TakeDamage(int amount);
}

public class Enemy : MonoBehaviour, IDamageable
{
    public int hp = 100;

    public void TakeDamage(int amount)
    {
        hp -= amount;
    }
}
```

弾の側は、当たった相手から `TryGetComponent` で取り出して直接呼びます。

```csharp
void OnTriggerEnter(Collider other)
{
    if (other.TryGetComponent(out IDamageable target))
    {
        target.TakeDamage(10);
    }
}
```

`TryGetComponent` は、見つからなかったときもエディタ上で確保をしません。`GetComponent` で取って null チェックするより、この点で有利です（Unity 2019.2 以降）。インターフェースで呼ぶ書き方自体は、どのバージョンでも使えます。

同じ相手に何度も呼ぶなら、取った参照をフィールドに持っておきます。計測では 2.22ms が 0.10ms になりました。

```csharp
IDamageable target;

void Start()
{
    player.TryGetComponent(out target);
}

void Update()
{
    // 毒の床など、毎フレーム同じ相手にダメージを与える場合
    target.TakeDamage(1);
}
```

## UnityEvent と C# の event の使いどころ

インターフェースが基本ですが、ほかの2つにも使いどころがあります。

- **UnityEvent**：インスペクターでつなぎ先を選びたいとき。デザイナーがボタンや仕掛けの反応を Unity エディタ上でつなぐような場面です。インターフェースより遅いものの、確保はありません
- **C# の event**：1つの出来事を、大勢に知らせたいとき。「プレイヤーが倒れた」を UI・BGM・敵の AI がそれぞれ受け取るような場面です。購読した側が先に破棄されるときは、`OnDestroy` などで必ず `-=` で解除します

どちらも「誰が受け取るかを、送る側が知らなくてよい」点が SendMessage と同じです。それでいて名前の文字列を使わないので、打ち間違いはコンパイルで止まります。

## Claude Code への頼み方

既存のプロジェクトに SendMessage が散らばっているなら、まとめて直してもらえます。

> このプロジェクトの SendMessage と BroadcastMessage を探して、呼んでいる関数ごとにインターフェース（例: IDamageable）を作り、TryGetComponent で取って直接呼ぶ形に直して。同じ相手に何度も呼ぶ場所では、取った参照をフィールドに持つこと。インスペクターでつなぎ先を選びたい箇所だけは UnityEvent にして。

ポイントは、**インターフェースに置き換えるのを基本にして、インスペクターでつなぐ箇所だけ UnityEvent に分けてもらう** ことです。全部を1つの書き方にそろえようとすると、デザイナーがエディタでつないでいた箇所まで壊れてしまいます。

## まとめ

- `SendMessage` は名前で関数を探し、引数を箱に詰める。敵1万体に毎フレームで 4.91ms・1秒に 26.1MB
- インターフェースで呼べば確保はゼロ。参照を持っておけば直接呼び出しとほぼ同じ 0.10ms
- 名前を打ち間違えると、エラーも出ずに1回も届かない。それでも探す時間はかかる
- インスペクターでつなぐなら UnityEvent、大勢に知らせるなら C# の event

ほかの回も、AI が書きがちなコードを同じように実測しています。前の回（第13回）では、敵1万体の `Update` をマネージャー1つにまとめると何倍速くなるかを測りました。記事は「[Unity で敵1万体の Update をマネージャー1つにまとめたら](/articles/unity-update-manager/)」です。チャンネルを始めた理由と動画の作り方は「[YouTube で「AIに任せる前に知るUnity」を始めました](/articles/unity-before-ai-youtube/)」に書きました。GC の確保を減らす話は「[Unityメモ 〇〇NonAllocが用意されているもの](/articles/unity-nonalloc-apis/)」もどうぞ。

### 参考

- [Component.SendMessage - Unity スクリプトリファレンス](https://docs.unity3d.com/ScriptReference/Component.SendMessage.html)
- [Component.TryGetComponent - Unity スクリプトリファレンス](https://docs.unity3d.com/ScriptReference/Component.TryGetComponent.html)
- [UnityEvent - Unity スクリプトリファレンス](https://docs.unity3d.com/ScriptReference/Events.UnityEvent.html)
