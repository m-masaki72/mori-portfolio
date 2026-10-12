export const SITE = {
  URL: "https://morilab-garage.com",
  TITLE: "Mori Lab",
  DESCRIPTION:
    "音響・ゲーム・プラグイン開発が好きなエンジニア。C++を軸にVSTプラグインやゲーム、Webツールなどを作っています。",
  EMAIL: "mementomori7272@gmail.com",
};

// AdSense のパブリッシャーID（例: "ca-pub-1234567890123456"）。
// 空のあいだは広告スクリプトを出力せず、ads.txt もコメントのみになる
export const ADSENSE_CLIENT = "ca-pub-6039922373762217";

// Cloudflare Web Analytics のトークン（公開前提の値）。空ならビーコンを出力しない
export const CF_ANALYTICS_TOKEN = "f9c19e1133b547578ea0f0761266f537";

export const HOME = {
  TITLE: "音響・ゲーム・Webツールの個人開発ポートフォリオ",
  DESCRIPTION:
    "MasakiMoriの個人開発ポートフォリオ。AIコード進行ツール、VSTプラグイン、Windows常駐アプリ、ブラウザで動くWebツールやゲームなど、音響・ゲーム・Webを中心とした制作物を紹介しています。",
};

export const PROJECTS = {
  TITLE: "制作物一覧",
  DESCRIPTION:
    "AI作曲支援ツール、VSTプラグイン、Windowsアプリ、ブラウザで動くWebツールやゲーム、開発者向けツールまで。MasakiMoriがこれまでに公開した制作物をカテゴリ別に紹介します。",
};

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

// DESC は Links ページで各リンクの下に出す説明
export const SOCIALS = [
  { NAME: "GitHub", HREF: "https://github.com/m-masaki72", DESC: "SANA 8BIT VST や Web アプリなど、公開している制作物のソースコード" },
  { NAME: "X (Twitter)", HREF: "https://x.com/mementomori72", DESC: "新しいアプリや記事の公開のお知らせと、開発中の小ネタ" },
  { NAME: "Zenn", HREF: "https://zenn.dev/masaki_mori72", DESC: "Unity・C#・Git などの技術記事（新しい記事はこのサイトで書いています）" },
  { NAME: "Qiita", HREF: "https://qiita.com/m-masaki72", DESC: "JUCE でのプリセット作成や Git・Unity の作業メモ（初期の技術メモ）" },
  { NAME: "はてなブログ", HREF: "https://mementomori7272.hatenablog.com/", DESC: "アプリの紹介記事と、ゲームや本の感想・ガジェットの話" },
  { NAME: "SoundCloud", HREF: "https://soundcloud.com/morimoririnn", DESC: "チップチューンの自作曲と、SANA 8BIT VST のデモ音源" },
  { NAME: "YouTube", HREF: "https://www.youtube.com/@masakimori2508", DESC: "Chord Eureka や TaktKey など、アプリのデモ動画" },
  { NAME: "OFUSE (投げ銭)", HREF: "https://ofuse.me/801de8c8", DESC: "制作を応援していただける方への投げ銭・ファンレター窓口" },
];
