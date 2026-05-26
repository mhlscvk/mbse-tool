# Faz 2 Slice 5 — Close-Out & Continuation Handover (D-FILTER-01 Revizyonu)

**Son güncelleme:** 2026-05-26 (Slice 5 KAPALI, FULL PASS, prod @ `588c5b7`)
**Branş:** master
**Baseline HEAD:** `6c22cb0` (Slice 4 close-out docs)
**Slice 5 HEAD:** `588c5b7` (W1-W5) — lokal == origin == **prod**
**Önceki handover:** `phase2_slice4_handover.md` (Security B1+B3)
**Brief:** `phase2_slice5_brief_v1_0.md` + CP-1 (chat) + `phase2_slice5_discovery.md` + `reproduce-slice5-pseudo-initial.ts`
**Canonical ops:** `renderer_refactor_phase1_brief_v1_5.md` (Brief v1.6 sıradaki)
**ADR:** `docs/adr/005-state-machine-renderer.md` (D-FILTER-01 Revoked, Slice 5)

> **Provenance:** Architect ↔ AG ↔ Tarayıcı ↔ Platform Owner çok-session akışı; Architect tarafından reconstructed. Smoke (CP-3) Tarayıcı tarafından prod'da yürütüldü; kod/deploy/counter bulguları git + prod re-verify ile doğrulandı.

---

## §1 — TL;DR

