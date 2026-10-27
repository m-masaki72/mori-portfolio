# TODO（収益化・SEO）

## AdSense
- [ ] 再申請（目安 11/13 以降。記事12〜15本・主要ページのインデックス済みを確認してから）
- [ ] 承認後: 各アプリ（`*.morilab-garage.com`）の `<head>` に広告スクリプトを設置
- [ ] 承認後: 全画面系アプリ（penlight・huh-cat・momoko・interval-timer 等）は URLグループでアンカー広告等を個別調整し、UIを塞がないか実機確認

## コンテンツ拡充（再申請に向けて。詳細はローカルの `CONTENT_PLAN.md`）
- [ ] 記事を週3本ペースで公開（ネタ帳は `CONTENT_PLAN.md`）
- [x] gcp-vm-egress-404-gzip に Standard ティアの結果を追記（10-28。Carrier Peering は消えず効果なし、と訂正。関連2記事も修正）
- [x] Moeter の掲載画像から「性癖」の文言を外した（10-25。生成元は moeter の front/scripts/ogp-card.html、ポートフォリオ用だけ差し替え）

## インデックス対策（10-20 フェーズ1・GitHub 側のリンク整備は完了）
- [ ] 新規記事の公開は週2〜3本までに抑える
- [ ] 重点記事10本を決め、Search Console の URL 検査で1日2〜3本ずつ登録リクエスト
- [x] Claude Code の設定系記事をまとめる記事を作り、各記事へリンク（10-21 新規記事は作らず、設定ツアーをハブにして設定系15本と相互リンク）
- [ ] Zenn に、Zenn 用に書き直した記事を出す（drafts/zenn-*.md の2本。要約・転載はしない）
- [x] 移設した古い記事（Jenkins・Rider・Unity）を今の内容に更新して updatedDate を付ける
- [x] はてなブログにテーマページへのリンク記事を1本置く（10-25）
- [x] GitHub プロフィールのピン留めを設定（SANA_8BIT_VST を先頭に）
- [ ] Search Console で sitemap を再送信し、テーマページ（claude-code・gcp）を登録リクエスト

## 計測
- [ ] Search Console でインデックス状況を確認（再申請前）
- [ ] Search Console に lux-meter.morilab-garage.com を登録し、sitemap.xml を送信（2026-10-18 に github.io から移転。必要なら robots.txt も置く）
- [ ] Search Console に spi3.morilab-garage.com を登録し、sitemap.xml を送信（2026-10-20 公開）
