# Faz 1 Slice 2d.3 — Multi-Root Container Labels (Bug-RENDER-02) — Brief v1.1

**Brief versiyonu:** v1.1 (AG discovery raporu sonrası, design + impl plan net)
**Tarih:** 2026-05-24
**Author:** Architect Claude
**Önceki sürüm:** v1.0 (`renderer_refactor_phase1_slice2d3_brief.md`, repo'da commit `0ccf303`)
**Discovery raporu:** AG raporu (`Slice 2d.3 Discovery Report`, Architect-tarafında bu brief'e entegre edildi)
**Tahmini kalan süre:** ~20 dk Architect brief v1.1 + ~1.5-2 saat impl + ~30 dk dogfood + flip = ~2.5-3 saat

---

## 1. v1.0 → v1.1 Değişiklikleri

AG discovery raporu iki kritik sürpriz getirdi, v1.0'daki üç yaklaşımı **temelden değiştirdi**:

### Sürpriz 1: Sprotty repo'da yok

`grep -ri sprotty` tüm package.json'larda boş. Frontend tamamen custom SVG renderer (`DiagramViewer.tsx`, 150KB). v1.0 Yaklaşım C "Sprotty group decorator" varsayımı **geçersiz**.

**Architect hatası:** v1.0 yazarken Sprotty'nin var olduğunu varsaydım — repo'daki package.json'a verification yapmadan. Bu, Slice 2d.1'de filter zorunlu varsayımıyla aynı pattern (kod okumadan tasarım iddiası). Anti-pattern brief v1.4'e eklenecek.

### Sürpriz 2 (belirleyici): Fix için yeni IR kind'ı + frontend değişikliği GEREKMİYOR

- `DiagramViewer.tsx:2197` zaten `nested + hasChildren` node'ları **title-bar'lı label'lı container** olarak çiziyor (`«state» + name`)
- Composite state (örn. SensorSystem'in `On` state'i içinde Normal/Degraded) zaten label'lı container — bu mekanizma bedava duruyor
- Top-level container'lar (SensorSystemStates, ModeAlpha) **aslında transformer'ın çizmeyi atladığı composite state'ler**

**Container'ı normal bir `kind: 'state'` IR node'u olarak emit etmek, var olan composite-state çizim makinesini yeniden kullanıyor.** IR şeması değişmez, renderer değişmez, frontend değişmez.

### POC Kanıtı (Discovery'de yapıldı, push edilmedi)

AG gerçek `stateMachineToSModelRoot` ile POC yaptı:
```
container SNode state__ModeAlpha: labels=[«state» ModeAlpha] css=stateusage
container SNode state__ModeBeta:  labels=[«state» ModeBeta]  css=stateusage
+ comp__modealpha_to_idle/active, comp__modebeta_to_open/closed
```

End-to-end ampirik kanıt — sadece teorik değil.

### v1.0 yaklaşımlarının durumu

- **Yaklaşım A** (yeni IR kind): Pahalı, gereksiz. **Reddedildi.**
- **Yaklaşım B** (multi-diagram): Scope creep, frontend kontrat değişikliği. **Reddedildi.**
- **Yaklaşım C** (Sprotty grouping): Temel varsayım geçersiz. **Reddedildi.**
- **Yaklaşım A′** (AG'nin önerdiği): Container'ı normal `state` node olarak emit et. **SEÇİLDİ.**

---

## 2. Tasarım Kararı: Yaklaşım A′ (Final)

### 2.1 Tek değişiklik noktası: Transformer seeding

`packages/diagram-service/src/rendering/state-machine/transformer.ts:190-197` (multi-seed loop, Slice 2d.1'de eklenen):

**Mevcut (Slice 2d.1):**
```typescript
const topLevelContainers = model.nodes.filter(n => {
  if (!isStateLike(n)) return false;
  const parent = parentByChild.get(n.id);
  return !parent || !isStateLike(parent);
});
for (const container of topLevelContainers) {
  emitContainer(container.id);  // sadece çocukları emit eder
}
```

**Slice 2d.3 (A′):**
- Eğer top-level container **StateUsage** ise → onu da **`kind: 'state'` IR node** olarak emit et (containedNodes ile çocuklarına bağlı)
- Eğer top-level container **StateDefinition** ise → mevcut davranış (çizmez, geriye uyum)

`emitContainer` davranışı korunur (çocukları emit), sadece **container'ın kendisi** ek olarak emit edilir (StateUsage case).

### 2.2 Görsel sonuç

Frontend `DiagramViewer.tsx:2197` zaten `nested + hasChildren` node'u title-bar'lı container olarak çiziyor:
- **«state» SensorSystemStates** title-bar'lı kutu, içinde On/Off/Error nested
- **«state» DeliverSSStates** title-bar'lı kutu, içinde On/Off nested

Bu, composite state'lerle (örn. On içinde Normal/Degraded) **görsel olarak tutarlı**. Görsel hierarchy: outer container → composite state → leaf state, hepsi aynı title-bar dilinde.

### 2.3 4 Karar Noktası — Kararlar (Architect Onaylı)

| Karar | Cevap |
|-------|-------|
| 1. Görsel stil (sade composite-state mi, region mı) | **Sade composite-state.** Görsel tutarlılık + minimum komplekslik. Region stili gerekirse Bug-RENDER-03 ayrı slice. |
| 2. state def davranışı (sensor-systems çizilmesin mi) | **Çizilmesin. Byte-identical snapshot.** Geriye uyum + SysML semantik (state def = abstract scope, state usage = concrete). |
| 3. Frozen snapshot regen onayı (Platform Owner) | **Onaylandı.** multi-root regen (2 container node + 4 composition edge), sensor-systems byte-identical. |
| 4. Yeni feature flag gerekli mi | **Hayır.** Mevcut `FF_STATE_MACHINE_NEW_RENDERER` yeterli. A′ sadece transformer çıktısını zenginleştirir, pipeline davranışını değiştirmez. |

### 2.4 SysML Semantik Uyumu

A′ aslında SysML v2 semantiğini doğru ifade ediyor:
- **StateDefinition** (`state def Foo`) = abstract definition, instantiate edilmeden çizilmez (mevcut davranış doğru)
- **StateUsage** (`state Foo`) = concrete state, çizilir (A′ bunu düzeltiyor — multi-root pattern'inde top-level StateUsage'lar şu an çizilmiyor)

Bu, sadece UX iyileştirmesi değil, **doğru spec implementasyonu** — Slice 2d.1 + 2d.3 birlikte "multi-root SysML v2 idiomatic pattern doğru çiziliyor" sonucunu veriyor.

---

## 3. Files to Touch

### Değiştirilecek (kesin)

- `packages/diagram-service/src/rendering/state-machine/transformer.ts` — seed loop'ta StateUsage container'ı `kind: 'state'` olarak emit (~15-25 satır)
- `packages/diagram-service/src/rendering/state-machine/transformer.test.ts` — yeni unit testler
- `packages/diagram-service/src/rendering/state-machine/end-to-end.test.ts` — yeni e2e test
- `packages/diagram-service/tests/fixtures/state-machine/multi-root-part-states/expected-ir.json` — regen (2 container node + 4 composition edge)
- `packages/diagram-service/tests/fixtures/state-machine/multi-root-part-states/expected-smodel.json` — regen

### Dokunulmayacak (önemli)

- `packages/diagram-service/src/rendering/state-machine/renderer.ts` — **dokunulmaz** (composite state mekanizması yeniden kullanılıyor)
- `packages/shared-types/src/state-machine.ts` — **dokunulmaz** (IR şeması korunur, yeni kind yok)
- `packages/web-client/src/diagram/DiagramViewer.tsx` — **dokunulmaz** (title-bar container çizim mekanizması zaten doğru)
- `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-*.json` — **byte-identical** (state def çizilmez, transformer test'i bunu doğrulamalı)
- `packages/diagram-service/src/rendering/pipeline.ts` — wedge dokunulmaz (Slice 2d.2'nin konusu, bu slice değil)
- `ecosystem.config.cjs` — FF değişmez, mevcut yeterli

---

## 4. Implementation Plan (3 Atomic Commit)

### Paket 1: Transformer fix + sensor-systems regression test

**Commit 1:** `Phase 1 Slice 2d.3: emit top-level StateUsage containers as state nodes`

- `transformer.ts` seed loop'unu güncelle: StateUsage container ise `kind: 'state'` node emit et (kind ayrımı `isStateUsage` predicate veya equivalent)
- Yorum eklemeleri: neden StateUsage emit edilir, neden StateDefinition emit edilmez (SysML semantik)
- `transformer.test.ts`'e yeni test: **sensor-systems regression** — mevcut frozen snapshot byte-identical kalır (state def çizilmez)
- POC'un kanıtladığı davranışı code'a koy

**Beklenen sonuç:**
- sensor-systems testleri yeşil (byte-identical)
- multi-root-part-states testleri **KIRMIZI** (snapshot eski, yeni IR'da extra node'lar)

Commit'in mesajında bu açıkça yazılmalı (atomic disipline: bu commit "fix + regression test", snapshot regen ayrı commit).

### Paket 2: Multi-root fixture snapshot regen

**Commit 2:** `Phase 1 Slice 2d.3: regenerate multi-root-part-states expected JSON (container labels)`

- `expected-ir.json` ve `expected-smodel.json`'ı **transformer çalıştırarak deterministic üret** (ADR-005 §7 garantisi)
- Yeni içerik: 2 ek state node (ModeAlpha, ModeBeta) + 4 ek composition edge (modealpha→idle, modealpha→active, modebeta→open, modebeta→close)
- Test'leri çalıştır, multi-root-part-states yeşile geçer

**Üretim yöntemi:** Geçici script (`scripts/_tmp-regen-multi-root.ts`, çalıştır, sil — POC pattern'i Slice 2d.1'den)

**Beklenen sonuç:**
- Tüm fixture testleri yeşil
- Snapshot diff açıklayıcı (2 node + 4 edge eklendi, mevcut hiçbir şey değişmedi)

### Paket 3: Multi-root container test'leri + edge case

**Commit 3:** `Phase 1 Slice 2d.3: add container-label tests + StateDefinition no-op test`

Yeni testler:

1. **Container label kanıtı (multi-root):** Yeni fixture'da `state__ModeAlpha` ve `state__ModeBeta` IR'da var, name'leri doğru, label'lı render edilir (SModel'de title-bar)
2. **Container containedNodes ilişkisi:** ModeAlpha'nın `containedNodes` array'inde Idle ve Active var, ModeBeta'nın'da Open/Closed var
3. **SysML semantic regression:** `state def Foo` content'iyle minimal fixture → StateDefinition top-level → çizilmez (regression test, geriye uyum sigortası)
4. **Composite state visual consistency:** Slice 2d.1'deki Active composite (içinde Running/Paused) zaten title-bar'lıydı — yeni ModeAlpha container'ı **aynı görsel dilde** olduğunun assertion'u

Test sayısı tahmini: +4-6 yeni test.

---

## 5. Test Matrix

| # | Senaryo | Test dosyası | Beklenen |
|---|---------|--------------|----------|
| 1 | **Regression: sensor-systems byte-identical** | `transformer.test.ts` (mevcut) | Frozen snapshot DEĞİŞMEZ, state def çizilmez |
| 2 | **Multi-root container'lar çizilir** | `transformer.test.ts` (yeni) | `state__ModeAlpha`, `state__ModeBeta` IR'da var, doğru name |
| 3 | **Multi-root containedNodes** | `transformer.test.ts` (yeni) | ModeAlpha → [Idle, Active], ModeBeta → [Open, Closed] |
| 4 | **Multi-root expected IR match** | `transformer.test.ts` (mevcut+yeni snapshot) | Regen edilmiş snapshot byte-identical match |
| 5 | **Multi-root expected SModel match** | `end-to-end.test.ts` | Regen edilmiş SModel byte-identical match |
| 6 | **Wedge end-to-end (counter)** | `end-to-end.test.ts` | `rendererUsed: 'new'`, counter `new` artar, fallback ARTMAZ |
| 7 | **SysML semantic regression: top-level StateDefinition no-op** | `transformer.test.ts` (yeni) | Minimal `state def Foo { state A; }` → Foo IR'da YOK (StateDefinition çizilmez), A IR'da var |
| 8 | **Composite state visual consistency** | `transformer.test.ts` veya `end-to-end.test.ts` (yeni) | Active (composite) ve ModeAlpha (container) aynı şekilde title-bar'lı, ikisi de aynı IR pattern |
| 9 | **Boş model edge case** | `transformer.test.ts` (mevcut) | Hâlâ no-op, defense guard çalışıyor |

**Beklenen toplam:** 1131 → 1135-1137 test (4-6 yeni, sıfır regression).

---

## 6. Acceptance Criteria

- [ ] `pnpm test` tüm monorepo yeşil (1135+ test)
- [ ] sensor-systems frozen snapshot byte-identical (state def davranışı korundu)
- [ ] multi-root-part-states snapshot regenerate edilmiş (2 container node + 4 composition edge eklendi, başka değişiklik yok)
- [ ] Transformer'da StateUsage vs StateDefinition ayrımı explicit (yorum + test)
- [ ] IR şeması değişmedi (`StateMachineNodeKind` aynı, yeni `state-group` veya benzeri YOK)
- [ ] Renderer dokunulmadı (`renderer.ts` diff = 0)
- [ ] Frontend dokunulmadı (`DiagramViewer.tsx` diff = 0)
- [ ] Pre-commit hook 1131+ yeşil
- [ ] 3 atomic commit, history aydınlık
- [ ] Self-dogfood kanıt üçgeni hizalı: Tarayıcı (container label'ları görünüyor) + Counter (`new` arttı, `old-fallback-from-new` artmadı) + Log (sessiz, `[Wedge] threw` yok)

---

## 7. Deploy + Dogfood + Flip Akışı

### 7.1 Yeni FF gerekmez

A′ mevcut `FF_STATE_MACHINE_NEW_RENDERER='true'` (permanent, Slice 2d.1 flip) kapsamında çalışıyor. Sadece transformer çıktısı zenginleşiyor.

### 7.2 Deploy (brief v1.3 §3.1 canonical)

Karar noktası tabanlı 3 paket (brief v1.3 §7):

**Karar 1: Push** (Paket 1-3 commit + push)
- Pre-commit hook 1131+ yeşil
- Remote HEAD teyit

**Karar 2: Production deploy**
- `ssh root@<host> 'cd /opt/systemodel && git pull origin master'` (fast-forward beklenir)
- Per-package build (sadece diagram-service değişti, ama disipline için tüm sequence)
- PM2 restart (config değişmedi, sadece kod): `pm2 delete diagram && pm2 start ecosystem.config.cjs --only diagram`
- Smoke + `/proc` env doğrulama (FF hâlâ aktif, regression yok)

**Karar 3: Self-dogfood + flip**

`pm2 flush diagram` ile log baseline sıfırla. Tarayıcı Claude + AG backend polling + counter — üçlü kanal. Kanıt üçgeni hizalı ise **zaten flip permanent** (yeni FF yok, sadece kod güncellemesi production'a alınıyor).

### 7.3 Self-dogfood beklentileri

- **Tarayıcı:** SensorSystem.sysml STV view'da iki container label'ı görünür (**«state» SensorSystemStates** ve **«state» DeliverSSStates**), title-bar'lı, içeride state'ler nested
- **AG backend:** Log sessiz, monitor sessiz
- **Counter:** `state-machine.new` artar (her STV açışta), `old-fallback-from-new` SIFIR

### 7.4 Rollback (gerek olursa)

- Slice 2d.3 commit'lerini revert: `git revert <commit3> <commit2> <commit1>` + push + prod pull + restart
- Counter izle (revert sonrası `new` hâlâ artmalı, sadece container label'ları kaybolur)
- Slice 2d.3.1 hotfix brief yazılır

---

## 8. Anti-Patterns (Bu Slice'a Özel + v1.0'dan miras)

Brief v1.3 §10 + Slice 2d.1 anti-pattern'leri aynen geçerli. Bu slice'a özel **yeni anti-pattern** (brief v1.4'e eklenecek):

**[YENİ] Anti-pattern: Brief'te framework/library iddiası repo verification olmadan**

> Brief yazarken "X framework kullanılıyor" iddiası (Sprotty, React Router, etc.) yapılırken **repo'daki package.json'a verification yap** (`grep -ri <library>` veya manuel `cat package.json | grep <library>`). Slice 2d.3 v1.0'da Sprotty varsayımı + Slice 2d.1'de filter zorunlu varsayımı — pattern aynı: kod okumadan tasarım kararı, AG ampirik test ile yakalıyor. Önlem: Architect brief yazımında "framework varsayımları" listesi yapar, AG keşif öncesi onları verify eder, yoksa brief revize edilir.

Bu slice'taki diğer anti-pattern'ler v1.3 §10'da mevcut, tekrarlanmıyor.

---

## 9. Out of Scope

- **Slice 2d.2 (filter integration):** Bu slice'ta dokunulmaz, ayrı slice
- **Bug-RENDER-03 (region stili, eğer talep gelirse):** Backlog candidate, A′ sade composite-state stilini kullanıyor
- **Frontend custom region/group decorator:** Sprotty olmadığı için gelecek frontend slice'ı olabilir (Faz 3+?), bu slice değil
- **Layout improvement (ELK, multi-root yerleşim):** Ayrı slice
- **Bug-RENDER-01:** Frontend state cleanup on model switch, önceki backlog
- **Faz 1 Final Report:** Slice 2d.2 ve 2d.3 sonrası

---

## 10. Workflow Disipline

### 10.1 Karar noktası sayısı: 3 (v1.3 §7 hedef)

- **Karar 1:** Implementation (Paket 1-3 commit + push) — AG tek paket olarak çalıştırır, pre-commit hook sürpriz olursa AG zaten durur
- **Karar 2:** Production deploy — AG tek paket olarak (pull + build + restart + smoke), sürpriz olursa AG durur
- **Karar 3:** Dogfood + permanent (counter teyit) — Architect onaylar veya rollback

Slice 2d.1'in 16 checkpoint'inden çok daha az. AG'ye auto-DUR yetkisi explicit.

### 10.2 AG'nin yapacağı

1. Bu brief v1.1'i oku
2. Paket 1-3 implementasyonu (atomic commit'ler)
3. Push (Karar 1) → AG durur, raporlar
4. Production deploy (Karar 2) → AG durur, raporlar
5. Dogfood koordinasyonu için Architect'e döner (Karar 3 öncesi)

### 10.3 Tarayıcı Claude'un rolü

Slice 2d.1 dogfood pattern'i tekrar uygulanır (brief v1.3 §5.2). Architect Tarayıcı Claude brief'ini hazırlayacak (önceki template + container label kontrolü).

---

## 11. Sources & References

- `renderer_refactor_phase1_slice2d3_brief.md` (v1.0, repo `0ccf303`)
- AG Discovery Report (Adım 0, bu brief'e entegre)
- `phase1_slice2d1_closeout.md` — multi-root pattern context
- `renderer_refactor_phase1_brief_v1_3.md` — canonical ops, checkpoint pattern, brief evrim disipline
- `bug_render_02_container_labels.md` (Architect-tarafı) — eski 3 yaklaşım analizi (artık historik)
- `docs/adr/005-state-machine-renderer.md` — D1, §6, §7

**Kod referansları (AG discovery'den):**
- `packages/diagram-service/src/rendering/state-machine/transformer.ts:190-197` (multi-seed loop, Slice 2d.1)
- `packages/diagram-service/src/rendering/state-machine/renderer.ts` (dokunulmuyor)
- `packages/shared-types/src/state-machine.ts:7` (IR şeması, dokunulmuyor)
- `packages/web-client/src/diagram/DiagramViewer.tsx:2197` (title-bar container mekanizması, dokunulmuyor)
- `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/` (byte-identical)
- `packages/diagram-service/tests/fixtures/state-machine/multi-root-part-states/` (regen)

---

**Brief v1.1 sonu. AG: Paket 1-3 implementasyonuna başla, atomic commit'ler. Push (Karar 1) sonrası Architect dogfood koordinasyonu için bekler.**
