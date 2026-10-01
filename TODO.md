# TODO（収益化・SEO）

## AdSense
- [x] 2026-10-01 審査リクエスト（pub-6039922373762217 / `src/consts.ts` の `ADSENSE_CLIENT`、`/ads.txt` 公開済み）
- [x] 自動広告設定（ビネットOFF・インテント重視OFF・複数枠OFF）、欧州向け同意メッセージ（Google CMP）作成
- [ ] 審査結果の確認（不承認なら理由に沿って修正し再申請）
- [ ] 承認後: 各アプリ（`*.morilab-garage.com`）の `<head>` に広告スクリプトを設置
- [ ] 承認後: 全画面系アプリ（penlight・huh-cat・momoko・interval-timer 等）は URLグループでアンカー広告等を個別調整し、UIを塞がないか実機確認

## 計測
- [ ] Cloudflare Web Analytics のトークン発行（ダッシュボード）→ ポートフォリオと各アプリに埋め込み

## SEO
- [ ] morse・loudness-meter・nothing-to-do: 静的HTMLに `<h1>` が無い（JS描画のみ）。静的に h1 を出すか検討
