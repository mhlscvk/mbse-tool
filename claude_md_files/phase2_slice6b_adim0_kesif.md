# Phase 2 Slice 6b — Adım 0 Keşif Raporu (frontend kalibrasyon kök neden)

**Slice:** Phase 2 Slice 6b — IV frontend görsel/layout kalibrasyon (K1 edge çakışması + K2.2 port konum)
**Yanıtlayan:** AG (Claude Code)
**Tarih:** 2026-05-27
**Brief:** `phase2_slice6b_frontend_calibration_brief_v1_0.md` + `phase2_slice6b_baslama_talimati.md`
**Repo HEAD:** `33f04d8` (Slice 6a kapanış)
**Yöntem:** Statik kod okuma (`DiagramViewer.tsx` layout + edge routing + port snap). Runtime DOM ölçümü Tarayıcı domain'i (🔍 işaretli).

> **🔑 TL;DR — EN KRİTİK BULGU:** **K1 (edge çakışması) büyük ölçüde K2.2'nin (port çakışması) SEMPTOMU, bağımsız bir bug değil.** Orthogonal router (`routeOrthogonal:1163-1171`) edge yolunu **yalnızca source/target node merkezlerinden** türetiyor; çakışan port'lar (K2.2) → çakışan srcPt/tgtPt → birebir aynı `d`. Brief K1 (W2) ve K2.2'yi (W3) **iki bağımsız fix** olarak çerçeveliyor; bulgu **bağımlı** olduklarını gösteriyor → **fix sırası K2.2-önce olmalı, sonra K1 yeniden ölç** (muhtemelen ayrı K1 fix'i gerekmez/minimal). Bu bir CP-1 / olası brief v1.1 kararı (§ sonunda).

---

## §1 — Soruların Cevapları

### Q1 — K1 (edge yol çakışması) kök neden

**Edge `d` nereden geliyor (3 katmanlı fallback, `edgePath:1364-1408`):**
1. `elkEdgeRoutes.get(edge.id)` (`:1366`) — ELK-computed route. **IV cross-container edge'leri için undefined**: cross edge'ler ELK'ya `cross_${pairKey}` id'siyle, pair başına **tek** edge olarak veriliyor (`:804-807` `if (crossEdgePairs.has(pairKey)) continue`), orijinal `edge.id` ile değil → `get(edge.id)` boş döner.
2. `routedEdgePaths.get(edge.id)` (`:1370`) — **IV edge'lerinin gerçek kaynağı.** `routeOrthogonal(e.sourceId, e.targetId)` (`:1355`) her association/bind/interface edge için orthogonal yol hesaplar.
3. Düz/eğri fallback + `edgeCurveOffset` fan (`:1381-1407`).

**Kök neden — `routeOrthogonal` edge kimliğini değil, yalnızca uç-node konumlarını kullanıyor (`:1163-1171`):**
```
const srcCenter = nodeCenter(srcId);   // sadece node pozisyonu
const tgtCenter = nodeCenter(tgtId);
const { srcSide, tgtSide } = chooseSides(...);
const srcPt = sideBorderPoint(srcCenter, srcSz, srcSide);  // node sınır noktası
```
→ İki edge'in source/target node'ları **aynı konumdaysa** (çakışan port'lar = K2.2), srcPt/tgtPt **birebir aynı** → orthogonal candidate'lar aynı → **aynı `d`**. Gözlemlenen conjuge `d = "M 192 140 L 182 140 L 182 338 L 172 338"` (4-nokta orthogonal) tam olarak `routeOrthogonal` çıktısı; 3 edge'in aynı olması = 3 port çiftinin çakışık olması.

**İkincil mekanizma (IV'de minör): parallel-edge fan bypass.** `edgeCurveOffset` (`:1015-1035`) aynı port-çiftindeki edge'leri yelpazeleyip ayırır — AMA bu yalnızca **düz/eğri fallback'te** uygulanır (`:1381`). `routedEdgePaths` bir yol döndürürse `edgePath` `:1370`'te erken return eder, offset'e hiç ulaşmaz. Yani aynı port-çiftindeki iki edge routedEdgePaths'te de çakışır. IV'de aynı port-çiftinde 2 edge nadir (her connect/flow/bind farklı port), bu yüzden **dominant neden K2.2**, bu değil.

**Sonuç:** K1 ≈ K2.2'nin downstream'i. `cross_${pairKey}` collapse'i (`:804`) sadece ELK *layout ordering* içindir (render `d`'sini etkilemez, çünkü cross route `edge.id`'ye map'lenmiyor).

### Q2 — K2.2 (port konum bug'ı) kök neden

**Port snap mantığı (`:846-888`):** nested mode'da her pin (cssClass ∈ `vcfg.pinCssClasses`, IV için `portusage`) için:
1. ELK pin'i parent'ın **iç (interior) child**'ı olarak yerleştirir (ports ELK'ya sıradan node olarak veriliyor — ELK-native port değil).
2. Snap, pin'in ELK iç merkezinden (`cx,cy`, `:860-861`) **en yakın kenarı** bulur (`:867-873`) ve o kenara straddle eder (`:879-887`).

