import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

import { SITE } from "./src/consts";
import sitemap from "@astrojs/sitemap";
import rehypeImageSize from "./src/lib/rehype-image-size.mjs";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// sitemap の lastmod 用に、記事の frontmatter から URL → 最終更新日を引く
// （astro:content は config から使えないので、ファイルを直接読む）
const ARTICLES_DIR = "./src/content/articles";
const articleDates = new Map(
  readdirSync(ARTICLES_DIR)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => {
      const text = readFileSync(join(ARTICLES_DIR, f), "utf8");
      const field = (name) => text.match(new RegExp(`^${name}:\\s*["']?([0-9-]+)`, "m"))?.[1];
      return [`${SITE.URL}/articles/${f.replace(/\.mdx?$/, "")}/`, field("updatedDate") ?? field("pubDate")];
    })
    .filter(([, date]) => date),
);
const latestArticleDate = [...articleDates.values()].sort().at(-1);

// frontmatter に noindex: true がある記事は sitemap に載せない
const noindexArticles = new Set(
  readdirSync(ARTICLES_DIR)
    .filter((f) => /\.mdx?$/.test(f) && /^noindex:\s*true\s*$/m.test(readFileSync(join(ARTICLES_DIR, f), "utf8")))
    .map((f) => `${SITE.URL}/articles/${f.replace(/\.mdx?$/, "")}/`),
);

// 統合して消した記事 → 統合先。はてな・Zenn の移設元リンクや外部の被リンクを切らさない
const mergedArticles = {
  "claude-code-statusline-powershell-slow": "claude-code-statusline",
  "claude-code-pin-model-version": "claude-code-model-selection",
  "claude-code-deny-env": "claude-code-hooks-block-dangerous-git",
};

// https://astro.build/config
export default defineConfig({
  site: SITE.URL,
  redirects: Object.fromEntries(
    Object.entries(mergedArticles).map(([from, to]) => [`/articles/${from}/`, `/articles/${to}/`]),
  ),
  markdown: {
    rehypePlugins: [rehypeImageSize],
  },
  vite: {
    root: process.cwd(),
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "IBM Plex Mono",
      cssVariable: "--font-plex",
      provider: fontProviders.google(),
      styles: ["normal"],
    },
    {
      name: "Geist",
      cssVariable: "--font-geist",
      provider: fontProviders.google(),
      styles: ["normal"],
    },
  ],
  integrations: [
    sitemap({
      filter: (page) => !noindexArticles.has(page),
      serialize(item) {
        // 記事は更新日（なければ公開日）、記事一覧・テーマページは最新記事の日付
        const date =
          articleDates.get(item.url) ??
          (item.url === `${SITE.URL}/articles/` || item.url.startsWith(`${SITE.URL}/articles/topics/`) ? latestArticleDate : undefined);
        return date ? { ...item, lastmod: new Date(date).toISOString() } : item;
      },
    }),
  ],
});
