# Phase 2 Slice 6a — Adım 0 Keşif Raporu (impl öncesi)

**Slice:** Phase 2 Slice 6a — Interconnection porto (pure refactor)
**Yanıtlayan:** AG (Claude Code)
**Tarih:** 2026-05-27
**Brief:** `phase2_slice6a_interconnection_porto_brief_v1_0.md`
**Repo HEAD:** `49653c7` (uncommitted)
**Amaç (§6, §8.3 4-adım):** impl'e BAŞLAMADAN state-machine pattern'inin IV'ye 1:1 tekrarlanabilirliğini doğrula, IV node/edge envanteri + IR draft çıkar, fixture seç, kontrat ihlali/varsayım çürütmesi raporla.

> **TL;DR (Architect için):** State-machine pattern **yapısal olarak** tekrarlanabilir (3 dosya + shared-types IR + wiring ✓), AMA **renderer katmanında DEĞİL** — IV renderer, state-machine'in sabit-boyut 3-şekilli renderer'ının aksine `nodeToSNode`'un ~247 satırını (dinamik `textWidth` boyutlama + compartment label formatlama + zengin `data` payload + per-kind dallanma) byte-identical taşımak zorunda. Bu brief'i **çürütmüyor** (Architect §5.7'de IR sapmasını öngörmüştü) ama **W2/W3 efor profilini ve IR şeklini** belirliyor → **CP-1'de IR-tasarım kararı gerek** (semantik IR vs thin IR). Ayrıca **2 brief düzeltmesi** yakaladım (call-site + fixture kaynağı).

---

## §1 — State-machine pattern 1:1 tekrarlanabilir mi? (brief §6.1)

**Yapısal: ✓ verified.** Dosya düzeni + wiring birebir uygulanabilir:
- `rendering/state-machine/{transformer,renderer,index}.ts` (3 dosya) + `shared-types/src/diagram-ir/state-machine.ts` (IR ayrı pakette). `index.ts` barrel (`ViewRenderer` = `{ viewType, transformAstToIR, toSModelRoot }`).
- Wedge zaten view-agnostic, IV için ek dallanma gerekmez (`pipeline.ts:51-120`).

**Renderer katmanı: ✗ refuted (kritik sapma).** State-machine renderer'ı (`renderer.ts:38-40`) **sabit boyut** kullandı (`STATE_SIZE=140×60`, `PSEUDO=24×24`, `BEHAVIOR=140×50`) ve **3 şekil** (state/pseudo/behavior), `data` payload **yok**. IV ise tamamen farklı:

| Boyut | State-machine renderer | IV renderer (gerekli) |
|---|---|---|
| Node boyutlama | Sabit (3 sabit) | **Dinamik** — `textWidth(text,fs)=len*fs*0.62+16` (`bdd-transformer.ts:142-144`), label/compartment genişliğine göre |
| Node şekilleri | 3 (state/pseudo/behavior) | **7+ branch**: Package tab-rect (`:168-178`), Comment note (`:181-197`), Control (`:201-214`), PortUsage boundary (`:218-230`), directed usage (`:235-262`), usage+inherited (`:269-302`), def+compartment (`:305-391`) |
| `data` payload | yok | **`{ qualifiedName, range, isRef, isParallel, direction? }`** her node'da — frontend bunu kullanıyor (port yön oku `data.direction`, `DiagramViewer.tsx:2378`) |
| Compartment label'lar | basit (entry/do/exit) | **karmaşık** — `node.attributes` → KEYWORD_VALUES/USAGE_KEYWORD_DISPLAY + `:>`/`:>>`/`::>` operatörleri + derived `/` + inherited `^` (`:339-372`) |
| Kind etiketi | sabit guillemet | **KIND_DISPLAY** tablosu (95 girdi, `:17-111`) + abstract/ref/individual/snapshot/parallel modifier'ları (`:152-157`) |

**Sonuç:** IV renderer ≈ legacy `nodeToSNode` (247 satır) + `connectionToSEdge` (30 satır) + yardımcı tablolar (KIND_DISPLAY, USAGE_KEYWORD_DISPLAY, KEYWORD_VALUES, IS_USAGE, CONTROL_KINDS) + `textWidth`/`makeLabel` **byte-identical port**. Bu W3'ün büyük kısmı; "thin renderer" beklentisi IV için geçersiz.

**Transformer'ın taşıması gereken pre-render adımları (W2):**
- `nodesWithChildren` hesabı (composition/noncomposite edge'lerden, `:681-688`) → `skipCompartments` flag'i. **IV'de gerekli** (nested part'lı def'ler compartment'sız render).
- `showInherited` ise `resolveInheritedAttributes` (mutasyon, `:619-621`+`:424`). Wedge `showInherited`'i viewSpec'te paslıyor; byte-identical için taşınmalı.
- `hiddenNodeIds`: IV'de **boş** (general bloğu IV'ye uygulanmaz; entry/do/exit zaten filtrede atıldı, brief §2 ✓) → hiding mantığı IV'de **gereksiz**, taşınmaz.
- `resolveActionUsageParams`: IV `cloneDefParamsAsUsagePins=false` (`view-config.ts:61`) → **çağrılmaz**, taşınmaz.

