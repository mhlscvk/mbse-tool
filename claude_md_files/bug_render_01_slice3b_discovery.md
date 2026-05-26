# Bug-RENDER-01 Slice 3b — W1 Discovery Report (CP-1)

**HEAD:** `813c7a0` (working tree clean) | **Tarih:** 2026-05-27
**Brief:** `phase2_slice3b_brief_v1_0.md` (W1 = reconciliation/unmount kök neden atfı)
**Anti-pattern #21 v2 uyarısı uygulandı:** CP-4 "primary = React reconciliation/unmount" atfı **devralınmadı** — kendi kanıt zincirimle değerlendirdim. **Bulgu: CP-4 etiketi imprecise olabilir** (aşağıda).

> **Headline:** Kod-okuma, DiagramViewer'ın React ağacı İÇİNDE stale node bırakacak **hiçbir mekanizma içermediğini** kanıtlıyor (keyed + reactive + animasyon-yok + tek root). Dolayısıyla CP-4'ün gördüğü DOM-mix iki olasılıktan biri: **(a)** switch sonrası `model` state'i hâlâ A'yı içeriyor (= reconciliation DEĞİL, model-delivery/state), veya **(b)** React fiber'ı dışında **detached orphan SVG** (totalSvgs 2→5 bunu destekliyor). **Kod bu ikisini ayıramaz — tek, kesin, 2-dakikalık runtime probe gerekiyor (Tarayıcı).** Bu olmadan W2 fix tasarımı (F1 vs F2) tahmin olur.

---

## §1 — Hipotez Değerlendirmesi (H1-H6, kod-kanıtlı)

| # | Hipotez | Verdict | Kanıt @ `813c7a0` |
|---|---------|---------|-------------------|
| **H1** | Çoklu render path | ✗ STV için tek path | DiagramViewer viewType'a göre `SequenceRenderer`(2010)/`BrowserRenderer`(2031)/`GeometryRenderer`(2038)/`GridRenderer`'a delege ediyor AMA STV→STV kendi `<svg>`'sini (2046-2922) kullanıyor. Tarayıcı repro'su STV→STV → tek path. Delegasyon bu bug'a alakasız. |
| **H2** | Render-input collection stale (memo dep eksik) | ✗ eliminated | `allNodes = useMemo(() => model?.children.filter(type==='node'), [model])` (474-477); `nodes = useMemo(() => allNodes.filter(!hidden), [allNodes, hiddenNodeIds])` (487-490). Tam reactive — `setDiagram(B)` → model ref değişir → nodes B olur. Stale memo yok. |
| **H3** | Name-collision reconciliation re-use | 🔍 bağımsız mekanizma DEĞİL | React keyed list: ortak key'ler (`state__Normal`) güncellenir, A-only key'ler (`behavior__On_entry_activation`) **kaldırılır**. React'in onları kaldırMAMASI için renderNodes'un hâlâ onları içermesi (=mekanizma a) VEYA listenin reconcile edilmemesi (=b) gerekir. H3 tek başına geçerli React mekanizması değil — (a) veya (b)'ye indirgenir. Name-collision sadece bir **gözlem ipucu**. |
| **H4** | Compound child ELK-result'tan besleniyor | ✗ eliminated | Entry-action node'lar `model.children`'da TOP-LEVEL (H6). renderNodes `nodes`'tan (model) besleniyor; ELK result yalnız **positions Map**'ini besliyor, node LİSTESİNİ değil. Ayrı child-render-from-layout branch'i yok. |
| **H5** | Orphan SVG root birikimi | 🔍 **LEADING ama kod-mekanizması bulunamadı** | `totalSvgs: 5` (PRE 2) → yeni SVG root'lar birikiyor, eskisi kaldırılmıyor = detached orphan DOM imzası. AMA: DiagramViewer = 1 `<svg>` (2046), tek mount (EditorPage:1120, **key yok**), portal yok, animasyon/transition lib **yok** (deps temiz), manuel DOM op yok, **tek React root** (main.tsx createRoot, StrictMode prod'da no-op). Tek root + standart reconciliation, kod-seviyesinde orphan üretmez. → Mekanizma runtime'da (fiber/DOM), statik okumayla görünmüyor. |
| **H6** | Action node ownership | ✓ verified — top-level | Fixture `sensor-systems/expected-smodel.json`: `behavior__On_entry_activation` top-level SNode (`cssClasses:["entryactionusage"]`, composition edge `comp__on_to_entry_activation` ile bağlı). Nested değil. → model=B ise B'nin children'ı bunu içermez → keyed render unmount ETMELİ. |

