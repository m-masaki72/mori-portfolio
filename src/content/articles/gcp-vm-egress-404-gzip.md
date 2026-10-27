---
title: "GCP の請求で Networking は ¥0 なのに、VM の通信料がかかっていた（404 の gzip 化と Standard ティア）"
description: "Cloudflare の裏で WordPress を動かす GCP VM の外向き通信が月約70GB。通信料は Networking ではなく Compute Engine 側に計上されていました。内訳を調べたら4割が圧縮されていない404応答だったので、PHP で gzip 化しました。Standard ティアへの切り替えは、Cloudflare 向けの通信には効かなかったという結果も追記しています。"
pubDate: 2026-10-15
updatedDate: 2026-10-28
tags: ["GCP", "WordPress", "Cloudflare", "コスト削減"]
---
GCP の請求をサービス別に見ると、**Networking は ¥0** でした。それなのに、VM の外向き通信料はしっかり請求されていました。

通信料は **Compute Engine の項目に含まれていた** のです。調べていくと、外向き通信の約4割が「圧縮されていない404ページ」だったことも分かりました。

**前提**：WordPress を動かしている Compute Engine の VM 1台（e2-medium / us-central1 / Apache）。手前に Cloudflare を置いています。

## 通信料はどこに計上されているか

課金レポートをサービス別に集計すると、Networking サービスの費用は0円です。これを見て「通信料はかかっていない」と思っていました。

ところが、**SKU 別** に分けると、Compute Engine サービスの中にこういう行がありました（8月分）。

| SKU | 量 | 金額 |
|---|---|---|
| Network Data Transfer Out via Carrier Peering Network - Americas Based | 39.5 GiB | ¥517 |
| （同じく EMEA 宛） | — | ¥58 |

VM から外に出ていく通信は、Networking ではなく **Compute Engine の SKU として請求されます**。単価は1GiBあたり約¥13でした。

「Carrier Peering」は、Google と直接つながっているネットワーク（ここでは Cloudflare）に向けた通信です。VM の前に Cloudflare を置いているので、外向き通信のほとんどがこの SKU になります。

## 何がそんなに出ていっているのか

VM の外向き通信は月約70GBで、その **97% が Cloudflare 向け** でした。Cloudflare がキャッシュしていないリクエストを、オリジン（VM）が返している分です。

アクセスログから15日分の内訳を見ると、大きいのは2つでした。

- **画像：19GB** — Cloudflare のキャッシュに載っていない画像の取得
- **404 応答：14.5GB** — 存在しない URL へのアクセス

画像の方は、Cloudflare の Smart Tiered Cache がすでに有効で、画像も1年キャッシュでヒットしていることを確認しました。残りはあまりアクセスされない画像（ロングテール）や Googlebot-Image による取得で、設定で減らすのは難しそうです。

気になったのは404の方です。

## 404 ページが1件365KBあった

WordPress の404ページは、通常のページと同じテーマで描画されるので、HTML がかなり大きくなります。このサイトでは **1件約365KB** ありました。

そして、このサーバーの Apache（mod_deflate）は、**200 の応答は gzip 圧縮するのに、404 の応答は圧縮していませんでした**。

404 になるアクセスの多くは、`.env` などを探す脆弱性スキャナや、削除済みの画像への古いリンクです。1件あたり365KB の非圧縮 HTML を、こうしたアクセスに律儀に返し続けていたわけです。

## PHP 側で 404 を gzip 化する

Apache の設定をいじる代わりに、WordPress のプラグイン（自作）の中で、404 のときだけ出力を gzip 圧縮するようにしました。

```php
if ( PHP_SAPI !== 'cli' && ! is_admin() && ! wp_doing_ajax() && ! wp_doing_cron() ) {
    ob_start( 'compress_404_handler' );
}

function compress_404_handler( string $buffer, int $phase ): string {
    static $use_gzip = null;
    static $pending  = '';

    if ( null === $use_gzip ) {
        $accept   = $_SERVER['HTTP_ACCEPT_ENCODING'] ?? '';
        $use_gzip = 404 === http_response_code()
            && is_string( $accept ) && false !== stripos( $accept, 'gzip' );
    }
    if ( ! $use_gzip ) {
        return $buffer;
    }

    // ob_clean 等で破棄された分は溜めない
    if ( $phase & PHP_OUTPUT_HANDLER_CLEAN ) {
        $pending = '';
        return '';
    }

    // 途中で flush されても圧縮単位が崩れないよう、最後にまとめて圧縮する
    $pending .= $buffer;
    if ( ! ( $phase & PHP_OUTPUT_HANDLER_FINAL ) ) {
        return '';
    }

    if ( headers_sent() ) {
        return $pending;
    }
    $gz = gzencode( $pending, 6 );
    if ( false === $gz ) {
        return $pending;
    }
    header( 'Content-Encoding: gzip' );
    header( 'Vary: Accept-Encoding', false );
    header_remove( 'Content-Length' );
    return $gz;
}
```

