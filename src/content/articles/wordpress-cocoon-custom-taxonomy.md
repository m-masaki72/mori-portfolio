---
title: "WordPressのCocoonでカスタムタクソノミーを追加する！"
description: "WordPress テーマ Cocoon の子テーマ functions.php に、タグとは別の分類（カスタムタクソノミー）を追加する手順とコード。"
pubDate: 2025-05-13
tags: ["WordPress"]
originalUrl: "https://mementomori7272.hatenablog.com/entry/2025/05/13/015348"
---
## 環境

- WordPress 6.8.1
  - GCP(GCEを利用)
  - Cloudflare(DNSとして利用)
- Cocoon 2.8.5.4

## タグとは別の分類を追加したい

カスタムタクソノミーを追加して、タグとは異なる分類を利用したい。 本のレビューブログを運営している場合、たとえば以下のような分類が考えられる。

- 本の種類（ハードカバー、文庫本……）
- 本の著者
- 属性（男性向け、女性向け、アクション、SF……）
- オリジナル or 二次創作

といったように、1種類のタグだけでは分類しきれないことがあるはず。 そういった場合に役立つのがカスタムタクソノミーである。

### 補足: カスタムタクソノミー

WordPressには、もともと「カテゴリ」や「タグ」といった投稿の分類機能があるが、それだけでは足りない場合に使えるのがカスタムタクソノミーだ。 開発者が自由に新しい分類の種類を作成でき、たとえば「著者」や「ジャンル」といった独自の分類ルールを追加することができる。

これにより、「タグ」はシーンやキーワードに使い、「カスタムタクソノミー」は分類の軸として使い分けることができるようになる。 複数の視点でコンテンツを整理できるため、読者の回遊性が上がり、SEO対策にも有効とされている。

## 対応方法手順

### テーマファイルエディタを開く

WordPress管理画面の**「外観」>「テーマファイルエディター」**をクリック。

### functions.php に追記してタクソノミーを定義する

Cocoon を使用している場合は、**Cocoon Child（子テーマ）** の `functions.php` に以下のコードを追記する。 （今回はマンガ本を意識した `manga_author` という種類のパーマリンクを追加してみる）

```php
// ==============以下追記部分===================
// マンガ著者用のタクソノミーを追加
function register_author_taxonomy() {
    register_taxonomy(
        'manga_author', // タクソノミーのスラッグ
        'post',   // 紐づける投稿タイプ（投稿：'post'、固定ページ：'page'）
        array(
            'label' => '著者',
            'hierarchical' => false, // タグのように使うなら false、カテゴリのように階層構造にするなら true
            'public' => true,
            'show_ui' => true,
            'show_admin_column' => true,
            'rewrite' => array('slug' => 'manga-author'),
        )
    );
}
add_action('init', 'register_author_taxonomy');

// 投稿本文の下に著者タクソノミーを表示
function add_manga_author_after_content($content) {
    if (is_single() && in_the_loop() && is_main_query()) {
        $terms = get_the_terms(get_the_ID(), 'manga_author');
        if ($terms && !is_wp_error($terms)) {
            $author_links = '';
            foreach ($terms as $term) {
                $link = get_term_link($term);
                $author_links .= '<a href="' . esc_url($link) . '">' . esc_html($term->name) . '</a> ';
            }
            $custom_output = '<div class="post-author-taxonomy">著者: ' . $author_links . '</div>';
            return $content . $custom_output;
        }
    }
    return $content;
}
add_filter('the_content', 'add_manga_author_after_content');
```

### パーマリンク設定を更新

1. WordPress管理画面の「設定」>「パーマリンク」をクリック
2. **何も変更せず**に「変更を保存」ボタンをクリック

これにより、カスタムタクソノミーの URL 構造が正しく反映される。

パーマリンクを更新しないと、パーマリンクページが404 not found状態になるので、必ず設定後に更新しよう。
