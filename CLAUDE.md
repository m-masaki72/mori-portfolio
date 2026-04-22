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

Astro 6 blog/portfolio starter. No framework components (React/Vue/etc.) — pure `.astro` files.

**Routing**: File-based. `src/pages/` maps directly to URL routes. `src/pages/blog/[...slug].astro` handles dynamic blog post routes.

**Content**: Blog posts live in `src/content/blog/` as `.md` or `.mdx` files. The collection schema is defined in `src/content.config.ts` — frontmatter must include `title`, `description`, `pubDate`; `updatedDate` and `heroImage` are optional.

**Global constants**: `src/consts.ts` exports `SITE_TITLE` and `SITE_DESCRIPTION` used across the site.

**Fonts**: Local Atkinson font (regular + bold) served from `src/assets/fonts/`, configured in `astro.config.mjs` via `fontProviders.local()`.

**Key integrations**: `@astrojs/mdx`, `@astrojs/sitemap`, `@astrojs/rss` (RSS feed at `src/pages/rss.xml.js`).

**Styles**: Single global stylesheet at `src/styles/global.css`. No CSS framework.

**`astro.config.mjs`**: Set `site` URL here before deploying — currently placeholder `https://example.com`.
