# Phase 2 — Slice 4 Brief v1.0 (Security B1 + B3)

**Slice ID:** Slice 4 (Security B1 + B3 — paired low-risk security fixes)
**Tarih:** 2026-05-26
**Baseline HEAD:** `4130d22` (Bug-RENDER-01 close-out docs; lokal == origin; prod == `a7e9eb9` code)
**Önceki:** Slice 3 (Bug-RENDER-01) KAPALI — `phase2_slice3b_handover.md`
**Canonical ops:** `renderer_refactor_phase1_brief_v1_5.md`
**Discovery:** bu brief §2 (Architect, 2026-05-26 — kod kanıtlı, inline)

---

## §0 — Anti-Pattern #21 Uyarısı: "brief hazır" iddiası YANLIŞTI

Önceki handover'lar B1+B3'ü "brief-ready" diye işaretledi ama **brief hiç yazılmamış** — bu döngüsel devralınan iddia (Brief v1.5 §10.3 #21):
- `architect_to_architect_handover_2026-05-25.md:113` → "✓ brief-ready Architect 2026-05-23 handover'ında"
- `architect_context_handover_2026-05-23.md:283-284` → "brief hazır" + tek satır tanım
- **Gerçek:** `claude_md_files/`'te security brief dosyası YOK; sadece bug labels (B1/B3) + birer cümle.

→ Bu brief sıfırdan, kod-okuma discovery'siyle yazıldı. Discovery iki tek-satır tanımı da **düzeltti** (aşağıda).

---

## §1 — Scope + Verification Etiketi

| WI | Açıklama | Risk | Kaynak |
|----|----------|------|--------|
| **W1** | B3 backend: wrong currentPassword `401` → `400 BadRequest` | Düşük | §2.1 ✓ verified @ `4130d22` |
| **W2** | B3 verify: frontend global 401-interceptor artık tetiklenmez (400) + Settings hata gösterimi | Düşük | §2.1 |
| **W3** | B1: `listMembers` email'i yalnız STARTUP_ADMIN+SITE_ADMIN'e döndürsün; STARTUP_USER id+name görür | Düşük-Orta | §2.2 ✓ verified @ `4130d22` |
| **W4** | Tests: B1 (admin email görür / user görmez) + B3 (wrong pw → 400) | Düşük | §3.4 |

**Scope dışı:** **Security B2** (JWT localStorage → cookie migration) — ayrı büyük slice (Slice 2e ile birlikte, ~1-2 gün). Bu slice'a sokulmaz.

**Karar girdileri (Platform Owner, 2026-05-26):**
- **DP-B3 = Backend 401 → 400/422** (tek yaklaşım; frontend interceptor'a dokunulmaz — 400 zaten tetiklemez).
- **DP-B1 = Sadece admin email görür** (STARTUP_ADMIN + SITE_ADMIN; STARTUP_USER id+name).

---

## §2 — Discovery (kod-kanıtlı, ✓ verified @ `4130d22`)

### §2.1 — B3: backend zaten 401 dönüyor; asıl bug frontend logout (devralınan tanım düzeltildi)

**Devralınan tanım:** "Wrong currentPassword 401 + logout" → sanki 401 eksikmiş gibi.

**Gerçek (✓ verified):**
- `packages/api-server/src/routes/auth.ts:297` `router.put('/password', requireAuth, ...)` (route doğru — `/password`, grep çıktısındaki `\password` bir tool render artifact'iydi, ham dosyada `/password`).
- `auth.ts:308-312`: `bcrypt.compare(currentPassword, ...)` → `!valid` ise **zaten** `res.status(401).json({error:'Unauthorized', message:'Current password is incorrect'})`.
- `packages/web-client/src/services/api-client.ts:38-45`: global `request()` wrapper **herhangi bir `res.status === 401`** + token varsa → `useAuthStore.clearAuth()` + `window.location.href = '/login'`.

→ **Bug:** Geçerli session'daki kullanıcı şifre değiştirirken mevcut şifresini yanlış girer → backend 401 → global interceptor onu **session-expiry sanıp logout + /login redirect** yapar. Veri kaybı + kötü UX.

**Fix (DP-B3 = a):** `auth.ts:309-312`'i `throw BadRequest('Current password is incorrect')` ile değiştir (400, error middleware formatlar). 401 semantik olarak da yanlıştı — request authenticated (geçerli JWT); hatalı olan **body alanı** (currentPassword), session değil. 400 hem semantik düzeltme hem davranış düzeltmesi. Interceptor (yalnız 401'de) tetiklenmez.

- **Kontrol (AG):** `auth.ts` `BadRequest`'i `lib/errors`'tan import ediyor mu? Etmiyorsa import ekle (diğer route'lar pattern'i kullanıyor).
- **Login akışı dokunulmaz:** bad-credentials-at-login 401'i DOĞRU (orada kaybedilecek session yok). Değişiklik yalnız change-password endpoint'ine scoped.

### §2.2 — B1: `listMembers` email'i tüm üyelere döndürüyor

**✓ verified:**
- `packages/api-server/src/routes/startups.ts:138-142`: `GET /:startupId/members` → `assertStartupAccess` (herhangi bir üye VEYA site admin geçer) → `listMembers(startupId)`.
- `packages/api-server/src/services/startup-ops.ts:139-144`: `include: { user: { select: { id, email, name } } }` → **email her üyeye** (STARTUP_USER dahil) döner.
- `assertStartupAccess` (`:155-164`): ADMIN → SITE_ADMIN; membership varsa `memberRole` döner. Yani route zaten requester'ın rolünü `access` içinde biliyor.

**Call-site map (Brief v1.5 §8.2.1):**
- `listMembers` production caller: **yalnız** `startups.ts:141` (+ test import `startup-ops.test.ts:39`). Başka caller yok → signature değişikliği güvenli.

**Fix (DP-B1 = a):** `listMembers(startupId, includeEmail: boolean)` — `includeEmail` false ise email döndürme (conditional select veya post-map strip). Route hesaplar:
```ts
const includeEmail = access.isSiteAdmin || access.memberRole === 'STARTUP_ADMIN';
const members = await startupOps.listMembers(req.params.startupId, includeEmail);
```

**Frontend honest-gap (🔍 — AG W3'te doğrulayacak):**
- `shared-types` `StartupMember.user.email` muhtemelen zorunlu (`string`). Email opsiyonel olunca → `email?: string` yapılmalı.
- Members'ı render eden UI bileşeni (muhtemelen Startup settings / member-management sayfası) email kolonu gösteriyorsa, STARTUP_USER için `undefined` email'i güvenli handle etmeli (kolon gizle veya "—"). **AG:** members listesini render eden bileşeni bul (`api.startups.list` tüketicisi), email kullanımını kontrol et. STARTUP_USER member-management UI'ına erişebiliyor mu? Erişemiyorsa frontend değişikliği gereksiz olabilir — ama tipi yine de opsiyonel yap (API kontrat doğruluğu).

---

## §3 — Work Items Detayı

### §3.1 — W1: B3 backend (auth.ts)
- `auth.ts:309-312` → `throw BadRequest('Current password is incorrect')`.
- Import kontrolü (`BadRequest` from `lib/errors`).
- **DP yok** — Platform Owner kararı net (400).

### §3.2 — W2: B3 frontend verify (kod değişikliği muhtemelen YOK)
- 400 → interceptor (yalnız 401) tetiklenmez → kullanıcı logout olmaz. **Verify**, fix değil.
- `SettingsPage` change-password hata gösterimi 400 mesajını ("Current password is incorrect") yüzeye çıkarıyor mu? `api-client.ts` 400'ü normalize edip `throw` ediyor (`!res.ok` dalı); Settings handler `catch`'te mesajı gösteriyor mu — AG teyit.
- **Karar Noktası DP-S4-1:** Eğer AG, başka kritik akışların da change-password'a benzer "geçerli session'da 401" ürettiğini bulursa (örn. başka bir re-auth endpoint), interceptor'ı sertleştirme (defense-in-depth) gündeme gelir → Architect'e taşı. Aksi halde W2 = sadece verify.

### §3.3 — W3: B1 (startup-ops.ts + startups.ts + shared-types + frontend)
- `listMembers(startupId, includeEmail: boolean)` — email koşullu.
- `startups.ts:141` route: `includeEmail = access.isSiteAdmin || access.memberRole === 'STARTUP_ADMIN'`.
- `shared-types`: `StartupMember.user.email` → opsiyonel.
- Frontend: members render bileşeni email-undefined güvenli (honest-gap §2.2).
- **Karar Noktası DP-S4-2:** STARTUP_ADMIN email görmeli mi yoksa yalnız SITE_ADMIN mi? Platform Owner kararı = **STARTUP_ADMIN + SITE_ADMIN** (admin tier). AG bunu uygular; ek daraltma gerekmez.

### §3.4 — W4: Tests
- `services/startup-ops.test.ts`: `listMembers(id, true)` email içerir; `listMembers(id, false)` email içermez (id+name var).
- `routes/auth.test.ts`: **YENİ** change-password testleri — wrong currentPassword → **400** (401 DEĞİL) + doğru `message`; valid → 200 + hash güncellenir; Google-only (passwordHash yok) → 400. (Mevcut auth.test.ts'te change-password coverage'ı yok — ✓ verified, yalnız JWT/login/register/reset testleri var.)
- Beklenen sayım: api-server 340 → ~344+ (web-client değişmezse 132 sabit; shared-types değişimi web-client tsc'sini etkiler ama test sayısını değil). Kesin sayım W4 sonrası raporlanır (#21: yuvarlama yok).

---

## §4 — Implementation Plan (sıra)

```
Adım 1 (W1): auth.ts 401→400 BadRequest + import kontrolü
Adım 2 (W3): listMembers signature + route includeEmail + shared-types optional + frontend handle
Adım 3 (W2): frontend verify (change-password 400 logout yapmıyor, hata mesajı görünür)
Adım 4 (W4): testler (startup-ops + auth) — suite green
Adım 5: Pre-deploy — per-package build + tsc (api-server npx tsc || true; shared-types + web-client EXIT 0)
Adım 6: Deploy (aşağıda §6)
Adım 7: AG close-out handover
```

W1 ve W3 bağımsız (paralel olabilir); W4 ikisine bağlı.

---

## §5 — Karar Noktası Tabanlı Checkpoint'ler (Brief v1.5 §7)

| CP | Karar Noktası | Beklenen Çıktı |
|----|---------------|----------------|
| **CP-1** | DP-S4-1 (başka 401-in-valid-session akışı var mı?) + frontend members UI/email honest-gap çözümü | AG discovery uzatması: `api.startups.list` tüketici bileşeni + email kullanımı + STARTUP_USER erişimi raporu. Architect onay → impl. |
| **CP-2** | W1+W3 impl + lokal test green | Değişen dosyalar, diff özet, suite çıktısı (yeni test sayısı). Architect onay → deploy. |
| **CP-3** | Prod deploy (api-server PM2 + web-client bundle) + smoke | api `/health` 200, `/ready` DB ok; web-client fresh bundle; manuel smoke (yanlış pw logout yapmıyor; STARTUP_USER members'ta email yok). Architect onay → close-out. |

3 CP yeterli (Brief v1.5 §7.4 — karar noktası = checkpoint, dar slice).

---

## §6 — Deploy + Verification (api-server dahil — Bug-RENDER-01'den FARKLI)

> **Önemli:** Bu slice **api-server** (PM2 process) + **web-client** (static) + **shared-types** değiştiriyor. Bug-RENDER-01 yalnız web-client static'ti; bu slice **PM2 api reload gerektirir.**

```bash
# Lokal (AG) — pre-deploy
pnpm --filter @systemodel/shared-types build      # EXIT 0 zorunlu (web-client import ediyor)
(cd packages/api-server && npx tsc || true)        # pre-existing tolere
pnpm --filter @systemodel/web-client build         # EXIT 0 zorunlu
# pre-commit hook full suite (1146 + yeni testler) green
git commit -m "Phase 2 Slice 4: Security B1 (member PII) + B3 (wrong-password 401->400)"

# Pre-deploy (Brief v1.5 §3.2.1)
git fetch origin master
git merge-base --is-ancestor origin/master HEAD    # ancestor check
ssh root@65.109.134.254 'cd /opt/systemodel && git rev-parse --short HEAD'   # prod HEAD (a7e9eb9 beklenir)

# Deploy
git push origin master
ssh root@65.109.134.254 'cd /opt/systemodel && git pull origin master'
ssh root@65.109.134.254 'cd /opt/systemodel && pnpm --filter @systemodel/shared-types build && (cd packages/api-server && npx tsc || true) && pnpm --filter @systemodel/web-client build'
# api-server PM2 reload — canonical (Brief v1.5 §2.2): restart DEĞİL
ssh root@65.109.134.254 'cd /opt/systemodel && pm2 delete api && pm2 start ecosystem.config.cjs --only api'

# Verification (AG)
ssh root@65.109.134.254 'curl -s localhost:3003/health; echo; curl -s localhost:3003/ready'
ssh root@65.109.134.254 'pm2 jlist'   # api online, restart fingerprint
# Counter regression: diagram-service'e dokunulmadı → state-machine.new artışı + fallback 0 korunur
```

**Manuel smoke (Platform Owner veya Tarayıcı):**
1. Şifre değiştir, mevcut şifreyi yanlış gir → **logout OLMAMALI**, "Current password is incorrect" hatası görünmeli.
2. STARTUP_USER ile members listesi → email **görünmemeli**; STARTUP_ADMIN/SITE_ADMIN ile → email görünmeli.

---

## §7 — Tamamlanma Kriterleri

- ✓ W1: wrong currentPassword → 400 (lokal test + prod smoke: logout yok)
- ✓ W3: STARTUP_USER members email görmüyor, admin görüyor (test + prod smoke)
- ✓ W4: yeni testler green, full suite green
- ✓ Prod deploy (api PM2 reload + web bundle), `/health`+`/ready` ok, counter regresyonsuz
- ✓ AG close-out handover (`phase2_slice4_handover.md`)

---

## §8 — Sonraki Candidate (Slice 4 sonrası)

3. Sub-state pseudo-initial daire (discovery zorunlu)
4. Slice 2e + Security B2 (WS auth + JWT migration, büyük scope)
5. Legacy view porto serisi (counter `old-default`'lar: general 39, sequence/browser/IV/AFV)

**Piggyback:** Bug-PRISMA-01 (`seed-examples.*` gitignore).

---

**Architect onayı bekleniyor.** Onay sonrası AG'ye paslanır; AG CP-1'den (frontend members UI honest-gap + DP-S4-1 taraması) başlar.

— Architect Claude, 2026-05-26
