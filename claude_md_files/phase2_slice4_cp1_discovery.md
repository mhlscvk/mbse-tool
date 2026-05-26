# Phase 2 Slice 4 — CP-1 Discovery Report (Security B1 + B3)

**HEAD:** `2be51f6` (brief committed) | **Tarih:** 2026-05-26 | **Brief:** `phase2_slice4_security_b1_b3_brief_v1_0.md` §5 CP-1
**Method:** Kod-okuma, her bulgu path:line + ✓/⚠️/🔍 (anti-pattern #21: devralınan iddiaya körü körüne güvenme).

> **Headline:** Brief planı **tam doğrulandı**, iki sadeleştirme ile: **W2 (B3 frontend) = sıfır kod** (400 interceptor'ı tetiklemez, kanıtlı) ve **W3 (B1 frontend) = sadece shared-types `email?` opsiyonel** (tek consumer SITE_ADMIN-gate'li + zaten null-safe). **Yeni DP yok** — DP-S4-1 = hayır, DP-B3 = 400 teyitli. CP-2 (impl) için Architect onayı yeterli.

---

## (a) DP-S4-1 — "geçerli session'da 401 üreten başka akış var mı?" → ✗ YOK ✓ verified

Interceptor (`web-client/src/services/api-client.ts:40-45`): yalnız `res.status === 401 && token && store.token` → `clearAuth()` + `/login`. Tüm `status(401)` siteleri (12 adet, grep):

| Site | Bağlam | Interceptor'ı tetikler mi? | Sınıf |
|------|--------|----------------------------|-------|
| `middleware/auth.ts:12` | requireAuth "Missing Bearer token" | Hayır (token yoksa zaten gönderilmez) | session-guard |
| `middleware/auth.ts:26` | requireAuth "Invalid or expired token" | **Evet — DOĞRU** (gerçek session-expiry) | session-expiry ✓ logout istenir |
| `auth.ts:224` | login "Invalid credentials" | Hayır (login = pre-session, token yok) | pre-auth |
| `auth.ts:247` | Google "Invalid Google token" | Hayır (pre-session) | pre-auth |
| `auth.ts:254` | Google "email not verified" | Hayır (pre-session) | pre-auth |
| **`auth.ts:310`** | **change-password "Current password is incorrect"** | **Evet — YANLIŞ (BUG)** | **in-session non-session-reason → W1 fix 400** |
| `files.ts:20/30/34` | SSE token (`?token=` query) | Hayır (EventSource kanalı, `request()` wrapper'ından geçmez) | ayrı kanal |
| `mcp.ts:96/181/205` | MCP Bearer token | Hayır (harici client, web-client wrapper kullanmaz) | ayrı client |

**Body-validation 401 yok:** Zod `.parse()` → ZodError → `middleware/error.ts:11-17` **400** döner (401 değil). AppError'lar `error.ts:21-27` kendi status'larıyla. Grep'te validation kaynaklı 401 sıfır.

**Sonuç:** Web-client interceptor'ı tetikleyen tek "in-session non-session-reason" 401 = `auth.ts:310` (tam da bug). W1 onu 400 yapınca tetiklenmez. **Defense-in-depth interceptor sertleştirme GEREKMEZ → W2 = sadece verify.** DP-S4-1 ✓ resolved.

---

## (b) B1 Frontend members-UI honest-gap (brief §2.2 🔍) → RESOLVED ✓ verified

- **Tek consumer:** `web-client/src/pages/SettingsPage.tsx` `StartupsSection` (`:792`); `api.startups.members.list` (`:823`); member satırı (`:998-1015`).
- **Email gösterimi:** `:1002` `{m.user?.email ?? ''}` — **zaten null-safe** (optional chaining + fallback).
- **Erişim gate'i:** `:78` `isAdmin = user?.role?.toUpperCase() === 'ADMIN'` (= SITE_ADMIN). Tab listesi `:86-87` ve render `:124` `{activeTab === 'startups' && isAdmin && <StartupsSection />}` — **çift gate, SITE_ADMIN-only.** STARTUP_USER ve site-admin-olmayan STARTUP_ADMIN bu UI'ı **hiç görmüyor**.
- **shared-types:** `StartupMember.user` **zaten opsiyonel** (`api.ts:77` `user?: { id; email; name }`). Email'i opsiyonel yapmak için tek değişiklik: `email?: string`. `:1002` null-safe olduğu için **kıran caller yok.**

**Sonuç:** B1 frontend kod değişikliği **gerekmez**; yalnız shared-types `email?` opsiyonel (tip doğruluğu için). Backend `includeEmail = isSiteAdmin || memberRole==='STARTUP_ADMIN'` → SITE_ADMIN her zaman email alır → mevcut tek UI (SITE_ADMIN-gate'li) bozulmaz.

**Yan gözlem (scope DIŞI, backlog):** Member-management UI'ı SITE_ADMIN-only; site-admin-olmayan STARTUP_ADMIN'in kendi startup'ının üyelerini yöneteceği frontend YOK. Ürün boşluğu — B1/B3 kapsamı değil, not düşüldü.

---

## (c) Mikro-discovery: 400 vs 422 → 400 KESİN BASKIN ✓ verified

- `lib/errors.ts`: `NotFound(404)`, `Forbidden(403)`, **`BadRequest(400)`**, `PayloadTooLarge(413)`. **`UnprocessableEntity`/422 sınıfı YOK.**
- Grep `BadRequest(|UnprocessableEntity(|status(400)|status(422)`: 28 occurrence / 12 dosya — hepsi BadRequest/400 (422 sınıfı tanımlı olmadığından sıfır 422).
- ZodError → 400 (`error.ts:11`). 

**Sonuç:** 400 (BadRequest) codebase konvansiyonu; 422 hiç kullanılmıyor. **DP-B3 = 400 (BadRequest) ıslahsız onaylanır.** Brief planı aynen.

---

## CP-1 → CP-2 Gate

| Soru | Cevap | Etki |
|------|-------|------|
| DP-S4-1 (başka in-session 401?) | ✗ Yok | W2 = sadece verify (kod yok) |
| B1 frontend kırılır mı? | ✗ Hayır (SITE_ADMIN-gate + null-safe) | W3 frontend = sadece shared-types `email?` |
| 400 mı 422 mi? | 400 (422 yok) | DP-B3 ıslahsız, BadRequest |

**Sadeleşen implementable scope (CP-2):**
- **W1:** `auth.ts:310` → `throw BadRequest('Current password is incorrect')` (+ import kontrolü)
- **W3:** `startup-ops.ts:139` `listMembers(startupId, includeEmail)` + `startups.ts:141` `includeEmail = access.isSiteAdmin || access.memberRole==='STARTUP_ADMIN'` + `shared-types/api.ts:77` `email?: string`
- **W4:** tests — `startup-ops.test.ts` (includeEmail true/false) + `auth.test.ts` (change-password wrong → 400, valid → 200, google-only → 400)
- **W2:** verify only (smoke: wrong pw logout yapmıyor)

**Yeni DP yok → Architect onayı ile CP-2 (impl) başlar.**
