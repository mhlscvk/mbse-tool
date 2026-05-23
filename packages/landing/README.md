# @systemodel/landing — System2Product landing site

Public marketing site for **System2Product**, the umbrella brand and bridge
platform (model → product). Systemodel is positioned as a sibling platform.

Built with **Astro 4** (static output), TypeScript strict mode, MDX content
collections, Astro's built-in i18n routing (TR default, EN under `/en/`), and
vanilla CSS with CSS variables. No CSS framework, no React/Vue.

> **Astro version note:** This package pins Astro 4.x deliberately. The content
> collection setup (`src/content/config.ts`, `type: 'content'`, `post.render()`)
> uses the Astro 4 API. Astro 5 replaced it with the content-layer/loader API,
> which would require rewriting `config.ts` and the blog pages. Upgrade as a
> deliberate, separate step.

## Routing & i18n

- **TR** is the default locale and is served from the root: `/`, `/vizyon`,
  `/danismanlik`, `/iletisim`, …
- **EN** is served under `/en/`: `/en/`, `/en/vision`, `/en/services`,
  `/en/contact`, …
- `src/i18n/utils.ts` holds the `routeMap` (single source of truth for nav
  links, the language switcher's smart link resolution, and hreflang
  alternates) plus the `t()` translation helper backed by `tr.json` / `en.json`.

## Develop

```bash
# from the monorepo root
pnpm --filter @systemodel/landing dev
```

Dev server runs at <http://localhost:4321> by default.

## Build & preview

```bash
pnpm --filter @systemodel/landing build     # outputs static site to dist/
pnpm --filter @systemodel/landing preview    # serve the built dist/ locally
```

The root `pnpm build` (Turbo) also builds this package automatically since it
has a `build` script and lives in the workspace.

## Add a blog post

1. Create an MDX file in `src/content/blog-tr/` (Turkish) and/or
   `src/content/blog-en/` (English). The slug is the filename without `.mdx`.
2. Add frontmatter matching the schema in `src/content/config.ts`:

   ```mdx
   ---
   title: 'Başlık'
   description: 'Kısa açıklama (SEO + kart için).'
   publishedAt: 2026-05-20
   # optional: updatedAt, author (defaults to "Muhlis Çevik"), tags, draft, coverImage
   ---

   Markdown / MDX içerik buraya.
   ```

3. Posts with `draft: true` are excluded from listings and routes. Posts are
   sorted newest-first by `publishedAt` automatically.
4. TR posts appear at `/blog/<slug>`; EN posts at `/en/blog/<slug>`.

## Deploy

The production Nginx server block points directly at
`packages/landing/dist`, so deployment is just a build on the server — no file
copying. `scripts/deploy.sh` already runs the landing build alongside the other
packages.

```bash
pnpm --filter @systemodel/landing build   # produces dist/ that Nginx serves
```

## First-launch setup (one-time, on the server)

1. **DNS** — point the domain at the VPS:

   ```
   A   system2product.com       → 65.109.134.254
   A   www.system2product.com   → 65.109.134.254
   ```

2. **Nginx** — place the config directly in `sites-enabled` (project
   convention is to edit `sites-enabled` directly, not `sites-available` +
   symlink):

   ```bash
   cp packages/landing/nginx.conf.example /etc/nginx/sites-enabled/system2product.conf
   nginx -t && systemctl reload nginx
   ```

3. **TLS certificate** — issue with Certbot:

   ```bash
   certbot --nginx -d system2product.com -d www.system2product.com
   ```

4. **Build** so `dist/` exists for Nginx to serve:

   ```bash
   pnpm --filter @systemodel/landing build
   ```

## Notes / TODOs

- Page copy is placeholder Turkish/English — real content provided separately
  (search for `TODO` comments).
- Contact and email-capture forms are stubs (`action="#"`). Wire up to Formspree
  (or chosen provider) later — search for `TODO: wire up to Formspree`.
- `public/og-image.png` is a generated placeholder (1200×630). Replace with the
  real Open Graph image.
- Analytics not set up (Plausible decision pending).
- No logo/branding assets included.
