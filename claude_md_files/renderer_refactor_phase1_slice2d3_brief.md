# Faz 1 Slice 2d.3 — Multi-Root Container Labels (Bug-RENDER-02)

**Brief versiyonu:** v1.0 (iki aşamalı: çerçeve + keşif spec; v1.1 AG discovery raporu sonrası)
**Tarih:** 2026-05-24
**Author:** Architect Claude
**Önkoşul:** `phase1_slice2d1_closeout.md` (Slice 2d.1 kapanış) okundu, multi-root pattern netleşmiş
**Çapraz referans:** `renderer_refactor_phase1_brief_v1_3.md` (canonical ops, bu brief onun pattern'lerini uyguluyor)
**Tahmini süre:** 30 dk keşif + 15 dk Architect review/v1.1 + 2 saat impl + 30 dk dogfood = ~3-3.5 saat

---

## 1. Sorun (Bug-RENDER-02)

Slice 2d.1 multi-root crash'i çözdükten sonra production self-dogfood'da fark edildi: **multi-root state machine render'da container isimleri görünmüyor.**

### Gözlem (Slice 2d.1 dogfood, 2026-05-23 screenshot)

Diagram canvas'ında iki bağımsız state machine yan yana render edilmiş:
- **Sol container:** "On" + "Off" + transition (DeliverSSStates)
- **Sağ container:** "Off" + "On" composite (içinde Normal + Degraded) + nested machinery (SensorSystemStates)

**Eksik:** Hiçbir yerde "DeliverSSStates" veya "SensorSystemStates" label'ı yok. Kullanıcı yorumu:
> *"iki farklı container içinde state akışları var bu containerlar diagramda gösterilmediği zaman neyin neye ait olduğu anlaşılmıyor."*

### Teknik root cause (Slice 2d.1 close-out'tan)

`transformer.ts:emitContainer(containerId)`:
- Container'ın **çocuklarını** emit ediyor (her state ayrı IR node)
- Container'ın **kendisini** emit etmiyor — "logical scope" olarak duruyor, görsel temsili yok
- Container'ın adı (`SensorSystemStates`) IR'da yok, sadece child state'lerin `qualifiedName` prefix'inde var (`SensorSystemStates::On::Normal`)

### Pre-fix durum (gizliydi, regression değil)

Slice 2d.1 öncesi tek-root varsayımıyla (`state def SensorSystemStates` standalone diagram root'u), renderer veya UI implicit olarak container'ı diagram başlığı/context olarak handle ediyordu (tek tane, bağlam belli). Multi-root'ta iki tane var ve hiçbiri "başlık" değil.

**Sonuç:** Multi-root görünür hale gelince UX gap açığa çıktı. Bug bir feature surface'i açtı — iyi cinsten regression.

---

## 2. Scope

### Kapsamda (Slice 2d.3)

1. **Top-level container'lar görsel olarak ayırt edilebilir** (label veya başka mekanizma)
2. **3 yaklaşımdan biri seçilir** (AG keşfi sonrası, Architect onayı ile)
3. **Backward-compatible:** Tek-root durumda (sensor-systems fixture) görsel davranış mümkün olduğunca korunur (regression yok veya minimal ve gerekçeli)
4. **Test coverage:** Mevcut frozen snapshot ya korunur ya da regenerate edilir (deterministic, ADR-005 §7 garantili)
5. **Self-dogfood:** Üçlü kanal (Tarayıcı + AG backend + counter), kanıt üçgeni, permanent flip

### Scope dışı

- **Slice 2d.2 (filter integration):** Bu slice'ta dokunulmaz. Eğer Yaklaşım seçimi filter-related olursa, scope cleanly Slice 2d.2'ye delege edilir (brief revize ederim).
- **Layout improvement:** İki container yan yana yerleştirme algoritması ayrı slice (ELK config + multi-root layout). Bu bug "label görünmüyor" — layout zaten çalışıyor.
- **Bug-RENDER-01:** Frontend state cleanup on model switch — önceki backlog, ayrı.
- **Faz 1 Final Report:** Slice 2d.2 ve 2d.3 sonrası.

---

## 3. Üç Yaklaşım (Kısa Tanıtım)

**ÖNEMLİ:** Bu üç yaklaşım birer **hipotez**. AG keşfi gerçek maliyet ve fizibilite verisini sağlayacak. **Şu an hiçbiri "doğru" değil** — Architect karar v1.1'de verir.

### Yaklaşım A: Renderer-side group label (IR şeması değişikliği)

**Fikir:** Top-level container'lar için yeni bir IR node tipi (örn. `kind: 'state-group'` veya `kind: 'region'`). Renderer onu label'lı bir frame (dashed border + name label) olarak çizer, içeride child state'ler.

**Mekanizma:**
- Transformer her top-level container için (mevcut multi-seed'in seedlediği her node) ek bir `state-group` IR node'u emit eder
- Renderer `state-group` kind'ını yeni şekilde çizer (frame + label)
- Mevcut state node'ları value değişmiyor

**Avantaj:**
- IR layer'da temiz ayrım (state vs container)
- Frontend dokunulmaz (SModel zaten frame-able structure destekliyor)
- Tek-root durumda backward-compat: tek group, label tek-root'un adıyla

**Dezavantaj:**
- IR şeması genişler (önceki "IR şemasını koru" disipline'inden taviz — Slice 2d.1'de bilinçli koruduğumuz şey)
- Renderer'a yeni rendering logic eklenir
- Mevcut frozen snapshot büyük ihtimalle değişir (yeni IR node tipi → yeni expected JSON)

### Yaklaşım B: Wedge-side multiple diagrams (UX büyük değişiklik)

**Fikir:** Multi-root durumunda her root için **ayrı diagram canvas** (tabs veya split view). Tek diagram = tek state machine.

**Mekanizma:**
- Wedge çıktı şekli değişir: tek `SModelRoot` yerine `SModelRoot[]` (her root için bir)
- Frontend tab/split UI mantığı ekler (her root ayrı render hedefi)
- Diagram başlığı = root'un adı (otomatik)

**Avantaj:**
- Konseptel olarak en temiz: "iki diagram çünkü iki state machine"
- Her diagram bağımsız (zoom, pan, scroll), karışıklık yok

**Dezavantaj:**
- Frontend UX büyük değişiklik — navigation karmaşıklığı, kullanıcı eğitimi
- Wedge/pipeline contract değişiyor (SModelRoot → SModelRoot[])
- Scope creep riski yüksek — bu Slice 2d.3 boyutunu aşabilir (frontend dokunma)
- Mevcut frontend tek diagram render varsayımı her yerde var

### Yaklaşım C: Frontend-side visual grouping (minimal değişiklik)

**Fikir:** SModel'de top-level container'ları görsel olarak gruplama (label + dashed border). IR ve transformer dokunulmaz.

**Mekanizma:**
- Transformer veya renderer SModel'e ek metadata ekler (örn. her top-level state node'una `data-group-label="SensorSystemStates"` attribute)
- Frontend SVG render'ında bu metadata'yı kullanarak dashed border + label çizer
- Sprotty zaten "group" decorator'ları destekler (kontrol edilmesi gerek)

**Avantaj:**
- IR şeması korunur (Slice 2d.1 disipline'i devam)
- Minimum kod değişikliği
- Backward-compat doğal (metadata varsa kullan, yoksa eski davranış)

**Dezavantaj:**
- Renderer'a "container görsel temsili" responsibility eklenir (şu an renderer dump)
- Frontend dokunulması gerekebilir (Sprotty group decorator'u nasıl tetikleniyor — keşif)
- Visual grouping logic ikiye dağılır (backend metadata + frontend rendering)

---

## 4. Karar Verme Kriterleri (Architect İçin, AG Keşif Sonrası)

AG her yaklaşımı keşfederken **şu kriterleri verisel olarak ölçecek**:

| Kriter | Nasıl ölçülür |
|--------|---------------|
| **Mevcut testler etki** | Frozen snapshot ya byte-identical ya değişir. Değişirse kaç fixture? |
| **Yeni kod miktarı** | Net diff (eklenen/silinen satır) tahmini |
| **Dokunulan paket sayısı** | Sadece diagram-service mi, web-client da gerekiyor mu? |
| **IR şeması değişikliği** | Var/yok. Varsa neyin neyin değiştiği. |
| **Frontend değişikliği** | Var/yok. Varsa hangi component'lar. |
| **Backward-compat** | Tek-root durumda davranış nasıl? Frozen snapshot regression riski? |
| **Slice 2d.2 etkisi** | Filter integration ile çakışma var mı? |
| **Test eklenme** | Yeni test'ler ne tipte (transformer, renderer, frontend)? |

**Architect karar matrisi (AG raporu sonrası v1.1'de):**

- Yaklaşım'ın yeni kod miktarı + frontend dokunma + scope creep riski **en düşük olan** seçilir
- Eşit gibi görünenler arasında **Slice 2d.1 disipline'iyle tutarlılık** belirleyici (IR şeması koru, view-first prensibi)
- Mevcut frozen snapshot byte-identical kalabilirse büyük artı

**Architect şu an hiçbir yaklaşımı tercih etmiyor.** AG keşfinin ardından karar verilir.

---

## 5. AG Keşif Spec (Adım 0)

### Görev: Üç yaklaşımı ampirik olarak değerlendir, gerekçeli design proposal yap

### 5.1 Keşif kapsamı

**Renderer tarafı:**
- `packages/diagram-service/src/rendering/state-machine/renderer.ts` — mevcut `containedSet` mantığı, top-level state render akışı (`:284-292`)
- IR şemasını koruyarak label nereye eklenebilir? Yaklaşım A için yeni node tipi eklenebilir mi (TypeScript type system)?
- Yaklaşım C için SModel'e metadata ekleme yolları (Sprotty SModelNode'da `data-*` attribute, `cssClasses`, vs.)

**IR / type tarafı:**
- `packages/diagram-service/src/rendering/state-machine/types.ts` (veya equivalent) — IR discriminated union yapısı
- Yeni `state-group` kind eklenmesi nasıl olur? Mevcut testler etki?

**Frontend tarafı (Yaklaşım B ve C için):**
- `packages/web-client/src/diagram/` (veya equivalent) — Sprotty diagram render setup
- Multi-diagram tab/split (Yaklaşım B) nasıl yapılır? Mevcut tek-diagram varsayımı nerede?
- Sprotty group decorator (Yaklaşım C) nasıl tetiklenir? Custom SModel feature mı, built-in mi?

**Test fixture tarafı:**
- `tests/fixtures/state-machine/sensor-systems/expected-*.json` (tek-root, frozen snapshot)
- `tests/fixtures/state-machine/multi-root-part-states/expected-*.json` (multi-root, Slice 2d.1)
- Hangi yaklaşım hangi fixture'ı nasıl değiştirir?

### 5.2 Sentetik proof gereksinimleri

AG **gerçek ampirik veri** üretmeli (Slice 2d.1'de filter integration sürpriz pattern'i tekrarlanmasın):

1. **Yaklaşım A prototip:** Geçici bir branch'te veya `/tmp/`'de mini bir POC — IR'a `state-group` ekle, renderer bunu nasıl çizer (sadece prototip kanıtı, push edilmiyor)
2. **Yaklaşım B keşif:** Frontend'de `SModelRoot[]` desteği var mı, nerede kırılır?
3. **Yaklaşım C keşif:** Sprotty group decorator dökümantasyonu + mevcut codebase'de örnek var mı?

### 5.3 AG raporu içeriği (Adım 0 sonrası)

```markdown
# Slice 2d.3 Discovery Report

## Yaklaşım A — Renderer-side group label
- Ampirik kanıt: ...
- Diff tahmini: ...
- IR şeması değişikliği: ...
- Frozen snapshot etkisi: ...
- Risk: ...

## Yaklaşım B — Wedge-side multiple diagrams
... (aynı yapı)

## Yaklaşım C — Frontend-side visual grouping
... (aynı yapı)

## Önerim
[Gerekçeli olarak hangi yaklaşımı seçtim ve neden]

## Sürprizler / Karar Noktaları
[Architect'in karar vermesi gereken belirsizlikler]
```

### 5.4 Keşif sınırları

- **Kod yazma yok** (POC prototip hariç, o da push edilmez)
- **Brief tamamlanmadan implementasyona BAŞLAMA**
- **Sürpriz çıkarsa DUR ve raporla** (Slice 2d.1 filter integration pattern'i)
- **30-45 dk** ideal süre, daha uzun sürerse Architect'e bildir

---

## 6. Implementation Plan (v1.1'de Detaylandırılacak)

Bu bölüm AG keşif raporu + Architect onayı sonra v1.1'de doldurulacak. Şimdilik iskelet:

### Paket 1: Implementation core
- Seçilen yaklaşıma göre kod değişiklikleri (transformer / renderer / frontend)
- Atomic commit'ler

### Paket 2: Test + fixture
- Mevcut testleri geçer hale getir
- Yeni testleri ekle (yaklaşıma göre)
- Frozen snapshot'lar regen ediliyorsa deterministic üretim (ADR-005 §7)

### Paket 3: Deploy + dogfood + flip
- Push → prod pull → build → PM2 restart
- Self-dogfood (Tarayıcı + AG backend + counter)
- Kanıt üçgeni hizalı ise permanent flip
- Eğer Yaklaşım A veya C (renderer tarafı): mevcut feature flag (`FF_STATE_MACHINE_NEW_RENDERER`) sufficient mi, yoksa yeni flag (`FF_STATE_MACHINE_CONTAINER_LABELS`) gerek mi? — keşifte karar verilir

---

## 7. Test Matrix (v1.1'de Detaylandırılacak)

İskelet:

| # | Senaryo | Beklenen |
|---|---------|----------|
| 1 | Mevcut sensor-systems (tek-root) | Frozen snapshot ya korunur ya regenerate |
| 2 | Yeni multi-root-part-states (Slice 2d.1) | Container label'ları görünür |
| 3 | Boş model / state-machine olmayan | No-op, crash yok |
| 4 | Yaklaşıma özel test'ler | (v1.1'de detaylanır) |

---

## 8. Acceptance Criteria (v1.1'de Detaylandırılacak)

İskelet:

- [ ] Container label'lar render edilir (sensor-systems'te tek-root için, multi-root-part-states'te iki container için)
- [ ] Tarayıcı Claude self-dogfood'da "hangi 'On' hangi sisteme ait" sorusu çözülmüş (görsel kanıt + screenshot)
- [ ] `pnpm test` tüm monorepo yeşil (1131 test)
- [ ] Frozen snapshot stratejisi açıklanmış (korundu veya regenerate, gerekçeli)
- [ ] Counter `state-machine.new` artıyor, `old-fallback-from-new` ARTMIYOR
- [ ] IR şeması değişikliği varsa ADR-005'te belgelenmiş
- [ ] Frontend değişikliği varsa açıkça not edilmiş

---

## 9. Anti-Patterns (Slice 2d.1'den + Bu Slice'a Özel)

Önceki anti-pattern'ler aynen geçerli (`renderer_refactor_phase1_brief_v1_3.md` §10). Bu slice'a özel ek:

1. **Yaklaşımı AG keşfi öncesi sabit kabul etme.** Üç yaklaşım hipotez, hiçbiri "doğru" değil.
2. **Sprotty bilgisi olmadan frontend yaklaşımı önerme.** Yaklaşım B ve C frontend rendering library bilgisi gerektirir — AG keşfetmeden tasarım kararı verme.
3. **IR şeması değişikliğini hafife alma.** Yaklaşım A'da yeni `state-group` kind'ı eklemek = renderer dışında discriminated union'da değişiklik = tip güvenliği etkisi. Keşif kapsamlı olmalı.
4. **Frozen snapshot regen'i otomatik kabul etme.** ADR-005 §7 deterministic garanti veriyor ama snapshot değişikliği **kullanıcı görselini etkiler** — Platform Owner onayı şart.

---

## 10. Out of Scope

- Slice 2d.2 (filter integration) — paralel ama bağımsız, ayrı slice
- Slice 2e (WS auth + HierarchicalFlagProvider) — Faz 1.1
- Security B1/B2/B3 — post-Faz 1
- Bug-RENDER-01 (frontend state cleanup) — önceki backlog
- Layout optimization (ELK config, multi-root yerleşim) — ayrı slice
- Faz 1 Final Report — Slice 2d.2 ve 2d.3 sonrası

---

## 11. Workflow (Karar Noktası Tabanlı, v1.3 §7 Pattern)

**Karar 1:** AG keşif → rapor (Adım 0) → Architect review → brief v1.1 ile design + plan netleşir

**Karar 2:** Implementation paketleri (commit, push) — sürpriz olunca AG durur, normalde otomatik geç

**Karar 3:** Deploy + dogfood + flip kararı (kanıt üçgeni) → permanent flip veya rollback

**Toplam karar noktası:** 3. Slice 2d.1'in 16 checkpoint'inden çok daha az.

---

## 12. Sources & References

- `phase1_slice2d1_closeout.md` — Slice 2d.1 narrative, Bug-RENDER-02 keşfi
- `renderer_refactor_phase1_brief_v1_3.md` — canonical ops, anti-pattern'ler, checkpoint pattern, brief evrim disipline
- `bug_render_02_container_labels.md` (Architect-tarafı backlog notu) — 3 yaklaşım analizi
- `renderer_refactor_strategy_v2.md` — strangler-fig + view-first
- `docs/adr/005-state-machine-renderer.md` — D1, §6, §7
- Kod path'leri: `renderer_refactor_phase1_brief_v1_3.md §11`

---

**Brief sonu. AG: Adım 0'dan başla — 3 yaklaşımı ampirik olarak keşfet, raporu Architect'e ilet. Implementasyona Architect onayı sonrası geçilir.**
