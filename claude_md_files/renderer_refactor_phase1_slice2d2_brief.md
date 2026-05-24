# Faz 1 Slice 2d.2 — View-Filter Integration (Brief v1.0)

**Brief versiyonu:** v1.0 (iki aşamalı: çerçeve + keşif spec + pre-impl visual preview; v1.1 AG discovery + Tarayıcı görsel ön-kabul sonrası)
**Tarih:** 2026-05-24
**Author:** Architect Claude
**Önkoşul:** `phase1_slice2d3_handover.md` okundu, multi-root + container labels production'da
**Çapraz referans:** `renderer_refactor_phase1_brief_v1_3.md` (canonical ops), `phase1_slice2d1_closeout.md`, `phase1_slice2d3_closeout.md`
**Yeni operating model:** **Tarayıcı Claude görsel otorite** — Platform Owner görsel onay rolü Tarayıcı Claude'a delege edildi. Architect kriterleri tanımlar, Tarayıcı objektif ölçer.
**Tahmini süre:** 30 dk keşif + 30 dk pre-impl POC + 20 dk Tarayıcı ön-kabul + 1.5 saat impl + 30 dk deploy/dogfood = ~3.5 saat

---

## 1. Bağlam — Neden Slice 2d.2?

Slice 2d.1'de bilinçle ertelenen iş: **view-filter integration**. Şu an pipeline mimarisi asimetrik:

- **Yeni renderer (`pipeline.ts:95`):** Ham model alıyor, filter YOK
- **Legacy renderer (`bdd-transformer.ts:616`):** İçeride `applyViewFilter(model, viewType)` çağırıyor

Bu asimetri **View-First prensibinden taviz**:
- Pipeline'da tek "filter sorumluluğu" yok
- Yeni renderer view-spesifik scope mantığı yapmıyor (Slice 2d.1'de bilinçli, transformer non-state node'ları zaten ignore ediyor)
- Ama gelecek view'lar (BDD, IBD, Use Case, Requirement) eklendiğinde bu asimetri büyür

Slice 2d.2'nin amacı: **Filter pipeline-level uygulanır, hem yeni hem legacy bunu kullanır, View-First prensibi tam tamamlanır.**

### Trade-off: Görsel davranış değişikliği

Slice 2d.1'de ampirik kanıtlandı: `applyViewFilter` sensor-systems STV render'ını değiştiriyor. Filter `pseudo-initial__on`'u siliyor (entry action olan state için start→entry remap).

Ampirik veri (Slice 2d.1 §4 brief evrim):
```
sensor-systems  RAW      : nodes=8 edges=11 pseudos=[pseudo-initial__on, pseudo-initial__top, pseudo-final__top]
sensor-systems  FILTERED : nodes=7 edges=10 pseudos=[pseudo-initial__top, pseudo-final__top]
                pseudo-initial__on KAYBOLDU
                StartNodes: raw=2 → filtered=1
```

**Bu Slice 2d.2'nin asıl karar noktası:** Bu davranış değişikliği STV semantiğine uygun mu? **Tarayıcı Claude'un görsel ön-kabulü belirleyici.**

---

## 2. Scope

### Kapsamda

1. **Wedge'e filter integration:** `pipeline.ts:95` öncesi `applyViewFilter(model, viewType)`, filtered model hem yeni hem legacy'ye verilir
2. **Legacy filter cleanup:** `bdd-transformer.ts:616` `applyViewFilter` çağrısı kaldırılır (double-filter önle)
3. **Frozen snapshot regenerate:** `sensor-systems/expected-ir.json` + `expected-smodel.json` filter sonrası output ile deterministic regen (ADR-005 §7)
4. **ADR-005 D-FILTER-01:** Yeni decision — filter integration scope'u, pseudo-state semantic kararı belgele
5. **Pre-impl visual preview:** AG geçici POC ile filter sonrası sensor-systems render'ını üretir, Tarayıcı Claude görsel ön-kabul verir → onay sonrası impl
6. **Multi-root fixture davranışı:** Filter `multi-root-part-states` üzerinde nasıl davranır? Entry action var mı? Snapshot etkilenecek mi? (AG keşfi)