**Kod-domain net sonuç (✓ verified @ `813c7a0`):** Tek React root + keyed flat render (`renderNodes.map`, key={node.id}) + reactive memo'lar + animasyon-lib-yok + portal-yok + entry-action'lar top-level ⟹ **standart React, model=B olunca A'nın node'larını unmount ETMEK ZORUNDA.** React ağacı içinde stale bırakacak kod-mekanizması YOK. Bu, **CP-4'ün "reconciliation/unmount path" etiketini sorguya açıyor** — reconciliation path'i koda göre DOĞRU.

---

## §2 — Atıf: İki Olasılık, Kod Ayıramıyor (🔍 honest gap)

| Olasılık | Mekanizma | totalSvgs:5 ile uyum | W2 fix farkı |
|----------|-----------|---------------------|--------------|
| **(a) model-state-contains-A** | switch sonrası EditorPage `diagram` state'i hâlâ A'yı içeriyor (WS race / SSE file-event reload / setDiagram sıralaması). Reconciliation DEĞİL. | ✗ uymuyor (tek svg, totalSvgs artmazdı) | **F2** — model-switch'i doğru detect edip state sıralamasını düzelt (delivery guard) |
| **(b) detached orphan SVG** | A'nın `<svg>`'si React fiber'ından koparılmış, DOM'da asılı (eski root/route artığı). | ✓ uyuyor (totalSvgs 2→5) | **F1/farklı** — orphan'ı kim yaratıyor; key/mount/router incelemesi |

**Neden kod ayıramıyor:** (a) post-switch `model` state'inin runtime içeriğini gerektirir (statik okunamaz); (b) fiber-ağacı-dışı DOM durumunu gerektirir (statik okunamaz). Her ikisinin de **kod-seviyesinde tetikleyicisi bulunamadı** (race için server in-order kanıtlandı; orphan için tek-root+no-portal+no-animation). → Mekanizma runtime etkileşiminde.

### Kesin Disambiguation Probe (Tarayıcı, ~2 dk) — W2 ÖNCESİ ZORUNLU

```js
// systemodel.com, Model A (STV) → Model B switch, 3sn sonra:
const stale = document.querySelector('[data-node-id="behavior__On_entry_activation"]'); // A-only
const bOnly = document.querySelector('[data-node-id="state__Off"]');                    // B-only (varsa)
console.log('1) stale svg === B svg?', stale?.closest('svg') === bOnly?.closest('svg'));
console.log('2) total svg roots:', document.querySelectorAll('svg').length);
console.log('3) stale React root içinde mi?', document.getElementById('root')?.contains(stale));
// + 3a W3 instrumentation: [PROBE setDiagram] son çağrı model.children A id'lerini içeriyor mu?
```

**Atıf matrisi:**
| Gözlem | Mekanizma | W2 |
|--------|-----------|-----|
| stale svg === B svg (aynı) + setDiagram childIds A içeriyor | **(a)** model-state | F2 (delivery/state guard) |
| stale svg ≠ B svg (farklı) VEYA stale root içinde değil | **(b)** orphan DOM | orphan kaynağı discovery + farklı fix |
| setDiagram childIds temiz B AMA stale DOM'da | **(b)** + fiber inceleme | React DevTools fiber tree |

---

## §3 — Yan Bulgu Scope Kararları (brief §1.2)

| Item | Karar | Gerekçe |
|------|-------|---------|
| **Orphan SVG (totalSvgs:5)** | **Side finding DEĞİL — muhtemelen PRIMARY mekanizma (b)** | totalSvgs artışı (a) ile uyumsuz; disambiguation probe'da netleşir. W2 scope'unun merkezi olabilir. |
| **R2 autosave guard** | **Backlog (W2 dışı)** — ✓ mekanizma doğrulandı, risk düşük | MonacoEditor:728 `setValue` → onDidChangeModelContent(328) → onChange(365) → handleChange(B). Fire anında fileId=B/value=B → idempotent PUT(B→B). Cross-file corruption yalnız dar render-penceresi (stale closure) — düşük olasılık. Runtime corruption görülmedikçe backlog. |
| **sizeOverrides/positionOverrides asimetrisi** | **Bağımsız, defer** (W2/W3 dışı) | Cleanup positionOverrides siliyor (:503), sizeOverrides silmiyor. Node-persistence ile ilgisiz; ayrı küçük fix veya comment. 3b'ye sokmaya gerek yok. |
| **Edge identity (data-edge-id)** | **Gerekmiyor (şimdilik)** | Disambiguation + W2 verification node-level `data-node-id` ile yeterli. |