**Slice 5 (D-FILTER-01 revizyonu) KAPALI, FULL PASS, prod @ `588c5b7`, suite 1154 green.** Smoke A+B PASS (SensorSystem'de DOM 2 pseudo-initial görünür + 3 model regresyon temiz). Slice 2d.2'de Pre-impl Visual Preview + Platform Owner-onaylı tasarım kararı (D-FILTER-01), 5 katmanlı kanıt zinciriyle **revize edildi** (SysML standart uyumu + anlam netliği). Entry-action sub-state'lerinde pseudo-initial (start dairesi) artık görünür.

---

## §2 — Implementation Özeti (commit `588c5b7`)

- **W1+W2** (`view-filters.ts`, +6/-48): entry-hide bloğu (`:162-178`) + start→entry remap bloğu (`:198-216`) **kaldırıldı**; connections map sadeleşti. **Reparent (`:180-196`) ve orphan-prune (`:232+`) KORUNDU.** Start node keepIds'te kalır + outgoing edge'i korunur → content komşusu var → orphan-prune'a takılmaz → daire render olur.
- **W3** (`end-to-end.test.ts` + 2 golden): assertion flip (`:282` `not.toContain` → `toContain`) + filtered golden regen (anti-pattern #19: regen + flip **aynı commit**). `pseudo-initial__on` artık post-filter'da KORUNUYOR.
- **W4** (`mock-model.ts` + `pseudo-initial.test.tsx`): `createMockModelWithClasses` factory (cssClass desteği, `createMockModel`'i bozmadan) + 3 RTL test.
- **W5** (`ADR-005`, +33): D-FILTER-01 "Revoked" revizyon notu (gerekçe + repro kanıtı + etkilenen kod).
- **Δ:** 7 dosya, +202/-92. **Test sayım:** 1151 → **1154** (web-client 132→135, +3 W4).
- **Bonus (ghost bug):** eski D-FILTER-01 remap artefaktı **duplicate `behavior__On_entry_activation`** golden'da temizlendi.

---

## §3 — Verification Zinciri (CP-1 → CP-4)

**CP-1 Discovery** (chat): 4 eksen kanıt. Kritik bulgu — **W1+W2 coupled** (W1 tek başına orphan-prune'a takılır, çünkü edge remap start'ın outgoing edge'ini düşürür). Golden path düzeltildi (`tests/fixtures/.../sensor-systems/`). Fixture parent-entry-action senaryosunu zaten içeriyor → assertion flip + golden regen. Regresyon scope: ~32 model adayı.

**CP-2 Implementation** (`588c5b7`): suite 1154 green, build trio EXIT 0, **4 self-caught issue** (`:162-216` blok imprecise → reparent korundu; golden path; mock-model factory; tsc).

**CP-3 Deploy** (prod `588c5b7`):
- Ancestor ff-safe; prod `6c22cb0` (beklenen); PRE counter `new 2149` / fallback 0
- Push `6c22cb0..588c5b7`; prod pull → `588c5b7`; build trio EXIT 0
- PM2 diagram **delete+start** → fresh, **↺=0** (api/lsp dokunulmadı)
- Health: api `/health`+`/ready` DB=ok (dokunulmadı), diagram `/health` ok (fresh)
- **Deployed-code grep:** built `view-filters.js` `parentsWithEntry` **0** + `startToEntry` **0** → kaldırılan kod bundle'da yok; build 13:46 taze

**CP-3 Smoke** (Tarayıcı, ~7 dk):
- SMOKE-A SensorSystem STV: DOM **2 pseudo-initial** (`pseudo-initial__normal` + `pseudo-initial__on`) görünür (önceden 0) ✓
- SMOKE-B 3 model regresyon: temiz, scope-sıçraması yok, top-level davranış korundu ✓

**CP-3 Counter recheck (final):** post-smoke `state-machine.new: 7` (>0), **fallback 0**, diagram ↺=0 → **filter değişikliği new path'i bozmadı, regresyon yok** ✓

---

## §4 — Production Durumu (2026-05-26 close-out re-verify)

- **HEAD:** `588c5b7` (lokal == origin == prod)
- **PM2:** diagram fresh ↺=0; api/lsp dokunulmadı (↺=0)
- **Counter:** `state-machine.new 7` / fallback 0 (post-smoke; restart in-memory'yi sıfırlamıştı)
- **Suite:** **1154** (api 345 + diagram 674 + web 135)

---

## §5 — Anti-Pattern #21 Saga — Slice 5'te 11 tetiklenme (Slice 3+4+5 toplam ~23)

| # | Kaynak | İddia | Çürüten |
|---|--------|-------|---------|
| 1 | Slice 2d.2 | "Sub-state pseudo-initial implement edilmemiş" | Repro: implement edilmiş, filter düşürüyor |
| 2 | Slice 2d.2 | "Renderer zaten çizmiyor" mekanizma | AG: filter düşürüyor, renderer değil |
| 3 | Slice 3a | "Kod kategorik var, iddia yanlış" | İmprecise: line-ref + mekanizma framing kısmen yanlış |
| 4 | AG discovery | "MOOT en olası" | Tarayıcı: gerçekten render yok |
| 5 | AG/Architect | "2d.2 false-negative selector" | Bonus probe: selector değil, gerçek eksiklik |
| 6 | AG üçlü tanı | β probe-mantığıyla elendi (pozitif #21) | — |
| 7 | AG üçlü tanı | γ-not-a-bug ayrımı (honest-gap) | — |
| 8 | AG önceki tur | "α-leading/real-bug suspected" | Repro: mekanizma doğru, kasıtlı tasarım |
| 9 | Fixture/test | "Backend testler yeşil = prod doğru" | Repro: fixture vs prod farkı |
| 10 | Architect brief | "2 ok" görsel framing'i | AG: 1 ok + içeride entry, daha temiz |
| 11 | Tarayıcı smoke | "startnode cssClass çapraz teyit" | DOM: cssClass yok, data-node-id var (naming asimetrisi) |
| +b | Architect | "`:162-216` blok kaldır" (reparent içerir) | AG: 2 ayrı blok, reparent korundu |
| +b | Architect | Golden path varsayımı (`test-fixtures/`) | AG: `tests/fixtures/.../sensor-systems/` |
| +b | Architect | mock-model factory cssClass destekliyor | AG: yeni factory gerek |
| +b | Fix sırasında | Eski remap duplicate entry node | Golden temizliği yan-kazanım |

**Disipline çıkarımı:** Kanıt zinciri **6 katmanlı** oldu (Discovery → Tarayıcı probe → AG üçlü tanı → Tarayıcı WS-frame → AG repro-script → Implementation CP-1 → Tarayıcı smoke). Brief v1.5 §8.3 4-adım disipline'i bu slice'ta **6-adım'a uzadı** — Brief v1.6 yoğun materyali. #21, Architect'in kendi üretiminin de (brief framing, path/blok varsayımları) tabi olduğunu defalarca gösterdi.

---

## §6 — Backlog Kayıtları (Slice 4'ten 11 + Slice 5 yeni = 15)

Slice 4 (1-11, bkz. `phase2_slice4_handover.md` §6) + Slice 5:
12. **Naming asimetrisi:** SNode `cssClasses:['startnode']` → SVG'de `data-node-id`'ye yansıyor ama `class` attribute'a değil. Tutarlılık (frontend renderer veya doc). Tarayıcı yan-bulgu #1.
13. **DOM-nesting:** pseudo-initial sub-state'in DOM child'ı değil kardeş (Sprotty layout flatten). Bilgi notu/doc. Tarayıcı yan-bulgu #2.
14. **Top-level entry semantiği:** AcKapat'ta entry top-level, pseudo-initial gelmiyor (Slice 5 scope dışı — sadece sub-state hedefledi). Kullanıcı isteği gelirse ayrı slice. Tarayıcı yan-bulgu #3.
15. **Brief v1.6 yazımı:** 25+ pattern + #21 saga 23 tetiklenme biriken → ops-doc revision turu **öncelikli candidate**.

---

## §7 — Sonraki Candidate (Final Report §6.2 + güncelleme)

1. ✓ Bug-RENDER-01 (Slice 3a+3b) — KAPALI
2. ✓ Security B1+B3 (Slice 4) — KAPALI
3. ✓ Sub-state pseudo-initial / D-FILTER-01 revizyonu (Slice 5) — KAPALI (bu slice)
4. **▶ Brief v1.6 yazımı** (ops-doc revision, 25+ pattern, #21 saga 23) — en güçlü öneri
5. Slice 2e + Security B2 (WS auth + JWT migration, büyük scope)
6. Legacy view porto serisi (counter'daki `old-default`'lar: general)

**Piggyback:** Bug-PRISMA-01 (`seed-examples.*`, ilk deploy dokunuşunda).

---

## §8 — Önemli Dosyalar

- `packages/diagram-service/src/transformer/view-filters.ts` (W1+W2)
- `packages/diagram-service/src/rendering/state-machine/end-to-end.test.ts` (W3)
- `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-{ir,smodel}-filtered.json` (W3 golden)
- `packages/web-client/src/test-utils/mock-model.ts` (`createMockModelWithClasses`)
- `packages/web-client/src/components/Diagram/pseudo-initial.test.tsx` (W4, 3 test)
- `docs/adr/005-state-machine-renderer.md` (W5)
- `claude_md_files/phase2_slice5_{brief_v1_0,discovery,handover}.md`
- `packages/diagram-service/scripts/reproduce-slice5-pseudo-initial.ts` (AG repro — gerçek model gitignored, header'dan re-fetch)

---

## §9 — Honest Gaps / Verification Limits

- **Regresyon kapsamı:** ~32 prod model adayından 3 örneklendi (SMOKE-B). Tam kapsam yok; transitif kanıt: backend e2e fixture + RTL test + 3 örneklem + repro-script (gerçek model post-filter 0→2).
- **Top-level entry semantiği** (backlog #14): farklı renderlanması beklenmedik kullanıcı isteği olarak çıkabilir.
- **Naming asimetrisi** (backlog #12): cssClass vs data-node-id, doc-clean kalemi.
- **Counter:** restart in-memory'yi sıfırladı; post-smoke `new 7`/`fallback 0` regresyon-yok kanıtı (tam pre/post sayı kıyası restart nedeniyle mümkün değil — yapısal fallback=0 kontrolü yeterli).

---

## §10 — Açık Konular (Yeni Architect / Sonraki Slice)

- **Brief v1.6 yazımı çok öncelikli** — Slice 5 saga zenginliği (6-katman kanıt zinciri, 23 #21 tetiklenme, yeni canonical pattern'ler: built-artifact grep, repro-script-on-real-model, fixture-vs-prod, Architect-tarafı #21 alt-türleri) ops-doc revision için ideal moment.
- Alternatif: Slice 2e+B2 (WS auth + JWT) veya legacy porto. Platform Owner kararı.

---

## §11 — Sıradaki Session İçin İlk Yapılacaklar

1. Bu handover + `phase2_slice4_handover.md` oku
2. `git log --oneline -5` → HEAD `588c5b7`; `git rev-list origin/master...HEAD` (close-out doc push'landıysa 0)
3. Prod re-verify: `ssh ... 'cd /opt/systemodel && git rev-parse --short HEAD'` → `588c5b7`
4. Platform Owner candidate seçimini bekle (Brief v1.6 önde)
5. Anti-pattern #21: devralınan her iddiayı (bu handover dahil) kendi kanıtınla doğrula
