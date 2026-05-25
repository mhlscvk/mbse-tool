# Bug-RENDER-01 Re-Discovery Report

**HEAD:** `ac3d6a4` (kod okundu, working-tree temiz)
**Önceki rapor:** İlk Discovery (multiSelectedNodeIds + parent selection cleanup eksiği) — **hâlâ geçerli ama Tarayıcı'nın gördüğü SVG-persist bug'ını AÇIKLAMIYOR.** Bu re-discovery onu ele alıyor.
**Önemli yol düzeltmesi (tekrar):** `packages/web-client/src/components/Diagram/DiagramViewer.tsx`. Render kanalı = **WebSocket `/diagram`** (SSE değil — bkz R4).

> **Dürüstlük notu (önemli):** R1'in "node persist" mekanizmasını statik kod-okumayla **kesin kanıtlayamadım**. İki gerçek, doğrulanmış mimari defekt buldum (ya biri ya ikisi sebep) ama Tarayıcı'nın gördüğü TAM DOM-mix'i nokta-atışı atfetmek için bir runtime probe gerekiyor (R1 sonunda spec'liyor). Hipoteze düşmemek için elediğimi ✓, doğruladığımı ✓, atfedemediğimi 🔍 ile işaretledim. Architect'in talebi gereği "kanıtlayamadığımı kanıtlanmış gibi sunma" disiplinine uydum.

---

## R1. SVG Persist Kök Nedeni (kritik)

### R1.0 — Render mimarisi (zemin) — ✓ verified @ ac3d6a4
- `renderNodes = [...nodes].filter(visibleNodeIds.has).sort(byDepth)` (DiagramViewer.tsx:1688-1690); `nodes = model?.children.filter(type==='node')` (475-490). → **Render YALNIZCA `model.children`'dan beslenir.**
- Her node `key={node.id}` ile render ediliyor (2164, 2204, 2259, 2274, 2293...). 
- **Mantıksal sonuç:** `model` = B ise, A'nın node'ları renderNodes'ta OLAMAZ → React onları unmount etmeli. A'nın node'ları DOM'da kalıyorsa → ya `model` hâlâ A'yı içeriyor, ya layout stale, ya React-dışı bir şey. Bu, hipotez elemesini yönlendiriyor.

### R1.1 — Hipotez elemesi (her biri kod-kanıtlı)

**(a) nodes/allNodes useMemo stale değer döndürüyor → ELENDİ ✓ verified**
`allNodes = useMemo(() => model?.children..., [model])` (474-477). `setDiagram(newModel)` her WS mesajında `JSON.parse`'lı **yeni obje referansı** veriyor (diagram-client.ts:55 → onModel → EditorPage:392 `setDiagram(model)`). Referans değişiyor → memo recompute. Reference-equality memo sorunu YOK.

