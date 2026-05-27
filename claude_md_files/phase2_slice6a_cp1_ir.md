# Phase 2 Slice 6a — CP-1: IR Şeması (W1 tamam, mini-rapor)

**Tarih:** 2026-05-27
**AG (Claude Code)** → Architect mikro-discovery gate (§5.6 A3)
**Durum:** W1 tamam, build yeşil. **W2'ye başlamadan onay bekliyorum.**

---

## Teslim

- **Yeni:** `packages/shared-types/src/diagram-ir/interconnection.ts` (`InterconnectionIR` + `InterconnectionNode` + `InterconnectionEdge` + `InterconnectionAttribute`)
- **Düzenlendi:** `shared-types/src/diagram-ir/index.ts` — union `StateMachineIR | InterconnectionIR`, `DIAGRAM_VIEW_TYPES = ['state-machine', 'interconnection']`, `export * from './interconnection.js'`

## Kabul kriteri (brief §3.W1) — hepsi ✓

- `pnpm -F @systemodel/shared-types build` **yeşil** (= compile-time exhaustiveness check geçti; yeni tag eklenmeseydi `_ExhaustivenessCheck` `never` olup patlardı)
- Runtime: `DIAGRAM_VIEW_TYPES = ['state-machine','interconnection']`, `isDiagramViewType('interconnection') = true`
- Dist üretildi: `dist/diagram-ir/interconnection.{js,d.ts}`

## Adım 0 §2 draft'ından değişiklikler (+ neden)

| # | Değişiklik | Neden |
|---|---|---|
| 1 | `IRAttribute` → **`InterconnectionAttribute`** dedicated tip, alanlar netleşti: `name/type?/value?/isDerived?/inherited?` | Compartment label builder'ın (`bdd-transformer.ts:339-372`) okuduğu tam alan kümesi; `inheritedFrom` taşınmadı (renderer kullanmıyor) |
| 2 | Draft'taki `...` ellipsis açıldı: **`isAbstract`, `isIndividual`, `portionKind`, `ownerIsPortOrActionUsage`** eklendi | Kind-modifier guillemet'leri (`:152-157`) + directed-usage-in-action-usage küçük kare branch'i (`:239`) için gerekli |
| 3 | `kind: string` → **`kind: SysMLNodeKind`**; edge `kind: SysMLConnection['kind']` | Tip güvenliği; IR bir **AST projeksiyonu** — ast.ts'ten import (diagram-ir → ast couplingi dürüst, IR AST'ten türüyor) |
| 4 | `range` için ayrı tip yerine **mevcut `SourceRange`** (ast.ts) | Legacy `data.range` aynen `SourceRange`; byte-identical için aynı tip |
| 5 | **`semanticRef`/`astNodeId` katmanı YOK** (state-machine'de vardı) | ⚠️ **Kritik fark — dikkatine:** state-machine IR id'leri **remap** ediyor (`state__Name`, `edge__src_to_tgt`) ve izlenebilirlik için `semanticRef.astNodeId` taşıyor. IV ise legacy SModel'de **ham parser id'lerini** (`node.id`, `conn.id`) doğrudan kullanıyor → byte-identical için IR `node.id` = parser id **olmalı**, remap YOK. Bu yüzden ayrı semanticRef gereksiz; `id` zaten ast id. (§5.7 #22: state-machine'e körü körüne uymadım, IV semantiğine baktım.) |

## §5.7 #22 notu (zihinsel model ↔ kod)

State-machine IR'ı **yapısal şablon** olarak aldım (viewType + metadata + nodes + edges), ama içerik IV-spesifik: id remap yok, semantik alanlar SysMLNode alt-kümesi, `hasVisibleChildren`/`isStdlib` pre-render flag'leri. IR ≈ "filtrelenmiş AST + 2 layout hint" — Adım 0 §2'de dürüstçe işaretlediğim gibi (state-machine'in structured-label değeri IV'de yok; IR burada faithful projeksiyon).

## Mikro-discovery gate için kontrol noktaları (brief §3)

- **13 node kind** kapsanıyor mu: `kind: SysMLNodeKind` tüm parser kind'lerini kabul ediyor; renderer KIND_DISPLAY + per-kind branch ile hepsini işler. ✓
- **11 edge kind** kapsanıyor mu: `kind: SysMLConnection['kind']` 11 IV edge kind'i (+ diğerleri) kabul ediyor. ✓
- **`hasVisibleChildren` / `isStdlib` doğru semantik mi:** `hasVisibleChildren` = `nodesWithChildren.has(id)` (composition/noncomposite edge → skipCompartments, `:681-688`); `isStdlib` = `id.startsWith('stdlib__')` (`:147`). İkisi de transformer'da (W2) hesaplanacak. ✓

---

**Onay beklediğim:** IR şekli W2 transformer'ı için yeterli mi? Özellikle madde 5 (semanticRef'siz, ham id) kararını onaylar mısın — bu byte-identical için zorunlu ama state-machine'den bilinçli sapma. Onay gelince W2'ye (transformer: filtrelenmiş AST → InterconnectionIR) geçerim.

— AG (Claude Code), Slice 6a CP-1
