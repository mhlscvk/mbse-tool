# Phase 2 — Slice 3b Brief v1.0

**Slice ID:** Slice 3b (Bug-RENDER-01 — probe-gated, Part 2 of 2)
**Tarih:** 2026-05-27
**Önceki:** Slice 3a Handover (`phase2_slice3a_handover.md`, HEAD `813c7a0`)
**Baseline HEAD:** `813c7a0` (lokal == prod, doc-only sync)
**CP-4 atfı (3a kapanışından):** S4 karma defect, primary = React reconciliation / unmount path eksikliği

---

## §1 — Scope + Atıf Özeti

### 1.1 Slice 3b Kapsamı (Ship Path)

| Work Item | Açıklama | Kaynak | Bağımlılık |
|-----------|----------|--------|-----------|
| **W1** | Discovery: stale node `<g>` reconciliation/unmount kök neden atfı (kod kanıtla) | 3a CP-4 (DOM atıf), Tarayıcı raporu | Hiçbir şeye bağlı değil — ilk adım |
| **W2** | Primary fix: stale persist eliminasyonu (tasarım W1 sonucuna göre) | W1 | W1 |
| **W3** | Defect #3 fix: interaction state cleanup (`multiSelectedNodeIds` + parent `diagramSelectedNodeId/EdgeId`) | İlk Discovery (inline, 3a handover §6) | Bağımsız ama aynı kod path'i (DiagramViewer cleanup effect) |
| **W4** | RTL harness kurulumu: `@testing-library/react` + ilk component-mount test | 3a accepted deviation | Bağımsız (paralel) |
| **W5** | Regression test'ler: W2 + W3 için | W2, W3, W4 | W2 + W3 + W4 (test infra) |
| **W6** | Brief v1.5 tam sürüm yazımı (Architect) | 3a brief Appendix A + bu brief Appendix B (saga) | 3b close-out sonrası |

### 1.2 Scope Dışı (Backlog'a Devir veya Discovery Kararı)

| Item | Karar yolu | Etiket |
|------|-----------|--------|
| **Orphan SVG root birikimi** (`totalSvgs: 5`, 3a CP-4 yan bulgu) | W1 Discovery'de: eğer aynı kök nedene bağlıysa W2 scope'una alınır; değilse 3c backlog | 🔍 partial |
| **sizeOverrides/positionOverrides asimetrisi** | W1 Discovery'de niyet teyit (bug mı kasıt mı): bug ise W2'ye, kasıt ise comment/doc fix | 🔍 partial |
| **R2 autosave handleChange stale closure** | W1 Discovery'de Monaco onChange semantiği teyit; risk doğrulanırsa W2 scope'una, değilse backlog | ⚠️ assumed |
| **Edge identity (`data-edge-id`)** | 3a DP-3a-1'de ertelenmişti; W2 fix verification için gerekirse W2 öncesi mini-task; gerekmiyorsa backlog | bağımlı (W1 sonucu) |
| **Bug-PRISMA-01** (`seed-examples.*` untracked artifact) | Brief v1.4 §3.3 piggyback; 3b deploy'unda dokunulursa eklenir | piggyback candidate |

---

## §2 — Discovery Girdileri

### 2.1 Slice 3a CP-4 Atıf Çıktısı (Tarayıcı re-probe, `08f0751`)

DOM-PRIMARY metodoloji ile elde edilen kanıt:

**Gerçek stale id'ler (✓ verified @ `08f0751`):**
- `behavior__On_entry_activation` — Model A'nın `On` state'inin entry action'ı, Model B'de yok
- `behavior__Normal_entry_checkPowerSource` — Model A'nın `Normal` state'inin entry action'ı, Model B'de yok

