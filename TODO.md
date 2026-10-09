# TODO（収益化・SEO）

## AdSense
- [x] 2026-10-01 審査リクエスト（pub-6039922373762217 / `src/consts.ts` の `ADSENSE_CLIENT`、`/ads.txt` 公開済み）
- [x] 自動広告設定（ビネットOFF・インテント重視OFF・複数枠OFF）、欧州向け同意メッセージ（Google CMP）作成
- [x] 審査結果の確認 → 2026-10-09「有用性の低いコンテンツ」で不承認（ルートが制作物紹介＋外部リンク中心、運用・流入の実績なし）
- [ ] 再申請（目安 11/13 以降。記事12〜15本・主要ページのインデックス済みを確認してから）
- [ ] 承認後: 各アプリ（`*.morilab-garage.com`）の `<head>` に広告スクリプトを設置
- [ ] 承認後: 全画面系アプリ（penlight・huh-cat・momoko・interval-timer 等）は URLグループでアンカー広告等を個別調整し、UIを塞がないか実機確認

## コンテンツ拡充（再申請に向けて。詳細はローカルの `CONTENT_PLAN.md`）
- [x] 制作物を4件追加（HeatDesk・Moeter・学マス プレイリストメーカー・Web Metronome）（2026-10-09）
- [ ] `/articles` コレクション（一覧・詳細・タグ・ナビ・sitemap・JSON-LD）
- [ ] 記事を週3本ペースで公開（ネタ帳は `CONTENT_PLAN.md`）
- [ ] はてなブログの技術記事を移設（元記事は「移転しました＋リンク」に書き換え）
- [ ] 制作物ページに、はてなの紹介記事にある開発の経緯・感想を統合
- [ ] About 拡充（経歴・制作スタイル・音楽活動・執筆実績）
- [ ] Links に各 SNS で何を発信しているかの説明を追加
- [ ] アプリ側（penlight・interval-timer・huh-cat・momoko など）に静的 HTML の使い方・FAQ を追加
- [ ] Moeter の掲載画像（「AI性癖診断」の文字入り）を差し替えるか判断

## 計測
- [x] Cloudflare Web Analytics をポートフォリオに埋め込み（2026-10-10、手動スニペット方式）
- [ ] Cloudflare Web Analytics を各アプリにも導入（Pages の5件は Metrics タブで Enable、GitHub Pages の6件はサイト追加＋スニペット）
- [ ] Search Console にサイトマップを送信し、インデックス状況を確認

## SEO
- [x] morse・loudness-meter・nothing-to-do: 静的HTMLに `<h1>` を追加（2026-10-01）
- [ ] 学マス（`pages.dev`）・HeatDesk（`workers.dev`）・メトロノーム（`github.io`）を `*.morilab-garage.com` に統一