---

## §4 — Defect #3 (W3) Hazır, Bağımsız (✓ verified @ `813c7a0` / `ac3d6a4`)

W3 (interaction state cleanup) node-persistence'tan AYRI eksen, atfa bağlı değil — paralel gidebilir:
- `multiSelectedNodeIds` (440), `selectionRect` (443), `contextMenu` (432), `hoveredNodeId` (454) — DiagramViewer-local, cleanup effect'te (497-505) reset edilmiyor.
- Parent `diagramSelectedNodeId/EdgeId` (EditorPage:99) — setter sadece callback'te (1156), reset yok.
- Fix: cleanup effect'e setter'lar eklenir (DP-3b-2: trigger `nodeIdSetKey` view-switch'te de fire eder — UX-tutarlı, muhtemelen istenir) + EditorPage'e `useEffect([fileId, viewType])` reset. DP-3b-3: TrainingPage:573-576 de kontrol edilmeli.

**Not:** W3 fix'i DiagramViewer cleanup effect'ine dokunuyor — eğer mekanizma (a)/(b) çözümü de aynı effect'i değiştirirse, çakışma koordinasyonu gerekir (sıralama: önce W2 mekanizma netleşsin).

---

## §5 — Verification Etiketi Özeti

| Bulgu | Etiket |
|-------|--------|
| H1 STV tek render path (delegasyon STV-dışı) | ✓ verified @ `813c7a0` |
| H2 nodes reactive (stale memo yok) | ✓ verified @ `813c7a0` |
| H3 name-collision tek başına React mekanizması değil | ✓ verified (reasoning + keyed-list semantiği) |
| H4 compound-child-from-ELK eliminated | ✓ verified @ `813c7a0` |
| H5 orphan SVG leading, kod-mekanizması bulunamadı | 🔍 partial — totalSvgs runtime gözlemi (Tarayıcı) |
| H6 entry-action top-level | ✓ verified @ `813c7a0` (fixture) |
| Kod ağaç-içi orphan mekanizması yok → CP-4 "reconciliation" imprecise | ✓ verified (kod eliminasyonu) |
| Atıf (a) vs (b) | 🔍 honest gap — kesin probe gerekli (§2) |
| R2 mekanizması (setValue→onChange→PUT) | ✓ verified @ `813c7a0` (MonacoEditor:725-728, 328, 365) |
| R2 corruption riski düşük/idempotent | ⚠️ assumed (runtime teyit edilmedi) → backlog |

---

## §6 — Gate Önerisi (Discovery → Brief Revision, brief v1.4 §8.3)

**DUR — W2 tasarımı (DP-3b-1: F1 vs F2) atıf bilinmeden yapılamaz.** (a) ve (b) **farklı fix** gerektiriyor (F2 delivery-guard vs orphan-kaynağı). Tahmine dayalı fix = anti-pattern #13 (ampirik test olmadan tasarım iddiası).

**Önerilen sıra:**
1. **Tarayıcı disambiguation probe** (§2, ~2 dk) → (a) mı (b) mi
2. Architect brief revize eder (DP-3b-1 fix yaklaşımı netleşir)
3. W3 (Defect #3) + W4 (RTL harness) bu arada **paralel** başlayabilir (atfa bağlı değil)
4. W2 fix (atfedilen mekanizmaya göre) → re-probe verification

**Anti-pattern #21 v2 notu:** Bu Discovery, CP-4'ün "reconciliation" atfını devralmadı ve kod kanıtıyla onu **sorguya açtı** (reconciliation path'i doğru). Slice 3 saga'sında 4. kez bir devralınan iddia (bu sefer CP-4 atfı) taze kanıtla revize edildi. Brief v1.5 #21 materyaline ekle.

**Bu, Tarayıcı'ya tekrar dönüş = ping-pong değil:** 6 hipotezden 4'ü kod ile elendi/karakterize edildi, kalan ikili (a/b) tek 2-dakikalık gözlemle çözülüyor. Probe-gated disiplinin doğru uygulaması.