---

## §2 — IV node/edge envanteri + IR draft (CP-1 deliverable)

**Filtre sonrası IV node kind'leri** (`view-filters.ts:12-16` `IV_NODE_KINDS`): PartUsage, PortUsage, ConnectionUsage, InterfaceUsage, ItemUsage, AttributeUsage + PartDefinition, PortDefinition, ConjugatedPortDefinition, ConnectionDefinition, InterfaceDefinition, ItemDefinition, AttributeDefinition + Package = **13 kind**.

**Filtre sonrası IV edge kind'leri** (`IV_EDGE_KINDS`): composition, noncomposite, flow, successionflow, message, bind, association, subsetting, redefinition, referencesubsetting, crossing = **11 kind**. (typereference IV_EDGE_KINDS'te YOK → filtrede elenir, `:699` IV için moot ✓.)

**IR-tasarım gerilimi (CP-1 kararı gerek):** Pure byte-identical refactor için IR iki uçta olabilir —
- **(B) Semantik IR (state-machine emsali, ÖNERİM):** IR node `nodeToSNode`'un okuduğu **semantik alanları** taşır; renderer per-kind mantığı çalıştırır. 6b kalibrasyonu için doğru zemin (renderer'da IR→SModel mapping'i değişir, transformer'a dokunulmaz). Maliyet: renderer'a ~247 satır port.
- **(A) Thin IR:** transformer SModel'e-yakın label/size/data üretir, renderer 1:1 map. IR neredeyse SModel kopyası, semantik değer az; 6b kalibrasyonu transformer'a sızar.