**False-stale (name collision artefakt'ları):**
- `state__Normal`, `state__Degraded` — her iki modelde de var, reconciliation re-use ediyor (gerçek bug değil, ama **reconciliation mekanizmasını anlamak için kritik gözlem**)

**Floating bbox:** Stale node'lar container dışında (y=795 vs container bottom 650) — ELK yeniden layout etmediği için eski koordinatlarda kalıyorlar. ELK guard (`:820`) doğru çalışıyor; floating, reconciliation kalıntısının yan etkisi.

**Yan bulgu:** `totalSvgs: 5` (PRE 2 idi) — orphan SVG root birikimi.

### 2.2 İlk Discovery'den Devreden (Defect #3, inline, `ac3d6a4`)

| State | Owner | Switch'te reset? |
|-------|-------|------------------|
| `multiSelectedNodeIds` | DiagramViewer-local | ✗ (kullanıcı çoklu-seçim yaptıktan sonra switch yaparsa stale kalır) |
| `selectionRect` | DiagramViewer-local | ✗ (transient) |
| `contextMenu` | DiagramViewer-local | ✗ (transient) |
| `hoveredNodeId` | DiagramViewer-local | ✗ (transient) |
| `diagramSelectedNodeId/EdgeId` | EditorPage-local (`:99`) | ✗ — setter sadece `:1156` callback'inde, reset çağrısı yok |

**Not:** İnternal `selectedNodeId/EdgeId` (DiagramViewer-local `:455-456`) parent-controlled olduğu için **moot** (display-dormant) — fix kapsamı dışı.

### 2.3 Re-discovery R1-R4'ten Hayatta Kalan Bulgular

| Bulgu | Durum |
|-------|-------|
| **R1 Defect #1 (ELK race)** | ✗ Çürütüldü (CP-1: guard `:820` mevcut) |
| **R1 Defect #2 (WS no-correlation out-of-order)** | ✗ Çürütüldü (runtime probe: in-order responses) |
| **R1 yapısal `uri` echo eksikliği** | ✓ verified ama latent — reconnect-replay senaryosu açık (3b'de değerlendirilebilir, scope'a girmiyor) |
| **R2 autosave guard** | ⚠️ assumed — W1 Discovery'de doğrulanacak |
| **R3 `data-node-id` yokluğu** | ✓ Çözüldü (Slice 3a W1) |
| **R4 render kanalı WS (SSE değil)** | ✓ verified — Brief v1.5 §5.2/§6 düzeltmesi (3a brief Appendix A.1) |

---

## §3 — Work Item'lar Detayı

### §3.1 — W1: Discovery (Reconciliation/Unmount Kök Nedeni)

**Hedef:** Tarayıcı'nın gözlemlediği "keyed render'a rağmen stale `<g>` DOM'da kalıyor" davranışının **kod-tarafı mekanizmasını** kanıt zinciriyle haritalandır. Hipotez listeli, her biri ✓/⚠️/🔍 etiketle elemiş veya doğrulanmış olarak rapor edilmeli.

#### Hipotez aday listesi (AG her birini kod-okuma ile değerlendirecek):

**H1 — Çoklu render path:**
`renderNodes.map` (~`:2127+`) tek render path mı, yoksa nested children için ayrı bir render branch'i (compound states için child node'lar) var mı? Eğer iki render path varsa, biri `model.children`'dan beslenirken diğeri başka bir kaynaktan (ör. eski `positions` Map'inden, layout sonucundan, vb.) beslenebilir → stale collection.

**H2 — Render-input collection stale:**
`renderNodes.map`'in çağrıldığı collection (`nodes` mu, `allNodes` mu, başka türetilmiş bir Map mı) `model.children`'dan reactive olarak türetiliyor mu? Eğer bir useMemo veya state-cached değer ise, dep array eksik olabilir → eski içerik tutar.

**H3 — Name collision reconciliation:**
React keyed reconciliation `key={node.id}` ile eşleşen node'ları **yeniden kullanır** (unmount etmez). `state__Normal` her iki modelde de var → React `state__Normal` `<g>`'sini unmount yerine props update yapar. Eğer **eski içeriği taşıyan child element'ler** (text label'lar, action box'lar) bu `<g>`'nin child'larıysa ve onlar da kendi key'leri olmadan render ediliyorsa, child reconciliation bozulabilir.

**H4 — Compound child render path:**
State machine'lerde compound state child'ları (`On.Normal`, `On.Degraded`) ayrı bir render branch'ında üretiliyor olabilir. Bu branch'ın input collection'ı `model.children`'dan değil, ELK layout result'ından geliyor olabilir → eski layout result'ı stale child barındırır.

**H5 — Orphan SVG roots (yan bulgu):**
`totalSvgs: 5` (PRE 2) — DiagramViewer her switch'te yeni bir SVG root mu yaratıyor, eskisini unmount etmiyor mu? Eğer evet, neden? (Conditional render flicker, suspense, vb.)