**(b) Server eski child'ları yeni modele merge ediyor → ELENDİ ✓ verified**
diagram-service `websocket-server.ts` **stateless** (tek state `connectionsPerIp` Map'i, rate-limit için; model cache/lastModel/merge YOK — grep `lastModel|cache|currentModel|merge` boş). Her `kind:'parse'` mesajı gönderilen content'ten taze model üretir. Server merge etmiyor.

**(c) ELK layout Map'lerinin (layoutSizes/elkEdgeRoutes) eski key'leri render üretiyor → KISMEN, dolaylı 🔍 partial**
Render node-üretimi `nodes`'tan (model) gelir, `positions`/`layoutSizes` Map'lerinden DEĞİL. Stale Map key'leri **node üretmez**. AMA stale Map'ler **mevcut node'ları yanlış konuma koyar** (aşağıda R1.2 defekt #1). "Container dışında y=660'da sallanan kutular" semptomu **tam da stale-position imzası** — ama bu, kutuların VARLIĞINI değil KONUMUNU açıklar.

**(d) Client-side derived action-node generation → ELENDİ (zayıf) ⚠️ assumed**
Render path'inde action kutularını client'ta üreten bir `getDerivedActionNodes` benzeri logic bulamadım. Action kutuları server SModel'inden (`model.children`) geliyor; client sadece `node.children`'ı compartment label'ı olarak okuyor (569-571). Client-side child generation YOK (exhaustive grep yapmadım → ⚠️).

**(e) Render'da key prop eksik → React mis-reuse → ELENDİ ✓ verified**
Tüm render dalları `key={node.id}` taşıyor (2164+). Key var. React keyed reconciliation eski key'leri unmount eder.

**(f) View-type değişimi child üretimini değiştirir / SSE payload → KISMEN ✓ verified**
Render kanalı **WS** (SSE değil, R4). viewType `sendText`'te gönderiliyor, server o view'a göre SModelRoot üretip JSON döner. Clean switch'te viewType doğru gönderilir (load effect 419). Mixed-view kontaminasyonu **WS yanıt korelasyonsuzluğundan** gelir (defekt #2).

### R1.2 — Bulunan İKİ gerçek defekt (ikisi de kanıtlı, ikisi de stale-persist üretebilir)

**DEFEKT #1 — Async ELK `.then`'de `cancelled` guard YOK — ✓ verified @ ac3d6a4**
DiagramViewer.tsx layout effect (~600-943):
```tsx
let cancelled = false;            // (effect başında)
elk.layout(...).then((result) => {
  // ... newPositions/newIbdSizes/newEdgeRoutes hesaplanır ...
  setElkEdgeRoutes(newEdgeRoutes);   // 908  ← cancelled KONTROLÜ YOK
  setPositions(newPositions);        // 910  ← cancelled KONTROLÜ YOK
  setIbdSizes(newIbdSizes);          // 911  ← cancelled KONTROLÜ YOK
  setTransform({...});               // 934  ← cancelled KONTROLÜ YOK
}).catch(() => { if (!cancelled) setLayoutPending(false); });  // 939 ← guard SADECE burada
return () => { cancelled = true; };  // 941
```
Cleanup `cancelled=true` yapıyor (941) ama **success path (908-938) guard kontrol etmiyor** — sadece `.catch` kontrol ediyor (939). → A→B switch'inde A'nın layout promise'i switch SONRASI resolve olursa, A'nın position/size/route/transform değerlerini state'e **yazar**. Bu, **stale-konum** üretir (kutuların yeni container dışında y=660'da kalması = bu defektin imzası).

**DEFEKT #2 — WS model kanalında request/response korelasyonu YOK — ✓ verified @ ac3d6a4**
- diagram-client.ts:53-57: `onmessage` → `if (msg.kind === 'model') listeners.forEach(l => l(msg.model, ...))`. Mesaj **uri/requestId/seq taşımıyor** (`DiagramMessage` model+diagnostics; uri echo'su client tarafında okunmuyor).
- EditorPage.tsx:392: `diagramClient.onModel((model) => setDiagram(model))` — **gelen HER modeli koşulsuz kabul ediyor.** "Bu yanıt güncel dosya/view için mi?" kontrolü YOK.
- **Sonuç:** Önceki dosya/view için uçuşta olan bir geç yanıt, switch sonrası gelirse mevcut modeli **overwrite eder**. Hızlı switch'te (Tarayıcı: ~0.3s tek tık) A render'ı/ELK'i daha settle olmadan B'ye geçilince, geç-gelen A modeli kazanabilir → A'nın node'ları render edilir.

### R1.3 — Kesin atfedemediğim kısım (dürüst) — 🔍 partial
Tarayıcı'nın gördüğü TAM görüntü "B'nin state def'leri DOĞRU + A'nın action kutuları ek olarak var" = iki modelin **DOM-mix**'i. R1.0 mantığına göre saf React render'da (model tek state, keyed) mix imkânsız — mix ya (i) `model.children`'ın gerçekten ikisini de içermesi, ya (ii) ELK stale-write + interleaved setDiagram'in geçici frame'i, ya (iii) izlemediğim bir nested-render inceliği gerektirir. **Statik okumayla hangisi olduğunu kanıtlayamadım.** İki defekt de gerçek ve düzeltilmeli, ama tam mekanizma için runtime probe şart:

**Önerilen runtime probe (Tarayıcı + AG, ~10 dk):**
1. `EditorPage.tsx:392` onModel'e geçici log: `console.log('[setDiagram]', model.children.map(c=>c.id))` — switch'ten sonra **stabilize olan SON model.children A'nın id'lerini içeriyor mu?**
   - İçeriyor → DEFEKT #2 (stale WS model kazandı) PRIMARY. Fix: yanıt korelasyonu.
   - İçermiyor (temiz B) ama DOM'da A var → React/SVG reconciliation veya ELK stale-write PRIMARY. Fix: DEFEKT #1 + render audit.
2. WS frame sırası: switch anında kaç `kind:'model'` frame geldi, hangi sırada (A-content mı B-content mı parse edildi).

---

## R2. PUT Yan Etkisi Mekanizması

**Autosave path — ✓ verified @ ac3d6a4:**
- `handleChange` (EditorPage.tsx:737) `<MonacoEditor onChange={handleChange} value={content}>`'e bağlı (916-919).
- `handleChange` → `setContent(value)` + `diagramClient.sendText(...)` (743) + **debounced autosave** (762-775): `saveTimer = setTimeout(() => api.files.update(projectId, fileId, value), AUTOSAVE_DEBOUNCE_MS)`.

**Switch'te PUT neden atılıyor — 🔍 partial:**
En olası zincir: load effect (401-436) switch'te `setContent(B-content)` yapıyor → controlled `value={content}` Monaco'ya programatik set ediliyor → **eğer MonacoEditor wrapper'ı programatik `setValue`'da `onChange` fire ediyorsa** → `handleChange(B-content)` → debounced `api.files.update(B → fileId=B)`. Yani **B'nin içeriğini B'ye geri yazıyor (idempotent-ish)**.

**Data-corruption riski değerlendirmesi:**
- **Düşük/orta.** `handleChange` useCallback deps'i `[..., fileId, ..., content]` (776) → fileId değişince yeniden yaratılıyor; `setTimeout` closure'ı çağrı anındaki `fileId`+`value`'yı yakalar. Normal akışta fileId=B, value=B → B'ye B yazılır (zararsız).
- **Gerçek risk penceresi:** Monaco `value` prop'u B'ye güncellenmişken `onChange` prop'u (handleChange) henüz A-closure'ında olduğu render-arası pencerede fire ederse → B-content, fileId=A ile yazılabilir = **cross-file corruption**. Timing-bağımlı, statik okumayla kanıtlanamadı.
- **Ek risk:** GET(B) ile debounced PUT(B) arası başka kullanıcı B'yi düzenlerse → clobber.

**Doğrulama gereği:** MonacoEditor wrapper'ının `onChange` semantiği (programatik `setValue`'da fire ediyor mu?). Eğer evet → guard ekle: `if (value === lastLoadedContentRef.current) return;` veya programatik-set flag'i. **R2'yi brief'te "verify + guard" olarak scope'la.**

