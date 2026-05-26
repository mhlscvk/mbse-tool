# Faz 1/2 Brief v1.6 — Canonical Operational Notes

**Versiyon:** v1.6 (Faz 2 Slice 4 = Security B1+B3 + Slice 5 = D-FILTER-01 revoke sonrası; Faz 2 üç slice'ı [3+4+5] kapalı)
**Tarih:** 2026-05-26
**Author:** Architect Claude
**Önceki sürümler:** v1.0-1.3 (Faz 1), v1.4 (Slice 2d.1+2d.3+2d.2), v1.5 (Slice 3 = Bug-RENDER-01)
**v1.6 delta özet (v1.5 üzerine, Slice 3+4+5 saga):** §5.6 (YENİ) 12 canonical pattern (A1-A12); §5.7 (YENİ) Architect-tarafı #21 alt-türleri; §8.5 (YENİ) multi-katman kanıt zinciri (6-adım); §10.3 +5 anti-pattern (#22-#26); #21 saga 12→~23; §11 Slice 4+5 dosyaları; §1/§2.2/§4.1 stale güncellemeler.
**Çapraz referans:** `phase2_slice3a_handover.md`, `phase2_slice3b_handover.md`, `phase2_slice4_handover.md`, `phase2_slice5_handover.md`, `phase2_slice4_cp1_discovery.md`, `phase2_slice5_discovery.md`, `renderer_refactor_strategy_v2.md`, `docs/adr/005-state-machine-renderer.md`

---

## Amaç

Bu doc **canonical operasyonel prosedürler ve pattern kataloğu**. Slice 2d.1 + 2d.3 + 2d.2'nin lessons learned'ları burada **direkt uygulanabilir komutlar ve kurallar** olarak duruyor. Gelecek slice'larda (2e, Faz 2) AG ve Architect bu doc'a referans verecek.

**Lifecycle:** Sürekli güncelleme. Yeni slice'larda yeni pattern öğrenildikçe v1.5, v1.6 olarak iterasyon. v1.2 (tarihsel narrative) sabit, v1.3 ve sonrası (canonical) yaşayan dokümantasyon.

**v1.4 delta özet** (v1.3 üzerine):
- §1: Pre-deploy tsc verification + test breakdown drift düzeltme (340+674=1014/1142, CLAUDE.md güncellenmesi notu)
- §3.2: Production HEAD sürpriz disiplini (yeni alt-bölüm)
- §4.1: Counter endpoint host-only browser erişim uyarısı
- §4.4: Health endpoint canonical (yeni alt-bölüm, `/health` path)
- §5.1: Tarayıcı görsel otorite nüansı (tablo güncellemesi)
- §5.2: Render kanalı WS/SSE deployment farkı + DOM programatik teyit
- §5.4: Counter PRIMARY kanıt vurgusu, kanıt üçgeni öncelik tablosu
- §6.4: Post-flush log yorumu (yeni alt-bölüm)
- §7.4: Olgunluk eğrisi notu (16+ → 3 → 3 trendi)
- §8.3: Discovery → Revision → Impl 4-adım canonical teyit
- §8.4: Pre-impl Visual Preview Pattern (yeni alt-bölüm)
- §8.4.1: PRE screenshot arşivleme + aynı view zorunluluğu (yeni alt-bölüm)
- §9.4: Handover backlog verification etiketi (yeni alt-bölüm, AG önerisi)
- §10.3: #13 güncelle (4 tekrar), #19 + #20 + #21 ekle
- §10.4: Test Mimarisi Disipline (yeni alt-bölüm)
- §11-§12-§13: Slice 2d.2/2d.3 tamamlanma güncellemeleri + state machine kapanış teyidi entegrasyonu

**v1.5 delta özet** (v1.4 üzerine, Faz 2 Slice 3 = Bug-RENDER-01 3a+3b):
- §1: test sayım 1142 → **1146** (web-client 128 → 132, Slice 3b RTL harness +4)
- §5.1: üçlü orchestration olgunluğu — Slice 3 (4 CP, probe-gated) ve backend-AG vs browser-Tarayıcı rol ayrımı netleşti
- §5.2: render kanalı düzeltmesi — **her zaman WebSocket `/diagram`**; SSE ayrı (file-change) kanaldır (eski "WS veya SSE" ifadesi yanlıştı, A.1)
- §5.5 (YENİ): Backend-AG vs Browser-Tarayıcı rol ayrımı (Slice 3a CP-1/CP-4 sürprizi)
- §7.4: olgunluk eğrisine Slice 3 eklendi (16+ → 3 → 3 → 4 CP)
- §9.4: verification etiketi disipline'i Slice 3 saga örneğiyle güçlendirildi
- §10.3 #21: **"Doğrulanmamış-iddia (devralınan claim)"** olarak ıslah — sub-agent + kendi önceki tur + önceki checkpoint atfı dahil (Slice 3'te 5 tetiklenme)
- §10.5 (YENİ): 3 canonical pattern — Honest-Gap işaretleme (🔍), Kanıt-karşısında-tez-geri-çekme, Probe-gated slice yapısı
- Appendix C (YENİ): Slice 3 (Bug-RENDER-01) retrospektifi

---

## 1. Test Sayım — Root vs Pre-commit Hook

**Önemli ayrım:**

**Güncel formül (Slice 2d.1 + 2d.3 + 2d.2 sonrası, AG canlı ölçüm 2026-05-25):**

```
root pnpm test  = api-server + diagram-service       = 340 + 674 = 1014
pre-commit hook = api + diagram + web-client         = 345 + 674 + 135 = 1154
```

**Slice'lar boyunca diagram-service test sayısı evrim:**
- Pre-Slice 2d.1: 663
- Slice 2d.1: +9 (multi-root transformer + e2e + edge) → 672 (raporlanan 663 v1.3'te güncellenmemişti)
- Slice 2d.3: +5 multi-root container + +2 def-vs-usage = +7 → 670 (overlap düzeltmesi)
- Slice 2d.2: +4 integration test → 674

**Kullanım:**
- **Lokal hızlı test:** `pnpm test` (1014) — geliştirme döngüsünde yeterli
- **Commit öncesi tam coverage:** Pre-commit hook otomatik (1142) — web-client da dahil
- **Production deploy öncesi:** Pre-commit hook ZORUNLU. Web-client'i atlamak frontend regression riski

**Brief yazımı:** "1154 yeşil" derken pre-commit hook kastediliyor. "1014 yeşil" derken manuel `pnpm test`.

**web-client evrimi:** v1.4'te 128; Slice 3b RTL harness ile +4 → 132; **Slice 5 `pseudo-initial.test.tsx` ile +3 → 135**. **api-server:** Slice 4 (B1×2 + B3×3) ile 340 → 345.

**Sayım değişirse:** Yeni test eklenince bu doc + CLAUDE.md güncellenir. Drift kapatma zinciri: Slice 3b 1142→1146 (web 128→132); Slice 4 1146→1151 (api 340→345); **Slice 5 1151→1154 (web 132→135)**. Prod HEAD: `588c5b7` (Slice 5 kod) + `a90ff77` (close-out); lokal == origin == prod.

---

## 2. PM2 Operasyonları (Canonical)

### 2.1 Env doğrulama — Ground Truth

```bash
cat /proc/$(pm2 pid <app>)/environ | tr "\0" "\n" | grep -E "FF_|NODE_ENV"
```

**Kurallar:**
- `pm2 env <app>` **KULLANMA** — false-negative riski (Slice 2d.1'de kanıtlandı, cache'lenen env'i göstermeyebilir)
- Cross-check için en az 2 env var birlikte (örn. FF + NODE_ENV) — env-loading'in tüm section'u aldığını kanıtlar
- Beklenmeyen değer veya eksik var → DUR, rollback

### 2.2 Restart (env değişikliği için)

```bash
pm2 delete <app>
pm2 start ecosystem.config.cjs --only <app>
```

**Kurallar:**
- `pm2 restart <app>` **KULLANMA** — cache'lenen `--update-env` flag'ini KORUR
- `pm2 reload <app>` **KULLANMA** — graceful restart, env cache aynı sorun
- `pm2 delete + start` kombo: env baştan yüklenir, ecosystem.config.cjs'ten gelir

**İki canlı reload örneği (Slice 4 + 5):**
- **api reload** (Slice 4 W1+W3 deploy, api-server kod değişimi): `pm2 delete api && pm2 start ecosystem.config.cjs --only api`
- **diagram reload** (Slice 5 W1+W2 deploy, filter kod değişimi): `pm2 delete diagram && pm2 start ecosystem.config.cjs --only diagram`
- Her ikisi **delete + start** (restart DEĞİL). Not: diagram restart in-memory counter'ı **sıfırlar** (regresyon kontrolü smoke trafiği geldikten sonra: `state-machine.new` > 0 + `fallback 0`).

### 2.3 Manuel flag açma (geçici test için)

```bash
pm2 delete <app>
FF_<NAME>=true pm2 start ecosystem.config.cjs --only <app> --update-env
```

**Kurallar:**
- Sadece **geçici dogfood** için (production'da kalmamalı)
- Permanent flip için ecosystem.config.cjs edit + commit + deploy (geçici flag bırakma)
- `--update-env` flag'i komut satırı env'lerinin cache'lenmesini sağlar

### 2.4 Flag rollback (manuel veya config-based)

```bash
pm2 delete <app>
pm2 start ecosystem.config.cjs --only <app>   # config'deki state'e döner
```

Sonra `/proc` ile doğrula — komut satırı env'i gitmiş, config env'i aktif olmalı.

### 2.5 Log management

```bash
pm2 flush <app>          # log dosyalarını temizler (truncate)
pm2 logs <app> --lines 50 --nostream --raw   # son N satır, blocking değil
pm2 logs <app> --raw --lines 0   # canlı tail, BLOCKING
```

**Kurallar:**
- **`pm2 flush` self-dogfood öncesi yap** — stale log'lar yeni vs eski hatayı ayırt etmeyi zorlaştırır
- Canlı tail blocking olduğu için **AG snapshot polling tercih etsin** (tail -n 120 + grep, persistent dosya zaten kayıp yok)
- Monitor (background grep): `tail -F | grep -E "pattern"` — failure-channel için

---

## 3. Build & Deploy (Canonical)

### 3.1 Per-package build

```bash
cd packages/shared-types && pnpm build
cd packages/api-server && npx tsc || true   # pre-existing TS errors tolerated
cd packages/diagram-service && pnpm build
cd packages/web-client && pnpm build
```

**Kurallar:**
- `pnpm build` (turbo, root) **KULLANMA** — api-server pre-existing TS hatalarında HALT eder, tüm pipeline durur
- API-server'da `npx tsc || true` — tolerated (pre-existing hatalar geliştirme borcu, çözülmediği sürece)
- Sıra önemli: shared-types önce (diğerleri import ediyor), api/diagram/web sonra (paralelize edilmez şu an)
- Eğer api-server hata sayısı **dramatik artarsa** (örn. 50+ yeni error) DUR ve raporla — gerçek regression olabilir
- Production'da **sadece değişen paket**i build etmek yeterli ama disipline için tüm sequence (config-only değişiklik bile) önerilir

### 3.1.1 Pre-deploy tsc Verification (CANONICAL, Slice 2d.2'den)

**Sorun:** Pre-commit hook esbuild kullanır, type checking YAPMAZ. esbuild syntax error yakalar, semantic TS error yakalamaz. Lokal `pnpm test` geçer ama deploy build'i HALT edebilir.

**Önlem:** AG **deploy öncesi** `pnpm build` ile tsc'yi ön-çalıştırır, production build'inin geçeceğini lokal'de teyit eder.

```bash
# Deploy öncesi lokal pre-flight (her slice deploy'undan önce):
cd packages/shared-types && pnpm build
cd packages/diagram-service && pnpm build
cd packages/web-client && pnpm build
# api-server için: npx tsc || true (pre-existing toleransı)
```

**Kurallar:**
- Lokal `pnpm build` 4/4 EXIT 0 değilse deploy başlama
- TS error sayısı api-server'da artmışsa (baseline'a göre) DUR, root cause analiz
- Bu adım Slice 2d.2'de doğdu — deploy sırasında sürpriz halt olmadı, lokal teyit önceden yapıldı

### 3.2 Git delivery

```bash
# Lokalde:
git push origin master

# Production'da:
ssh root@65.109.134.254 'cd /opt/systemodel && git pull origin master'
```

**Kurallar:**
- `deploy.sh` **KULLANMA** — stale `REMOTE_BRANCH` config + `git add -A` (untracked brief'leri süpürür)
- Manuel branch checkout **KULLANMA** — master fast-forward yeterli
- Pull öncesi `git status --short` ile prod working tree kontrolü (Slice 2d'de untracked prisma artifact'leri vardı, pull'u engellemediler ama kontrol disipline'i şart)
- Pull sonrası `git log --oneline -1` ile HEAD teyit

### 3.2.1 Production HEAD Sürpriz Disiplini (CANONICAL, Slice 2d.2'den)

**Sorun:** Production HEAD beklenmedik commit'te olabilir (paralel workstream, manuel müdahale, eski deploy). Reflexif `git pull` veya `git reset` ile karşılık verme tehlikeli.

**Protokol (5 adım):**

```bash
# 1. Mevcut production HEAD:
ssh root@<host> 'cd /opt/systemodel && git rev-parse HEAD'
# → örn. 3301417 (beklenenden farklı)

# 2. Ancestor check — production HEAD lokaldeki HEAD'in atası mı?
ssh root@<host> 'cd /opt/systemodel && git merge-base --is-ancestor <prod_HEAD> <local_HEAD>; echo $?'
# → 0: ata, 1: değil

# 3. Fast-forward kontrolü — pull yapılırsa diverge olur mu?
ssh root@<host> 'cd /opt/systemodel && git fetch origin && git merge-base --is-ancestor HEAD origin/master; echo $?'
# → 0: fast-forward mümkün, 1: diverge

# 4. Runtime impact analizi — aradaki commit'ler ne?
ssh root@<host> 'cd /opt/systemodel && git log --oneline <prod_HEAD>..origin/master'
# → doc-only mi (md, ADR), code mi?

# 5. Karar:
# - Ata + fast-forward + doc-only → pull devam et
# - Ata + fast-forward + code change → ek dogfood gerekebilir, Architect onayı
# - Ata değil VEYA diverge → DUR, Architect koordinasyonu
```

**Slice 2d.2'de uygulama:** Prod HEAD 3301417'deydi (beklenenden eski), ancestor check ile fast-forward kanıtlı, aradaki commit'ler doc-only (System2Product brief'leri). Pull devam etti, smoke temiz.

**Anti-pattern:** "Prod HEAD farklı → hemen reset --hard" YAPMA. Önce ancestor + diverge + impact analizi.

### 3.3 Untracked artifact'ler

Production'da bazı build artifact'leri untracked olarak duruyor:
- `packages/api-server/prisma/seed-examples.{d.ts,js,map}` (gitignore'a eklenmemiş, scope dışı, Bug-PRISMA-01 backlog candidate)
- Bunlar pull'u engellemiyor

---

## 4. Counter Endpoint

### 4.1 Endpoint canonical

```
GET http://localhost:3002/internal/renderer-stats
```

**Auth:** Yok (internal endpoint, **host-only erişim**)

**ÖNEMLİ — Browser session'dan erişim:** Bu endpoint sadece sunucu localhost'undan çağrılabilir. Tarayıcı Claude bunu prod URL'inden (`systemodel.com/internal/renderer-stats`) çağırırsa **SPA shell HTML döner** (HTTP 200 ama body Monaco environment script'i — SPA router catch-all). **Bu endpoint deploy edilmedi anlamına gelmez**, sadece browser'dan erişilemez. Counter doğrulaması **AG kanalından** (SSH + `curl localhost:3002`) yapılmalı.

**Admin endpoint (`/api/admin/renderer-stats`):** Bearer token ister, browser session'dan erişilemez. Internal endpoint dogfood için yeterli.

**⚠️ Port netleştirmesi (canonical):** Counter `/internal/renderer-stats` **diagram-service `:3002`**'de — **api-server `:3003` DEĞİL**. Slice 4 CP-3 protokolünde Architect `:3003` yazdı (typo); `:3003`'te SPA/404 döner. api-server `:3003` yalnız `/health` + `/ready` sunar. Health probe'larında HTTPS 302 bypass için `-H "x-forwarded-proto: https"` ekle (§6 gotcha).

### 4.2 Response format

```json
{
  "totalRenders": <number>,
  "byViewType": {
    "<view-type>": {
      "<outcome>": <count>
    }
  },
  "unmapped": <number>
}
```

**Outcome'lar:**
- `new` — yeni renderer başarılı
- `old-fallback-from-new` — yeni renderer crash, wedge legacy'ye düştü
- `old-default` — flag kapalı veya view-type mapping yok
- `old-fallback-not-registered` — flag açık ama renderer kayıtlı değil

### 4.3 Counter okuma akışı

```bash
ssh root@<host> 'curl -s http://localhost:3002/internal/renderer-stats'
```

**Dogfood yorumu:**
- Yeni renderer çalışıyor → `new` artar
- Yeni renderer crash → `old-fallback-from-new` artar (kritik: hotfix başarısız)
- Restart sonrası counter sıfırlanır (in-memory, persistent değil) — baseline

### 4.4 Health Endpoint (CANONICAL, AG kapanış teyidinden)

```
GET http://localhost:3002/health
```

**NOT:** Path **`/health`**, `/api/health` DEĞİL. AG 2026-05-25 kapanış teyidinde brief tablosundaki `/api/health` path'i 404 verdi, doğrusu `/health`.

**Response:**
```json
{"status":"ok","service":"diagram-service","uptime_seconds":<N>}
```

**Kullanım:**
- Servis sağlık teyidi (HTTP 200 + JSON)
- `uptime_seconds` pm2 uptime ile cross-check (tutmuyorsa restart yaşandı demek)
- Smoke test ve canlı durum sorgularında brief v1.3 §3 build/deploy sonrası kullanılmalı

---

## 5. Self-Dogfood Disipline

### 5.1 Üçlü orchestration

| Kanal | Sorumluluk |
|-------|-----------|
| 🖥️ **Tarayıcı Claude** | Browser UI: WS panel inceleme, görsel doğrulama (**ölçülebilir kriterler için otorite**), screenshot, DOM analizi |
| 👁️ **AG (backend)** | Log snapshot polling, monitor (background grep), counter sorgu |
| 🧭 **Architect** | Kanıt üçgenini değerlendirme, karar (flip / rollback / şüphe → ek inceleme) |
| 👤 **Platform Owner (Muhlis)** | **Subjektif SysML semantik kararlar** (örn. "X spec'e uygun mu", "görsel değişiklik kabul edilir mi") |

**Operating model nüansı (Slice 2d.2'de keşfedildi):**
Tarayıcı Claude görsel otorite **ölçülebilir kriterler** için (element sayısı, console error, network response). Subjektif SysML semantik kararları (örn. "pseudo-initial silinmesi anlamlı mı") Platform Owner'a devredilir. Slice 2d.2'de DP2: Pre-impl Visual Preview pattern bu devri kanıtladı (lokal POST vs prod PRE side-by-side, Platform Owner kabul).

**Slice 3 nüansı (DOM-PRIMARY otorite):** Bug-RENDER-01'de Tarayıcı'nın ölçülebilir-kriter otoritesi **DOM probe**'a genişledi: `data-node-id` deploy edildikten sonra `document.querySelectorAll('[data-node-id]')` ile stale node atfı **sayısal/kesin** yapıldı (text-fingerprint + bbox sekonder kaldı). Atfın kendisi (React leftover vs orphan SVG vs model-state) **yalnız browser runtime probe ile** ayrıştırılabildi — bkz. §5.5 rol ayrımı. Counter PRIMARY kalır (§5.4); DOM probe, "render kanalı marker'ı yoksa" sekonder kanıt rolünü Slice 3'te DOM-PRIMARY metodolojisine yükseltti.

### 5.2 Tarayıcı Claude için canonical akış

Bkz. `tarayici_claude_dogfood_brief.md` template. Özet:
1. systemodel.com login + DevTools (Network → **WS `/diagram`** filtresi = render kanalı; Console, Elements)
2. Proje + dosya aç + view sekmesi seç → render kanalı tetikler
3. WS `/diagram` frame'lerini incele → server frame `{kind:'model', model, viewType, _meta}` içinde `rendererUsed` marker'ı ara (render kanalı **her zaman** WS, bkz. kritik kurallar)
4. Console error/warn ara
5. Görsel kontrol (multi-root, nested, compartments, transitions, pseudo-states)
6. Screenshot
7. Counter sorgu — **browser'dan ÇALIŞMAZ** (bkz. §4.1). Counter doğrulaması AG kanalından
8. Raporlama: kanıt-temelli ham, hipotez yok

**Kritik kurallar:**
- **Render kanalı HER ZAMAN WebSocket `/diagram`** (✓ verified, A.1: `diagram-service/websocket-server.ts:117-123` frame `{kind:'model',...}`; client `web-client/src/lib/diagram-client.ts:42`). SSE `/api/.../events?token=<JWT>` **AYRI kanaldır** — file-change notification stream'i (render değil), `EditorPage.tsx:590-606`'da tüketilir. **v1.4'teki "production'a göre WS veya SSE" ifadesi yanlıştı:** 2026-05-25 dogfood'unda Network'te görülen SSE render kanalı değil, file-change kanalıydı (Slice 3 re-discovery R4 + headless runtime probe ile düzeltildi). Network'te SSE görürsen render değil dosya-değişim kanalına bakıyorsundur.
- XHR/Fetch'te diagram trafiği YOK
- Hipotez kurma, kanıt topla
- DevTools panel açılamazsa fallback: WebSocket.prototype.send monkey-patch + DOM analizi (Slice 2d.1'de Tarayıcı Claude'un yaptığı)
- **`rendererUsed` marker'ı render kanalında bulunamazsa:** counter (AG kanalı) primary kanıt, DOM dolaylı kanıt (yeni renderer'a özgü davranış özellikleri — örn. multi-root, container labels, pseudo-initial yokluğu) sekonder kanıt

### 5.2.1 DOM Programatik Teyit (CANONICAL, Slice 2d.2'den)

**Sorun:** Görsel sezgi yanıltıcı olabilir — bir node "yok gibi görünür" ama 1px boyutta bir köşede çizilmiş olabilir. "Görsel olarak görmedim" yetersiz kanıt.

**Doğrusu:** DOM seviyesinde **element sayısı saymak** ve **parent ID kontrolü** yapmak.

**Kullanım örneği (Slice 2d.2):**
```javascript
// "pseudo-initial__on" filter sonrası IR'dan silindi, mevcut renderer onu zaten çizmiyor mu?
const pseudoInitials = document.querySelectorAll('[id*="pseudo-initial"]');
console.log('pseudo-initial element count:', pseudoInitials.length);
// → 0 ise: renderer zaten çizmiyor (no-op flip kanıtı)
// → >0 ise: silinen IR node'u hala DOM'da, renderer crash var

// Yanlış pozitif elemine için parent kontrolü:
pseudoInitials.forEach(el => {
  console.log('parent:', el.closest('[id*="state-"]')?.id || 'orphan');
});
// → parent ID listesi expected ile match ediyor mu?
```

**Kurallar:**
- Görsel davranış sorgulanırken element count + parent kontrolü yap
- "Sayı 0" iddia ederken querySelectorAll sonucunu rapor et (görsel iddia değil, sayısal kanıt)
- WS frame içeriği + DOM count + counter — üçü hizalı ise davranış kanıtlı

### 5.3 AG için canonical akış (backend polling)

```bash
# Snapshot polling (blocking değil):
ssh root@<host> 'wc -l /root/.pm2/logs/diagram-out.log /root/.pm2/logs/diagram-error.log; tail -n 120 /root/.pm2/logs/diagram-out.log'

# Failure channel monitor (background):
ssh root@<host> 'tail -F -n 0 /root/.pm2/logs/diagram-out.log /root/.pm2/logs/diagram-error.log 2>&1 | grep -E --line-buffered "New renderer threw|exception|MODULE_NOT_FOUND"'

# Counter snapshot:
ssh root@<host> 'curl -s http://localhost:3002/internal/renderer-stats'
```

**Kurallar:**
- `pm2 logs --raw --lines 0` **KULLANMA** turn-based ortamda — blocking
- Snapshot polling kayıpsız (dosya persistent), ~90 sn'de bir özet
- Sürpriz çıkarsa anında raporla

### 5.4 Kanıt üçgeni

Karar verirken üç bağımsız kaynak hizalı olmalı:

| Kaynak | Pozitif sinyal | Öncelik |
|--------|---------------|---------|
| 👁️ **Counter (AG)** | `<view>.new` arttı, `old-fallback-from-new` ARTMADI | **PRIMARY** — ground-truth |
| 🖥️ Tarayıcı | Görsel temiz, 0 console error, DOM count beklenen, render kanalı marker (varsa) | Sekonder |
| 👁️ Log + monitor (AG) | Sessiz veya sadece startup banner, `[Wedge] threw` YOK | Sekonder |

**Counter PRIMARY ground-truth dili:**
- Yeni renderer çalıştı vs legacy fallback: sadece counter ayırt eder
- Görsel "temiz" görünebilir ama yeni renderer crash etmiş + legacy'ye düşmüş olabilir (yanıltıcı pozitif)
- Counter `new` artışı + `old-fallback-from-new` sıfır → yeni renderer'ın gerçekten çalıştığı kanıtı

**Tek kanal yetmez:**
- Counter `new` artmış olabilir AMA görsel broken ise → renderer çalışıyor ama yanlış output. Görsel doğrulama şart.
- Log sessiz olabilir AMA görsel veya counter problemli → render-time vs startup-time hata ayrımı.
- Görsel temiz + log sessiz ama counter eksik → yine de teyit gerekli (render hiç yapılmamış olabilir)

**Üçü hizalı → flip onayı. Counter eksik → flip ERTELENİR. Sekonder kanal eksik → ek inceleme ama parsiyel onay mümkün.**

---

### 5.5 Backend-AG vs Browser-Tarayıcı Rol Ayrımı (CANONICAL, Slice 3a CP-1/CP-4'ten)

**Sorun:** İki Claude'un kanıt domain'leri **örtüşmez**, ama bir bug'ın atfı her ikisini de gerektirebilir. Domain'ini aşan bir Claude ya yanlış kanıt üretir ya da "göremiyorum" deyip tıkanır.

**Domain haritası:**

| Kanıt türü | Kim yapabilir | Kim YAPAMAZ |
|------------|---------------|-------------|
| Browser DOM probe (`querySelectorAll`, fiber, render kanalı frame) | 🖥️ Tarayıcı | 👁️ AG (browser session'ı yok) |
| Counter / PM2 log / `/proc` env / `curl localhost` | 👁️ AG (SSH) | 🖥️ Tarayıcı (host-only, §4.1) |
| Headless WS protocol probe (server response sırası, frame şekli) | 👁️ AG (kendi domain'i) | 🖥️ Tarayıcı (protocol-level değil UI-level) |
| Kod okuma / git / grep | 👁️ AG + 🧭 Architect | — |
| Subjektif SysML/görsel semantik | 👤 Platform Owner | hepsi (devredilir) |

**Slice 3'te kanıt (CP-1 + CP-4 sürprizi):**
- Bug-RENDER-01 SVG-persist atfı **browser DOM probe** gerektirdi (`data-node-id` ile stale node sayımı + stale `<g>`'nin React-rendered mı imperatif mi olduğu). Bunu **yalnız Tarayıcı** yürütebildi (W3 = Tarayıcı verifier).
- AG aynı bug için **headless WS protocol probe** yaptı (kendi domain'i) → server-side "out-of-order" hipotezini ✗ çürüttü (in-order, stateless).
- Atıf ancak **iki domain birleşince** yakınsadı: AG server'ı temizledi (WS in-order), Tarayıcı client-side leftover'ı kanıtladı (`data-node-id` taşıyan stale `<g>`).

**Kural:**
1. Architect bir probe spec yazarken **hangi domain'in çalıştırabileceğini** belirtsin (AG mi Tarayıcı mı). Yanlış domain'e verilen probe ya boş döner ya yanıltır.
2. Bir Claude "bunu göremiyorum" dediğinde, bu **gap değil domain sınırı** olabilir — diğer Claude'a route et (§10.5 Honest-Gap ile birlikte).
3. Counter doğrulaması **daima AG kanalı** (browser'dan host-only endpoint SPA shell döner, §4.1). DOM atfı **daima Tarayıcı kanalı**.

---

### 5.6 Slice 3+4+5'ten Yeni Canonical Pattern'ler (A1-A12)

Slice 3 (Bug-RENDER-01), Slice 4 (Security B1+B3), Slice 5 (D-FILTER-01 revoke) boyunca kristalleşen 12 pattern. (Slice 3'e özgü 3 pattern §10.5'te.)

**A1 — AG handover-vs-canlı-kod cross-verification.** Fresh AG session devraldığında handover'ları (canonical brief + slice handover'ları) **canlı kodla cross-check** eder; devralınan iddialar doğrulanmadan kabul edilmez. Slice 3a: AG "pseudo-initial implement edilmemiş" iddiasını çürüttü (kod transformer/renderer/DiagramViewer'da mevcut). #21'in AG-tarafı pozitif uygulaması. **Kanıt:** `phase2_slice3a_handover.md`.

**A2 — Çapraz-session bellek tarih-kapsamlama.** AG eski memory'leri tarih-kapsamlar ("Mar–Apr 2026 era") ve yeni bellek dosyaları açarak ayrı tutar; çapraz-session karışıklığı önler. Slice 2d.1: `project_recent_rendering_work.md` "era" işaretlendi, `project_phase1_renderer_refactor.md` yaratıldı. **Kanıt:** Slice 2d.1 close-out.

**A3 — Architect mikro-discovery gate'leri.** Brief'te varsayım barındıran her karar için Architect CP-1'e küçük doğrulama görevi ekler. Slice 4: 400-vs-422 seçimi için "codebase pattern" gate → AG `lib/errors.ts`'te 422 sınıfı olmadığını + 28 BadRequest occurrence saydı. Erken-tahmin (#13) ve devralınan-iddia (#21) tuzaklarından kaçınır. **Kanıt:** `phase2_slice4_cp1_discovery.md` §c.

**A4 — Built artifact grep = deployed-code teyit.** PM2/static deploy'da prod'daki çalışan kod'un fix'i içerdiğini built JS'te grep ile doğrula — Counter PRIMARY + DOM teyidin deploy karşılığı. Slice 4: `grep "Current password is incorrect" auth.js`; Slice 5: `grep "parentsWithEntry" view-filters.js` = 0 (kaldırılan kod bundle'da yok). Pre-deploy `npx tsc` (§3.2.1) ile birlikte (esbuild semantik bakmaz). **Kanıt:** Slice 4+5 CP-3 deploy raporları.

**A5 — HTTPS 302 prod localhost bypass.** Prod'da `x-forwarded-proto !== https` zorlaması localhost curl'ünü 302'ler. Health/ready probe'ları `-H "x-forwarded-proto: https"` ile bypass edilir. **Kanıt:** Slice 4+5 CP-3 health adımları (ayrıca §6 gotcha).

**A6 — Self-caught issue raporlama.** AG yakaladığı tsc/build/cross-check hatasını **açıkça raporlar** (gizlemez/kıyıdan geçmez). Disipline kanıtı + §3.2.1 pre-deploy tsc'nin canlı örneği. Slice 4: `user!.passwordHash` `string|null` commit öncesi yakalandı → `hash` değişkenine ayrıştırıldı. Slice 5: 4 self-caught (path range, golden path, mock factory, duplicate golden entry). **Kanıt:** Slice 4+5 CP-2 raporları.

**A7 — Repro-script gerçek prod modelinde regression-guard.** Karmaşık atıf/tasarım-revizyonunda statik okuma + fixture yetmez; **gerçek prod modeli üzerinde katman-katman pipeline trace** yapılır. Slice 2d.1: `reproduce-sensor-bug.ts` (multi-root crash atfı). Slice 5: `reproduce-slice5-pseudo-initial.ts` (raw IR 2 → post-filter 0; fix sonrası 0→2). IP hijyeni: gerçek model SELECT-only çekilir, kullanılır, **silinir** (gitignored). **Kanıt:** iki repro-script.

**A8 — Combined evidence (pozitif/negatif) tablosu.** Security/filter davranış değişiminde **aynı veri üzerinde zıt role/koşulla** kontrast tablosu çıkar. Slice 4: ENT-S2P-002'de SITE_ADMIN 4/4 email, STARTUP_USER 0/4 — role-based projeksiyon farkı, fix'in en güçlü kanıtı. **Kanıt:** `phase2_slice4_handover.md` §3 CP-4.

**A9 — WS-frame inspect = backend→frontend kontrat kanıtı.** DOM/visual teyidin altında backend'in gönderdiği ham JSON'u (`kind:'model'` frame, `model.children`) doğrula. `MessageEvent.prototype.data` getter override, prototip-yamasından önce açılmış WS bağlantıları için canonical (standart `onmessage` patch çalışmaz). Slice 5: frame'de pseudo-initial/startnode yok → β (frontend) elendi. **Render kanalı:** WS asıl model, SSE control/keepalive. **Kanıt:** Slice 5 Tarayıcı WS-frame probe.

**A10 — CP-1 implementation item bağımlılıkları erken keşfi.** Brief'te "bağımsız" görünen WI'lar CP-1'de coupled çıkabilir. Slice 5: W1 (parent-entry-hide kaldır) + W2 (edge remap) "koordineli"ydi; AG orphan-prune analiziyle **W1 tek başına orphan-prune'a takılır** → coupled kanıtladı (`:235` CONTROL_KINDS StartNode, `:245-251` content-neighbor şartı). İmpl-anında çakacak bug'ı önledi. **Kanıt:** Slice 5 CP-1 §4.2.

**A11 — Onaylı tasarım kararlarının iteratif revizyonu.** Pre-impl Visual Preview + Platform Owner-onaylı karar bile (Slice 2d.2 D-FILTER-01) derin discovery sonrası **revize edilebilir**. Slice 5: SysML semantik (initial vs entry ayrı kavram) + standart uyumu → D-FILTER-01 geri çekildi, ADR (W5) ile resmi kayıt. §5.4 "subjektif kararlar Platform Owner'a" pattern'inin revizyon örneği. **Kanıt:** Slice 5 brief §1 + ADR-005 revision.

**A12 — Prisma conditional select (alan-bazlı PII).** Security fix'te `select: { field: includeFlag }` — `false` ise alan çıktıdan **tamamen çıkar** (null/undefined değil, anahtar yok). Slice 4 B1: `listMembers(startupId, includeEmail)` STARTUP_USER için email anahtarı dönmez (`'email' in user` = false). **Kanıt:** Slice 4 W3 (`startup-ops.ts:139`) + SMOKE-B Test 2.

### 5.7 Architect-tarafı Anti-Pattern #21 Alt-Türleri (CANONICAL, Slice 3+4+5)

Anti-pattern #21 ("devralınan iddiaya körü körüne güvenme") sadece sub-agent'a değil, **Architect'in kendi ürettiği iddiaya** da tabidir. Slice 3+4+5 saga'sında tetiklenen Architect-tarafı alt-türler:

| Alt-tür | Örnek (Slice / kanıt) |
|---|---|
| Port typo | Slice 4 CP-3 counter `:3003` (gerçek `:3002`) — AG düzeltti |
| Role varsayımı | Slice 4 "Muhlis SITE_ADMIN" — Tarayıcı JWT decode çürüttü |
| Format varsayımı | Slice 4 role UPPER_SNAKE; gerçek lowercase ('admin'/'editor') |
| UI hipotezi | Slice 4 "UI string-match"; AG kod: koşulsuz generic render |
| Görsel framing | Slice 5 "2 ok"; AG: 1 ok + içeride entry (#22) |
| Path range | Slice 5 "162-216 kaldır" reparent (`:180-196`) içeriyordu (#23) |
| Golden path | Slice 5 `test-fixtures/...` yanlış; gerçek `tests/fixtures/state-machine/sensor-systems/` |
| Mock factory varsayımı | Slice 5 W4 cssClass destekliyor varsayımı; AG: yeni factory gerek |
| MOOT tahmini | Slice 5 "MOOT en olası"; Tarayıcı: render yok, gerçek bug |
| False-negative hipotezi | Slice 5 "selector pre-3a yanlış" tahmini çürüdü (#25) |

**Çıkarım:** Brief yazımı, plan, hipotez üretimi — hepsi #21'e tabi. Architect her kendi iddiayı path:line ile doğrulamaya çalışmalı; doğrulayamadığında **"varsayım, AG/Tarayıcı doğrulayacak" disclaimer'ı** kullanmalı. **Kanıt:** Slice 3+4+5 handover §5 saga tabloları.

---

## 6. Stale-Log Forensic (Anti-Pattern)

### 6.1 Sorun

PM2 log dosyaları truncate edilmiyor (manuel `pm2 flush` olmadıkça). Eski instance'ların hataları yeni instance'ın log'unda görünebilir. **Rollback DUR koşulu yanlış tetiklenebilir.**

### 6.2 Cross-reference protokolü (canonical)

Rollback DUR koşulu görüldüğünde **otomatik aksiyon YAPMA**, önce:

```bash
# 1. Mevcut process start time:
ssh root@<host> 'pm2 jlist | jq ".[] | select(.name==\"<app>\") | .pm2_env.pm_uptime"'
# → epoch ms, örn. 1748019288000

# 2. Log dosyası mtime:
ssh root@<host> 'stat -c "%Y %n" /root/.pm2/logs/<app>-*.log'
# → epoch sn, dosya başına

# 3. out.log içindeki startup banner sayısı:
ssh root@<host> 'grep -c "Service running" /root/.pm2/logs/<app>-out.log'
# → her restart bir tane ekler, beklenenden çoksa stale içerik var

# 4. Şüpheli hata satırının pozisyonu:
ssh root@<host> 'grep -n "Wedge.*threw" /root/.pm2/logs/<app>-out.log'
# → satır numarasına bak, mevcut process'in startup banner'ından önce mi sonra mı
```

**Karar matrisi:**
- Hata satırı mevcut process startup'ından **önce** → STALE, rollback yapma
- Hata satırı mevcut process startup'ından **sonra** → GERÇEK, rollback yap
- Log dosyası mtime current process start'ından **önce** → tüm log stale, hatalar geçmişten

### 6.3 Önlem: `pm2 flush` self-dogfood öncesi

```bash
ssh root@<host> 'pm2 flush <app>'
ssh root@<host> 'wc -l /root/.pm2/logs/<app>-*.log'   # 0 baseline teyit
```

Bu, dogfood sırasında çıkan herhangi bir error'ın **kesinlikle yeni** olmasını garanti eder.

### 6.4 Post-Flush Log Yorumu (CANONICAL, Slice 2d.2 kapanış teyidinden)

**Sorun:** `pm2 flush` sonrası log dosyaları boş kalır. Eğer process restart olmazsa, **startup banner ("Service running") da yeniden basılmaz**. Bu durumda `grep -c "Service running"` = 0 sonucu **stale değil**, "süreç hala flush'tan beri çalışıyor" anlamına gelir.

**Yorum matrisi (Slice 2d.2 kapanış teyidi 2026-05-25):**

| Durum | "Service running" sayısı | Log boyutu | Yorum |
|-------|--------------------------|------------|-------|
| Normal çalışma | 1+ (restart sayısı + 1) | >0 | Sağlıklı |
| Post-flush, restart yok | 0 | 0 | **Mümkün olan en sağlıklı durum** — sıfır error |
| Post-flush, restart oldu | 1+ | >0 | Restart sayısı kontrol et |
| Eski log + restart yok | "Service running" var ama eski | >0 (eski mtime) | Stale forensic gerekli |

**Kanıt üçgenindeki tamamlayıcı:** Post-flush boş log durumunda render kanıtı **counter'da** (counter in-memory, restart sonrası sıfırlanır ama post-flush + restart-yok durumunda counter restart öncesindeki son baseline'dan **artmaya devam etmiştir** — 2026-05-25'te 343 → 2095, 15h+ kesintisiz). PM2 uptime + counter artışı = sağlıklı.

---

## 7. Karar Noktası Tabanlı Checkpoint (Pattern)

### 7.1 Sorun (Slice 2d.1'den)

Slice 2d.1'de toplam ~16 checkpoint vardı, ~10'u gereksizdi. Özellikle F.1-F.8 her komut için ayrı onay aldı.

### 7.2 Pattern

**Checkpoint sayısı = karar noktası sayısı**, komut sayısı değil.

**Karar noktası:** Yön değiştirebilen bir aksiyon (production'a aktif etme, rollback, scope açma)
**Komut paketi:** Önceki onayın doğrudan devamı olan teknik adımlar (build, commit, pull → push paketinin parçası)

### 7.3 Brief şablonu

```markdown
### Paket X — [Karar noktası adı]

Komutlar:
- Komut 1
- Komut 2
- Komut 3

AG: Komutları sırayla çalıştır, **sadece** şu durumlarda DUR:
- Beklenmedik hata (non-zero exit, conflict, exception)
- Beklenen output sapması (örn. test sayısı farklı, HTTP 200 değil)
- Ampirik test başarısız (örn. /proc env doğrulama)

Normal flow: hepsi yeşilse konsolide rapor, sonraki paket onayı için bekle.
```

### 7.4 Hedef checkpoint sayıları ve olgunluk eğrisi

| Slice türü | Hedef |
|-----------|-------|
| Hotfix (Slice 2d.1 gibi) | 5-7 |
| Feature slice (Slice 2d.2 gibi) | 7-10 |
| Major refactor | 10-15 |
| Mimari değişiklik | 15+ ama paketle |

**Olgunluk eğrisi (Slice 2d.1 → 2d.3 → 2d.2):**

| Slice | Checkpoint sayısı | Karar noktası | Verimlilik |
|-------|-------------------|---------------|-----------|
| 2d.1 | 16+ | ~6 gerçek karar | Düşük (mikromanage) |
| 2d.3 | 3 | 3 gerçek karar | Yüksek |
| 2d.2 | 3 DP + paketler | 3 gerçek karar | Yüksek |
| 3a | 4 (CP-1..CP-4) | 4 gerçek karar | Yüksek (probe-gated, her CP gerçek gate) |
| 3b | 6 (CP-1..CP-6) | 6 gerçek karar | Yüksek (discovery → audit → fix → test → deploy → re-probe) |

**Trend:** Doğru yönde — checkpoint sayısı = karar noktası sayısı (16+ → 3 → 3 → 4 → 6). Slice 3'teki artış **mikromanage değil**: probe-gated yapıda her CP gerçek bir karar gate'i (discovery sonucu fix yaklaşımını belirler, re-probe atfı doğrular). AG auto-DUR refleksleri olgunlaştı (3a CP-1'de W2-void'i implement'a geçmeden yakaladı). Bu, **olgunluk göstergesi** — karmaşıklık arttığında CP sayısı karar sayısıyla orantılı büyüyor, komut sayısıyla değil.

### 7.5 Architect sorumluluğu

Brief yazarken kendine sor:
1. Bu checkpoint **karar noktası mı**, yoksa **komut tamamlama** noktası mı?
2. Bu checkpoint'i atlasak ne olur? "Sürpriz çıkarsa AG zaten durur" → checkpoint gereksiz
3. 10+ checkpoint varsa brief'i revize et

### 7.6 AG sorumluluğu

Brief'te "DUR" demese bile AG'nin **kendi disiplinli auto-DUR refleksleri** çalışır:
- Beklenmedik exit code
- Beklenen output sapması
- Ampirik test failure
- Production-impacting irreversible aksiyon öncesi
- Stale-log forensic gerektiren durumlar

Architect bunlara güvenmeli — gereksiz mikromanage yapmamalı.

---

## 8. Brief Evrim Disipline

### 8.1 Ampirik doğrulama zorunluluğu

**Kural:** Brief'te bir tasarım iddiası **ampirik test edilene kadar HİPOTEZ**, ne kadar açık görünse de.

**Pattern:**
1. Discovery raporu → **veri** (kod yapısı, dependency'ler, mevcut davranış)
2. Brief tasarımı → **karar** (yeni yapı, scope)
3. Ampirik doğrulama → **kanıt** (gerçekten çalışıyor mu, sürpriz var mı)
4. Implementasyon → **uygulama** (kanıtlanmış tasarımı kod'a çevirme)

Slice 2d.1'de Adım 3 (ampirik) atlandı (Brief v1.1 §4 filter zorunlu iddiası). AG implementasyon sırasında yakalayıp DUR'du. Doğru pattern: **Adım 0 discovery'de sentetik proof + ampirik doğrulama yap, brief tasarımına bunu yedirme**.

### 8.2 Brief'te hipotez işareti

Brief'te tasarım kararı yazılırken:
- ✓ "Bu çalışır" iddiası → **kanıt referansı şart** (örn. "AG discovery §3'te kanıtlandı: renderer.ts:284-292 multi-root tüketim yapıyor")
- ⚠️ "Bu çalışması beklenir" hipotezi → **HIPOTEZ etiketi + ampirik doğrulama checkpoint'i** (örn. "Adım 0'da ampirik test: filter sensor-systems output'unu değiştiriyor mu?")

### 8.2.1 Çağrı sitesi haritası (CANONICAL, Slice 2d.1+2d.3+2d.2 4-tekrar pattern'den)

**Kural:** Brief yazımında her **"X dokunulacak / kaldırılacak / değiştirilecek"** iddiası için **çağrı sitesi haritası** zorunlu.

```bash
# Brief'te "X kaldırılacak" yazmadan önce:
grep -rn "X" packages/ --include="*.ts" --include="*.tsx"
# → Kim çağırıyor? Kaç test bağımlı? Side-effect var mı?
```

**Pattern (Slice 2d.1 + 2d.3 v1.0 + 2d.2 v1.0 + 2d.2 v1.1 — 4 tekrar):**
- Slice 2d.1: "filter integration zorunlu" iddiası — sensor-systems snapshot'ı bozardı
- Slice 2d.3 v1.0: "Sprotty group decorator" iddiası — Sprotty kurulu değildi
- Slice 2d.2 v1.0: "Legacy filter cleanup" iddiası — 59 test bağımlıydı
- Slice 2d.2 v1.1: "sensor-systems snapshot regen" iddiası — 3 test sitesi paylaşıyor

Her dört vakada AG Adım 0'da yakaladı, brief revize edildi. Önlem: Architect brief yazarken çağrı haritası adımını **atlama**, AG'nin Adım 0 keşfi bunu zorunlu kılsın.

### 8.3 Brief revision pattern (4-adım canonical)

| Sebep | Versiyon |
|-------|----------|
| Discovery raporu sonrası ilk taslak | v1.0 |
| AG Adım 0 keşfi sonrası design simplification/revize | v1.1 |
| Ampirik bulgu sonrası tasarım revize | v1.X+1 |
| Slice close-out narrative | v1.X+1 (final) |

**4-adım canonical (Slice 2d.1 doğdu, Slice 2d.3 ve 2d.2'de teyit edildi):**
1. **Architect brief v1.0** (hipotezler)
2. **AG Adım 0 keşif** (ampirik veri + POC)
3. **Architect brief v1.1** (kanıtlı tasarım)
4. **AG implementation** (atomic commit'ler)

Slice 2d.1: v1.0 → v1.1 → v1.2 (close-out). Slice 2d.3: v1.0 → v1.1 → impl. Slice 2d.2: v1.0 → AG snapshot mimarisi keşfi → v1.1 → impl. Bu pattern gelecek slice'larda standart.

### 8.4 Pre-impl Visual Preview Pattern (CANONICAL, Slice 2d.2'den)

**Amaç:** Görsel davranış değişikliği riski olan slice'larda **deploy öncesi** kullanıcı algısını teyit et. Sıfır rollback maliyeti.

**5 adım:**

1. **AG geçici patch yazar** — clearly-marked (`// TEMP: visual preview, do not commit`), push edilmez
2. **AG lokal stack çalıştırır** — Docker DB + pnpm dev (lokal production simulation)
3. **AG WS smoke ile patch'i ampirik kanıtlar** — lokal stack'in gerçekten patch'i servis ettiğini WS frame içeriği ile teyit eder (lokal serve doğrulaması)
4. **Platform Owner side-by-side görsel inceleme** — lokal POST (localhost:5173) vs prod PRE (systemodel.com) yan yana, tarayıcıda
5. **Karar:**
   - Kabul → impl başlar
   - Reddet → vazgeç (sıfır rollback maliyeti, kod merge edilmedi)

**Kullanım koşulu:** Görsel davranış riski olan tüm slice'larda. ADR-005 D-FILTER-01 gibi semantic değişiklikler şart.

**Slice 2d.2'de kanıt:** Filter `pseudo-initial__on`'u IR'dan siliyor, ama mevcut renderer onu zaten çizmiyordu → lokal POST = prod PRE birebir aynı görüntü. Platform Owner DP2 kabul → impl başladı, deploy temiz, kullanıcı için no-op flip.

**Anti-pattern:** IR diff'ten görsel sonuç çıkarma (bkz. §10.3 #20). Subjektif görsel kararlar gerçek render üzerinde yapılır, IR'dan extrapolation değil.

### 8.4.1 PRE Screenshot Arşivleme Disiplini (CANONICAL, Slice 2d.2 kapanış teyidinden)

**Sorun:** Slice 2d.2'de Platform Owner görsel ön-kabul (DP2) verdi ama PRE screenshot'ı **arşivlemedi**. Kapanış teyidi (2026-05-25) sırasında Madde 7 (no-op flip eşitlik kanıtı) için PRE referansı arandığında dağınık dosya sisteminde aranmak zorunda kalındı, bulunan screenshot da **farklı view'daydı** (GV embed STV, standalone STV değil) → karşılaştırma parsiyel kaldı.

**Kurallar (Slice 2d.2'den sonra zorunlu):**

1. **PRE screenshot zorunlu arşivlenir** — Pre-impl Visual Preview adımı 4'te (Platform Owner side-by-side karşılaştırma) görülen prod PRE görseli ekran kaydı olarak alınır
2. **Arşiv yeri:** Slice close-out doc'una ek (`claude_md_files/phase1_slice<N>_visual_preview_pre.png`) veya repo dışı `outputs/` klasörü
3. **Aynı view kuralı:** PRE ve POST screenshot'ları **aynı view-type'ta** alınır (örn. STV → STV, GV → GV). Embed edilmiş view'lar (örn. GV içinde STV) standalone view ile birebir karşılaştırılamaz, davranışsal parite ile yetinilir
4. **Metadata:** Screenshot dosya adında veya yanındaki not'ta tarih, view-type, slice referansı yazılır
5. **Close-out doc'ta referans:** Slice close-out'unda "PRE screenshot: <path>" satırı zorunlu

**Kanıt:** Slice 2d.2 close-out'ta bu disipline uygulanmasaydı, kapanış teyidinde Madde 7 ⚠️ ŞÜPHELİ olarak kalır, retroaktif sökmece gerekirdi.

### 8.5 Multi-Katman Kanıt Zinciri (CANONICAL, Slice 5'ten)

Karmaşık atıfta tek discovery turu yetmez. Slice 5, **6-katman** kanıt zincirinin canlı örneği:

1. **Discovery** (AG statik kod-okuma): çelişen iddiaları kategorize et, hipotez listele
2. **Tarayıcı probe #1** (runtime gözlem): hipotezi doğrudan test et — sonuç sürpriz olabilir (Slice 5'te "MOOT en olası" çürüdü, render gerçekten yoktu)
3. **AG üçlü tanı** (α/β/γ): kalan hipotezleri katmanlara ayır, ele
4. **Tarayıcı probe #2** (disambiguation): backend mi frontend mi — kesin cevap (WS-frame inspect, A9)
5. **AG repro-script** (gerçek prod model): mekanizmayı pipeline'da pinle (A7) — Slice 5: raw IR 2 → post-filter 0
6. **Implementation + Smoke** (kod-test-runtime kanıt üçgeni)

Her katman öncekine bağlı; **brief yazımı son katman sonrası** (erken brief = anti-pattern #13). §8.3 4-adım disipline'i (Discovery → Brief → Implementation → Close-out) bu saga'da **6-adım'a uzadı**. **Kanıt:** Slice 5 saga (discovery → 2 probe → üçlü tanı → repro → smoke), `phase2_slice5_{discovery,handover}.md`.

---

## 9. Handover Disipline (Üçlü Orchestration)

### 9.1 İki seviyeli handover

**AG handover** (`claude_md_files/phase1_slice<N>_handover.md`):
- Repo'da, commit edilir
- AG yeni session'da otomatik okur
- İçerik: kapatılan iş, açık konular, sonraki adımlar, kod path'leri, operasyonel detaylar

**Architect handover** (`/mnt/user-data/outputs/architect_context_handover_<date>.md` veya benzeri):
- Repo dışı, Architect kendi dosyalarında
- Sen yeni Architect Claude sohbetine ilk mesaj olarak yapıştırırsın
- İçerik: refactor özeti, lessons learned, açık konular, kişisel bağlam

### 9.2 Cross-verification

Yeni AG session açıldığında handover'ı okur, repo state ile cross-verify yapar:
- HEAD beklenen mi
- Untracked dosyalar handover'da açıklanmış mı
- Yeni commit'ler var mı (paralel workstream)

Slice 2d.1'de AG bunu yaptı: `2217c0e → a523e90 → 3af584a` zincirini gördü, `3af584a` (System2Product) renderer scope dışı diye netleştirdi.

### 9.3 Handover içeriği checklist

**AG handover'da olmalı:**
- [ ] Mevcut HEAD + production HEAD
- [ ] Son commit listesi (slice'a ait)
- [ ] Bugün yapılanların özeti
- [ ] Lessons learned özet
- [ ] Açık konular (sonraki slice candidate'ları) **— her item için verification etiketi (bkz. §9.4)**
- [ ] Kod path'leri (gelecek slice'lar için)
- [ ] Operasyonel detaylar (yeni canonical pattern'ler)

**Architect handover'da olmalı:**
- [ ] Operating model (Three-Claude + Platform Owner)
- [ ] Refactor genel mimarisi
- [ ] Bugünün özeti
- [ ] Lessons learned
- [ ] Açık konular + öncelik analizi **— her item için verification etiketi (bkz. §9.4)**
- [ ] Önemli dosyalar (brief'ler, ADR'ler, kod)
- [ ] Operasyonel gotcha'lar
- [ ] Kişisel bağlam (Platform Owner)
- [ ] İlk yapılacaklar (yeni Architect'in adımları)

### 9.4 Handover Backlog Item Verification Etiketi (CANONICAL, AG önerisi 2026-05-25)

**Sorun:** Handover'da bir backlog item yazıldığında ("X implement edilmemiş", "Y bağımlı", "Z henüz yapılmadı"), bu **doğrulanmış olgu mu** yoksa **o an varsayım mı** ayırt edilemiyor. Bir sonraki AG/Architect session'ı bu item'ları "doğru" kabul edip iş kuruyor.

**Slice 2d.2 vakası (AG 2026-05-25 raporu):** Handover §4'te "yeni candidate: sub-state pseudo-initial daire çizimi (yeni renderer'da implement edilmemiş)" yazıyordu. Ama canlı kod kontrolü (transformer.ts:60-61 + renderer.ts:186-200 + DiagramViewer.tsx:2288-2301) generic render yolunun MEVCUT olduğunu gösterdi. Handover iddiası kategorik olarak yanlıştı; gerçek soru farklıydı.

**Kural:** Handover backlog item'ları **verification etiketi** taşır:

| Etiket | Anlam | Gerekli kanıt |
|--------|-------|---------------|
| ✓ verified @ commit X | Bu iddia commit X'te ampirik olarak doğrulandı | `grep`/`git show`/test output referansı |
| ⚠️ assumed | Bu iddia handover yazarının sanısı, doğrulanmadı | Yok — bir sonraki session önce doğrulamalı |
| 🔍 partial — see §N | Kısmen doğrulandı, eksik kısımlar §N'de | Detaylı not |

**Brief v1.3 §8.2 hipotez etiketinin handover'lara genişletilmesi.** Brief'lerde uygulanıyordu, handover'larda eksikti — bu boşluk Slice 2d.2 backlog claim'inde patladı.

**Slice 2d.2 backlog item'ları için retroaktif etiketleme örneği:**

- "Sub-state pseudo-initial daire çizimi implement edilmemiş" → ⚠️ assumed (AG 2026-05-25 cross-check: generic yol mevcut, gerçek soru farklı — discovery gerekli)
- "Bug-PRISMA-01 prisma seed-examples gitignore" → ✓ verified @ commit dec3470 prod-side untracked, lokal tracked-and-correct
- "Legacy renderer kaldırma" → 🔍 partial — Faz 2 boyunca 6+ view tipi porto edilmeli, tek slice değil (§N: Faz 2 final report)

**Slice 3 saga örneği (devralınan iddianın 3 katmanı):** Bu disipline'in en güçlü kanıtı Slice 3'te geldi — bir checkpoint atfı bile (CP-4 "primary = React reconciliation/unmount path") doğrulanmamış-iddiaydı. 3b W1 discovery onu **devralmadı**, kod-okumayla "reconciliation path'i koda göre DOĞRU" diye sorguya açtı ve (a)/(b) honest-gap'iyle 🔍 etiketledi; kesin atıf Tarayıcı probe'una bırakıldı. Ders: **handover backlog item'ı + checkpoint atfı + sub-agent raporu + kendi önceki turun** — hepsi aynı doğrulanmamış-iddia kategorisinde (§10.3 #21). Verification etiketi olmadan yazılan her atıf, bir sonraki turda taze kanıtla yeniden test edilmeli.

---

## 10. Anti-Patterns Kataloğu

Slice 2d.1 + 2d.3 + 2d.2 ve önceki slice'lardan biriken anti-pattern'ler. Brief yazımı ve implementation sırasında kontrol listesi.

### 10.1 Kod anti-pattern'leri

| # | Anti-pattern | Doğrusu |
|---|--------------|---------|
| 1 | `find()!` non-null assertion | `find()` + null check + log |
| 2 | Fixture izole pattern varsayımı | Idiomatic real-world pattern (part-state usage) |
| 3 | IR şemasına `roots` field'ı ekleme | Renderer zaten multi-root, transformer-side seed yeterli |
| 4 | Transformer'a "view scope" mantığı yazma | Filter-pipeline-transformer ayrımı koru (view-first) |
| 5 | Helper'ı premature olarak çıkarma | Inline + atomic; renderer/transformer farklı veri-aynı pattern → ortak helper zorlama |

### 10.2 Operasyonel anti-pattern'leri

| # | Anti-pattern | Doğrusu |
|---|--------------|---------|
| 6 | Env var format `RENDERER_FLAG_*` | `FF_*` (feature-flags.ts:30 template literal) |
| 7 | `pnpm build` (turbo) production'da | Per-package + api-server `tsc \|\| true` |
| 8 | `deploy.sh` kullanma | Düz `git push origin master` + prod `git pull` |
| 9 | `pm2 restart` flag rollback için | `pm2 delete + start ecosystem.config.cjs` |
| 10 | `pm2 env` env doğrulama | `/proc/<pid>/environ` ground truth |
| 11 | Reflexif rollback (log error görünce) | Stale-log forensic cross-reference önce |
| 12 | `pm2 logs --raw --lines 0` blocking | Snapshot polling (tail -n 120 + grep) |

### 10.3 Süreç anti-pattern'leri

| # | Anti-pattern | Doğrusu |
|---|--------------|---------|
| 13 | **Brief tasarım iddiası ampirik test olmadan** (4 tekrar pattern) | "HİPOTEZ" etiketi + Adım 0'da ampirik doğrulama + **çağrı sitesi haritası** (`grep -rn`) |
| 14 | Her komut için ayrı checkpoint | Karar noktası tabanlı, komut paketi halinde |
| 15 | Scope creep (UX defekti hotfix'e dahil) | Backlog'a, scope cleanliness |
| 16 | Browser self-dogfood'da XHR/Fetch tab | WS tab (backend WS üzerinden konuşuyor) |
| 17 | Görsel doğrulamayı tek başına yeterli sayma | Kanıt üçgeni (görsel + counter + log) |
| 18 | Hipotez kurma ("muhtemelen X") | Kanıt-temelli ham rapor, hipotez yok |
| **19** | **Failing-test commit pattern pre-commit hook ile uyumsuz** (Slice 2d.3) | Snapshot regen + fix tek commit'te; yeni testler ayrı yeşil commit'lere böl |
| **20** | **IR diff'ten görsel sonuç çıkarma** (Slice 2d.2) | Subjektif görsel kararlar gerçek render üzerinde — Pre-impl Visual Preview pattern (§8.4) |
| **21** | **Doğrulanmamış-iddia: kafadan yuvarlama VEYA devralınan claim** (Slice 2d.2 + Slice 3, Architect/AG öz-eleştirisi) | İddia/sayım yaparken: (a) sayım kaynağını referansla VEYA (b) iddia başka kaynaktan geliyorsa — sub-agent, **kendi önceki tur**, **önceki checkpoint atfı**, handover backlog — kendi kanıt zincirinle `✓ verified` koyana kadar **varsayım** say. Yuvarlama yapma; devralma yapma. Slice 3'te 5 tetiklenme (detay aşağıda + Appendix C) |
| **22** | **Architect zihinsel modeli ↔ kod-gerçeklik farkı** (Slice 5) | Brief framing kod yapısıyla birebir uyuşmayabilir. "Muhtemel görsel X, AG impl'de doğrulayacak" disclaimer kullan. Örnek: brief "2 ok" → gerçek "1 ok + içeride entry (composition child)" |
| **23** | **Path range varsayımı imprecise** (Slice 5) | "X:N-M satırları kaldır" aralığı fazladan/korunması-gereken kod içerebilir. Aralığa **fonksiyonel blok ismi** ekle; AG yapısal sınırı kod-okumayla doğrular. Örnek: ":162-216" reparent bloğunu (`:180-196`) içeriyordu |
| **24** | **Fixture-test yeşil ama prod'u temsil etmiyor** (Slice 5) | Fixture gerçek prod yapısını yansıtmayabilir; kritik fix sonrası **repro-script ile gerçek modelde** doğrula (A7). Örnek: fixture'da top-level initial var, gerçek modelde yok — test prod davranışını yakalamıyordu |
| **25** | **Selector hipotez tuzağı (false-negative zinciri)** (Slice 5) | "false-negative" gibi **düzeltme-tahminleri de #21'e tabi**; çürütme zincirinin her halkasını ayrı kanıtla. Örnek: "selector pre-3a yanlış" tahmini bonus-probe (oldSelector=newSelector=0) ile çürüdü |
| **26** | **Naming asimetrisi: SNode cssClass DOM'a yansımayabilir** (Slice 5, bilgi notu) | Renderer `cssClasses:['startnode']` → DiagramViewer `data-node-id`'ye çevirir ama `class` attribute'una değil; `.startnode` selector boş döner. Renderer çıktı path'inin DOM tezahürünü kod/test ile doğrula |

**#13 detay (4-tekrar pattern):**
- Slice 2d.1: "filter integration zorunlu" iddiası → sensor-systems snapshot'ı bozardı
- Slice 2d.3 v1.0: "Sprotty group decorator" iddiası → Sprotty kurulu değildi (`grep -ri sprotty` boş)
- Slice 2d.2 v1.0: "Legacy filter cleanup" iddiası → 59 test bağımlıydı
- Slice 2d.2 v1.1: "sensor-systems snapshot regen" iddiası → 3 test sitesi paylaşıyor

Önlem: Brief yazımında her "X dokunulacak" iddiası için `grep -r "X" .` çağrı sitesi haritası şart (§8.2.1).

**#21 detay (Slice 3 — 5 tetiklenme, "devralınan claim" ıslahı):**

| # | Kaynak | Devralınan/üretilen iddia | Çürüten kanıt |
|---|--------|---------------------------|---------------|
| 3a-1 | Explore-ajan (sub-agent) | "selection state temizlenmiyor (selectedNodeId stale)" | AG kod-okuma: selection parent-controlled → internal moot; gerçek stale `multiSelectedNodeIds` |
| 3a-2 | Re-discovery (kendi) | "WS uncorrelated → out-of-order, stale model kazanır" (Defect #2) | Kendi runtime probe: sync parse event-loop'u bloke → in-order responses |
| 3a-3 | Re-discovery (kendi) | "`.then`'de ELK cancel-guard yok" (Defect #1) | CP-1 kod-okuma: guard `:820` mevcut (önceki tur offset 838-943 okumuş, 608-838 okumamış) |
| 3b-4 | CP-4 atfı (checkpoint) | "primary = React reconciliation/unmount path" | W1 discovery kod-okuma: ağaç-içi stale mekanizması YOK → reconciliation path doğru; etiket imprecise, (a)/(b)'ye ayrıştır |
| 3b-5 | W2 audit (**kendi önceki tur**) | Option-C reddi: "prop dirty → remount temizlemez" | Tarayıcı RECV log: son setDiagram clean B → premise yanlış; Option C re-instate |

**Üç katman:** (1) başka ajan, (2) kendi önceki tur, (3) önceki checkpoint atfı. Hepsi aynı doğrulanmamış-iddia kategorisinde. "Sub-agent'a güvenme" yetmez — **kendi geçen-tur framing'ini ve hatta kendi checkpoint atfını** da taze kanıtla doğrula. Önlem: her devralınan iddiaya verification etiketi (§9.4) + kanıt zinciri.

**#22-#26 detay (Slice 4+5):** Bu beş anti-pattern Slice 4+5'te tetiklendi; somut örnekleri **§5.7 Architect-tarafı #21 alt-türleri tablosunda**. #22 (zihinsel model↔kod), #23 (path range), #24 (fixture-prod), #25 (false-negative zinciri) Slice 5 CP-1/CP-2'de; #26 (naming asimetrisi) Slice 5 SMOKE-A yan-bulgu. #22-#25 hepsi **Architect-tarafı #21'in özel halleri** — #21'in "kendi ürettiğin iddiaya da tabisin" ilkesinin somutlaşması.

**#21 saga toplam (Slice 3+4+5): ~23 tetiklenme** (Slice 3: 5 + Slice 4: 7 + Slice 5: 11). Architect-tarafı alt-türleri 8+ (§5.7 tablosu). Disipline ~22'sini yakaladı (1'i son anda). Çıkarım: #21 bu projenin **en sık tetiklenen ve en sık yakalanan** disipline'i — verification kültürünün omurgası. Detaylı tablolar: ilgili slice handover §5'lerinde.

### 10.4 Test Mimarisi Disipline (CANONICAL, Slice 2d.2'den)

**Kural:** Test piramidi seviyesi (transformer isolation / wedge end-to-end / e2e) → **kendi golden dosyası**.

**Sorun:** Paylaşılan snapshot mimarisi katmanlar arası bağımlılık yaratır. Bir katmanda regen, diğer katmandaki testleri kırar veya yanlış coverage gösterir.

**Slice 2d.2 vakası:**
- `sensor-systems/expected-ir.json` ve `expected-smodel.json` üç test sitesi tarafından paylaşılıyordu (transformer unit, wedge integration, e2e)
- View-filter integration sonrası IR değişiyor, ama transformer isolation testleri filter'sız ham output bekliyor
- Architect ilk brief'te "regen" dedi → 3 test sitesi tepkisi farklı
- AG keşfi: split mimarisi (paylaşılan değil, katman başına dosya) çözüm

**Çözüm — Split snapshot mimarisi:**

```
fixtures/state-machine/sensor-systems/
├── expected-ir.json              # Transformer isolation (raw, byte-identical)
├── expected-smodel.json          # Wedge integration (raw renderer output)
├── expected-ir-filtered.json     # YENİ: Filter sonrası IR (filtered transformer test)
└── expected-smodel-filtered.json # YENİ: Filter sonrası SModel (filtered wedge test)
```

**Kurallar:**
- Test piramidi seviyesi başına ayrı golden dosyası
- Paylaşılan snapshot **kasıtlı tasarım kararı** olmadıkça AVOID
- Eğer paylaşım gerekiyorsa: ADR'de gerekçe belgele, hangi katmanlar paylaşıyor netleştir
- Regen kararı verirken: hangi katmanlar etkilenir, mevcut paylaşım yapısı neyi koruyor analizi şart

**Architect failure mode (4. tekrar — Slice 2d.2'de):**
Brief'te "regen" direktifi paylaşılan snapshot mimarisini bilmiyordu. AG keşfetti, Architect karar (split). Önlem: snapshot regen kararı vermeden önce **kim okuyor** haritası şart (`grep -r expected-ir.json`).

### 10.5 Slice 3'ten Yeni Canonical Pattern'ler

Bug-RENDER-01 (3a+3b) sırasında üç pattern kristalleşti. İkisi (A, B) Slice 3a brief Appendix A'da aday olarak işaretlendi, üçüncüsü (C) slice yapısının kendisinden çıktı.

#### Pattern A — Honest-Gap İşaretleme (🔍 etiket disipline'i)

Bir iddianın doğrulanması ajanın mevcut araç setiyle (kod okuma, headless probe, browser dogfood) mümkün değilse:

1. **Hipotezi YAZMA, gap'i AÇIKLA** — "bu kanıtlanmadı çünkü X gerekir"
2. Gap'i kapatacak somut probe/teyit spec'ini yaz (başka ajan veya tur için)
3. Bağımlı kararı (slice scope, fix öncelik) gap kapanana kadar ertele; ertelenemezse altında "🔍 assumed" ile devam et

**Slice 3 örneği:** W1 discovery, SVG-persist atfını (a) model-state vs (b) orphan SVG arasında **statik kod okumayla ayıramadı**. Hipotez kurmak yerine 🔍 honest-gap işaretledi ve "kesin disambiguation 2-dakikalık Tarayıcı probe gerektirir" spec'ini yazdı. Fix tasarımı (F1 vs F2) probe sonucuna gate'lendi → anti-pattern #13'ten (ampirik test olmadan tasarım iddiası) kaçınıldı. **🔍, "uydurma-eldeci-bilgi" anti-pattern'inin önündeki en güçlü bariyer.**

> **§5.5 ile etkileşim:** Bir gap aslında **domain sınırı** olabilir ("AG browser göremez"). Bu durumda gap'i kapatmak = doğru Claude'a route etmek, yeni discovery turu değil.

#### Pattern B — Kanıt-Karşısında-Tez-Geri-Çekme

Bir tezi (mimari defect iddiası, root cause atfı) yeni kanıt çürüttüğünde, tez sahibi (AG, Architect, Tarayıcı):

1. **Eski tezin yanlış olduğunu RAPORDA AÇIKLA, sessizce silme**
2. Çürüten kanıt zincirini referansla (komut çıktısı, satır numarası)
3. Yeni atfı `✓ verified` veya `🔍 partial` etiketleyerek devam et

**Karşıt anti-pattern:** eski tezi sessizce reframe etme veya yeni rapora taşımama ("biz öyle dememiştik" pattern'i).

**Slice 3 örnekleri (iki kez):**
- AG re-discovery "Defect #2 out-of-order" framing'ini kendi runtime probe'u ✗ refuted etti → probe raporunun başına dürüstçe yazdı.
- W2 audit, **kendi önceki turunun** Option-C reddini Tarayıcı RECV log'uyla çürüttü → "Option C reddim yanlış premise'eydi; düzeltiyorum" diye açık yazdı (audit §2 Anti-pattern #21 v2).

Bu pattern #21 (devralınan claim) ile kardeş: #21 "devralma yapma" der, B "çürütünce dürüstçe geri çek" der.

#### Pattern C — Probe-Gated Slice Yapısı

**Ne zaman:** Bir bug'ın kök neden atfı mevcut araçlarla (kod okuma) tamamlanamıyor ama atıf **fix tasarımını belirliyor** (farklı kök neden → farklı fix). Tahmine dayalı fix = anti-pattern #13.

**Yapı:**
1. **Part A — güvenli/infra ship:** Atıftan bağımsız, düşük-riskli değişiklikleri (instrumentation, identity attribute) önce deploy et. Bunlar **atfı mümkün kılan** araçlardır.
2. **GATE — ampirik probe:** Doğru domain'deki Claude (§5.5) instrumentation'ı kullanarak atfı kesinleştirir.
3. **Part B — atfa-dayalı fix:** Doğrulanmış atfa göre fix tasarla + uygula + aynı probe ile re-verify.

**Slice 3 = kanonik örnek:**
- **3a:** `data-node-id` instrumentation ship (atıftan bağımsız, sıfır davranış riski) → atfı DOM-PRIMARY mümkün kıldı.
- **GATE:** Tarayıcı re-probe — stale `<g>` `data-node-id` taşıyor mu? (React-rendered leftover vs imperatif/orphan ayrımı).
- **3b:** Atıf = (c2) React leftover → fix = model-identity remount → aynı probe ile staleIds=0 re-verify.

**Maliyet/fayda:** Ekstra bir deploy + gate turu, ama tahmine dayalı yanlış-fix riskini (ve onun rollback/re-discovery maliyetini) eler. Görsel/runtime davranışı statik okunamayan tüm bug'lar için önerilen.

---

## 11. Kod Path'leri (Quick Reference)

### State machine pipeline

| Path | Sorumluluk | Son slice'larda değişti? |
|------|-----------|----------------------|
| `packages/diagram-service/src/rendering/state-machine/transformer.ts` | AST → IR transformation | ✓ 2d.1 (multi-seed, qname walk, defense guards), ✓ 2d.3 (top-level state container emit) |
| `packages/diagram-service/src/rendering/state-machine/renderer.ts` | IR → SModelRoot | ✗ (multi-root tüketim zaten vardı `:284-292`) |
| `packages/diagram-service/src/rendering/state-machine/index.ts` | Barrel + registration | ✗ |
| `packages/diagram-service/src/rendering/state-machine/types.ts` | IR şeması | ✗ (korundu, A′ yaklaşımı şemaya dokunmadı) |
| `packages/diagram-service/src/rendering/state-machine/transformer.test.ts` | Unit tests | ✓ 2d.1 (+6 multi-root), ✓ 2d.3 (+5 container) |
| `packages/diagram-service/src/rendering/state-machine/end-to-end.test.ts` | E2E tests | ✓ 2d.1 (+2 multi-root), ✓ 2d.3 (+2 def-vs-usage) |
| `packages/diagram-service/src/rendering/state-machine/parser-state-machine-integration.test.ts` | Parser integration | ✗ |

### Strangler-fig + counter

| Path | Sorumluluk | Son slice'larda değişti? |
|------|-----------|----|
| `packages/diagram-service/src/rendering/pipeline.ts:95-109` | Wedge try/catch + view-filter integration | ✓ 2d.2 (applyViewFilter eklendi) |
| `packages/diagram-service/src/rendering/feature-flags.ts:30` | Flag mantığı (`FF_*` template) | ✗ |
| `packages/diagram-service/src/rendering/renderer-stats.ts` | Counter (in-memory, `/internal/renderer-stats` endpoint) | ✗ |
| `packages/diagram-service/src/rendering/view-type-mapper.ts` | View type → IR mapping | ✗ |
| `packages/diagram-service/src/rendering/view-registry.ts` | Lazy renderer loader | ✗ |
| `packages/diagram-service/src/rendering/wedge.ts` (veya pipeline) | Strangler-fig fallback logic | ✗ |

### Transformer/filter shared

| Path | Sorumluluk | Son slice'larda değişti? |
|------|-----------|----|
| `packages/diagram-service/src/transformer/view-filters.ts` | `filterStateTransitionView`, `applyViewFilter` | ✗ (algoritma korundu, çağrı sitesi 2d.2'de eklendi) |
| `packages/diagram-service/src/transformer/bdd-transformer.ts:616` | Legacy filter call | ✗ (2d.2'de korunmaya karar verildi — 59 test bağımlı, DP1=b new-path-only) |
| `packages/diagram-service/src/parser/sysml-text-parser.ts` | SysML v2 text → AST | ✗ |

### Frontend (container labels desteği)

| Path | Sorumluluk | Son slice'larda değişti? |
|------|-----------|----|
| `packages/web-client/src/components/Diagram/DiagramViewer.tsx:2197` | Nested+hasChildren → title-bar container çizimi | ✗ (zaten doğru, 2d.3 A′ yaklaşımı bu mekanizmayı kullanıyor) — **NOT:** doğru path `components/Diagram/`, v1.4'teki `src/diagram/` yanlıştı |
| `packages/web-client/src/components/Diagram/DiagramViewer.tsx` | Render path `renderNodes.map` (~`:2127+`, `key={node.id} data-node-id={node.id}`); cleanup effect `:501+` (Slice 3b W3 interaction reset); ELK layout effect guard `:820` | ✓ Slice 3a (`data-node-id` ×11), ✓ Slice 3b (W3 interaction reset) |
| `packages/web-client/src/pages/EditorPage.tsx` | Slice 3b W2 remount `key={fileId:viewType}` (`:~1129`), W3 selection reset effect `[fileId,viewType]` (`:~308`); parent selection `:99`/`:1156` | ✓ Slice 3b |
| `packages/web-client/src/pages/TrainingPage.tsx` | Slice 3b W2 `key={taskIndex}`, W3 selection reset `[taskIndex]` (`:~159`) | ✓ Slice 3b |
| `packages/web-client/src/test-utils/mock-model.ts` | RTL mock model factory `createMockModel(ids)` (reusable) | ✓ Slice 3b (yeni) |
| `packages/diagram-service/src/websocket-server.ts:117-123` | Render kanalı WS frame `{kind:'model',...}` (§5.2 düzeltmesi kaynağı) | ✗ |
| `packages/web-client/src/lib/diagram-client.ts:42` | Client WS `/diagram` bağlantısı | ✗ |

### Fixture'lar

| Path | İçerik | Son slice'larda değişti? |
|------|--------|----|
| `tests/fixtures/state-machine/sensor-systems/model.sysml` | Eski fixture (izole `state def`, yanlış pattern ama testler geçiyor) | ✗ |
| `tests/fixtures/state-machine/sensor-systems/expected-ir.json` | Raw transformer golden (filter'sız) | ✗ (byte-identical, raw isolation) |
| `tests/fixtures/state-machine/sensor-systems/expected-smodel.json` | Raw wedge golden | ✗ (byte-identical) |
| `tests/fixtures/state-machine/sensor-systems/expected-ir-filtered.json` | **YENİ** filtered transformer golden | ✓ 2d.2 |
| `tests/fixtures/state-machine/sensor-systems/expected-smodel-filtered.json` | **YENİ** filtered wedge golden | ✓ 2d.2 |
| `tests/fixtures/state-machine/multi-root-part-states/model.sysml` | Multi-root anonim fixture | ✓ 2d.1 (oluşturuldu) |
| `tests/fixtures/state-machine/multi-root-part-states/expected-*.json` | Multi-root frozen snapshot | ✓ 2d.1 (oluşturuldu), ✓ 2d.3 (container labels regen) |

### Production

| Path | Sorumluluk |
|------|-----------|
| `/opt/systemodel` | Repo root |
| `/root/.pm2/logs/diagram-*.log` | PM2 log dosyaları |
| `ecosystem.config.cjs` | PM2 process config (env burada, Slice 2d.1'de FF eklendi, permanent) |

---

### Slice 4+5 Dosyaları (Security B1+B3 + D-FILTER-01 revoke)

| Path | Sorumluluk | Slice |
|------|-----------|-------|
| `packages/api-server/src/routes/auth.ts:310` | change-password 401→400 BadRequest (B3) | 4 W1 |
| `packages/api-server/src/services/startup-ops.ts:139` | `listMembers(startupId, includeEmail)` PII (B1) | 4 W3 |
| `packages/api-server/src/routes/startups.ts:141` | members route includeEmail (role-based) | 4 W3 |
| `packages/shared-types/src/api.ts:77` | `StartupMember.user.email` opsiyonel | 4 W3 |
| `packages/diagram-service/src/transformer/view-filters.ts:162` | D-FILTER-01 geri çekildi (entry-hide + remap kaldırıldı; reparent + orphan-prune korundu) | 5 W1+W2 |
| `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-*-filtered.json` | filtered golden (pseudo-initial artık korunur) | 5 W3 |
| `packages/web-client/src/test-utils/mock-model.ts` | `createMockModelWithClasses` factory | 5 W4 |
| `packages/web-client/src/components/Diagram/pseudo-initial.test.tsx` | startnode render RTL test (3) | 5 W4 |
| `packages/diagram-service/scripts/reproduce-slice5-pseudo-initial.ts` | repro regression-guard (gerçek model gitignored) | 5 |
| `docs/adr/005-state-machine-renderer.md` | D-FILTER-01 Revision notu | 5 W5 |

---

## 12. ADR İlişkileri

**ADR-005 (state-machine-renderer):**
- D1: Translation policy (SysML v2 keyword verbatim)
- §6: AST stability guarantee
- §7: Layout determinism (snapshot regen güvenli)
- **D-FILTER-01 (Slice 2d.2'de tamamlandı):** View-filter pipeline-level integration
  - Karar: `applyViewFilter` `pipeline.ts:95` öncesinde, new-renderer path için
  - Trade-off: Legacy `bdd-transformer.ts:616` korundu (59 test bağımlı), asimetri output seviyesinde çözüldü
  - Pseudo-state remap: `pseudo-initial__on` siliniyor (entry action varsa start→entry remap)
  - Görsel davranış: Slice 2d.2'de no-op flip (mevcut renderer pseudo-initial'i zaten çizmiyordu) — Pre-impl Visual Preview ile teyitli

**Slice 2d.3'te ADR güncellemesi yapılmadı** — A′ yaklaşımı şema değişikliği değil, transformer-side davranış genişletmesi. IR şeması korundu, yeni decision gerekmedi.

---

## 13. Update Log

| Versiyon | Tarih | Değişiklik |
|----------|-------|-----------|
| v1.0 | Faz 1 başı | İlk Faz 1 brief |
| v1.1 | Slice 2c sonrası | Slice 2 eklemeleri |
| v1.2 | Slice 2d.1 sonrası | Slice 2d.1 narrative (tarihsel) |
| v1.3 | 2026-05-24 | Canonical ops notes (PM2, build, counter, dogfood, stale-log forensic, checkpoint, brief evrim, handover, anti-patterns 18 madde) |
| **v1.4** | **2026-05-25** | **Slice 2d.1 + 2d.3 + 2d.2 sonrası: 5 yeni canonical pattern (pre-deploy tsc, prod HEAD sürprizi, DOM programatik teyit, Pre-impl Visual Preview, Test Mimarisi Disipline) + 3 yeni anti-pattern (#19 failing-test pre-commit, #20 IR diff'ten görsel, #21 sayım yuvarlama) + 2 nüans (Tarayıcı görsel otorite ölçülebilir, çağrı sitesi haritası zorunluluğu) + 1 olgunluk göstergesi (checkpoint trendi 16+ → 3 → 3) + ADR D-FILTER-01 tamam. State machine kapanış teyidinden (2026-05-25) sonra eklenen düzeltmeler: §1 test breakdown drift (340+674=1014/1142, CLAUDE.md güncellenmesi notu) + §4.1 counter endpoint host-only browser erişim uyarısı + §4.4 health endpoint canonical (`/health`, `/api/health` değil) + §5.2 render kanalı WS/SSE deployment farkı + §5.4 counter PRIMARY kanıt vurgusu + §6.4 post-flush log yorumu + §8.4.1 PRE screenshot arşivleme + aynı view zorunluluğu + §9.4 handover backlog verification etiketi. Toplam yeni: 5 pattern, 3 anti-pattern, 9 kapanış-teyidi düzeltmesi.** |
| **v1.5** | **2026-05-26** | **Faz 2 Slice 3 (Bug-RENDER-01 3a+3b) sonrası: test sayım 1142→1146 (web 128→132); §5.2 render kanalı düzeltmesi (her zaman WS `/diagram`, SSE ayrı file-change kanalı); §5.5 (YENİ) backend-AG vs browser-Tarayıcı rol ayrımı; §7.4 olgunluk eğrisi 16+→3→3→4→6 CP; §9.4 Slice 3 saga örneği; §10.3 #21 ıslahı "doğrulanmamış-iddia/devralınan claim" (sub-agent + kendi önceki tur + checkpoint atfı, 5 tetiklenme); §10.5 (YENİ) 3 canonical pattern (Honest-Gap 🔍, Kanıt-karşısında-tez-geri-çekme, Probe-gated slice); §11 frontend path düzeltmesi (`components/Diagram/`) + Bug-RENDER-01 path'leri; Appendix C (YENİ) Slice 3 retrospektifi.** |
| **v1.6** | **2026-05-26** | **Faz 2 Slice 4 (Security B1+B3) + Slice 5 (D-FILTER-01 revoke) sonrası: test 1146→1154 (web 132→135, api 340→345); §5.6 (YENİ) 12 canonical pattern A1-A12 (AG cross-verify, memory tarih-kapsamla, Architect mikro-discovery, built-artifact grep, HTTPS 302 bypass, self-caught raporlama, repro-script regression-guard, combined evidence, WS-frame inspect, item-bağımlılık erken keşfi, tasarım iteratif revizyon, Prisma conditional select); §5.7 (YENİ) Architect-tarafı #21 alt-türleri tablosu; §8.5 (YENİ) multi-katman kanıt zinciri (6-adım); §10.3 +5 anti-pattern (#22 zihinsel-model↔kod, #23 path-range, #24 fixture-prod, #25 selector-false-negative, #26 naming-asimetrisi); #21 saga 12→~23; §11 Slice 4+5 dosyaları; §2.2 diagram reload örneği; §4.1 counter port (3002 NOT 3003) explicit.** |
| v1.7 | (planlanan) | Slice 2e (WS auth + HierarchicalFlagProvider + JWT migration) sonrası |
| v1.8 | (planlanan) | Legacy view porto serisi sonrası |

---

# Appendix C — Slice 3 (Bug-RENDER-01) Retrospektifi

Faz 2'nin ilk slice'ı. Probe-gated 2-parça yapı (3a + GATE + 3b). Kaynak: `phase2_slice3a_handover.md`, `phase2_slice3b_handover.md`, `bug_render_01_slice3b_discovery.md`, `bug_render_01_slice3b_audit.md`.

## C.1 — Bug + Atıf Zinciri

**Belirti:** Model A → Model B switch sonrası, A'nın node'ları (`behavior__On_entry_activation`, `behavior__Normal_entry_checkPowerSource`) DOM'da kalıyor, container dışında floating (y=795). Sessiz (console error yok).

**Atıf turu (toplam: ilk discovery + 3 tur + 2 gate):**
1. İlk discovery (inline) → Defect #3 (interaction state cleanup)
2. Re-discovery → Defect #1 (ELK race) + #2 (WS out-of-order) — **ikisi de sonradan çürütüldü**
3. Runtime probe (headless WS) → #2 ✗ refuted, atıf client-side'a
4. 3a GATE (Tarayıcı re-probe, `data-node-id`) → CP-4: S4 karma defect, primary = React reconciliation/unmount
5. 3b W1 discovery → CP-4 etiketini sorguya açtı (ağaç-içi mekanizma yok), (a)/(b) honest-gap
6. 3b Tarayıcı disambiguation probe → **(c2) React keyed-reconciliation leftover** ✓ (stale `<g>` `data-node-id` taşıyor = React-rendered, prop clean B)
7. 3b W2 audit → fix = model-identity remount (Option C)

## C.2 — Fix (`a7e9eb9`)

- **W2:** `<DiagramViewer key={fileId:viewType}>` (EditorPage) + `key={taskIndex}` (TrainingPage) → switch'te full unmount/remount, leftover `<g>` sökülür.
- **W3:** interaction state reset (multiSelect/selectionRect/contextMenu/hover + parent selection).
- **W4:** RTL harness (`@testing-library/react` + mock-model).
- **W5:** web-client 128→132.
- **Verification:** Tarayıcı prod re-probe staleIds=0. **RTL testleri W2'yi sınamaz** (parent `key=`, izole mount egzersiz etmez) — clean-reconciliation baseline'ını guard'lar; W2'nin asıl kanıtı prod probe (bug RTL-reproducible değil, multi-frame async).

## C.3 — Process Dersleri (→ §5.5, §9.4, §10.3 #21, §10.5)

- **Anti-pattern #21, 5 tetiklenme:** 3 katman (sub-agent, kendi önceki tur, checkpoint atfı). Her seferinde verification disipline'i yakaladı. (§10.3 #21 detay tablosu.)
- **Backend-AG vs Browser-Tarayıcı rol ayrımı:** Atıf iki domain'in birleşmesiyle yakınsadı — AG server'ı temizledi (WS in-order), Tarayıcı client leftover'ı kanıtladı. (§5.5)
- **Honest-gap (🔍):** W1, (a)/(b) ayrımını statik okuyamadı; hipotez kurmadı, probe spec yazdı. (§10.5 Pattern A)
- **Probe-gated slice:** infra ship (3a) → gate → atfa-dayalı fix (3b). Tahmine dayalı fix'ten kaçınıldı. (§10.5 Pattern C)
- **Render kanalı düzeltmesi:** "WS veya SSE" yanlıştı; render her zaman WS, SSE file-change. (§5.2)

## C.4 — Kapanış Durumu (2026-05-26)

- HEAD `a7e9eb9`, lokal == origin == **prod** (Architect re-verified; eski handover'ların "prod=ac3d6a4/08f0751" notu stale'di).
- Counter `state-machine.new: 2135`, fallback 0; PM2 diagram ↺=0 ~38h.
- Bug-RENDER-01 = **KAPALI**. Sıradaki candidate: **Security B1 + B3** (PII leak + wrong-password 401).