**H6 — Action node ownership:**
Stale node'lar (`behavior__On_entry_activation`, `behavior__Normal_entry_checkPowerSource`) **child** node'lar (parent state'in entry action'ı). Bu node'lar render tree'de parent state'in altında mı, root'ta mı? Parent (`state__On`, `state__Normal`) name collision varsa, child render branch'ı stale parent referansından besleniyor olabilir.

#### Discovery çıktısı

AG, hipotezleri kod-okuma ile elemiş veya doğrulamış olarak rapor edecek. Hedef: **tek bir mekanizma kanıt zinciriyle doğrulanmış** (✓ verified @ `813c7a0`) olarak ayrılsın; diğerleri elenmesin bile değerlendirilmiş olsun. Eğer birden fazla mekanizma katkıda bulunuyorsa, primary + secondary ayrımı net olsun.

**Verification etiketi disipline'i:** Her hipotez için (a) kod referansı (satır numarası), (b) ✓/⚠️/🔍 etiket, (c) sonraki adımın atıfa nasıl bağlandığı.

**Anti-pattern #21 v2 uyarısı (Slice 3 saga'sından):** Kendi önceki tur framing'lerini bile devralma — her hipotezi taze kanıtla.

---

### §3.2 — W2: Primary Fix (Tasarım W1 Sonucuna Göre)

**Hedef:** W1'in atfedilmiş kök nedeni minimum-invaziv şekilde çöz.

#### Olası fix yaklaşımları (Discovery sonucuna göre seçim)

**F1 — Model-scoped key:** Eğer name collision reconciliation kaynaklıysa (H3), `key={node.id}` → `key={`${modelId}__${node.id}`}` veya benzeri prefix. Switch'te tüm key'ler değişir → full unmount → temiz mount. Risk: re-render maliyeti (tüm node'lar her switch'te yeniden mount edilir).

**F2 — Explicit cleanup on model switch:** Model switch'i detect eden ayrı bir effect ekle (örneğin `useEffect(() => { ... }, [model.uri])` veya `model.id`), tüm bağımlı state'leri reset et. Bu, mevcut cleanup effect'in (nodeIdSetKey-keyed, layout-focused) genişletilmesi yerine **ayrı bir model-switch reset hook'u** olabilir.

**F3 — Render path consolidation:** Eğer çoklu render path varsa (H1) veya stale collection besleniyorsa (H2/H4), render tek `model.children` source'una indirgenir. Diğer cached collection'lar (varsa) eliminasyon veya reactive yenileme.

**F4 — Karma:** Yukarıdakilerin kombinasyonu.

#### Tasarım karar noktası

**DP-3b-1:** W1 atıf sonucu hangi F seçeneğini önerirse, Architect onayı alınacak. Bu, brief v1.0'ı revize edebilir (Brief v1.4 §8.3 "Discovery → Brief Revision → Implementation" pattern'i).

#### Verification stratejisi

Post-fix Tarayıcı re-probe (DOM-PRIMARY ile, `data-node-id` mevcut): aynı repro (Model A → Model B switch), `staleIds.length === 0` ve floating bbox yok beklenir.

---

### §3.3 — W3: Defect #3 Fix (Interaction State Cleanup)

**Hedef:** Switch'te DiagramViewer-local ve EditorPage-local interaction state'leri reset et.

#### Tasarım

İki dosya dokunulur:

**`packages/web-client/src/components/Diagram/DiagramViewer.tsx`:**
Mevcut cleanup effect (`:497-505`, layout-focused) ya genişletilir ya yanına ayrı bir interaction-reset effect eklenir:

```ts
// Mevcut (sözde-kod):
useEffect(() => {
  if (prevNodeIdSetKey.current !== nodeIdSetKey) {
    prevNodeIdSetKey.current = nodeIdSetKey;
    setPositions(new Map());
    setIbdSizes(new Map());
    setElkEdgeRoutes(new Map());
    setPositionOverrides(new Map());
  }
}, [nodeIdSetKey]);

// Genişletme:
useEffect(() => {
  if (prevNodeIdSetKey.current !== nodeIdSetKey) {
    prevNodeIdSetKey.current = nodeIdSetKey;
    // Layout reset (mevcut)
    setPositions(new Map());
    setIbdSizes(new Map());
    setElkEdgeRoutes(new Map());
    setPositionOverrides(new Map());
    // Interaction reset (yeni)
    setMultiSelectedNodeIds(new Set());
    setSelectionRect(null);
    setContextMenu(null);
    setHoveredNodeId(null);
  }
}, [nodeIdSetKey]);
```

