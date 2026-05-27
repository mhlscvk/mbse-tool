# Phase 2 Slice 6a — CP-2 Raporu (W1–W5 tamam, BLOKLAYICI checkpoint)

**Tarih:** 2026-05-27
**AG (Claude Code)** → Architect CP-2 review
**Brief:** `phase2_slice6a_interconnection_porto_brief_v1_0.md`
**Durum:** W1+W2+W3+W4+W5 tamam. Differential oracle byte-identical. Tam suite yeşil. **W6/CP-3'e geçiş için onay bekliyorum.**

---

## Teslim edilen WI'lar

| WI | Dosya(lar) | Durum |
|---|---|---|
| **W1** IR şeması | `shared-types/src/diagram-ir/interconnection.ts` (yeni) + `diagram-ir/index.ts` (union + DIAGRAM_VIEW_TYPES + exhaustiveness) | ✓ build yeşil |
| **W2** transformer | `diagram-service/src/rendering/interconnection/transformer.ts` (yeni) | ✓ |
| **W3** renderer | `diagram-service/src/rendering/interconnection/renderer.ts` (yeni — `nodeToSNode`/`connectionToSEdge` + tablolar port) | ✓ |
| **W4** wiring | `interconnection/index.ts` (barrel, yeni) + `view-type-mapper.ts` (`case 'interconnection'`) + `src/index.ts:18` (lazy register) | ✓ |
| **W5** test | `interconnection/end-to-end.test.ts` (yeni, 16 test) + `tests/fixtures/interconnection/{basic,multi-port,conjugated,inheritance}/{model.sysml,expected-smodel.json}` | ✓ |

**W4 call-site:** Adım 0 §4'te yakaladığım düzeltmeleri kullandım — register `src/index.ts:18` (rendering/index.ts yok), lazy-loader imzası (`() => import(...).then(m => m.interconnectionRenderer)`).

---

## Kabul kriterleri (brief §4 CP-2)

- ✅ **Tam suite yeşil, regresyon yok:** api-server **345** + diagram-service **690** (674 + 16 yeni) + web-client **135** = **1170** (önceki 1154, +16). 0 skip.
- ✅ **Differential oracle her fixture'da `toEqual`:** 4 fixture + 3 repo örneği üstünde `newPipeline(model) === transformToBDD(model,'interconnection')` byte-identical.
- ✅ **AG self-report: kontrat ihlali yok** — port mekanik ve sadık; "yanlış görünüyor" anı olmadı (§5.6 A6). Differential oracle teyit etti.

**Test kapsamı (16 test):**
- Differential oracle: 4 fixture × (new===legacy) + 4 fixture × (new===golden) = 8
- showInherited no-op guard (CP-1.5): 1 (legacy true===false, new true===false, new===legacy@true)
- Broad differential (repo örnekleri): 3
- Production wiring: 4 (mapper, registry resolve, wedge flag-on→'new'+equals+stats, wedge flag-off→old-default+equals+stats)

---

## ⚠️ Architect dikkatine — 2 küçük not + 1 sapma

### Sapma: `expected-ir.json` golden ATLANDI (brief §3.W5'te listeliydi)

Brief §3.W5 fixture başına `{model.sysml, expected-ir.json, expected-smodel.json}` istedi. **`expected-ir.json`'ı atladım**, sadece `expected-smodel.json` ürettim. Gerekçe:
1. IR `metadata.generatedAt = new Date().toISOString()` (non-deterministic) → committed golden kırılgan olur (state-machine bunu `normalize()` ile astNodeId/generatedAt maskeleyerek çözmüştü).
2. IR iç ara-katman; **doğruluk SModel golden + differential oracle ile tam kapsanıyor** (SModel = renderer'ın gerçek çıktısı, frontend'in gördüğü).
3. SModel golden deterministik (timestamp yok), temiz commit.

**İstersen ekleyebilirim** — `generatedAt` normalize edip `expected-ir.json` golden + IR-equality testi yazarım. Ama önerim: atlanmış kalsın (gereksiz bakım yükü, differential oracle zaten IR→SModel zincirini kanıtlıyor). **Onayın/red'ini bekliyorum.**

### Not 1: `renderer-stats` `unmapped` rollup değişti (observability-only, user etkisi yok)

`DIAGRAM_VIEW_TYPES`'a `'interconnection'` eklendiği için `isDiagramViewType('interconnection')` artık `true`. Etki: IV `old-default` render'ları **artık `unmapped` toplamına sayılmıyor** (önceden raw legacy bucket olarak sayılıyordu). **Bucket anahtarı değişmedi** (`'interconnection:old-default'` — wedge null-mapping branch'inden flag-off branch'ine geçti ama key string aynı). Sadece `unmapped` rollup sayısı farklı. Mevcut testler yeşil; sadece raporluyorum. Bu aslında daha doğru (IV artık "mapped" view).

### Not 2: Self-author fixtures (PO modelleri henüz gelmedi)

CP-1.5 onayında PO'nun `flows.sysml`/`interfaces.sysml`/`conjuge.sysml` modellerini chat'ten paslayacağı söylendi — **henüz gelmediler.** W5'i kendi yazdığım 4 fixture (basic / multi-port / conjugated / inheritance) ile tamamladım; bunlar IV yüzeyini (parts/ports/conjugated/connect/flow/bind/interface/nested/inheritance) kapsıyor. **PO modelleri geldiğinde** aynı differential-oracle loop'una eklemek tek satır (fixture klasörüne kopyala + FIXTURES dizisine ekle). 6b Tarayıcı re-probe için PO modelleri yine de lazım olacak.

---

## Production durumu (deploy güvenliği)

- **Flag default OFF.** `mapToDiagramViewType('interconnection')` artık 'interconnection' dönüyor → wedge flag'i kontrol ediyor (`interconnection-new-renderer`). Flag kapalı olduğu sürece IV **eskisi gibi old-default** render ediliyor — **production davranışı değişmedi.**
- Flag açılınca (W6 rollout) IV yeni path'e geçer. CP-3 Tarayıcı re-probe bunu flag-açık vs kapalı karşılaştırmasıyla doğrulayacak.

---

## Sonraki adım (W6 / CP-3 — bloklayıcı)

Brief §3.W6 + §4.CP-3: deploy (flag kapalı, suite yeşil) → **Tarayıcı re-probe** (flag açık vs kapalı DOM count/edge/port sapma = sıfır fark) → **Platform Owner side-by-side görsel onay**. Bunlar benim domain'im dışında (deploy = ops, browser render = Tarayıcı, görsel onay = Platform Owner).

**CP-2 onayını ve yukarıdaki `expected-ir.json` kararını bekliyorum.** Commit'i sana/Platform Owner'a bırakıyorum (Slice 5 emsali close-out pattern) — istersen ben de hazırlarım.

— AG (Claude Code), Slice 6a CP-2