---

## R3. data-node-id Eksikliği — ✓ verified @ ac3d6a4

- Render'daki `key={node.id}` bir **React reconciliation key'i**, DOM attribute DEĞİL → DOM'a düşmez. Tarayıcı'nın "data-node-id yok, [id] yok" gözlemi **doğru.**
- DiagramViewer.tsx'te `data-node-id|data-element|data-sysml` grep'i **boş** → SVG node `<g>`'lerinde hiçbir identity attribute yok (sadece `<defs>` marker'ları id'li).
- **En az invaziv kalıcı çözüm:** Her render dalının dış `<g>`'sine `data-node-id={node.id}` ekle (2164, 2204, 2259, 2274, 2293, 2310, 2330, 2392, 2471, 2517 — `key={node.id}` olan her `<g>`). Opsiyonel `data-node-kind={node.cssClasses?.[0]}`. 
- **Fayda (brief v1.4 §5.4):** Tarayıcı stale-tespitini text-content + bbox yerine `document.querySelectorAll('[data-node-id]')` ile yapar → DOM programatik teyit PRIMARY disiplini kalıcılaşır. Bu, Bug-RENDER-01 verification'ı için **ön-koşul** (fix'i nasıl test edeceğiz?).

---

## R4. Render Kanalı — SSE DEĞİL, WS (brief v1.4 düzeltmesi) — ✓ verified @ ac3d6a4

**Tarayıcı'nın gördüğü SSE, render kanalı DEĞİL — ayrı bir kanal:**
- `POST /api/projects/:p/files/:fileId/sse-token` → JWT; `GET /api/projects/:p/files/:fileId/events?token=...` → bu **dosya-değişim event stream'i** (`api-server/src/routes/files.ts:18` `/:fileId/events`, token verify HS256 `:28`, `mcpEvents`/`FileChangeEvent` yayını). EditorPage.tsx:590-606 bunu tüketiyor — **amaç: dosya başka kullanıcı/AI tarafından değişince tespit** (collaboration/AI-edit reload), diagram modeli DEĞİL.
- **Diagram modeli WS ile geliyor:** diagram-client.ts:42 `new WebSocket('${proto}//${location.host}/diagram')`; `DiagramMessage` `{kind: 'model'|'error'|'clear', model, diagnostics}` (diagram-client.ts:55-61). Model push frame tipi = **`kind: 'model'`**, payload `msg.model` (SModelRoot).

