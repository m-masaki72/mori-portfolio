---
title: "YouTube 埋め込みでは Chrome の自動ピクチャー イン ピクチャーが使えなかった"
description: "タブを切り替えたら自動で別窓再生にしたくて、Chrome 134 以降の自動 PiP（Media Session の enterpictureinpicture）を実装しました。しかし YouTube の埋め込みプレーヤーでは発動せず、撤回しました。理由と、代わりに残した手動の別窓再生についてまとめます。"
pubDate: 2026-10-10
tags: ["YouTube", "Chrome", "Picture-in-Picture"]
---
個人開発の [非公式 学マス プレイリストメーカー](/projects/gakumasu-playlist-maker) は、YouTube の動画を埋め込みプレーヤーで連続再生する Web アプリです。

作業しながら BGM 代わりに流したいのですが、別のタブに切り替えると再生が止まります。YouTube の埋め込みは「見えている状態で再生する」のが前提なので、タブが隠れたら一時停止するようにしているためです。

そこで、**タブを切り替えたら自動で別窓（ピクチャー イン ピクチャー）にして、そのまま再生を続ける** 機能を入れようとしました。結論から言うと、YouTube の埋め込みでは動きませんでした。

**環境**：Windows / Chrome（デスクトップ版）

## やろうとしたこと

Chrome 134 以降には、タブを切り替えたときに自動で PiP の窓を開く仕組みがあります。Media Session API に `enterpictureinpicture` というアクションのハンドラーを登録しておくと、音が出ている状態でタブが切り替わったときに、ブラウザがこれを呼んでくれます。

アプリにはもともと、Document Picture-in-Picture（Chrome・Edge のデスクトップ版）で別窓再生するボタンがありました。なので、ハンドラーからそれを呼ぶだけで済むはずでした。

```ts
useEffect(() => {
  if (pipWindow || !('mediaSession' in navigator)) return;
  const action = 'enterpictureinpicture' as MediaSessionAction;
  try {
    navigator.mediaSession.setActionHandler(action, () => void open().catch(() => undefined));
  } catch {
    return; // 未対応のブラウザ
  }
  return () => navigator.mediaSession.setActionHandler(action, null);
}, [pipWindow]);
```

タブが隠れたときの一時停止も、自動 PiP の窓が開くのを少し（800ms）待ってから判定するように変えました。

## 実機では発動しなかった

ところが、Chrome で再生しながらタブを切り替えても、別窓は一度も開きませんでした。

調べると、Chrome の自動 PiP には **メディアが最上位のフレーム（ページ本体）で再生されていること** という条件がありました。YouTube の埋め込みプレーヤーは、別オリジンの `<iframe>` の中で動いています。音を出しているのは iframe の中の動画なので、ページ本体から見るとこの条件を満たせません。

つまり、YouTube の埋め込みを使っている限り、自動 PiP は **どう実装しても発動しない** ということです。

ちなみに、Playwright で自動テストしようとしても、タブが hidden 状態にならないので自動 PiP は試せません。気づいたのは実機で触ってからでした。

## 撤回して、手動の別窓再生だけ残した

自動 PiP のコードと、800ms 待つ処理は削除しました。タブが隠れたら、すぐ一時停止する元の動きに戻しています。

代わりに、画面の説明文を次のように変えました。

> タブを切り替えても聴きたいときは「別窓で再生」で常に手前に表示できます

ボタンを押して別窓にしておけば、タブを切り替えても再生は止まりません。自動ではなくなりましたが、「作業しながら聴きたい」という目的はこれで果たせます。

## おまけ：別窓で YouTube がエラー 153 になる

手動の別窓再生でもひとつハマりました。Document PiP の窓は `about:blank` なので、そこに YouTube のプレーヤーを作ると Referer が送られず、**エラー 153** で再生できません。

同じオリジンに空のページ（`/pip-frame/`）を用意し、別窓の中でそのページを開いて、その中にプレーヤーを作ることで解決しました。

## まとめ

- Chrome 134 以降の自動 PiP は、Media Session の `enterpictureinpicture` で実装できる
- ただし **メディアが最上位フレームにあること** が条件なので、YouTube の埋め込み（別オリジンの iframe）では発動しない
- タブを切り替えても再生を続けたいなら、ボタンで開く Document PiP の別窓再生が現実的
