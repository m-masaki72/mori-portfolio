# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev       # Dev server at localhost:4321
npm run build     # Production build to ./dist/
npm run preview   # Preview production build
npm run astro ... # Astro CLI (e.g. astro add, astro check)
```

## Architecture

Astro portfolio site. No framework components (React/Vue/etc.) — pure `.astro` files. Styling via Tailwind CSS v4.

**Routing**: File-based. `src/pages/` maps directly to URL routes.
- `src/pages/projects/[...id].astro` — project detail pages
- `src/pages/privacy.astro` — privacy policy / disclaimer (AdSense, Cookie, analytics). Covers all `*.morilab-garage.com` services; linked from Footer.

**Content collections** (`src/content.config.ts`):
- `projects` — `src/content/projects/*.md`. Required: `title`, `description`, `image { url, alt }`, `category` (enum `CATEGORIES`), `platform`. Optional: `tech[]`, `order` (表示順, 小さいほど先頭), `liveUrl`, `githubUrl`. 一覧取得は `src/lib/projects.ts` の `getProjects()`（order順）を使う。
- `articles` — `src/content/articles/*.md`（`/articles/<id>`）。Required: `title`, `description`, `pubDate`. Optional: `updatedDate`, `tags[]`, `originalUrl`（はてなブログ・Zennからの移設元。あると詳細ページに移設の注記を出す。表示名はホストで判定）。記事内画像は `public/articles/<id>/`。一覧取得は `src/lib/articles.ts` の `getArticles()`（新しい順）。

**Global constants** (`src/consts.ts`):
- `SITE` — `URL`, `TITLE`, `DESCRIPTION`, `EMAIL`
- `NAV_LINKS` — shared nav items used by Header and Footer
- `SOCIALS` — social link list used by Contact, Footer, Links pages
- `HOME`, `PROJECTS`, `ARTICLES` — page-level title/description
- `ADSENSE_CLIENT` — AdSense publisher ID (`ca-pub-...`). 空ならAdSenseスクリプト非出力。`src/pages/ads.txt.ts` がこれから `/ads.txt` を生成

**Fonts**: IBM Plex Mono (`--font-plex`) and Geist (`--font-geist`), loaded via `astro:assets` Font API.

**Key integrations**: `@astrojs/sitemap`.

**Styles**: `src/styles/global.css` — imported once via `Layout.astro`. Tailwind CSS v4.

**OGP**: `Head.astro` outputs `og:*` and `twitter:*` meta tags. Default image is `public/og-default.png` (1200×630). Pass `image` prop to `<Layout>` to set a custom OGP image per page.

**Screenshots**: `public/screenshots/` — referenced from project `.md` frontmatter as `image.url`.

**Deployment**: GitHub Pages via GitHub Actions. Site URL: `https://morilab-garage.com` (set in `astro.config.mjs` and `SITE.URL`).

**DNS automation**: `scripts/sync-dns.mjs` + `dns-projects.json` manage Cloudflare DNS records across multiple projects (this site included) from a single source of truth. `convert-images.mjs` handles image format conversion for the content pipeline. See `TODO_DNS.md` for outstanding DNS-related work.
