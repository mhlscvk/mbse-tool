# Bug-RENDER-01 Slice 3b — W2 Audit Report (cache/effect/ref sweep)

**HEAD:** `813c7a0` (working tree: W3+W4 uncommitted) | **Tarih:** 2026-05-27
**Girdi:** Tarayıcı canlı WS probe (5. iddia çürütüldü: mixed-content + stale-frame YOK; son RECV clean B, 0 behaviors) + headless server-clean probe (önceki tur) + W4 RTL (DiagramViewer clean-prop→clean-render)
**Method:** Yol B (audit) — Tarayıcı'nın 3 hipotezini (late-effect / cache / ref-portal) kod-okumayla eleme.

> **Sonuç (✓ verified @ `813c7a0`):** Defekt **(c2) React keyed-reconciliation leftover** — DiagramViewer model A için render ettiği 2 `<g>`'yi model B'ye geçişte **unmount etmiyor**; eski A transform'unu koruyorlar (floating y=795). Tarayıcı hyp 1 (late inject) ve hyp 3 (imperative/portal) **`data-node-id` kanıtıyla** elendi. Exact React-internal trigger statik okumayla pinlenemedi (🔍) — ama fix bundan bağımsız.

---

## §1 — Hipotez Elemesi

### Belirleyici kanıt: stale node'lar `data-node-id` taşıyor
`data-node-id` **yalnızca** `renderNodes.map` React element'lerinde JSX attribute olarak var (Slice 3a W1, 11 site, hepsi 2136'daki tek map'te). 

- **İmperatif DOM eklemesi** (`appendChild`, `createPortal`) bu JSX attribute'unu **taşıyamaz** → stale node imperatif eklenmemiş.
- **Geç imperatif inject** (hyp 1) de aynı sebeple JSX `data-node-id` üretemez.

→ Stale node'lar **React-rendered keyed `<g>`** = React unmount etmedi = **(c2) leftover.** Bu, W1 (data-node-id) altyapısının mekanizma-class atfını kesinleştirmesi.

### Hyp 1 — Late effect-driven inject → ✗ ELENDİ ✓ verified
- DiagramViewer'da `useLayoutEffect` / `requestAnimationFrame` / `MutationObserver` / `setTimeout`-node-inject **YOK** (grep boş).
- `data-node-id` kanıtı: late imperatif inject JSX attribute taşıyamaz → ruled out.

### Hyp 2 — ELK/layout cache render-from-cache → ✗ ELENDİ ✓ verified
- Tek node render path: `renderNodes.map` (2136), `renderNodes = [...nodes]` (1697), `nodes = model.children` (reactive). **Cache key'leri üzerinden node üreten ikinci map YOK.**
- `positions`/`layoutSizes`/`elkEdgeRoutes` Map'leri **konum** tutuyor, node varlığı değil. Cleanup effect (497-509) bunları model değişiminde sıfırlıyor.
- Floating y=795: stale `<g>` React tarafından kaldırılmadığı için **son render'daki A transform'unu koruyor** — "cache'ten geri çağırma" değil, "leftover `<g>` eski transform'u tutuyor." Aynı gözlem, farklı (doğru) yorum.

### Hyp 3 — Sub-component ref/portal imperative DOM → ✗ ELENDİ ✓ verified
- `createPortal` / `ReactDOM` / `appendChild` / `insertBefore` / `cloneNode` / `innerHTML` / `insertAdjacent` / `dangerouslySet` **YOK** (grep boş).
- `data-node-id` kanıtı (yukarıda): imperatif eklenen node JSX attribute taşımaz → ruled out.

### Pinlenemeyen: exact React reconciliation trigger → 🔍 partial
Neden React 2 keyed `<g>`'yi prod multi-frame async sekansında unmount etmiyor (W4/repro'da temiz) — **statik okumayla pinlenemedi.** Yapısal gözlem: `renderNodes.map` (2136), transform `<g>` (2134) içinde **birden çok sibling children-array'in** (nodes, edges, label'lar...) biri. `{nodesMap}{edgesMap}{...}` sibling-array deseni, array sınırları kaydığında React reconciliation için bilinen bir hazard'dır — ama bunun KESİN trigger olduğu reproduce edilmeden doğrulanamaz. Fix bu pinlemeye bağlı değil (aşağıda).

---

## §2 — W2 Fix Önerisi: `key={modelId}` Remount (Option C — RE-INSTATE)

**Öneri:** EditorPage'de `<DiagramViewer key={`${fileId}:${viewType}`} ... />` (+ TrainingPage'de `key={taskIndex}`). Model switch → DiagramViewer **full unmount + remount** → React tüm eski subtree'yi (leftover `<g>` dahil) söker, temiz B'den sıfırdan mount eder.

