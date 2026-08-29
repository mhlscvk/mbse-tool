# @systemodel/payanda-lab — Payanda Lab talep toplama sitesi

**Payanda Lab**, Ankara'daki savunma sanayii KOBİ'lerine yönelik organizasyonel
dönüşüm hizmeti sunan bir ekibin tanıtım + talep toplama sitesi. Bir SaaS ürünü
değil — bir keşif ve randevu arayüzü. Sistemodel ve System2Product'ın kardeş
projesi (eşit konumda, hiyerarşi yok).

Built with **Astro 4** (static output), TypeScript strict mode, Astro content
collections (plain Markdown, MDX gerekmiyor), vanilla CSS with CSS variables.
No CSS framework, no React/Vue. Türkçe tek dil — i18n yok.

## Site yapısı

- `/` — Hero ("Bu sizin hikayeniz mi?")
- `/vakalar` — 6 vaka kartı
- `/vakalar/[slug]` — Vaka detayı (`src/content/vakalar/*.md`'den statik üretilir)
- `/teshis` — 3 soruluk teşhis sihirbazı (istemci tarafı JS, tek sayfa içinde adımlar arası geçiş)
- `/tesekkur` — Teşekkür ekranı + "e-postamı bırak" mini form
- `/hakkimizda` — Hakkımızda
- `/randevu` — Cal.com inline embed + yedek link + alternatif saat formu

## Lead akışı (backend yok)

Ana lead toplama noktası **Cal.com'un kendi randevu formu** — ayrı bir
veritabanı yok. Vaka sayfası veya teşhis sihirbazından gelen bağlam, `?notes=`
query param'ı ile `/randevu` sayfasına taşınıyor ve Cal.com'un `notes`
alanına otomatik yazılıyor.

İki ikincil form (`/tesekkur`'daki e-posta bırakma, `/randevu`'daki alternatif
saat talebi) **mailto: ile interim çözüm** — System2Product landing'in
(`packages/landing/src/pages/iletisim.astro`) kullandığı aynı stopgap deseni:
`action="mailto:info@payandalab.com" method="post" enctype="text/plain"`.
Gerçek bir backend/Resend entegrasyonu kurulana kadar bu şekilde kalacak.

**TODO:** `info@payandalab.com` gelen kutusunun kurulması gerekiyor (domain
MX kaydı / e-posta hosting) — bu form linkleri şu an gerçek bir adrese
gitmiyor, adres sadece yer tutucu.

## Cal.com

- Event type: `muhlis-cevik-sy1nce/payanda-lab-tanışma-gorusmesi` (`src/pages/randevu.astro`, `CAL_LINK`)
- 20 dakika, sadece Cumartesi 11:00-15:00
- Embed her nedenle yüklenmezse `#calFallbackLink` doğrudan Cal.com sayfasına yönlendiriyor

## Develop

```bash
# from the monorepo root
pnpm --filter @systemodel/payanda-lab dev
```

Dev server runs at <http://localhost:4321> (veya `landing` de çalışıyorsa başka bir port) by default.

## Build & preview

```bash
pnpm --filter @systemodel/payanda-lab build     # outputs static site to dist/
pnpm --filter @systemodel/payanda-lab preview   # serve the built dist/ locally
```

## Vaka içeriği ekleme/düzenleme

`src/content/vakalar/*.md` — her dosya bir vaka. Frontmatter şeması
`src/content/config.ts`'te: `order`, `tip`, `title`, `hook`, `subtitle`,
`ctaType` (`full` | `soft` | `none`), `ctaText` (soft için).

## Deploy

```bash
pnpm --filter @systemodel/payanda-lab build   # produces dist/ that Nginx serves
```

`scripts/deploy.sh` diğer paketlerle birlikte bu paketi de build ediyor.

## First-launch setup (one-time, on the server)

1. **DNS** — point the domain at the VPS:

   ```
   A   payandalab.com       → 65.109.134.254
   A   www.payandalab.com   → 65.109.134.254
   ```

2. **Nginx** — place the config directly in `sites-enabled` (project
   convention is to edit `sites-enabled` directly, not `sites-available` +
   symlink):

   ```bash
   cp packages/payanda-lab/nginx.conf.example /etc/nginx/sites-enabled/payandalab.conf
   nginx -t && systemctl reload nginx
   ```

3. **TLS certificate** — issue with Certbot:

   ```bash
   certbot --nginx -d payandalab.com -d www.payandalab.com
   ```

4. **Build** so `dist/` exists for Nginx to serve:

   ```bash
   pnpm --filter @systemodel/payanda-lab build
   ```

## Notes / TODOs

- `public/og-image.png` yok — sosyal paylaşım için bir OG görseli eklenmedi.
- `info@payandalab.com` inbox kurulmadı (yukarıya bakın).
- Logo/marka varlığı yok, sadece metin logosu ("Payanda Lab") kullanılıyor.