### Scope dışı

- **Yeni view type'ları (BDD, IBD, etc.):** Faz 2+'da, bu slice'ta sadece state-transition view filter integration
- **Filter algoritması değişikliği:** `filterStateTransitionView` davranışı dokunulmaz, sadece çağrı sitesi değişiyor
- **Slice 2d.1 + 2d.3 davranışı:** Multi-root + container labels dokunulmaz
- **Faz 1 Final Report:** Bu slice kapanışından sonra
- **Bug-RENDER-01:** Önceki backlog
- **Slice 2e (WS auth):** Faz 1.1

---

## 3. Yeni Operating Model — Tarayıcı Claude Görsel Otorite

### 3.1 Eski model (Slice 2d.1, 2d.3)

- Tarayıcı Claude: görsel raporlar (kanıt-temelli ham)
- Architect: raporu yorumlar, "bu kabul edilir mi" diye karar verir
- Platform Owner (Muhlis): görsel "doğru/yanlış" otoritesi

### 3.2 Yeni model (Slice 2d.2+)

- **Architect:** Görsel kabul kriterlerini **önceden** tanımlar (§7'de)
- **Tarayıcı Claude:** Kriterlere göre objektif değerlendirir, **"kabul/reddet"** kararı verir
- **Platform Owner (Muhlis):** Sadece sistemik kararlar (slice öncelik, scope), görsel düzeyde devreye girmez

### 3.3 Tarayıcı Claude'un kabul yetkisi

Tarayıcı Claude şunları yapar:
- Kriterleri tutturup tutturmadığını ölçer (yes/no per criterion)
- Eğer **kriterler tutturulmuyorsa**: spesifik hangi kriter, neden, kanıt (screenshot, DOM, WS)
- Eğer **kriterler tutturuluyorsa**: "kabul, deploy onayı verildi"

Tarayıcı'nın **kabul etmeme yetkisi var**. Bu durumda Architect karar verir (rollback / kriter revizyonu / yeni yaklaşım).

Bu yeni model brief v1.4'e canonical olarak girecek.

---

## 4. Implementation Plan (3 Aşama)

### Aşama 1: Discovery + Pre-impl POC (~60 dk)

**AG Adım 0a — Keşif:**
- `pipeline.ts:95-109` mevcut akış (raw model'in renderer'a gidişi)
- `bdd-transformer.ts:616` legacy filter call konumu
- `view-filters.ts:applyViewFilter` ve `filterStateTransitionView` signature + side effects
- `multi-root-part-states` fixture üzerinde filter etkisi (entry action yok, snapshot etkilenecek mi?)
- Frontend WS contract: filtered SModel beklenenden farklı bir şekil getirmez (sadece içerik)

**AG Adım 0b — Pre-impl POC:**
Geçici script (`scripts/_tmp-poc-filter-integration.ts`, push edilmez):
1. Sensor-systems fixture'ı oku
2. Manuel `applyViewFilter` uygula
3. Filtered model'i yeni transformer + renderer'a ver
4. Üretilen SModel'i kaydet (geçici dosya, output veya base64)
5. Aynı işi multi-root-part-states için tekrarla
6. AG raporda: IR diff özetleri + (mümkünse) SModel'in görsel preview yolu

**Pre-impl POC çıktısı:**
- Sensor-systems: pre-filter vs post-filter SModel diff (IR'da kaç node/edge eklendi/silindi, pseudo-state değişikliği detayı)
- Multi-root: pre-filter vs post-filter (büyük ihtimalle minor değişiklik veya hiç yok)
- Görsel preview için **lokal HTML render** veya **JSON snapshot Tarayıcı'ya iletilebilir formatta**

### Aşama 2: Tarayıcı Claude Görsel Ön-Kabul (~20 dk)

AG'nin POC çıktısı Tarayıcı Claude'a iletilir. Tarayıcı §7 kriterlerine göre değerlendirir, **"kabul / reddet / şüpheli"** raporu verir.

**Kabul:** Impl + deploy zinciri başlar.
**Reddet:** Architect karar verir — kriter revizyonu, alternatif yaklaşım, veya Slice 2d.2'yi backlog'a iade.
**Şüpheli:** Architect + Tarayıcı tartışma, kriter netleştirilir, tekrar değerlendirme.

### Aşama 3: Implementation + Deploy (~2 saat)

Sadece Aşama 2 KABUL sonra başlar.

**Implementation paketleri (3 atomic commit hedef):**

**Paket 1: Filter integration + cleanup**
- `pipeline.ts:95` öncesi `applyViewFilter` ekle
- `bdd-transformer.ts:616` `applyViewFilter` çağrısı kaldır
- Mevcut testlerin durumu güncelleyici test (filter çift uygulanmıyor)

**Paket 2: Snapshot regenerate**
- `sensor-systems/expected-ir.json` + `expected-smodel.json` filter sonrası output ile regen (AG'nin POC'sundaki output, deterministic)
- multi-root-part-states için snapshot kontrolü (büyük ihtimalle değişmez, yine de teyit)
- Mevcut testlerin uyarlanması

**Paket 3: ADR-005 D-FILTER-01 + dokümantasyon**
- ADR-005'e D-FILTER-01 ekle: filter integration scope + pseudo-state semantik kararı
- Brief v1.3 §10 anti-pattern'lere "Pipeline asimetrisi" ekle (gelecek slice'larda kontrol için)

**Deploy + dogfood (mevcut akış):**
- Pull → build → PM2 restart → /proc env doğrulama → smoke → counter baseline
- Self-dogfood (üçlü kanal: Tarayıcı görsel + AG backend + counter)
- Kanıt üçgeni hizalı ise permanent (yeni FF yok, mevcut yeterli)

---

## 5. Files to Touch

### Değişecek (kesin)

- `packages/diagram-service/src/rendering/pipeline.ts:95-109` — wedge öncesi filter
- `packages/diagram-service/src/transformer/bdd-transformer.ts:616` — legacy filter call kaldır
- `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-ir.json` — regen
- `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-smodel.json` — regen
- `docs/adr/005-state-machine-renderer.md` — D-FILTER-01 eklenir

### Değişme ihtimali (AG keşfi belirleyecek)

- `packages/diagram-service/tests/fixtures/state-machine/multi-root-part-states/expected-*.json` — filter etkisi varsa regen
- `packages/diagram-service/src/rendering/state-machine/end-to-end.test.ts` — e2e flow'da filter call eklenmesi
- `packages/diagram-service/src/rendering/state-machine/transformer.test.ts` — eğer testler ham model bekliyorsa update

### Dokunulmayacak

- `packages/diagram-service/src/transformer/view-filters.ts` — filter algoritması (sadece çağrı sitesi değişiyor)
- `packages/diagram-service/src/rendering/state-machine/transformer.ts` — multi-seed + container emit (Slice 2d.1 + 2d.3)
- `packages/diagram-service/src/rendering/state-machine/renderer.ts` — dokunulmaz
- `packages/shared-types/state-machine.ts` — IR şeması korunur
- `packages/web-client/*` — frontend dokunulmaz
- `ecosystem.config.cjs` — FF değişmez, mevcut yeterli

---

## 6. AG Keşif Spec (Adım 0)

### Keşif kapsamı

**Pipeline tarafı:**
- `pipeline.ts:95-109` — wedge try/catch içinde transformer çağrısı nasıl yapılıyor?
- `applyViewFilter` çağrısı nereye ekleyeceğiz (try öncesi mi içeri mi)?
- Wedge fallback'i (legacy) hâlâ filtered model'i alacak mı?

**Legacy tarafı:**
- `bdd-transformer.ts:616` filter call'u kaldırınca legacy davranışı değişir mi?
- Eğer pipeline filter ediyorsa, legacy'nin kendi filter call'u redundant — pure double-filter cleanup

**Filter side-effects:**
- `applyViewFilter('state-transition', model)` — input/output şekli (mutate mi, yeni model mi?)
- Eğer mutate ediyorsa, hem yeni hem legacy aynı modeli görür — paralel çağrılarda race risk?
- Slice 2d.1 ampirik veri: sensor-systems üzerinde 8→7 node, 11→10 edge

**Multi-root etkisi:**
- `multi-root-part-states` fixture'ında entry action var mı? (Eğer yoksa filter etkisi minimal)
- `applyViewFilter` multi-root fixture'da ne yapar? POC ile ölç.

### Pre-impl POC gereksinimleri

AG geçici script yazacak (Slice 2d.3 POC pattern'i):

```typescript
// scripts/_tmp-poc-filter-integration.ts (push edilmeyecek)
import { applyViewFilter } from '../src/transformer/view-filters.js';
import { transformAstToStateMachineIR } from '../src/rendering/state-machine/transformer.js';
import { stateMachineToSModelRoot } from '../src/rendering/state-machine/renderer.js';
import { parseSysMLText } from '../src/parser/sysml-text-parser.js';
// fixture yolları, parse, filter uygula, IR + SModel üret, kaydet
```

POC çıktısı:
1. `sensor-systems-PRE-filter.smodel.json` (mevcut output)
2. `sensor-systems-POST-filter.smodel.json` (filter sonrası)
3. Diff özeti (node/edge sayıları, pseudo-state değişikliği)
4. Aynı şey `multi-root-part-states` için
5. **Görsel preview yolu:** Eğer mümkünse, çıktıyı tarayıcıda görüntülenebilir bir HTML olarak da üret (DiagramViewer'ı standalone çalıştır) — Tarayıcı Claude'un kontrolü için

**Süre:** ~30 dk keşif + ~30 dk POC = 60 dk toplam.

---

## 7. Tarayıcı Claude Görsel Kabul Kriterleri (Architect Tarafından Tanımlanır)

Tarayıcı Claude pre-impl POC çıktısını alıp her kriteri **objektif olarak** değerlendirir. Yes/no + kanıt (screenshot, DOM detayı).

### Kriter 1: STV Semantik Doğruluğu

**Soru:** Entry action olan bir state için `pseudo-initial__<state>` silinmesi STV semantiğine uygun mu?

**Kabul kriteri:** Filter sonrası render'da:
- `On` state'inin içindeki **entry action** label'lı bir node olarak görünür (örn. «entry action» activation)
- Entry action node, On state'inin **start noktası** rolünü görsel olarak üstlenir
- Initial pseudo-state'in görsel boşluğu kapatılmış olur (çirkin "boş alan" yok)

**Reddet kriteri:**
- Entry action label kaybolmuş, On state'inin içine ne girdiği belirsiz
- Görsel akış kopuk: "On state'i nereden başlıyor?" sorusu cevapsız
- Initial pseudo-state'in olmaması nedeniyle layout broken

### Kriter 2: Görsel Okunaklılık

**Soru:** Filter sonrası render'da transition akışı net mi?

**Kabul kriteri:**
- Edge'ler doğru state'leri bağlıyor
- Label'lar (transition trigger'ları) okunabiliyor
- State'lerin görsel yerleşimi (layout) düzenli

**Reddet kriteri:**
- Edge'ler karışmış, hangi state'ten hangisine gittiği belirsiz
- Label'lar üst üste binmiş veya kesilmiş
- Layout broken (state'ler üst üste binmiş veya garip yerlere savrulmuş)

### Kriter 3: Multi-Root Paritesi

**Soru:** SensorSystemStates ve DeliverSSStates container'ları (Slice 2d.3) hâlâ doğru görünüyor mu?

**Kabul kriteri:**
- Her iki container hâlâ title-bar'lı render ediliyor («state» + name)
- İçerideki state'ler nested
- Görsel hierarchy bozulmamış

**Reddet kriteri:**
- Container label kayboldu
- Hierarchy bozuldu (state'ler container dışına savruldu)

### Kriter 4: Genel Görsel Sağlık

**Soru:** Pre-filter render ile karşılaştırıldığında, net olarak **iyileşme veya nötr** mi, **gerileme** mi?

**Kabul kriteri:**
- İyileşme: Filter sonrası render daha temiz, daha net
- Nötr: Görsel olarak fark yok ama mimari iyileşti (View-First prensibi)
- **Genel olarak: kullanıcı şikayet etmeyecek**

**Reddet kriteri:**
- Kullanıcı bakınca "bu eskiden daha güzeldi" diyecek
- Net görsel regression

### Kriter 5: SysML v2 Spec Uyumluluğu

**Soru:** Filter'ın start→entry remap'i SysML v2 spec'i ile uyumlu mu?

**Bu kriter Architect-bilgi gerektirir.** Tarayıcı Claude bu kriteri **kendi başına ölçemez**. Eğer kriter 1-4 kabul ise, kriter 5 "Architect onaylar" olarak işaretlenir, Architect karar verir.

### Karar Matrisi

| Kriter 1 | Kriter 2 | Kriter 3 | Kriter 4 | Sonuç |
|---------|---------|---------|---------|-------|
| ✓ | ✓ | ✓ | ✓/nötr | **KABUL** (kriter 5 Architect'e devredilir) |
| ✗ | * | * | * | **REDDET** — STV semantik problemi |
| * | ✗ | * | * | **REDDET** — okunaklık problemi |
| * | * | ✗ | * | **REDDET** — multi-root regression |
| * | * | * | ✗ | **REDDET** — net görsel gerileme |
| şüpheli | şüpheli | * | * | **ŞÜPHELİ** — Architect ile konuş |

---

## 8. Test Matrix (v1.1'de Detaylandırılacak)

İskelet:

| # | Senaryo | Beklenen |
|---|---------|----------|
| 1 | Sensor-systems regen sonrası test | Filter sonrası snapshot match |
| 2 | Multi-root-part-states (Slice 2d.3) | Etkilenmedi / minimal etki, snapshot match |
| 3 | Wedge filter doğru çalışıyor | Filter pipeline-level uygulanıyor, double-filter yok |
| 4 | Legacy filter cleanup | bdd-transformer'da filter call YOK |
| 5 | E2E counter | rendererUsed:'new', fallback:0 |
| 6 | Boş model edge | Filter no-op, transformer no-op |

---

## 9. Acceptance Criteria (v1.1'de Detaylandırılacak)

İskelet:

- [ ] Tarayıcı Claude görsel ön-kabul: Kriter 1-4 KABUL (kriter 5 Architect onayı)
- [ ] `pnpm test` tüm monorepo yeşil (1138+ test, regen ile +1-3 test eklenebilir)
- [ ] Sensor-systems snapshot regen, deterministic
- [ ] Multi-root snapshot kontrolü (değişti mi değişmedi mi)
- [ ] Pipeline asimetrisi düzeltildi (tek filter call point)
- [ ] ADR-005 D-FILTER-01 yazıldı
- [ ] 3 atomic commit
- [ ] Self-dogfood kanıt üçgeni hizalı

---

## 10. Anti-Patterns (Brief v1.3 + bu slice'a özel)

Brief v1.3 §10 + Slice 2d.1, 2d.3 anti-pattern'leri aynen geçerli. Bu slice'a özel ek:

**[Yeni] Pipeline asimetrisi:** Yeni ve legacy pipeline'ları farklı kontratlarla çalıştırma. View-First prensibi: filter pipeline-level, transformer view-content'e odaklı. Slice 2d.2 bu asimetriyi düzeltiyor.

**[Pekiştirme] Görsel kabul = objektif kriterler:** Slice 2d.2'den itibaren görsel kabul **subjective Platform Owner kararı** değil, **objektif Tarayıcı Claude değerlendirmesi**. Architect kriter yazar, Tarayıcı ölçer.

---

## 11. Out of Scope

- Slice 2d.3 (container labels) — KAPALI, dokunulmaz
- Slice 2d.1 (multi-seed) — KAPALI, dokunulmaz
- Faz 1 Final Report — Slice 2d.2 sonrası
- Yeni view type'ları — Faz 2+
- Filter algoritması değişikliği
- Frontend dokunma (DiagramViewer.tsx)
- Yeni feature flag (mevcut FF yeterli)

---

## 12. Workflow Disipline

### 12.1 Karar noktası sayısı: 4 (yeni operating model nedeniyle +1)

- **Karar 1:** Discovery + Pre-impl POC → AG raporu Architect'e
- **Karar 2:** **Tarayıcı Claude görsel ön-kabul** → kabul/reddet (yeni!)
- **Karar 3:** Implementation paketleri (3 atomic commit) + push → Architect deploy onayı
- **Karar 4:** Deploy + dogfood + kanıt üçgeni → permanent (veya rollback)

Slice 2d.3'te 3 karar noktası vardı; Slice 2d.2'de Tarayıcı görsel ön-kabul ek bir karar noktası ekliyor — ama bu **çok değerli** çünkü görsel reddetme deploy öncesi yapılıyor (rollback maliyeti = 0).

### 12.2 AG'nin yapacağı

1. Bu brief v1.0'ı oku
2. Adım 0 discovery + Pre-impl POC
3. POC çıktısını Architect'e ilet, Tarayıcı kabul süreci için bekle
4. (Tarayıcı kabul sonrası) Brief v1.1'i bekle (detaylı impl plan)
5. Implementation + deploy + dogfood

### 12.3 Tarayıcı Claude'un yapacağı

1. Architect'ten POC çıktısı + §7 kriterleri al
2. POC'u (HTML preview veya JSON+DOM kontrol) değerlendir
3. Her kriter için yes/no + kanıt
4. Karar matrisi sonucu rapor: KABUL / REDDET / ŞÜPHELİ
5. (Kabul sonrası) Standart dogfood akışı (Slice 2d.3 pattern)

---

## 13. Sources & References

- `renderer_refactor_phase1_brief_v1_3.md` — canonical ops, anti-pattern'ler, karar noktası tabanlı checkpoint
- `phase1_slice2d1_closeout.md` — filter integration ertelenmesinin ampirik kanıtı
- `phase1_slice2d3_closeout.md` — A′ yaklaşımı + üçlü orchestration olgunluğu
- `renderer_refactor_strategy_v2.md` — View-First prensibi
- `docs/adr/005-state-machine-renderer.md` — D-FILTER-01 eklenecek

**Kod referansları (Slice 2d.1 + 2d.3'ten):**
- `packages/diagram-service/src/rendering/pipeline.ts:95-109` — wedge, dokunulacak
- `packages/diagram-service/src/transformer/bdd-transformer.ts:616` — legacy filter, kaldırılacak
- `packages/diagram-service/src/transformer/view-filters.ts` — algoritma, dokunulmuyor
- `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-*.json` — regen
- `packages/diagram-service/tests/fixtures/state-machine/multi-root-part-states/expected-*.json` — kontrol

---

**Brief v1.0 sonu. AG: Adım 0 (Discovery + Pre-impl POC) ile başla. POC çıktısı Architect → Tarayıcı kabul → Brief v1.1 → Implementation.**