### Anti-pattern #21 v2 — açık düzeltme (5. iddia bağlamı)
**Geçen tur Option C'yi REDDETTİM** — gerekçe: "model prop dirty (8), remount dirty prop'u temizlemez." **Tarayıcı'nın RECV log'u bu premise'i çürüttü:** son `setDiagram` clean B (16 child, 0 behavior). Prop temiz; defekt React leftover (c2). **Temiz-prop/React-leftover için remount KESİN çalışır** (full unmount leftover'ı siler). Yani C reddim yanlış premise'eydi; düzeltiyorum. (Saga'nın 5. çürütülen iddiası benim kendi geçen-tur sonucumdu — disiplin çalıştı.)

### Neden C artık doğru (önceki redde rağmen)
| Kriter | Değerlendirme |
|--------|--------------|
| (c2) leftover'ı çözer mi | ✓ Full unmount React leftover `<g>`'yi kesin siler (prop zaten temiz) |
| Exact trigger pinlemesi gerekir mi | ✗ Gerekmez — remount herhangi bir reconciliation leftover'a robust |
| Hyp 1/3'e robust mu (sub-component'te varsa) | ✓ Unmount tüm child effect cleanup'larını tetikler, geç async iptal olur |
| "Root cause örtüyor" eleştirisi | Zayıf — audit targetable defective line bulamadı; ve "model switch'te tam reset" zaten İSTENEN davranış (idiomatic React "remount on identity change") |
| Maliyet | Switch'te full re-mount (ELK yeniden çalışır — ama switch'te zaten çalışıyor, positions cleanup'la sıfırlanıyor); marginal maliyet component teardown/setup |
| Bonus | DiagramViewer-local interaction state (multiSelectedNodeIds vb.) remount'la sıfırlanır → W3'ün DiagramViewer-local kısmıyla örtüşür (W3 EditorPage parent-selection reset YİNE gerekli — child remount parent state'i sıfırlamaz) |

### modelId seçimi
- EditorPage: `key={`${fileId}:${viewType}`}` — file VEYA view switch'te remount (model-identity sınırı). showInherited dahil DEĞİL (aynı elementler, remount gereksiz).
- TrainingPage: `key={taskIndex}` — task switch'te remount.

### W3 ile etkileşim (net)
- W2 (key remount) DiagramViewer-local interaction reset'i SUBSUME eder (file+view switch için). W3'ün DiagramViewer cleanup-effect eklemesi (497-509) artık switch için redundant ama **hide/show için** hâlâ değerli (remount olmaz) + zararsız. **Tutulabilir** (defense-in-depth) veya sadeleştirilebilir — DP.
- W3'ün **EditorPage + TrainingPage parent-selection reset'i YİNE gerekli** (key DiagramViewer'a, parent state'i etkilemez).

---

## §3 — Verification Planı

- **RTL bug-repro mümkün değil:** W4 + repro gösterdi DiagramViewer clean-prop→clean-render; bug prod multi-frame async sekansına özgü, RTL synchronous flush'la tetiklenmiyor. → Fix'i RTL'de bug-repro ile doğrulayamam.
- **Fix verification = Tarayıcı re-probe** (prod, DOM-PRIMARY): switch sonrası `staleIds.length === 0` + floating yok beklenir. (W1 data-node-id bunu mümkün kılıyor.)
- **RTL'de eklenebilir:** key'in model switch'te değiştiğini assert eden test (remount mekanizması garantisi) + mevcut clean-reconciliation regression testleri (W4) korunur.
- **Counter regression:** state-machine.new artar, fallback 0 (state-machine path'e dokunulmuyor).

---

## §4 — Verification Etiketi Özeti

| Bulgu | Etiket |
|-------|--------|
| Stale node'lar `data-node-id` taşıyor → React-rendered leftover | ✓ verified @ `813c7a0` (W1 attribute + Tarayıcı DOM) |
| Hyp 1 (late inject) elendi | ✓ verified (data-node-id + no late-effect in DiagramViewer) |
| Hyp 2 (cache render-path) elendi | ✓ verified (single renderNodes.map, caches hold positions not nodes) |
| Hyp 3 (imperative/portal) elendi | ✓ verified (no imperative DOM + data-node-id) |
| Defekt = (c2) React keyed-reconciliation leftover | ✓ verified |
| Exact React-internal trigger | 🔍 partial — pinlenemedi, fix-irrelevant |
| W2 = key={modelId} remount çözer | ✓ verified mantık (clean prop + full unmount) — prod re-probe ile teyit edilecek |
| Option C reddi (geçen tur) yanlış premise'eydi | ✓ verified (Tarayıcı RECV clean B) |

---

## §5 — DP-3b-1 (Architect onayı gerekli)

W2 fix yaklaşımı = **key={modelId} remount** (Option C re-instate). Brief §3.2 DP-3b-1: fix yaklaşımı Architect onayı ister. Öneri gerekçesi: (c2) confirmed + audit targetable line bulamadı + remount idiomatic + robust + İSTENEN davranış (switch'te clean reset). Onay sonrası implement + Tarayıcı re-probe verification + W5.