> ⚠️ **Bu kararı tek başıma vermiyorum** — brief IR-midpoint pattern'ine kararlı ama IV'de IR'ın anlamı state-machine'deki kadar net değil (state-machine IR'ı structured label ile Bug-SM-01'i unrepresentable yapmıştı; IV pure-refactor'da IR ceremonial riski var). **Önerim (B)**, gerekçe: 6b kalibrasyonunu izole eder. Architect onayı CP-1'de.

**IR draft (Option B — semantik):**
```typescript
// shared-types/src/diagram-ir/interconnection.ts
export interface InterconnectionNode {
  id: string;
  kind: string;                  // SysML kind (PartUsage, PortUsage, ...) — renderer KIND_DISPLAY'e bakar
  name: string;
  qualifiedName?: string;        // "name : Type" + conjugated '~' burada taşınır
  direction?: 'in' | 'out' | 'inout';
  multiplicity?: string;
  isRef?: boolean; isParallel?: boolean; isAbstract?: boolean;
  isIndividual?: boolean; portionKind?: 'snapshot' | 'timeslice';
  ownerIsPortOrActionUsage?: boolean;
  attributes?: IRAttribute[];    // compartment label'ları için (name/value/type/inherited/isDerived)
  hasVisibleChildren: boolean;   // = nodesWithChildren (skipCompartments) — transformer hesaplar
  isStdlib: boolean;             // id.startsWith('stdlib__')
  range?: SourceRange;
}
export interface InterconnectionEdge {
  id: string; kind: string;      // composition/association/flow/bind/... → renderer cssClass=kind
  sourceId: string; targetId: string;
  name?: string; sourcePort?: string; targetPort?: string;  // flow label mantığı için
  range?: SourceRange;
}
export interface InterconnectionIR {
  viewType: 'interconnection';
  metadata: IRMetadata;
  nodes: InterconnectionNode[];
  edges: InterconnectionEdge[];
}
```
**Gözlem:** IR node ≈ `SysMLNode`'un IV-ilgili alt-kümesi + `hasVisibleChildren`. Bu dürüst — IV'nin SModel'i AST'ye yakın (filtre seçim yapıyor, transformer şekillendirmiyor). Renderer asıl işi yapar.

---

## §3 — Fixture seçimi (brief §6.3) + 🔍 KAYNAK GAP'i

**🔍 Brief'in önerdiği fixture kaynağı repo'da yok / uygunsuz.** Brief §5.W5: "Platform Owner'ın `flows.sysml`/`interfaces.sysml`/`conjuge.sysml` modelleri systemodel.com'da, Standard Libraries başlangıç noktası." Ama:
- Repo'daki `Standard Libraries/Systems Library/Flows.sysml` + `Interfaces.sysml` = **soyut SysML standart kütüphane tanımları** (`abstract flow def MessageAction :> Action, Link`). **IBD instance modeli DEĞİL** — part usage / `connect` / nested part **yok**. IV fixture olarak **kullanılamaz.**
- Platform Owner'ın gerçek IBD modelleri (`InterconnectionView` paketi) **repo'da yok, benim bağlamımda yok.**

**Önerim: fixture'ları AG kendi yazsın** (differential oracle için "gerçek" model gerekmez, IV yüzeyini kapsayan model gerekir). 3 fixture:
1. **`basic`** — part + 2 port + `connect` (composition + association + port boundary kontratı)
2. **`multi-port`** — nested part hiyerarşisi + birden çok port + flow + bind (compartment + nesting + flow label + bind `=`)
3. **`conjugated`** — `port p : ~PortDef` + interface def (conjugated `~` + interface def node)

(Adım 0 probe modelim bu 3'ün çekirdeğini zaten doğruladı — headless byte-identical üretiyor.) Platform Owner'ın gerçek modelleri **6b görsel işine** eklenebilir; 6a differential oracle için self-authored yeterli ve **kapsama kontrolü daha iyi.** → **Architect onayı: self-author OK mi?**

---

## §4 — Çağrı Sitesi Haritası Düzeltmeleri (§8.2.1 — brief'te 2 hata yakalandı)

| Brief iddiası | Gerçek (doğrulandı) | Etki |
|---|---|---|
| W4: `packages/diagram-service/src/rendering/index.ts:15-17` register | **`rendering/index.ts` YOK.** Register `src/index.ts:15` (`viewRegistry.register('state-machine', () => import(...))`). | W4 doğru dosyaya yazılmalı: **`src/index.ts:15`** |
| W4: `register('interconnection', { transform, render })` | API: `register(viewType, loader)`, `loader: () => Promise<ViewRenderer>`, `ViewRenderer = { viewType, transformAstToIR, toSModelRoot }` (`view-registry.ts:38,44`). Lazy dynamic-import. | W4 imzası: `viewRegistry.register('interconnection', () => import('./rendering/interconnection/index.js').then(m => m.interconnectionRenderer))` |

Diğer call-site'lar (brief W1 `diagram-ir/index.ts:13-35`, W3 `EDGE_STYLES`, mapper `:14-19`) **✓ doğru.**

---

## §5 — Differential oracle FİZİBİL Mİ? (W5 kritik)

**✓ Byte-identical fizibil — state-machine'in golden-divergence sorunu IV'de YOK.**
- Wedge yeni-path'te `applyViewFilter(model,'interconnection')` (`pipeline.ts:102`), legacy `transformToBDD` de aynı fonksiyonu içeride çağırıyor (`:616`). **Aynı filtre, aynı girdi.** (State-machine'de STV filtresi start→entry remap yapıp golden'ı saptırmıştı, `pipeline.ts:96-99`; IV filtresinde böyle remap **yok** — `filterInterconnectionView` saf seçim.)
- **SModel `id` eşleşiyor:** legacy `interconnection__<uri>` (`:706`), tag seçimi `'interconnection'` olduğu için yeni renderer da `interconnection__<uri>` üretir → id byte-identical. (Tag `'internal-block'` seçilseydi id sapardı; brief'in `'interconnection'` seçimi bunu garantiliyor ✓.)
- Çocuk sırası: legacy `[...sNodes, ...sEdges]` (`:707`). Renderer aynı sırayı korumalı (önce node'lar filtre sırasında, sonra edge'ler).

**Sonuç:** `expect(newSModel).toEqual(transformToBDD(model,'interconnection'))` byte-identical geçebilir — renderer `nodeToSNode`/`connectionToSEdge`'i tam replike ettiği sürece. Bu güçlü ve ulaşılabilir bir hedef.

---

## §6 — Architect Kararı Bekleyen / Olası Brief v1.1 Tetikleri

1. **IR tasarımı (B semantik vs A thin)** — §2. Önerim B. **CP-1'de onay**, ama W1 (IR şeması) bu karara bağlı olduğu için **impl'den önce** netleşmeli. → *Hafif v1.1 ya da chat onayı.*
2. **Fixture kaynağı** — §3. Self-author öneriyorum (PO modelleri repo'da yok). → *chat onayı yeterli.*
3. **Brief call-site düzeltmeleri** — §4. `src/index.ts:15` + loader imzası. → *not düzeyinde, v1.1 gerekmez, impl'de doğrusunu kullanırım.*
4. **Renderer efor profili** — §1. W3 "thin" değil "ağır port"; brief'in risk profili "düşük-orta" diyor, gerçekçi ama W3 efor beklentisi yukarı revize edilmeli. → *bilgi; brief'i çürütmez.*

**Bunların hiçbiri brief'i ÇÜRÜTMÜYOR.** Architect §5.7'de IR sapmasını ve CP-1 gate'ini zaten kurmuştu — bulgular o gate'i besliyor. **Tek "impl-bloklayıcı" karar: IR tasarımı (madde 1).** Onu netleştirince W1'e başlarım.

---

## §7 — Honest Gaps (🔍)

1. **🔍 `browser_observation.md` bağlamımda yok.** Brief referans veriyor ama dosya `claude_md_files/`'te yok (chat üzerinden paslanmış). P6 (edge label 2× render) sadece brief §5.1 özetinden biliniyor — ham DOM ölçümlerini görmedim. 6a kapsamı dışı (porto sonrası sayı değişmezse kontrat korunmuş demektir, brief §5.1 ✓).
2. **🔍 PO IBD modelleri yok** (§3) — self-author ile aşılıyor; 6b görsel fidelity için gerçek modeller gerekecek.
3. **🔍 Pixel-identical ≠ byte-identical** — CP-3 Tarayıcı re-probe gerektiriyor (brief zaten K5.a'da kurmuş). 6a domain'imden SModel byte-identical kanıtlarım; pixel Tarayıcı.

---

**Adım 0 tamam. Impl-bloklayıcı tek karar: IR tasarımı (B semantik öneriyorum).** Onay + fixture self-author onayı gelince W1→W5 sırasıyla başlarım; W4'te düzeltilmiş call-site'ları (`src/index.ts:15` + lazy loader) kullanırım. Pure refactor disiplinini koruyacağım — "yanlış görünüyor" hissi olursa DURUP raporlarım (§5.6 A6), kalibrasyon 6b.

— AG (Claude Code), Slice 6a Adım 0