**Karar Noktası DP-3b-2:** Cleanup effect'in trigger'ı `nodeIdSetKey` (visible node set değişimi). Model switch dışında **view-type switch** veya **hidden-toggle** durumlarında da fire eder. Interaction state'i bu durumlarda da reset etmek istiyor muyuz? Muhtemelen evet (UX tutarlılığı) ama AG kanıt zinciri (kullanıcı senaryosu) ile teyit etmeli. Alternatif: model-switch için ayrı effect, view-type switch için mevcut effect ayrı kalır.

**`packages/web-client/src/pages/EditorPage.tsx`:**
Model switch (file change veya view-type change) detect eden bir effect:

```ts
useEffect(() => {
  setDiagramSelectedNodeId(null);
  setDiagramSelectedEdgeId(null);
}, [fileId, viewType]);
```

veya benzeri. AG Discovery'de hangi dep array'in doğru olduğunu kanıtlayacak (model identity'sinin ne ile değiştiği).

**Karar Noktası DP-3b-3:** `TrainingPage.tsx:573-576` aynı pattern'i kullanıyor (ilk Discovery'de gözlemlendi). Fix oraya da yansıtılmalı mı? AG kontrol edecek.

---

### §3.4 — W4: RTL Harness Kurulumu

**Hedef:** `@testing-library/react` ekle, ilk component-mount testi yaz, gelecek slice'larda kullanılabilir bir test pattern'i kur.

#### Adımlar

1. `pnpm --filter @systemodel/web-client add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event` (eğer jest-dom henüz yoksa)
2. `vitest.config.ts` veya benzeri config'te `globals: true` + setup file (gerekirse `setupFiles: ['./vitest.setup.ts']` ile jest-dom matchers)
3. İlk component-mount test'i — DiagramViewer çok büyük (~2600 satır), bu yüzden ilk test küçük bir component üzerinde olmalı (ör. başka bir basit component) veya doğrudan **DiagramViewer'ı minimal mock ile mount** denemesi. AG **W5 ile uyumlu pattern** seçecek.

#### Risk

- Mock model + ELK layout async → test'lerin fragile olma riski. AG, **synchronous mock veya `waitFor` pattern'i** ile fragility'yi minimize edecek.
- Yeni dependency'ler `pnpm-lock.yaml` değişir → CI'da fresh install gerekir.

**Karar Noktası DP-3b-4:** RTL harness 3b'ye paralel mi (W4 bağımsız iş), yoksa W2/W3 fix sonrası mı? Architect önerisi: **paralel**, W5 (regression test'leri) yazımı W2+W3+W4 tamamlandıktan sonra. AG Discovery turunda effort tahmini verecek.

---

### §3.5 — W5: Regression Test'ler

**Hedef:** W2 fix'i + W3 fix'i için unit test (RTL harness ile).

#### Test senaryoları

