---
title: "Googleのクロールがfavicon.icoを正しく読み取ってくれなかったときに見直す"
description: "WordPress サイトの favicon が Google 検索結果に反映されなかったときの調査と対応。リダイレクトの解消、.ico の配置、Cloudflare のキャッシュ削除まで。"
pubDate: 2025-05-12
tags: ["WordPress", "SEO", "Cloudflare"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2025/05/12/211634"
---
## 問題

WordPressでブログアイコンを設定しており、ブラウザ上では正しく表示されている。  
しかし、Google検索結果ではCocoonのデフォルトアイコンが表示されており、不自然である。  
また、何度クロールを待っても検索結果のアイコンが更新されない。

## 環境

- WordPress 6.8.1 を使用
- GCP の GCE 上で WordPress を稼働
- Cloudflare を使用して DNS を制御

## 調査

まずはブログのファビコンのパスを確認してみる。

ファビコンのURLにアクセスしたところ、リダイレクトによってWordPressの画像ファイルに遷移していることがわかった。

```
ブログURL/favicon.ico 
↓
ブログURL/wp-content...._plugins_easy-image-logo-creator_tmp_xyztq8Lp6-32x32.png
```

WordPressの設定、Cocoonの設定、あるいは画像系のプラグインに問題がある可能性がある。  
なお、`easy-image-logo-creator` は自分で導入した記憶がない。

少なくとも以下の問題が考えられる：

- ファビコンが最終的に `.png` であるため不適切
- リダイレクトが発生しているのは異常

## 対応方法

### faviconファイルを作成する

WordPress側が自動で生成してくれるものと思っていたため、faviconファイルは用意していなかった。  
手頃なWebサービスを使って、PNG画像から `.ico` 形式に変換を実施。

[Favicon.io - The Ultimate Favicon Generator (Free)](https://favicon.io/)

### GCP側に入って配信用サイトに `.ico` を直接アップロード

Apache環境のため、`/var/www/html/favicon.ico` に配置するようファイルをアップロード。

### PHP側のコードを対応

クローラーに明示的にファビコンを認識させるため、`functions.php` に以下のコードを追加。

```php
function add_custom_favicon_link() {
    echo '<link rel="icon" href="' . esc_url( home_url('/favicon.ico') ) . '" type="image/x-icon">';
}
add_action('wp_head', 'add_custom_favicon_link');
```

### Cloudflare ダッシュボードからキャッシュクリア

Cloudflareのキャッシュをカスタムパージする。  
`ブログURL/favicon.ico` だけを対象にキャッシュパージを実施。

![Cloudflareのキャッシュをパージ](/articles/google-favicon-crawl/1.png)

*Cloudflareのキャッシュをパージ*

## 更新確認方法

Favicon確認サイトにアクセスし、ファビコンが正しく設定されているか確認する。  

[Favicon Checker | Toolsaday](https://toolsaday.com/seo/favicon-checker)

![ファビコンを確認するサイト](/articles/google-favicon-crawl/2.png)

*ファビコンを確認するサイト*

しばらく経過後、Googleのクロール結果により登録ドメインのアイコンが更新されているか確認する。  
確認用URL：  
`https://www.google.com/s2/favicons?domain=ここはあなたのサイトのドメイン`
