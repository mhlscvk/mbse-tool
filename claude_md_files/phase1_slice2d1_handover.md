# Faz 1 Slice 2d.1 — Close-Out & Continuation Handover

**Son güncelleme:** 2026-05-23 (Slice 2d.1 KAPALI, global flip permanent, production stable)
**Branş:** master
**HEAD:** `2217c0e` (global flip commit, push edildi)
**Production HEAD:** `2217c0e` ✓ (prod ve master aynı noktada)
**Önceki handover:** `claude_md_files/phase1_slice2d_status.md` (Slice 2d crash + reproduce + hotfix scope)

---

## 1. TL;DR — Slice 2d.1 KAPALI

Slice 2d crash (`transformer.ts:206`, multi-root model üzerinde `find()!` yalan söylüyordu) çözüldü. Multi-seed root-finding + qualifiedName walk fix + defense guards + anonim multi-root fixture eklendi. Production'a deploy edildi, self-dogfood temiz (counter `state-machine.new:6, fallback:0`, görsel multi-root render kanıtı), permanent global flip yapıldı (ecosystem.config.cjs).

**Production durumu:** Sağlıklı. State-machine yeni renderer **globally enabled** (config-driven). Counter restart sonrası sıfır baseline, monitor sessiz, smoke 200/200.

**Sonraki adım:** Architect karar verecek — Slice 2d.2 (view-filter integration) mi, Slice 2d.3 (container labels, Bug-RENDER-02) mi, yoksa brief v1.2 + Faz 1 final report mı önce.

---

## 2. Bugün (2026-05-23) Yapılanlar

### Commits (master, push edildi)

```
2217c0e  Phase 1 Slice 2d.1: enable state-machine new renderer globally (ecosystem.config.cjs)
cdd05ef  Phase 1 Slice 2d.1: add multi-root-part-states fixture + transformer/e2e tests
c7d3185  Phase 1 Slice 2d.1: multi-seed root-finding in transformer (raw model)
b35d9ad  Phase 1 Slice 2d.1: defense guards in transformer (no behavior change)
74247fa  Phase 1 Slice 2d status: self-dogfood reproduce + root cause (dün, devir öncesi)
```

### Adımlar (sıra)