**Kök neden:** Snap **her port'u bağımsız** olarak iç pozisyonundan kenara map'liyor — **aynı parent + aynı kenardaki port'lar arasında dağıtım / çakışma-önleme YOK.** ELK iki port'u aynı/benzer iç koordinata koyduysa (tiny 16×16 pin'ler, aralarında edge yok, layout onları ayırmaya zorlanmıyor), ikisi de **aynı kenar noktasına** snap olur → çakışık port (interfaces: 6 çift aynı bbox, örn. `usbC_b1`↔`usbC_b12` (767,220)).

> ELK'nın native port constraint'i (`elk.portConstraints`, boundary port placement) **kullanılmıyor**; ports interior node + post-hoc nearest-side snap. Anti-collision adımı eksik.

**55 px taşma (flows `fuelTank.outlet`) — AYRI alt-vaka, 🔍 runtime gerek:** Snap formülü bir pin için -55px üretemez (left snap = `parentPos.x - half` = parent kenarından 8px). Hipotez: `outlet : Definitions::Outlet` bir **container-port** (Outlet port def'inin item'ları fuelOut/fuelIn var → outlet'in child'ları var). Snap pin'in **kendi** node'unu 16×16'ya set ediyor (`:888`) ama render edilen `<g>` bbox'ı child item node'larını içeriyor olabilir → bbox sola taşar. Veya container-port snap'i atlanıyor (parent pos/size eksik, `:858 continue`). **Kesin neden ELK çıktısı + DOM bbox gerektirir → Tarayıcı.**

### Q3 — Fix yaklaşımı önerisi

**Fix SIRASI (brief'ten sapma — aşağıda gerekçe):** Önce K2.2, sonra K1 yeniden ölç.

**K2.2 fix (kök) — brief §3.W3 (b)+(a) hibrit, ÖNERİM:**
Snap loop'unda (`:846-889`), pin'leri kenara map'lemeden **önce** `(parentId, side)` ile grupla; her grubu mevcut `cy` (left/right) ya da `cx` (top/bottom) sırasına göre sırala; kenar boyunca **min spacing** (örn. `PORT_BORDER_SIZE + 4`) ile dağıt. Deterministik, çakışma-önleyici, mevcut snap mimarisine minimal dokunuş.
- Alternatif (daha büyük): ELK-native port constraints'e geçiş — Slice 6b scope'u için fazla (cross-view refactor). Önermiyorum.

**K1 fix — muhtemelen GEREKMEZ veya minimal:** K2.2 fix port'ları ayrıştırınca srcPt/tgtPt ayrışır → conjuge 4 edge / interfaces 14 edge **farklı `d` alır**. Re-probe sonrası **kalan** çakışma varsa (gerçek aynı-port-çifti parallel edge): `routedEdgePaths`'e fan offset ekle (brief §3.W2 (a)) — `edgeCurveOffset`'i routed path'e de uygula (perpendicular kaydır) ya da fanned çiftleri routing'den çıkar. Ama bunu **K2.2 fix + re-probe'dan sonra** karar ver, kör fix atma.

### Q4 — Cross-view regresyon riski (kritik)

**Snap loop (`:847`) TÜM nested view'larda çalışıyor** (`effectiveViewMode === 'nested' && vcfg.pinCssClasses.size > 0`). Frontend `view-config.ts`'e göre pinCssClasses:
- **general:** `{actionin, actionout, actioninout}` (action pin'leri)
- **interconnection:** `{portusage}`
- **action-flow:** `{actionin, actionout, actioninout, portusage}`
- **state-transition:** `{actionin, actionout, actioninout, portusage}`

→ K2.2 fix (snap'e dağıtım eklemek) **sadece IV'yi değil, general / AFV / STV pin yerleşimini de değiştirir.** Bu gerçek cross-view etki.

**Regresyon planı (W4):**
- jsdom unit test: aynı parent'ta multi-pin → distinct, çakışmasız pozisyon (IV portusage + AFV actionin/out senaryoları).
- Mevcut suite 1176 yeşil kalmalı (özellikle web-client DiagramViewer testleri).
- **Tarayıcı CP-3 re-probe yalnız IV değil**, state-machine + AFV + general için de DOM count + port konum ölçmeli (bu view'larda istenmeyen layout kayması var mı). Brief başlama talimatı §3.Q4 bunu zaten istiyor — onaylıyorum, genişletiyorum: AFV + STV de dahil (pinCssClasses port içeriyor).

---

## §2 — Devralınan İddialar / Hipotez Tablosu

| Brief hipotezi | Kaynak | Doğrulama | Kanıt |
|---|---|---|---|
| "K1: layout parallel edge'leri ayırmıyor, aynı source-target çifti aynı path" | brief §2 | **🔍 kısmen / yeniden çerçevelendi** | Asıl neden farklı port-*çiftleri* değil, çakışan *port'lar*; K1 ⊂ K2.2 (`routeOrthogonal:1163-1171`) |
| "K1 çözümü ELK config / post-processing / unique offset (a/b/c)" | brief §2 | **✗ ana neden değil** | ELK config K1'i çözmez (route node pozisyonundan; sorun port çakışması). K2.2 fix K1'i çözer |
| "K2.2: layout port konumu deterministik ama çakışma çözümü yok" | brief §2 | **✓ verified** | Snap `:846-888` anti-collision/distribution yok; her port bağımsız nearest-side |
| "K1 ve K2.2 iki bağımsız fix (W2, W3)" | brief §3 | **✗ refuted — bağımlı** | K1 büyük ölçüde K2.2 semptomu; fix sırası K2.2-önce |
| "16-21 px sapma tasarım (K2.1), dokunma" | brief §2 | **✓ kabul** | Snap straddle (half=8) kasıtlı; dokunmuyorum |
| "Fix cross-view'ı kırmaz (varsayım)" | brief §5 | **✗ risk doğrulandı** | Snap tüm nested view'larda çalışır; general/AFV/STV etkilenir (Q4) |

**Self-caught (§5.6 A6):** Benden syntax/typo yok (salt okuma). Brief'in K1/K2.2 bağımsızlık çerçevesi gerçekle uyuşmuyor — bunu raporluyorum, sessizce kendi planımı uygulamıyorum.

---

## §3 — Honest Gaps (🔍 — Tarayıcı / runtime domain)

1. **🔍 55 px taşma kök neden (flows fuelTank.outlet):** Container-port bbox artefaktı hipotezi (Outlet'in item child'ları). Kesin tanı ELK çıktısı + DOM bbox gerektirir → **Tarayıcı**. Snap formülü tek başına -55px üretemez.
2. **🔍 ELK'nın port'ları neden aynı iç koordinata koyduğu:** Mekanizma (anti-collision yokluğu) statik kanıtlı ve fix bundan bağımsız (dağıtım her durumda çözer), ama spesifik ELK davranışı runtime. Fix için **gerekli değil** — dağıtım deterministik çözüm.
3. **🔍 K2.2 fix sonrası K1 tam çözülüyor mu:** Statik olarak "büyük ölçüde evet" diyorum (ayrık port → ayrık `d`), ama %100 kanıt **re-probe** gerektirir (Tarayıcı, K2.2 fix sonrası). K1 kalan-fix kararı buna bağlı.
4. **🔍 Edge label 2× render (P6) / İlişkiler-60 (UI metrik):** Brief zaten scope dışı işaretledi; dokunmuyorum.

---

## §4 — Brief v1.1 Tetiği Değerlendirmesi (CP-1 kararı)

**Bir adet ⚠️ scope/framing sapması var — Architect kararı gerek:**

Brief W2 (K1) ve W3'ü (K2.2) **bağımsız, paralel fix** olarak yapılandırıyor. Bulgu: **bağımlılar; K1 ⊂ K2.2.** Önerdiğim revize akış:
- **W3' (önce):** K2.2 port dağıtımı fix'i.
- **Ara re-probe (Tarayıcı):** K1 çakışması ne kadar kaldı?
- **W2' (sonra, koşullu):** Kalan K1 varsa minimal fan-offset; yoksa W2 no-op kapanır.

Bu brief'in **amacını** (K1=0 + K2.2=0 edge/port çakışması) değiştirmiyor, sadece **fix sırası + bağımlılık** yapısını düzeltiyor. Senin kararın:
- (A) Bunu CP-1 onayıyla kabul et (brief v1.1 yazmadan, W2/W3 sırası AG takdirinde) — **önerim**, A12 pattern (Slice 6a CP-1.5 emsali).
- (B) Brief v1.1 ile W2/W3'ü resmen yeniden sırala.

Diğer her şey brief'e sığıyor; kök neden **tek katman** (frontend `DiagramViewer.tsx`, ELK config DEĞİL — ELK port'ları interior veriyor, fix snap katmanında). ELK upgrade / backend layout hint gerekmiyor.

---

## §5 — Önerilen WI (revize) + dokunulacak dosyalar (call-site)

| WI | Dosya:satır | İş |
|---|---|---|
| **W3' K2.2** | `DiagramViewer.tsx:846-889` (snap loop) | Pin'leri `(parent, side)` grupla, kenar boyunca min-spacing dağıt |
| **W2' K1 (koşullu)** | `DiagramViewer.tsx:1349-1362` (routedEdgePaths) + `:1370/1381` | Kalan çakışma varsa routed path'e fan-offset; re-probe sonrası karar |
| **W4 regresyon** | **Yeni** `web-client/src/components/Diagram/DiagramViewer.layout.test.tsx` | jsdom: multi-pin distinct pozisyon (IV + AFV); cross-view DOM count |
| **W5 re-probe** | (Tarayıcı) | conjuge/flows/interfaces fix-öncesi vs sonrası + state-machine/AFV/general regresyon |

**55px (🔍):** W3' kapsamında container-port bbox'ı Tarayıcı doğruladıktan sonra ele alınır; gerekirse ayrı küçük fix.

---

**Adım 0 tamam.** En kritik çıktı: **K1 ⊂ K2.2 (bağımlı), fix K2.2-önce.** Kök neden tek katman (frontend snap `:846-888` anti-collision yok + `routeOrthogonal:1163-1171` node-pozisyonundan route). Cross-view etki gerçek (snap tüm nested view'larda → W4 general/AFV/STV dahil). 🔍'lar: 55px taşma + K2.2-sonrası-K1 kalan = Tarayıcı re-probe. **CP-1'de fix-sıra kararını (A/B) bekliyorum**, sonra W3'e (K2.2) geçerim.

— AG (Claude Code), Slice 6b Adım 0
