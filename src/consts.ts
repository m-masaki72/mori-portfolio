export const SITE = {
  URL: "https://morilab-garage.com",
  TITLE: "Mori Lab",
  DESCRIPTION:
    "音響・ゲーム・プラグイン開発が好きなエンジニア。C++を軸にVSTプラグインやゲーム、Webツールなどを作りながら、Claude Code などのAIを使った開発の記録をブログに書いています。",
  EMAIL: "mementomori7272@gmail.com",
};

// AdSense のパブリッシャーID（例: "ca-pub-1234567890123456"）。
// 空のあいだは広告スクリプトを出力せず、ads.txt もコメントのみになる
export const ADSENSE_CLIENT = "ca-pub-6039922373762217";

// Cloudflare Web Analytics のトークン（公開前提の値）。空ならビーコンを出力しない
export const CF_ANALYTICS_TOKEN = "f9c19e1133b547578ea0f0761266f537";

export const HOME = {
  TITLE: "Claude Code・AIを使った個人開発のブログ",
  DESCRIPTION:
    "Claude Code を毎日の開発で使いながら、試したこと・測ったこと・失敗したことを書いている個人開発者 MasakiMori のブログ。Unity・GCP・Cloudflare の記事と、VSTプラグインやWebツールなどの制作物も紹介しています。",
};

export const PROJECTS = {
  TITLE: "制作物一覧",
  DESCRIPTION:
    "AI作曲支援ツール、VSTプラグイン、Windowsアプリ、ブラウザで動くWebツールやゲーム、開発者向けツールまで。MasakiMoriがこれまでに公開した制作物をカテゴリ別に紹介します。",
};

// 記事のテーマ別まとめページ（/articles/topics/<slug>/）。tags のどれかを持つ記事を集める。
// 記事が少ないタグは薄いページになるので、まとめるほど数があるものだけ載せる
export type Topic = { slug: string; name: string; tags: string[]; description: string; project?: string };

export const TOPICS: Topic[] = [
  {
    slug: "claude-code",
    name: "Claude Code",
    tags: ["Claude Code"],
    description:
      "Claude Code を毎日の開発で使いながら、設定・hooks・auto mode・サブエージェント・claude -p などを実際に試し、ログを集計して分かったことをまとめています。Windows で使うときのハマりどころや、推測が外れた失敗の記録も含みます。",
  },
  {
    slug: "chord-eureka",
    name: "Chord Eureka",
    tags: ["Chord Eureka"],
    project: "chord-eureka",
    description:
      "AI コード進行アプリ Chord Eureka の開発記録です。2年間の運用で分かったこと、楽譜表示の自作、ボイシングのプリセット、生成結果の自動採点などを書いています。",
  },
  {
    slug: "gcp",
    name: "GCP",
    tags: ["GCP", "Google Cloud"],
    description:
      "個人開発で使っている GCP（Cloud Run・Compute Engine・Artifact Registry・Cloud Storage）の記事です。請求の見直しシリーズでは、確約利用割引の二重購入、VM の通信料、GPU の予算キルスイッチなどを実際の金額つきで書いています。",
  },
  {
    slug: "cloudflare",
    name: "Cloudflare",
    tags: ["Cloudflare", "Cloudflare Workers"],
    description:
      "Cloudflare（Pages Functions・Workers・DNS・キャッシュ）を個人開発で使った記録です。動的 OGP 画像の生成、GCS 画像のエッジ配信、通信料の削減などを扱っています。",
  },
  {
    slug: "windows",
    name: "Windows",
    tags: ["Windows"],
    description:
      "Windows で開発するときのハマりどころと対処の記録です。Git Bash・PowerShell・CRLF の問題、スリープの制御、Microsoft Store へのアプリ公開などを書いています。",
  },
  {
    slug: "indie-dev",
    name: "個人開発",
    tags: ["個人開発"],
    description:
      "個人で作って公開しているアプリ・サービスの開発と運用の記録です。アプリの長期運用、クラウドの費用、CI の無料枠、AI を使った開発の進め方などを、実際の数字と失敗込みで書いています。",
  },
];

export const ARTICLES = {
  TITLE: "記事一覧",
  DESCRIPTION:
    "Claude Code などの AI 活用、Unity・ゲーム開発、Web・サーバー運用まで。実際に手を動かして調べたこと・ハマったことをまとめた技術記事です。",
};

export const NAV_LINKS = [
  { name: "自己紹介", href: "/about/" },
  { name: "制作物", href: "/projects/" },
  { name: "記事", href: "/articles/" },
  { name: "リンク", href: "/links/" },
];

// DESC は Links ページで各リンクの下に出す説明。SAME_AS: false は Person の sameAs（JSON-LD）から外す
export const SOCIALS = [
  { NAME: "GitHub", HREF: "https://github.com/m-masaki72", DESC: "SANA 8BIT VST や Web アプリなど、公開している制作物のソースコード" },
  { NAME: "X (Twitter)", HREF: "https://x.com/mementomori72", DESC: "新しいアプリや記事の公開のお知らせと、開発中の小ネタ" },
  { NAME: "Zenn", HREF: "https://zenn.dev/masaki_mori72", DESC: "Unity・C#・Git などの技術記事（新しい記事はこのサイトで書いています）" },
  { NAME: "Qiita", HREF: "https://qiita.com/m-masaki72", DESC: "JUCE でのプリセット作成や Git・Unity の作業メモ（初期の技術メモ）" },
  { NAME: "はてなブログ", HREF: "https://mementomori7272.hatenablog.com/", DESC: "アプリの紹介記事と、ゲームや本の感想・ガジェットの話" },
  { NAME: "SoundCloud", HREF: "https://soundcloud.com/morimoririnn", DESC: "チップチューンの自作曲と、SANA 8BIT VST のデモ音源" },
  { NAME: "YouTube", HREF: "https://www.youtube.com/@masakimori2508", DESC: "Chord Eureka や TaktKey など、アプリのデモ動画" },
  { NAME: "YouTube（AIに任せる前に知るUnity）", HREF: "https://www.youtube.com/@unity_before_ai", DESC: "AI が書きがちな C#/Unity のコードの問題点と、Claude Code への頼み方を 1 本 2 分ほどで解説するビデオブログ" },
  { NAME: "OFUSE (投げ銭)", HREF: "https://ofuse.me/801de8c8", DESC: "制作を応援していただける方への投げ銭・ファンレター窓口", SAME_AS: false },
];