**⚠️ Brief v1.4 düzeltmesi gerekli:** §5.2 ("render kanalı SSE olduğunu keşfetti, WS panel boş çıktı") ve §6 — bu **conflation**. Tarayıcı'nın gördüğü SSE = dosya-event kanalı. Render kanalı WS `/diagram`. WS panelinin "boş" görünmesi muhtemelen nginx proxy / DevTools WS-frame görünürlüğü sorunu — kanalın yokluğu değil. **brief v1.4 §5.2/§6'ya düzeltme: "render = WS /diagram (kind:model); file-events = SSE /files/:id/events — ayrı kanallar."**

---

## R5. Verification Etiketi Özeti

| # | Bulgu | Etiket |
|---|---|---|
| R1.0 | Render yalnız `model.children`'dan beslenir + `key={node.id}` | ✓ verified @ ac3d6a4 |
| R1.1a | Stale memo (reference-equality) | ✓ ELENDİ — setDiagram yeni obje |
| R1.1b | Server merge | ✓ ELENDİ — WS server stateless |
| R1.1c | Layout Map eski key'leri node üretir | 🔍 partial — konum stale eder, node üretmez |
| R1.1d | Client-side derived action nodes | ⚠️ ELENDİ (exhaustive değil) |
| R1.1e | Key prop eksik | ✓ ELENDİ — key var |
| R1.1f | View-type/SSE child üretimi | ✓ verified — WS, viewType gönderiliyor |
| **R1.2 #1** | **Async ELK `.then` cancelled guard yok (908-941)** | **✓ verified @ ac3d6a4** |
| **R1.2 #2** | **WS model kanalı request/response korelasyonsuz (diagram-client.ts:53-57, EditorPage:392)** | **✓ verified @ ac3d6a4** |
| R1.3 | Tam DOM-mix mekanizması | 🔍 partial — runtime probe gerekli (spec verildi) |
| R2 | Autosave path (handleChange→debounced PUT) | ✓ verified @ ac3d6a4 |
| R2 | Switch-PUT tetikleyici + corruption riski | 🔍 partial — Monaco onChange semantiği + guard gerek |
| R3 | data-node-id yok (React key ≠ DOM attr) | ✓ verified @ ac3d6a4 |
| R3 | Fix: `data-node-id={node.id}` <g>'lere | ✓ verified (ekleme noktaları listelendi) |
| R4 | SSE = file-events (files.ts:18), render = WS /diagram | ✓ verified @ ac3d6a4 |
| R4 | brief v1.4 §5.2/§6 SSE-conflation düzeltmesi | ✓ verified |

---

## Brief v1.0 İçin Açık Karar Noktaları (DP candidate)

1. **R1 fix sırası:** Önce runtime probe (DEFEKT #1 mi #2 mi PRIMARY) → sonra fix. Yoksa "iki defekti de düzelt, probe ile teyit et" (savunmacı). DP: probe-first mi fix-both mi?
2. **R1 DEFEKT #2 fix tasarımı:** WS model'e uri/requestId echo + client'ta `if (msg.uri !== currentUri) ignore`. Bu shared-types + diagram-service + diagram-client + EditorPage = **multi-package** (4 dosya). Backend dokunuşu VAR (ilk discovery'deki "backend yok" sadece DEFEKT #1 + R3 için geçerli).
3. **R2 scope:** Bu slice'a mı (Monaco guard) yoksa ayrı backlog mu? Cross-file corruption riski doğrulanırsa yüksek öncelik.
4. **R3 önce:** `data-node-id` eklemesi fix-verification'ın ön-koşulu → muhtemelen ilk commit (test altyapısı).
5. **Test:** DiagramViewer testi yok (ilk discovery). DEFEKT #1 (cancelled guard) saf-fonksiyon değil (async effect) → RTL veya effect-extraction. DEFEKT #2 client-state logic → izole edilebilir.
6. **Kapsam revizyonu:** Bu artık "frontend state cleanup" değil — en az 3 ayrı defekt (ELK race, WS korelasyon, selection cleanup) + R3 altyapı + R2 guard. **Brief v1.0 multi-defect olarak yeniden çerçevelenmeli**, belki sub-slice'lara bölünmeli.

---

## İlk Discovery'den Devreden (hâlâ geçerli)
- `multiSelectedNodeIds` + parent `diagramSelectedNodeId` switch'te reset edilmiyor (selection staleness) — SVG-persist'ten AYRI bir defekt, düşük öncelik ama aynı slice'ta toplanabilir.
- Cleanup effect (497-505) layout reset ediyor, interaction state etmiyor.
- EditorPage remount yok (route key yok) → state persist.