**T1 (W2):** Mock model A → mock model B switch, post-switch `[data-node-id]` count'unun yalnızca B'nin node'larıyla eşleştiğini assert et.
**T2 (W2):** Name collision senaryosu — A ve B'de aynı id'li node varken (ör. `state__Normal`), child element'lerin doğru update edildiğini assert et.
**T3 (W3):** `multiSelectedNodeIds` switch'ten önce set, switch sonrası boş olduğunu assert et.
**T4 (W3):** Parent `diagramSelectedNodeId` reset assertion (EditorPage test'i).
**T5 (opsiyonel):** ELK guard regression — büyük model A → küçük model B switch, eski koordinatlarda floating node olmadığını assert et (Defect #1 guard'ın korunduğunu garanti).

#### Yaklaşım

Brief v1.4 §10.4 helper extraction disipline'i: render path'i veya cleanup logic'i mümkün olduğunca saf helper'lara çıkar, unit test'ler helper'ları test eder; component-mount test'leri yalnızca entegrasyon için (mock model fragility'sini minimize için).

---

### §3.6 — W6: Brief v1.5 Tam Sürüm Yazımı (Architect, 3b kapanış)

**Hedef:** Brief v1.4 → v1.5 geçişi. Slice 3 boyunca biriken delta + yeni canonical pattern'ler + anti-pattern #21 ıslahı tam sürüm olarak tek dosyada.

#### İçerik kaynakları

- **3a brief Appendix A** (§A.1 render kanalı düzeltmesi, §A.2 #21 ek örnek, §A.3 kanıt-karşısında-tez-geri-çekme pattern adayı, §A.4 honest-gap işaretleme pattern adayı, §A.5 yazım notu)
- **3a handover §5** (anti-pattern #21 saga'sı, 3 turlu tetiklenme)
- **3a handover §9** (process gözlemleri, backend-AG vs Tarayıcı rol ayrımı)
- **Bu brief Appendix B** (Slice 3b saga'sı, fix tasarım kararları, RTL harness pattern'i)

#### Yapı (3b kapanışında Architect yazar)

Brief v1.4'ün 843 satır iskeletini baz al, aşağıdaki değişikliklerle:

1. **§5.2/§6 render kanalı** düzeltilir (WS only, SSE file-change ayrı kanal)
2. **§7 üçlü orchestration olgunluğu** Slice 3'ten input alır (4 CP, backend/browser rol ayrımı)
3. **§9.4 verification etiketi disipline'i** Slice 3 saga'sı ile örneklendirilir
4. **§10.3 #21 ıslahı**: "Doğrulanmamış-iddia (devralınan claim)" — sub-agent + kendi önceki tur dahil
5. **§10.X yeni canonical pattern'ler**:
   - Honest-gap işaretleme (🔍 etiket disipline'i)
   - Kanıt-karşısında-tez-geri-çekme
   - Probe-gated slice yapısı (Slice 3 örneği)
6. **§3.X backend-AG vs browser-Tarayıcı rol ayrımı** (Slice 3a CP-1+CP-4 sürprizi)
7. **Slice 3 retrospektif** ayrı appendix (Slice 3a + 3b saga özeti)

**Tahmini boyut:** ~900-1000 satır (v1.4 + delta + saga appendix). Architect 3b kapanışında yazar.

---

## §4 — Implementation Plan

### §4.1 — Sıra

```
Adım 1: W1 Discovery (AG)
  ├─ Hipotez H1-H6 kod-okuma değerlendirmesi
  ├─ Yan bulgular scope kararı (orphan SVG, sizeOverrides, R2)
  └─ Discovery raporu → Architect

[GATE: Discovery → Brief Revision pattern (Brief v1.4 §8.3)]
  Architect Discovery sonucuna göre brief v1.0 revize edebilir veya direkt onaylar

Adım 2: W4 RTL harness (AG, paralel) — Architect onayı sonrası
  ├─ Dependency'ler eklenir, config kurulur
  └─ Minimal smoke test'i (yeni dep'lerin çalıştığını doğrula)

Adım 3: W2 Primary fix (AG)
  ├─ DP-3b-1 kararı (F1/F2/F3/F4'ten hangisi)
  ├─ Implementation
  ├─ Lokal test (smoke: TypeScript clean, mevcut suite green)
  └─ Pre-deploy tsc + per-package build

Adım 4: W3 Defect #3 fix (AG, W2 ile paralel veya seri)
  ├─ DP-3b-2 (cleanup trigger scope) + DP-3b-3 (TrainingPage) kararları
  ├─ Implementation
  └─ Lokal test

Adım 5: W5 Regression test'ler (AG)
  ├─ T1-T5 yazımı
  └─ Test suite'i tüm yeşil

Adım 6: PRE screenshot arşivleme (Tarayıcı, Brief v1.4 §8.4.1)
  └─ Slice 3a Tarayıcı raporundaki repro tekrarlanabilir mi - PRE state baseline alınır

Adım 7: Deploy (`git push origin master` + prod `git pull` + nginx fresh bundle)

Adım 8: Tarayıcı post-fix re-probe (DOM-PRIMARY, fix verification)
  └─ staleIds.length === 0 + floating yok beklenir

Adım 9: AG slice 3b close-out handover yazımı

Adım 10: W6 Brief v1.5 tam sürüm (Architect)
```

### §4.2 — Pre-Deploy Disipline'i (Brief v1.4 §3.2.1, §5.X)

- **Per-package `pnpm build`** (turbo değil, individual) — multi-package değişim varsa (W4 lock file değiştirir)
- **Per-package `tsc --noEmit`** — esbuild yapmıyor, semantic check zorunlu
- **Production HEAD ancestor check** — fast-forward öncesi (Brief v1.4 §3.2.1 5-adım protokol)
- **`pnpm-lock.yaml` commit** — W4 yeni dependency ekliyor

---

## §5 — Karar Noktası Tabanlı Checkpoint'ler (Brief v1.4 §7)

Slice 3b daha geniş, 5-6 checkpoint:

| CP # | Karar Noktası | Beklenen Çıktı |
|------|---------------|----------------|
| **CP-1** | W1 Discovery tamamlandı, hipotezler değerlendirildi, yan bulgular scope kararı verildi | AG raporu (`bug_render_01_slice3b_discovery.md`): hipotez tablosu (✓/⚠️/🔍), atfedilen primary mekanizma, yan bulgular (orphan SVG, sizeOverrides, R2) scope kararı. Architect brief revizyonu (gerekirse). |
| **CP-2** | DP-3b-1 (W2 fix yaklaşımı F1/F2/F3/F4) + DP-3b-2 (cleanup scope) + DP-3b-3 (TrainingPage) + DP-3b-4 (RTL paralel/seri) kararları | Architect onayı, AG implementation'a geçer |
| **CP-3** | W2 + W3 + W4 implementation tamamlandı, lokal smoke green | AG raporu: değişen dosyalar, diff özet, lokal test çıktısı (tsc + suite). Architect onay → W5 |
| **CP-4** | W5 regression test'ler yazıldı, suite tam green | AG raporu: yeni test sayısı, coverage, CI green. Architect onay → deploy |
| **CP-5** | Production deploy + counter/uptime sağlıklı + nginx fresh bundle | Counter ve diagram-service kontrolü, Architect onay → Tarayıcı re-probe |
| **CP-6** | Post-fix Tarayıcı re-probe ✓ (stale yok, floating yok) | Tarayıcı raporu, atıf doğrulandı → AG handover yazımı + W6 Brief v1.5 (Architect) |

---

## §6 — PRE Screenshot Arşivleme (Brief v1.4 §8.4.1)

Adım 6'da Tarayıcı şu state'leri arşivler:

1. **Slice 3a baseline tekrar:** Model A açık, switch öncesi `data-node-id` count + id listesi
2. **Slice 3a bug repro:** Switch sonrası 3 saniye stable, stale id'leri ve floating bbox doğrulanır (3a Tarayıcı raporu ile karşılaştırma için)
3. **(Post-fix CP-6'da)** Aynı repro, fix sonrası — `staleIds.length === 0`, floating yok

Her screenshot'a caption (timestamp, model id, HEAD `<commit>`).

---

## §7 — Test Mimarisi (Brief v1.4 §10.4)

W4 + W5 birlikte ele alınır:

- **RTL harness pattern'i:** `@testing-library/react` mount + `waitFor` async assertion + minimal mock model factory (gelecek slice'lar için yeniden kullanılabilir)
- **Mock model factory:** `packages/web-client/src/test-utils/mock-model.ts` (yeni dosya) — `createMockModel({ children: [...] })` helper'ı
- **Helper extraction:** W2 fix logic'i mümkün olduğunca saf helper'a çıkar (`shouldResetForModelSwitch(oldModel, newModel)` veya benzeri), unit test'lenebilir
- **DiagramViewer mount fragility'si:** Async ELK + WS mock'ları gerekirse `vi.mock` ile stub, focused testing (full integration değil)

**Coverage hedefi:** W2 + W3 fix'lerini kapsayan T1-T4 zorunlu; T5 (ELK guard regression) opsiyonel ama önerilen.

---

## §8 — Deploy + Verification Sırası

```bash
# Lokal (AG)
git status                                    # working tree clean?
pnpm install --frozen-lockfile                # W4 lock file değişimi varsa
pnpm --filter @systemodel/web-client build    # per-package
pnpm --filter @systemodel/web-client test     # web-client suite green
# Diğer paketler değişmediyse onları skip et (turbo halt riski, brief v1.4)
git add -A
git commit -m "Slice 3b: reconciliation fix + interaction reset + RTL harness (Bug-RENDER-01 part 2/2)"

# Pre-deploy (AG)
git fetch origin master
git merge-base --is-ancestor origin/master HEAD
git log origin/master..HEAD --oneline

# Deploy (AG)
git push origin master

# Production (AG SSH)
ssh root@65.109.134.254
cd /opt/systemodel
git pull
pnpm install --frozen-lockfile                # eğer paket değişimi varsa
pnpm --filter @systemodel/web-client build    # nginx serve edecek
# PM2 reload YOK — web-client static SPA, nginx fresh bundle

# Verification (AG)
curl -s localhost:<port>/internal/renderer-stats | jq
pm2 status
# Counter sağlıklı, diagram-service uptime continue (Slice 3a'da olduğu gibi)
```

**Counter regression check:** `state-machine.new` artmalı, `fallback: 0` korunmalı. 3b state-machine path'ine dokunmuyor, regression beklenmiyor ama zorunlu.

---

## §9 — Slice 3b Tamamlanma Kriterleri

3b "kapalı" sayılır eğer:

- ✓ W1 Discovery tamamlandı, primary mekanizma ✓ verified
- ✓ W2 implementation tamamlandı, post-fix Tarayıcı re-probe `staleIds.length === 0` doğruladı
- ✓ W3 Defect #3 fix lokal'de teyit (interaction state reset davranışı)
- ✓ W4 RTL harness kuruldu, smoke test yeşil
- ✓ W5 regression test'ler yazıldı, T1-T4 zorunlu yeşil
- ✓ Production deploy tamamlandı, counter ve uptime sağlıklı
- ✓ Post-fix Tarayıcı re-probe geçildi (CP-6)
- ✓ AG handover (`phase2_slice3b_handover.md`) yazıldı
- ✓ **W6 Brief v1.5** Architect tarafından yazıldı (canonical ops doc güncellendi)

---

## §10 — Slice 3 Sonrası (Faz 2 Devam Roadmap)

Slice 3 kapandıktan sonra Faz 2 candidate sıralaması (Faz 1 Final Report §6.2'den, güncel durum):

1. ✓ **Bug-RENDER-01** (Slice 3a + 3b) — kapalı (3b tamamlandığında)
2. **Security B1 + B3** — PII leak + wrong-password 401 (brief-ready Architect 2026-05-23 handover'ında)
3. **Sub-state pseudo-initial daire çizimi** (discovery zorunlu, Slice 2d.2 backlog çelişkisi)
4. **Slice 2e + Security B2** — WS auth + HierarchicalFlagProvider + JWT migration (büyük scope)
5. **Legacy view porto serisi** — Faz 2 ana gövdesi (her view için Slice 2d ailesi pattern'i)

**Piggyback:** Bug-PRISMA-01, Bug-RENDER-03.

Platform Owner Slice 4 başlangıcında seçim yapacak.

---

# Appendix A — Brief v1.5 Delta Kaynağı (3a brief Appendix A'dan taşınan)

Bu bölüm 3a brief'in Appendix A'sının özetini içerir. Tam içerik `phase2_slice3a_brief_v1_0.md` Appendix A'da. W6 (Brief v1.5 yazımı) bu materyali kullanır:

- **A.1** Render kanalı düzeltmesi (WS only, SSE file-change kanalı)
- **A.2** Anti-pattern #21 ek örnek (Slice 3 saga'sı, 3 turlu tetiklenme)
- **A.3** Yeni canonical pattern adayı: Kanıt-karşısında-tez-geri-çekme
- **A.4** Yeni canonical pattern adayı: Honest-gap işaretleme (🔍 etiket disipline'i)
- **A.5** Brief v1.5 yazım notu

---

# Appendix B — Slice 3b Process Notları (3b kapanışında AG handover ile uyumlu)

3b boyunca biriken process gözlemleri W6 (Brief v1.5) için input olarak burada toplanır. Bu appendix 3b CP-1'den itibaren AG ve Architect tarafından **canlı doldurulur** (brief revizyonu yerine handover ile sentez):

- **B.1** Backend-AG vs browser-Tarayıcı rol ayrımı (3a'da net oldu, 3b'de pattern olarak doğrulanır)
- **B.2** Probe-gated slice yapısı retrospektifi (3a + 3b sentezi)
- **B.3** RTL harness kurulum pattern'i (gelecek slice'lar için template)
- **B.4** Fix tasarım kararının Discovery'ye geri-besleme (DP-3b-1 sonucu brief'i revize ederse, bunun process'i belgelenecek)

---

# Son

**Architect onayı bekleniyor.** Onay sonrası bu brief AG'ye paslanır, AG CP-1'den (W1 Discovery) başlar.

**Slice 3b'nin başarısı için kritik faktör:** Anti-pattern #21 v2 disipline'i — devralınan iddiaları (Slice 3a CP-4 atfı dahil!) kendi kanıt zincirinizle doğrulayın. CP-4 "primary = React reconciliation/unmount path" dedi, ama hangi mekanizma kanıtlanmadı. W1 bunu kanıtlayacak.

— Architect Claude, 2026-05-27
