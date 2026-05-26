# Phase 2 — Slice 5 Brief v1.0 (D-FILTER-01 Revizyonu)

**Slice ID:** Slice 5 (D-FILTER-01 revizyonu — entry-action sub-state'lerinde pseudo-initial dairesi görünür)
**Tarih:** 2026-05-26
**Baseline HEAD:** `6c22cb0` (Slice 4 close-out docs; lokal == origin == prod kod `477b87d`)
**Önceki:** Slice 4 (Security B1+B3) KAPALI — `phase2_slice4_handover.md`
**Canonical ops:** `renderer_refactor_phase1_brief_v1_5.md`
**Discovery:** `phase2_slice5_discovery.md` (Architect, 2026-05-26 — uncommitted, close-out'la commit'lenir) + `packages/diagram-service/scripts/reproduce-slice5-pseudo-initial.ts` (AG repro, uncommitted)
**ADR güncelleme:** `docs/adr/005-state-machine-renderer.md` (D-FILTER-01 geri çekilir/revize edilir, bu slice'ta)

---

## §0 — Discovery'den İki Önemli Düzeltme (Anti-Pattern #21)

Slice 2d.2 backlog ve Slice 3a cross-verify iddialarının **ikisi de imprecise** çıktı; AG repro-script (`reproduce-slice5-pseudo-initial.ts`, 2026-05-26) gerçek prod modelini DB'den çekerek pipeline'ı katman-katman koşturdu ve kesin sonuç verdi:

| Devralınan iddia | Kanıtlı düzeltme |
|---|---|
| "Sub-state pseudo-initial implement edilmemiş" (Slice 2d.2 `phase1_slice2d2_closeout.md:332`) | **YANLIŞ.** Implement edilmiş (transformer emit + renderer startnode SNode + frontend CONTROL_CSS dolu daire). |
| "Renderer zaten çizmiyor" (Slice 2d.2 mekanizma atfı) | **MEKANIZMA YANLIŞ.** Renderer çiziyor — `view-filters.ts:171-178` parent-entry-hide koşulu düşürüyor (ADR-005 D-FILTER-01). |
| "Kod kategorik var, iddia kategorik yanlış" (Slice 3a cross-verify, `architect_to_architect_handover_2026-05-25.md:88`) | **İKİSİ DE KISMEN HAKLI.** Kod var (Slice 3a), ama filter ürünü gizliyor (Slice 2d.2 outcome doğru ama mekanizma yanlış). |

Discovery + 2 probe + repro-script zinciri (~3 saat) ile çelişki çözüldü; **Slice 5 brief'i kanıt zincirine dayanır, varsayıma değil.**

---

## §1 — Slice 5'in Gerçek Hali: D-FILTER-01 Revizyonu

**Slice 2d.2'de Pre-impl Visual Preview + Platform Owner-onaylı bir tasarım kararı vardı (ADR-005 D-FILTER-01):**

> "Hide start nodes when an entry action node exists in the same parent — entry action replaces the start circle in STV."

**Bu karar bugün revize edilecek.** SysML semantik analiziyle:

- **Pseudo-initial (start daire):** "Container açıldığında HANGİ sub-state aktif olacak" — initial transition'ın hedefini gösterir
- **Entry-action:** "Bu sub-state aktif olduğunda NE çalıştırılacak" — state'e geçiş davranışını gösterir

Bunlar **farklı kavramlar**; SysML standardına sıkı uyumda ayrı görsellenirler. Slice 2d.2 kararı görsel basitlik için ikisini birleştirmişti, ama:

1. **Standart uyumu:** SysML v2 spec ikisini ayrı simgeler
2. **Anlam netliği:** "Container nereden başlar" + "buraya geldiğinde ne yapılır" — iki ayrı soru, iki ayrı görsel
3. **Tutarlılık:** entry-action'sız sub-state'lerde başlangıç dairesi görünüyor; entry-action eklemek bu görselliği kaybettirmek mantıksız

→ **Karar:** D-FILTER-01 geri çekilir. Entry-action varlığı pseudo-initial daire'nin gizlenmesini tetiklemez.

---

## §2 — Discovery Özet (Repro-Script Kanıtlı)

### §2.1 — Backend pipeline trace (gerçek prod modeli `cmolrsqrq002oglb7a41d5fz5`)

| Katman | pseudo-initial sayısı | Kanıt |
|---|---|---|
| AST (parser) | 2 StartNode | `control__Normal_start` + `control__On_start`, ikisinde de `parentHasEntryAction=true` |
| Raw IR (transformer) | 2 | `pseudo-initial__normal` + `pseudo-initial__on` |
| Post view-filter | **0** | Filter ikisini de düşürüyor — `view-filters.ts:171-178` parent-entry-hide |
| Final SModel | 0 | Filter sonrası akış kaybeder |

**Tetikleyici:** `view-filters.ts:171-178` koşul: "Start node'un parent'ında entry action varsa, start node'u gizle" (orphan-prune değil, doğrudan hide). Gerçek model her iki sub-state'de entry action içerdiği için ikisi de elendi.

### §2.2 — Frontend doğru çalışıyor (β kesin elendi)

- WS-frame probe (Tarayıcı, `MessageEvent.prototype.data` getter override): `kind:'model'` frame'inde 18 node, hepsi `state__*` veya `behavior__*`. **Pseudo-initial node hiç yok**, `startnode` cssClass yok, `start__to__*` edge yok.
- AG kod analizi: DiagramViewer `allNodes = model.children.filter(type==='node')` (Slice 3b discovery). SNode model.children'da olsaydı `<g data-node-id>` üretilirdi. Frame'de olmadığı için DOM'da da yok = beklenen davranış.

→ **Backend filter'ı düzeltirsek frontend otomatik render eder** — DiagramViewer startnode dalı (`:358` CONTROL_CSS + `:193` color + `:558/:572` size) zaten hazır, sadece SNode'lar gelmiyor.

### §2.3 — Fixture vs Prod Uyuşmazlığı

`packages/diagram-service/src/rendering/end-to-end.test.ts:282-283` fixture'da `pseudo-initial__top` korunduğunu test ediyor → test yeşil. Ama **gerçek prod modelde top-level initial yok** (sadece 2 sub-state initial, ikisi de parent-entry-action'lı, ikisi de filter'a takılıyor). **Backend testleri yeşil ama prod davranışı'nı temsil etmiyordu.**

Bu, Brief v1.5'in "fixture vs prod fark gözleyin" disiplinine **canlı bir örnek** — Brief v1.6 materyali.

---

## §3 — Scope + Verification Etiketi

| WI | Açıklama | Risk | Kaynak |
|----|---|---|---|
| **W1** | `view-filters.ts:171-178` parent-entry-hide koşulunu kaldır (D-FILTER-01 geri çekiliyor) | Düşük | §2.1 ✓ verified @ `6c22cb0` |
| **W2** | `view-filters.ts:207-216` start→entry edge remap mantığını koru/güncelle (filter kaldırılınca edge davranışı tutarlı kalmalı) | Düşük-Orta | §2.1 + AG CP-1 disambiguation |
| **W3** | Backend e2e test güncelle: `end-to-end.test.ts` parent-entry-action'lı sub-state initial'in artık KORUNDUĞUNU doğrulasın (mevcut "filter düşürür" asssertion'ı tersine çevir) | Düşük | §3.3 |
| **W4** | Frontend RTL test ekle: entry-action sub-state'inde pseudo-initial daire'nin DOM'da render edildiğini doğrula (Slice 3b RTL harness + mock-model factory) | Düşük | §3.4 — honest-gap (#4 backlog) kapatma |
| **W5** | ADR-005 D-FILTER-01 güncelle: "geri çekildi, gerekçe: SysML standart uyumu + anlam netliği" notu ekle | Düşük | §3.5 |
| **W6** | Smoke: Tarayıcı prod re-probe — entry-action sub-state'inde pseudo-initial daire görünür çiziliyor mu (DOM kanıtı) | Düşük | CP-3 |

**Scope dışı:** Top-level pseudo-initial render (gerçek modelde yok zaten; eğer modele eklenirse zaten render edilir). Diğer filter davranışları (transition compress, orphan-prune) dokunulmaz.

**Karar girdileri (Platform Owner, 2026-05-26):**
- **DP-S5-1 = D-FILTER-01 geri çekilir** (entry-action sub-state'lerinde start dairesi görünür) — onaylı
- **DP-S5-2 = Frontend test W4 olarak entegre** (Slice 3b RTL harness ile) — onaylı

---

## §4 — Discovery Honest Gaps (CP-1'de Kapatılacak)

CP-1 AG discovery'sinde şunları doğrulamalı:

### §4.1 — Edge remap davranışı (W2 ile ilgili)
`view-filters.ts:207-216` start→entry edge remap mantığı parent-entry-hide ile bağlı çalışıyordu. Filter kaldırılınca:
- (a) Edge remap **artık gereksiz** → kaldır
- (b) Edge remap **hâlâ değerli** (örn. entry-action label'ı edge üstüne taşımak için) → koru ama trigger koşulunu güncelle

**AG CP-1'de karar verecek:** Hangi durumda hangi davranış. Edge remap'i kaldırırsak diagram bir initial→sub-state oku + sub-state'in entry-action node'una ayrı bir state→entry oku gösterir (iki ok). Koruyalım dersek tek birleşik ok kalır.

### §4.2 — Orphan-prune davranışı (W2 ile ilgili)
`view-filters.ts:232+` orphan-prune (kenarı olmayan node'lar elenir) — parent-entry-hide kaldırılınca pseudo-initial daire'nin **outgoing edge'i (initial transition)** korunmuş mu? Eğer outgoing edge silindiyse (edge remap düşürdüyse), daire orphan olur ve orphan-prune düşürür → fix işe yaramaz.

**AG CP-1'de doğrulayacak:** İlk start→entry edge remap kaldırılınca (veya değiştirilince), pseudo-initial daire'nin outgoing edge'i (`start→initial-target`) hâlâ kalıyor mu?

### §4.3 — Test fixture uyuşmazlığı
`end-to-end.test.ts` fixture'da parent-entry-action'lı sub-state var mı? Yoksa eklenmeli (fix sonrası testlerin gerçek senaryo'yu kapsaması için). AG CP-1'de fixture incelemesi.

### §4.4 — Diğer state machine modellerde regresyon riski
Prod'da SensorSystem dışında state machine modelleri var mı? D-FILTER-01 değişikliği onları da etkiler. AG production'dan modelid listesi çekebilir (`SELECT id, name FROM sysml_files WHERE content LIKE '%state %'` benzeri). Manuel görsel doğrulama gerekirse Tarayıcı'ya paslanır.

---

## §5 — Karar Noktası Tabanlı Checkpoint'ler (Brief v1.5 §7)

| CP | Karar Noktası | Beklenen Çıktı |
|----|---|---|
| **CP-1** | DP-S5-3 (§4 honest gap çözümleri): edge remap (kaldır/güncelle), orphan-prune outgoing edge, fixture güncelleme, regresyon scope | AG discovery uzatması: 4 noktada kanıtlı karar önerisi. Architect onay → impl. |
| **CP-2** | W1+W2+W3+W4 impl + lokal test green (1151 → ~1153+, kesin sayım W4 sonrası) | Değişen dosyalar, diff özet (her WI ayrı), suite çıktısı, repro-script tekrar koşar (post-filter şimdi 2 pseudo-initial göstermeli) |
| **CP-3** | Prod deploy + Tarayıcı re-probe | api/diagram restart, web-client static bundle deploy, Tarayıcı entry-action sub-state'inde pseudo-initial daire DOM'da görünür çiziyor mu? Counter regresyon yok. Architect onay → close-out. |

3 CP yeterli (Brief v1.5 §7.4 — karar noktası = checkpoint, dar slice).

---

## §6 — Implementation Plan (Sıra)

```
Adım 1 (W1): view-filters.ts:171-178 parent-entry-hide koşulu kaldır/devre dışı bırak
             - Koşulun hâlâ değerli olduğu başka bir durum varsa (örn. final-state filtering), 
               sadece pseudo-initial start node'ları için kaldır (selective)
Adım 2 (W2): CP-1 §4.1 + §4.2 kararına göre edge remap + orphan-prune güncelleme
Adım 3 (W3): end-to-end.test.ts güncellemesi
             - parent-entry-action'lı sub-state'in pseudo-initial korunuyor test'i (terslenmiş 
               assertion veya yeni test)
             - Fixture parent-entry-action içeriyorsa korunma, içermiyorsa eklenme
Adım 4 (W4): web-client RTL test (Slice 3b harness kullan)
             - mock-model: parent-entry-action içeren sub-state + pseudo-initial child
             - render edildiğinde [data-node-id*="pseudo-initial"] DOM'da var
Adım 5 (W5): docs/adr/005-state-machine-renderer.md güncelle (D-FILTER-01 geri çekildi)
Adım 6: Pre-deploy — per-package build + tsc
             - shared-types build (etkilenmez)
             - diagram-service tsc + build (W1+W2+W3 odak)
             - web-client build (W4 testler)
Adım 7: Deploy (§8 deploy planı)
Adım 8: AG close-out handover
```

W1 ve W3 birbirinden bağımsız; W4 W1'e bağlı (test fix'in çalıştığını doğrular). W2 W1 ile koordineli (edge davranışı bağlı).

---

## §7 — Deploy + Verification

> **Önemli:** Bu slice **diagram-service** (PM2 process — counter regresyon riski!) + **web-client** (static) değiştiriyor. **api-server dokunulmuyor.**

```bash
# Lokal (AG) — pre-deploy
pnpm --filter @systemodel/shared-types build      # etkilenmez ama EXIT 0
(cd packages/diagram-service && npx tsc || true)   # pre-existing tolere
pnpm --filter @systemodel/diagram-service build    # EXIT 0 zorunlu
pnpm --filter @systemodel/web-client build         # EXIT 0 zorunlu
# pre-commit hook full suite (1151 + ~yeni testler) green
git commit -m "Phase 2 Slice 5 W1+W2+W3+W4+W5: D-FILTER-01 revizyonu (entry-action sub-state pseudo-initial görünür)"

# Pre-deploy (Brief v1.5 §3.2.1 — Production HEAD Sürprizi protokol)
git fetch origin master
git merge-base --is-ancestor origin/master HEAD
ssh root@65.109.134.254 'cd /opt/systemodel && git rev-parse --short HEAD'
# Beklenen: prod 6c22cb0 (Slice 4 close-out docs sonrası kod hâlâ 477b87d)
# Eğer beklenen değilse → DUR, Architect'e bildir

# Deploy
git push origin master
ssh root@65.109.134.254 'cd /opt/systemodel && git pull origin master'
ssh root@65.109.134.254 'cd /opt/systemodel && pnpm --filter @systemodel/diagram-service build && pnpm --filter @systemodel/web-client build'

# diagram-service PM2 reload (Brief v1.5 §2.2 — restart DEĞİL)
ssh root@65.109.134.254 'pm2 delete diagram && cd /opt/systemodel && pm2 start ecosystem.config.cjs --only diagram'

# Verification (AG)
ssh root@65.109.134.254 'curl -s -H "x-forwarded-proto: https" localhost:3002/internal/renderer-stats | head -100'
# Counter: state-machine.new artmaya devam, fallback 0 korunmuş (filter değişikliği, ama new path aynı)
ssh root@65.109.134.254 'pm2 jlist | grep -E "diagram|name|status|uptime|restart"'
# diagram online, fresh process, ↺=0
```

**Manuel smoke (Platform Owner veya Tarayıcı):**
1. systemodel.com'da SensorSystem.sysml aç (veya parent-entry-action içeren herhangi bir state machine model)
2. STV view'a geç
3. Beklenen: **Normal ve On sub-state'lerinin başında küçük dolu daire (pseudo-initial)** görünür
4. DOM probe (Slice 3a sonrası `data-node-id` mevcut):
   ```js
   document.querySelectorAll('[data-node-id*="pseudo-initial"]').length
   // Beklenen: 2 (Normal + On)
   ```
5. Initial → entry-action / sub-state arasındaki ok davranışı CP-1 kararına göre (tek ok veya iki ayrı ok)

---

## §8 — Tamamlanma Kriterleri

- ✓ W1: parent-entry-hide kaldırıldı/güncellendi
- ✓ W2: edge remap + orphan-prune CP-1 kararına göre güncellendi
- ✓ W3: backend e2e test güncellendi (parent-entry-action'lı sub-state pseudo-initial korunuyor)
- ✓ W4: web-client RTL test eklendi (DOM'da render kanıtı)
- ✓ W5: ADR-005 D-FILTER-01 geri çekildi/güncellendi
- ✓ Prod deploy (diagram-service PM2 reload), counter regresyonsuz
- ✓ Tarayıcı re-probe DOM kanıtı: 2 pseudo-initial daire görünür
- ✓ AG close-out handover (`phase2_slice5_handover.md`)

---

## §9 — ADR Güncellemesi (W5)

`docs/adr/005-state-machine-renderer.md` D-FILTER-01 bölümüne ekleme:

```markdown
### D-FILTER-01 (REVIZYON — Phase 2 Slice 5, 2026-05-26)

**Durum:** Geri çekildi.

**Önceki karar (Phase 1 Slice 2d.2, 2026-04-XX):** "Hide start nodes when an 
entry action node exists in the same parent — entry action replaces the start 
circle in STV." Görsel basitlik gerekçesi.

**Yeni karar (Phase 2 Slice 5, 2026-05-26):** Pseudo-initial (start daire) ve 
entry-action **farklı SysML kavramlarıdır** ve **ayrı görsellenmelidir**.

**Gerekçe:**
- **Standart uyumu:** SysML v2 spec, initial transition ve entry-action'ı 
  ayrı simgelerle gösterir
- **Anlam netliği:** Initial = "container hangi sub-state'le başlar"; 
  entry-action = "sub-state aktif olduğunda ne çalıştırılır" — iki ayrı soru
- **Tutarlılık:** Entry-action'sız sub-state'lerde pseudo-initial görünüyor; 
  entry-action eklemek bu görselliği kaybettirmek mantıksız

**Etkilenen kod:** `view-filters.ts:171-178` (parent-entry-hide koşulu kaldırıldı), 
ilişkili `:207-216` edge remap ve `:232+` orphan-prune güncellemeleri (Slice 5 W2).

**Test güncellemesi:** `end-to-end.test.ts` parent-entry-action'lı sub-state 
initial'in artık korunduğunu test ediyor (Slice 5 W3); `web-client` RTL test 
DOM'da pseudo-initial daire'nin render edildiğini doğruluyor (Slice 5 W4).
```

---

## §10 — Sonraki Candidate (Slice 5 sonrası)

4. Slice 2e + Security B2 (WS auth + JWT migration, büyük scope)
5. Legacy view porto serisi — Faz 2 ana gövdesi (counter'daki `old-default`'lar)
+ Piggyback: Bug-PRISMA-01 (`seed-examples.*` artifact); password_add (taslak brief)

---

## §11 — Honest Gaps + Verification Limits

- **Edge remap + orphan-prune davranışı:** CP-1'de AG karar verecek (§4.1, §4.2). Şu an "kaldır" veya "koru ama trigger güncelle" arasındaki tercih belirsiz.
- **Diğer prod state machine modellerinde regresyon riski:** CP-1'de AG modelid listesi çekecek. Manuel görsel doğrulama gerekirse Tarayıcı.
- **`reproduce-slice5-pseudo-initial.ts`:** Discovery'de tek-seferlik kullanıldı (gerçek model DB'den çekildi sonra silindi — IP hijyeni). Slice 5 CP-2'de fix sonrası tekrar koşturulup post-filter sayımı 0 → 2 olacak (regression-guard).

---

## §12 — Anti-Pattern #21 Saga (Slice 5 Çıkarımı)

Bu slice boyunca tetiklenen ve çürütülen iddialar (6 saga örneği, toplam Slice 3+4+5: 18):

| # | İddia / Çürüten |
|---|---|
| 14 | "MOOT en olası" tahmini → Tarayıcı probe gerçekten yok olduğunu gösterdi |
| 15 | "Slice 2d.2 false-negative selector" → bonus probe (oldSelector=0, newSelector=0) selector değil gerçek render eksikliği |
| 16 | β probe-mantığıyla elendi (pozitif #21 uygulaması) |
| 17 | γ-not-a-bug ayırması (honest-gap işaretlendi, sonra repro-script kapattı) |
| 18 | AG "α-leading / real-bug suspected" → mekanizma doğru ama "kasıtlı, bug değil" (AG kendi önceki turunu düzeltti) |
| 19 | Fixture vs prod uyuşmazlığı kanıtlandı (backend testleri yeşil ama prod'u temsil etmiyor) |

**Disipline çıkarımı:** Çok kademeli kanıt zinciri (Discovery → Tarayıcı probe → AG üçlü tanı → Tarayıcı WS-frame → AG repro-script) hipotezleri sırayla daralttı ve gerçek nedeni pinledi. Brief v1.5 §8.3 4-adım disipline'i bu slice'ta **5-adım'a uzadı** — Brief v1.6 materyali.

---

**Architect onayı bekleniyor.** Onay sonrası AG'ye paslanır; AG CP-1'den (§4 honest gap çözümleri + edge remap + orphan-prune kararları) başlar.

— Architect Claude, 2026-05-26
