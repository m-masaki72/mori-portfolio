# mori-portfolio

Masaki Mori のポートフォリオサイト。

- **URL**: https://morilab-garage.com
- **Repo**: https://github.com/m-masaki72/mori-portfolio

## Tech Stack

- [Astro 6](https://astro.build/) — Static site framework
- [Tailwind CSS 4](https://tailwindcss.com/) — Styling
- GitHub Actions — CI/CD
- GitHub Pages — Hosting

## Commands

| Command           | Action                              |
| :---------------- | :---------------------------------- |
| `npm install`     | Install dependencies                |
| `npm run dev`     | Dev server at `localhost:4321`      |
| `npm run build`   | Convert screenshots to webp, then production build to `./dist/` |
| `npm run preview` | Preview production build            |
| `npm run sync-dns` | Sync Cloudflare DNS / Pages custom domains from `scripts/dns-projects.json` (`.env` required) |
| `npm run audit-seo` | Check OGP / JSON-LD / sitemap etc. across all subdomains |

## Deploy

`master` ブランチへの push で GitHub Actions が自動ビルド・デプロイを実行する。

```
.github/workflows/deploy.yml
```