ポイントは3つです。

- **出力バッファはプラグインの読み込み時点で開始する**：Autoptimize などのキャッシュ・最適化プラグインも出力バッファを使います（`template_redirect` で開始）。それより外側に置くため、早い段階で `ob_start()` しています。
- **404 以外は素通しする**：200 の応答は Apache がすでに圧縮しているので、二重圧縮にならないよう触りません（実際のコードでは、既に `Content-Encoding` ヘッダが付いている場合も素通しにしています）。
- **最後にまとめて圧縮する**：途中で flush されたときに断片ごとに gzip すると、壊れたレスポンスになります。`PHP_OUTPUT_HANDLER_FINAL` が来るまで溜めておきます。

これで404ページは **365KB → 37KB** になりました。通信料に換算すると、月 約¥300〜350の削減見込みです。

## Standard ティアに切り替える

もう1つの対策が、VM の **ネットワーク サービス ティア** の変更です。

GCP の外向き通信には、Premium ティア（デフォルト）と Standard ティアがあります。Standard ティアには **月200GiBまでの無料枠** があり、このサイトの外向き通信（直近30日で66.4GiB）なら、ほぼ収まる計算です。

Standard ティアは、Google のバックボーンではなく一般のインターネット経路を使うので、Premium より遅くなる場合があります。ただ、このサイトは手前に Cloudflare があり、利用者が直接 VM につなぐことはありません。影響は小さいと判断しました。

切り替えには注意点が1つあります。**外部 IP アドレスが変わります**。今回は Cloudflare の DNS で A レコードを向けているだけだったので、新しい IP に書き換えて済みました。

切り替えは2026-10-15に実施しました。

## 結果：Carrier Peering の課金は消えなかった（2026-10-28 追記）

切り替えの前後で、Compute Engine の外向き通信の SKU を比べました。

| 期間 | Carrier Peering | 1日あたり | Standard |
|---|---|---|---|
| 9月 | 57.66 GiB / ¥735 | 1.92 GiB / ¥24.5 | — |
| 10/1〜10/15 | 26.76 GiB / ¥336 | 1.78 GiB / ¥22.4 | 0.05 GiB |
| 10/16〜10/28（切り替え後） | 16.82 GiB / ¥212 | 1.29 GiB / ¥16.3 | 0.29 GiB / ¥0 |

Standard ティアの SKU（`Network Standard Data Transfer Out to Internet from Iowa`）は新しく現れましたが、13日間で 0.29 GiB だけでした。**Cloudflare 向けの通信は、切り替え後も Carrier Peering として、同じ単価（約¥12.6/GiB）で課金され続けています**。Standard ティアの無料枠に入るのは、Carrier Peering 以外の、一般のインターネット向けの通信だけのようです。

1日あたりの通信量は約3割減りました。ただ、Standard 側にはほとんど流れていないので、これは同じ時期に入れた **404 の gzip 化の効果** と見ています。

Cloudflare のように Google と直接つながっているネットワークが手前にあると、Standard ティアに切り替えても通信料は下がりません。IP アドレスが変わる手間だけがかかりました。

## まとめ

- VM の外向き通信料は、**Networking ではなく Compute Engine の SKU** として請求される。サービス別の集計だけ見ていると気づかない。
- 外向き通信の内訳を見ると、意外なものが大きいことがある。今回は **圧縮されていない404応答** が4割を占めていた。gzip 化で外向き通信は約3割減った。
- Cloudflare の裏にある VM では、**Standard ティアに切り替えても Carrier Peering の課金は消えなかった**。無料枠が効くかは、切り替える前に SKU を確認したほうがいい。

GCP の費用見直し全体の流れは、[Claude Code に GCP の課金を棚卸しさせたら、月1万円が半分になった](/articles/claude-code-gcp-cost-review/) にまとめています。