**Adım 0 — Discovery (AG raporu Architect brief v1.0 → v1.1'i şekillendirdi):**
- `view-filters.ts:filterStateTransitionView` — flat `{nodes, connections}` döndürüyor, root kavramı yok
- `transformer.ts:162-220` + `:306-308` — üç `find()!` aynı kök varsayıma bağlı (StateDefinition var seed)
- **Renderer ZATEN multi-root** (`renderer.ts:284-292` `containedSet` mantığı) — IR şemasına `roots` eklemeye gerek yok

**Adım 1 — Defense guards (`b35d9ad`):** İki `find()!` → guard'lı `find()` + null check, boş IR no-op log. Davranış-değişmez.

**Adım 2 — Anonim fixture:** `tests/fixtures/state-machine/multi-root-part-states/model.sysml` (35 satır, anonim isimler, multi-root pattern, parse-clean). Architect review onayıyla eklendi.

**Adım 3 — Sürpriz + karar:** Brief v1.1 §4 "filter integration zorunlu" iddiası ampirik test edilince yanlış çıktı:
- Filter sensor-systems'in `pseudo-initial__on`'unu siliyor → frozen snapshot bozulurdu (legacy davranış değişikliği)
- Multi-seed **ham model** üzerinde de çalışıyor (transformer non-state node'ları zaten ignore ediyor)
- Architect karar: **A (raw multi-seed) bu slice, B (filter integration) Slice 2d.2'ye ertelendi**

**Adım 3a (`c7d3185`) — Multi-seed root-finding (raw model):**
- `isStateLike` predicate eklendi (`StateUsage | StateDefinition | ExhibitStateUsage`)
- Seed: `model.nodes.filter(n => isStateLike(n) && !isStateLike(parent))` → her top-level state container için `emitContainer`
- qualifiedName walk: "Package'a kadar yürü" → "ilk non-state ata'da dur" (`while (current && isStateLike(current))`)
- `findTopLevelStates` helper INLINE (utils.ts'e çıkarılmadı — premature abstraction kararı, gerekçeli)
- Renderer'a dokunulmadı

**Adım 3b — Fixture tests (`cdd05ef`):** +9 test (transformer multi-root 6, e2e 2, empty-model edge 1). `expected-ir.json` + `expected-smodel.json` deterministic üretildi.

**Adım 4-6 — Test suite + lint + push:**
- 1003 → 1131 test yeşil (root pnpm test 340+663; pre-commit hook web-client 128 dahil = 1131)
- Mevcut frozen snapshot byte-identical (zero regression)
- master push: `74247fa → cdd05ef`

**Aşama 2 — Production deploy (manuel flag):**
- prod pull `9b43279 → cdd05ef` fast-forward
- per-package build (turbo değil, brief §10.2): 4/4 EXIT=0, sıfır TS hatası
- PM2 reset: `pm2 delete diagram && FF_STATE_MACHINE_NEW_RENDERER=true pm2 start ecosystem.config.cjs --only diagram --update-env`
- `/proc/<pid>/environ` ground-truth: `FF_STATE_MACHINE_NEW_RENDERER=true` ✓
- Smoke 200/200, log temiz (stale `[Wedge] threw` izleri forensic ile elendi)

**Aşama 3-4 — Self-dogfood:**
- Tarayıcı Claude: görsel multi-root teyit (2 makine yan yana, nested hierarchy, compartments, transitions, pseudo-states, 0 console error)
- AG backend polling: log sessiz, monitor `bt5pstsou` hiç tetiklenmedi
- Counter: `state-machine.new:6, fallback:0` ← belirleyici kanıt

**Aşama 5 — Permanent flip (F.1-F.8):**
- `ecosystem.config.cjs` edit: `diagram.env.FF_STATE_MACHINE_NEW_RENDERER: 'true'` (+3 satır, açıklamayla)
- Commit `2217c0e`, push
- Prod pull `cdd05ef → 2217c0e`
- PM2 restart **komut satırında FF YOK** — config'den env yüklemesi
- `/proc/2488090/environ`: `FF_STATE_MACHINE_NEW_RENDERER=true + NODE_ENV=production` cross-check ✓
- Smoke 200/200, counter sıfırlandı (`{totalRenders:0}`, beklenen)
- Monitor `bt5pstsou` kapatıldı (TaskStop)

**Sonuç:** Slice 2d.1 KAPALI. Production'da yeni state-machine renderer **globally enabled, config-driven, permanent**.

---

## 3. Yeni Kazanılan Operasyonel Bilgi (Brief v1.3 İçin)

### Test sayım ayrımı
- **Root `pnpm test`** = `api-server && diagram-service` = 340 + 663 = **1003**
- **Pre-commit hook** = api-server + diagram-service + web-client = 340 + 663 + 128 = **1131**
- Brief'lerde "1131 yeşil" derken pre-commit hook kastediliyor. Manuel komut satırı verifikasyonu 1003 ama complete coverage için hook gerekir.

### Stale-log forensic anti-pattern
PM2 log dosyaları truncate edilmiyor — eski instance'ın hataları yeni instance'ın log'unda görünebilir. Rollback DUR koşulu görüldüğünde **otomatik rollback YAPMA**, önce cross-reference:
- `pm2 jlist | jq` ile `pm_uptime` (current process start time)
- `stat -c %Y` ile log dosyası mtime
- `out.log` içindeki "Service running" startup banner'larını say (her restart bir tane ekler)
- Eğer error log tarihçesindeyse (current process'in start time'ından önce) → STALE, rollback gereksiz

Bugün bu pattern reflexif rollback'i önledi. Brief v1.3'e ekle.

### PM2 env doğrulama (canonical)
```bash
cat /proc/$(pm2 pid <app>)/environ | tr "\0" "\n" | grep -E "FF_|NODE_ENV"
```
`pm2 env <app>` **kullanma** — false-negative riski. Cross-check için FF + NODE_ENV birlikte doğrula (env-loading'in tüm section'u aldığı kanıtı).

### Per-package build (canonical)
```bash
cd packages/shared-types && pnpm build
cd packages/api-server && npx tsc || true   # pre-existing TS errors tolerated
cd packages/diagram-service && pnpm build
cd packages/web-client && pnpm build
```
`pnpm build` (turbo) production'da api-server'da HALT eder. Per-package + tsc-tolerate disiplini şart.

### Git delivery (canonical)
```bash
git push origin master          # NOT deploy.sh (stale config + git add -A)
# prod:
git pull origin master          # NOT manuel branch checkout
```

### PM2 restart (kullanıcı-etkili)
```bash
pm2 delete <app> && pm2 start ecosystem.config.cjs --only <app>
# NOT pm2 restart (cache-lenen --update-env'i korur)
```

### Counter endpoint
`/internal/renderer-stats` (auth-free, internal access). Admin endpoint `/api/admin/renderer-stats` Bearer token istiyor (browser session'dan erişilemez).

---

## 4. Açık Konular (Backlog, Yarın Karar)

### Slice 2d.2 — View-filter integration
**Scope:**
- `pipeline.ts:95` öncesi `applyViewFilter(model, viewType)` çağrısı ekle
- `bdd-transformer.ts:616` legacy filter call'u kaldır (double-filter önle)
- `sensor-systems/expected-ir.json` + `expected-smodel.json` yeniden üret (filter sonrası output)
- Görsel parite analizi: filter `pseudo-initial__on`'u siliyor (start→entry remap, On has entry action)
- ADR-005'te yeni karar belgele (D-FILTER-01 gibi) — filter'ın STV semantic'ine etkisi

**Risk:** Görsel davranış değişikliği — kullanıcı algısı değişikliği. Muhlis (Platform Owner) onaylamadan implementasyon başlamaz.

**Tahmini süre:** 2-3 saat impl + 1 saat dogfood

### Bug-RENDER-02 (Slice 2d.3 candidate) — Multi-root container labels
**Detaylı not:** Architect tarafında (`bug_render_02_container_labels.md`, henüz repo'da değil; Architect yarın brief'lere referans verecek)

**Özet:** Multi-root render'da `SensorSystemStates` / `DeliverSSStates` isimleri diagram'da görünmüyor — sadece içerideki state isimleri var. Kullanıcı "hangi 'On' hangi sisteme ait" anlayamıyor.

**Root cause:** Step 3a tasarımının doğal sonucu — top-level container state'leri "state def" rolü oynuyor, node olarak çizilmiyor. Pre-fix tek-root durumda gizliydi, multi-root görünür yaptı.

**3 yaklaşım (Slice 2d.3'te keşif):**
- A: Renderer-side group label (IR'a yeni node tipi)
- B: Wedge-side multiple diagrams (tabs/split view)
- C: Frontend-side visual grouping (label + dashed border, IR dokunulmadan)

Karar AG keşif + Architect onay döngüsünde.

### Diğer backlog
- **Bug-RENDER-01:** Frontend state cleanup on model switch (önceki backlog)
- **Brief v1.2:** Slice 2d.1 close-out (filter integration ertelendi notu, hikayeyi doğru anlat)
- **Brief v1.3:** Operasyonel notlar canonical (yukarıdaki §3)
- **Faz 1 Final Report:** Slice 2d.1 + global flip sonrası, Faz 2 hazırlığı için
- **Slice 2e (Faz 1.1):** WS auth + HierarchicalFlagProvider, per-user dogfood
- **Security B1/B2/B3:** Post-Faz 1

---

## 5. Disipline Pattern Olgunlukları (Lessons Learned)

1. **"Brief tasarım iddiası ampirik test edilene kadar HİPOTEZ":** v1.1 §4 "filter integration zorunlu" iddiası yanlıştı (sensor-systems'i bozardı). AG ampirik testte yakaladı. Architect bunu brief'lere açıkça yazsın — discovery raporu **tasarım** değil, **veri**. Tasarım kararı ampirik doğrulama gerektirir.

2. **Stale-log forensic:** Rollback DUR koşulu görüldüğünde reflexif aksiyon YAPMA. Process start time + log mtime + restart history cross-reference zorunlu. Bugünkü yanlış rollback önlendi.

3. **PM2 env ground-truth:** `/proc/<pid>/environ` canonical, `pm2 env` false-negative riski.

4. **Counter = ortak ground-truth dili:** Three-Claude orchestration'da sayısal kanıt görsel kanıttan daha güçlü (görsel "legacy fallback" da temiz görünebilir; counter `old-fallback-from-new` artarsa hotfix başarısız).

5. **Scope cleanliness:** UX defekti (Bug-RENDER-02) hotfix sırasında değil, backlog'a. Scope creep yok. Yorgunluk yönetimi disipline'in parçası.

6. **Checkpoint sayısı azaltma (yarın için):** Slice 2d.1'de 16+ checkpoint vardı, ~10'u gereksiz friction'dı. Yarın 2d.2+'da **karar noktası tabanlı checkpoint** — komut paketleri halinde, AG'ye "sürpriz olursa zaten dur" yetkisi. Architect handover'ında detay var.

---

## 6. Yarın AG'nin İlk Yapacakları

1. **Bu handover'ı oku** (otomatik, repo'da). Slice 2d.1 close-out + açık konular + lessons learned burada.
2. `git log --oneline -10` — HEAD `2217c0e` veya yarın commit edilecek status doc/close-out commit'i olmalı.
3. **Architect'in yarın yazacağı brief'i bekle.** Karar: brief v1.2 mi, Slice 2d.2 mi, Slice 2d.3 mi, Faz 1 final report mı önce.
4. Brief gelince başla. İlk dokunulacak kod (slice'a göre):
   - **Brief v1.2/v1.3:** `claude_md_files/`'a yeni dosyalar, kod yok
   - **Slice 2d.2:** `rendering/pipeline.ts:95`, `transformer/bdd-transformer.ts:616`, `tests/fixtures/state-machine/sensor-systems/expected-*.json` (regen), ADR-005 yeni decision
   - **Slice 2d.3:** AG keşfi gerekir (3 yaklaşım), kod scope keşif sonrası netleşir

---

## 7. Pratik Notlar (Yarın Hızlı Erişim)

### Lokal repo durumu (2026-05-23 gece)
- `.claude/settings.local.json` modified (alakasız, sürekli değişiyor)
- Untracked: `claude_md_files/architect_context_handover_2026-05-23.md` + diğer Architect-tarafı brief'ler (Architect yarın kullanacak)
- HEAD: `2217c0e`

### Production durumu (2026-05-23 gece)
- HEAD: `2217c0e`
- pm2: api (12h) + lsp (12h) + diagram (pid 2488090, uptime 2m+, online, ↺=0)
- Env: `FF_STATE_MACHINE_NEW_RENDERER=true` config-driven ✓
- Counter: `{totalRenders:0}` (flip baseline, restart sonrası sıfır)
- Monitor: kapalı (manuel başlatılabilir)

### Önemli dosyalar (Slice 2d.2/2d.3 implementasyonu için)

**Slice 2d.2 (view-filter integration):**
- `packages/diagram-service/src/rendering/pipeline.ts:95-109` (wedge try/catch)
- `packages/diagram-service/src/transformer/view-filters.ts` (`applyViewFilter`, `filterStateTransitionView`)
- `packages/diagram-service/src/transformer/bdd-transformer.ts:616` (legacy filter call kaldırılacak)
- `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-ir.json`
- `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-smodel.json`
- `docs/adr/005-state-machine-renderer.md` (yeni decision)

**Slice 2d.3 (container labels, Bug-RENDER-02):**
- `packages/diagram-service/src/rendering/state-machine/transformer.ts` (top-level seed mantığı)
- `packages/diagram-service/src/rendering/state-machine/renderer.ts` (eğer Yaklaşım A: yeni IR node tipi tüketimi)
- `packages/diagram-service/src/rendering/state-machine/types.ts` (IR şeması, eğer A)
- AG keşif sonrası netleşir
