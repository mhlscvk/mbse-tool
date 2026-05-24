# Faz 1 Brief v1.3 — Canonical Operational Notes

**Versiyon:** v1.3 (Slice 2d.1 sonrası, gelecek slice'lar için canonical referans)
**Tarih:** 2026-05-24
**Author:** Architect Claude
**Önceki sürümler:** v1.0 (Faz 1 ilk brief), v1.1 (Slice 2c eklemeleri), v1.2 (Slice 2d.1 narrative)
**Çapraz referans:** `phase1_slice2d1_handover.md`, `renderer_refactor_strategy_v2.md`, `docs/adr/005-state-machine-renderer.md`

---

## Amaç

Bu doc **canonical operasyonel prosedürler ve pattern kataloğu**. Slice 2d.1'in lessons learned'ları burada **direkt uygulanabilir komutlar ve kurallar** olarak duruyor. Gelecek slice'larda (2d.2, 2d.3, 2e, Faz 2) AG ve Architect bu doc'a referans verecek.

**Lifecycle:** Sürekli güncelleme. Yeni slice'larda yeni pattern öğrenildikçe v1.4, v1.5 olarak iterasyon. v1.2 (tarihsel narrative) sabit, v1.3 (canonical) yaşayan dokümantasyon.

---

## 1. Test Sayım — Root vs Pre-commit Hook

**Önemli ayrım:**

```
root pnpm test  = api-server + diagram-service       = 340 + 663 = 1003
pre-commit hook = api + diagram + web-client         = 340 + 663 + 128 = 1131
```

**Kullanım:**
- **Lokal hızlı test:** `pnpm test` (1003) — geliştirme döngüsünde yeterli
- **Commit öncesi tam coverage:** Pre-commit hook otomatik (1131) — web-client da dahil
- **Production deploy öncesi:** Pre-commit hook ZORUNLU. Web-client'i atlamak frontend regression riski

**Brief yazımı:** "1131 yeşil" derken pre-commit hook kastediliyor. "1003 yeşil" derken manuel `pnpm test`.

**Sayım değişirse:** Yeni test eklenince bu doc güncellenmeli (v1.4, v1.5...).

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

**Auth:** Yok (internal endpoint, host-only erişim)

**Admin endpoint (`/api/admin/renderer-stats`):** Bearer token ister, browser session'dan erişilemez. Internal endpoint dogfood için yeterli.

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

---

## 5. Self-Dogfood Disipline

### 5.1 Üçlü orchestration

| Kanal | Sorumluluk |
|-------|-----------|
| 🖥️ **Tarayıcı Claude** | Browser UI: WS panel inceleme, görsel doğrulama, screenshot, DOM analizi |
| 👁️ **AG (backend)** | Log snapshot polling, monitor (background grep), counter sorgu |
| 🧭 **Architect** | Kanıt üçgenini değerlendirme, karar (flip / rollback / şüphe → ek inceleme) |

### 5.2 Tarayıcı Claude için canonical akış

Bkz. `tarayici_claude_dogfood_brief.md` template. Özet:
1. systemodel.com login + DevTools (Network → **WS filtresi**, Console, Elements)
2. Proje + dosya aç + view sekmesi seç → WS connect tetikler
3. WS Messages frame'leri incele → server response `rendererUsed` ara
4. Console error/warn ara
5. Görsel kontrol (multi-root, nested, compartments, transitions, pseudo-states)
6. Screenshot
7. Counter sorgu (`/internal/renderer-stats`)
8. Raporlama: kanıt-temelli ham, hipotez yok

**Kritik kurallar:**
- WS panel (Network tab → WS filter) — XHR/Fetch'te diagram trafiği YOK
- Hipotez kurma, kanıt topla
- DevTools panel açılamazsa fallback: WebSocket.prototype.send monkey-patch + DOM analizi (Slice 2d.1'de Tarayıcı Claude'un yaptığı)

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

| Kaynak | Pozitif sinyal |
|--------|---------------|
| 🖥️ Tarayıcı | Görsel temiz, 0 console error |
| 👁️ Counter | `<view>.new` arttı, `old-fallback-from-new` ARTMADI |
| 👁️ Log + monitor | Sessiz veya sadece startup banner, `[Wedge] threw` YOK |

**Tek kanal yetmez:**
- Görsel temiz olabilir AMA legacy fallback ise → tehlikeli yanılgı. Counter ground-truth dili.
- Counter `new` artmış olabilir AMA görsel broken ise → renderer çalışıyor ama yanlış output. Görsel doğrulama şart.
- Log sessiz olabilir AMA görsel veya counter problemli → render-time vs startup-time hata ayrımı.

**Üçü hizalı → flip onayı. Biri eksik → ek inceleme.**

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

---

## 7. Karar Noktası Tabanlı Checkpoint (Yeni Pattern)

### 7.1 Sorun (Slice 2d.1'den)

Slice 2d.1'de toplam ~16 checkpoint vardı, ~10'u gereksizdi. Özellikle F.1-F.8 her komut için ayrı onay aldı.

### 7.2 Yeni pattern

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

### 7.4 Hedef checkpoint sayıları

| Slice türü | Hedef |
|-----------|-------|
| Hotfix (Slice 2d.1 gibi) | 5-7 |
| Feature slice (Slice 2d.2 gibi) | 7-10 |
| Major refactor | 10-15 |
| Mimari değişiklik | 15+ ama paketle |

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

### 8.3 Brief revision pattern

| Sebep | Versiyon |
|-------|----------|
| Discovery raporu sonrası ilk taslak | v1.0 |
| Discovery sonrası design simplification | v1.1 |
| Ampirik bulgu sonrası tasarım revize | v1.X+1 |
| Slice close-out narrative | v1.X+1 (final) |

Slice 2d.1: v1.0 → v1.1 → v1.2 (close-out). Bu pattern gelecek slice'larda tekrarlanacak.

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
- [ ] Açık konular (sonraki slice candidate'ları)
- [ ] Kod path'leri (gelecek slice'lar için)
- [ ] Operasyonel detaylar (yeni canonical pattern'ler)

**Architect handover'da olmalı:**
- [ ] Operating model (Three-Claude)
- [ ] Refactor genel mimarisi
- [ ] Bugünün özeti
- [ ] Lessons learned
- [ ] Açık konular + öncelik analizi
- [ ] Önemli dosyalar (brief'ler, ADR'ler, kod)
- [ ] Operasyonel gotcha'lar
- [ ] Kişisel bağlam (Platform Owner)
- [ ] İlk yapılacaklar (yeni Architect'in adımları)

---

## 10. Anti-Patterns Kataloğu

Slice 2d.1 ve önceki slice'lardan biriken anti-pattern'ler. Brief yazımı ve implementation sırasında kontrol listesi.

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
| 13 | Brief tasarım iddiası ampirik test olmadan | "HİPOTEZ" etiketi + Adım 0'da ampirik doğrulama |
| 14 | Her komut için ayrı checkpoint | Karar noktası tabanlı, komut paketi halinde |
| 15 | Scope creep (UX defekti hotfix'e dahil) | Backlog'a, scope cleanliness |
| 16 | Browser self-dogfood'da XHR/Fetch tab | WS tab (backend WS üzerinden konuşuyor) |
| 17 | Görsel doğrulamayı tek başına yeterli sayma | Kanıt üçgeni (görsel + counter + log) |
| 18 | Hipotez kurma ("muhtemelen X") | Kanıt-temelli ham rapor, hipotez yok |

---

## 11. Kod Path'leri (Quick Reference)

### State machine pipeline

| Path | Sorumluluk | Slice 2d.1'de değişti? |
|------|-----------|----------------------|
| `packages/diagram-service/src/rendering/state-machine/transformer.ts` | AST → IR transformation | ✓ (multi-seed, qname walk, defense guards) |
| `packages/diagram-service/src/rendering/state-machine/renderer.ts` | IR → SModelRoot | ✗ (multi-root tüketim zaten vardı `:284-292`) |
| `packages/diagram-service/src/rendering/state-machine/index.ts` | Barrel + registration | ✗ |
| `packages/diagram-service/src/rendering/state-machine/types.ts` | IR şeması | ✗ |
| `packages/diagram-service/src/rendering/state-machine/transformer.test.ts` | Unit tests | ✓ (+6 multi-root) |
| `packages/diagram-service/src/rendering/state-machine/end-to-end.test.ts` | E2E tests | ✓ (+2 multi-root) |
| `packages/diagram-service/src/rendering/state-machine/parser-state-machine-integration.test.ts` | Parser integration | ✗ |

### Strangler-fig + counter

| Path | Sorumluluk |
|------|-----------|
| `packages/diagram-service/src/rendering/pipeline.ts:95-109` | Wedge try/catch (Slice 2d.2'de dokunulacak: applyViewFilter) |
| `packages/diagram-service/src/rendering/feature-flags.ts:30` | Flag mantığı (`FF_*` template) |
| `packages/diagram-service/src/rendering/renderer-stats.ts` | Counter (in-memory, `/internal/renderer-stats` endpoint) |
| `packages/diagram-service/src/rendering/view-type-mapper.ts` | View type → IR mapping |
| `packages/diagram-service/src/rendering/view-registry.ts` | Lazy renderer loader |
| `packages/diagram-service/src/rendering/wedge.ts` (veya pipeline) | Strangler-fig fallback logic |

### Transformer/filter shared

| Path | Sorumluluk |
|------|-----------|
| `packages/diagram-service/src/transformer/view-filters.ts` | `filterStateTransitionView`, `applyViewFilter` (Slice 2d.2'de pipeline'a eklenecek) |
| `packages/diagram-service/src/transformer/bdd-transformer.ts:616` | Legacy filter call (Slice 2d.2'de kaldırılacak) |
| `packages/diagram-service/src/parser/sysml-text-parser.ts` | SysML v2 text → AST |

### Fixture'lar

| Path | İçerik |
|------|--------|
| `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/model.sysml` | Eski fixture (izole `state def`, yanlış pattern ama testler geçiyor) |
| `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-ir.json` | Frozen snapshot (Slice 2d.2'de regen edilecek filter integration sonrası) |
| `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-smodel.json` | Frozen snapshot |
| `packages/diagram-service/tests/fixtures/state-machine/multi-root-part-states/model.sysml` | Yeni anonim fixture (Slice 2d.1) |
| `packages/diagram-service/tests/fixtures/state-machine/multi-root-part-states/expected-*.json` | Yeni frozen snapshot |

### Production

| Path | Sorumluluk |
|------|-----------|
| `/opt/systemodel` | Repo root |
| `/root/.pm2/logs/diagram-*.log` | PM2 log dosyaları |
| `ecosystem.config.cjs` | PM2 process config (env burada, Slice 2d.1'de FF eklendi) |

---

## 12. ADR İlişkileri

**ADR-005 (state-machine-renderer):**
- D1: Translation policy (SysML v2 keyword verbatim)
- §6: AST stability guarantee
- §7: Layout determinism (snapshot regen güvenli)
- (Slice 2d.2 ekleyecek): D-FILTER-01 — filter integration trade-off, pseudo-state remap kararı

**Slice 2d.2'de yapılacak ADR güncellemesi (önceden not):**
- `applyViewFilter` pipeline-level uygulanması
- `pseudo-initial__on` siliniyor (entry action varsa start→entry remap)
- Görsel davranış değişikliği kabul edilir mi? — Platform Owner kararı

---

## 13. Update Log

| Versiyon | Tarih | Değişiklik |
|----------|-------|-----------|
| v1.0 | Faz 1 başı | İlk Faz 1 brief |
| v1.1 | Slice 2c sonrası | Slice 2 eklemeleri |
| v1.2 | Slice 2d.1 sonrası | Slice 2d.1 narrative (tarihsel) |
| **v1.3** | **2026-05-24** | **Canonical ops notes (bu doc)** |
| v1.4 | (planlanan) | Slice 2d.2 sonrası: filter integration prosedürü, snapshot regen, ADR D-FILTER-01 |
| v1.5 | (planlanan) | Slice 2d.3 sonrası: container labels pattern (3 yaklaşımdan seçilen) |
| v1.6 | (planlanan) | Faz 1 Final Report sonrası: Faz 2 hazırlık notları |
