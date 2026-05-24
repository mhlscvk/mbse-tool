# Faz 1 Slice 2d.2 — Close-Out Narrative

**Slice durumu:** ✅ KAPALI. Production'da view-filter integration çalışıyor, View-First prensibi output seviyesinde tamamlandı, görsel etki sıfır (no-op flip).
**Tarih:** 2026-05-24
**Author:** Architect Claude
**Önceki briefs:** `renderer_refactor_phase1_slice2d2_brief.md` (v1.0, commit `7df6cc6`), `renderer_refactor_phase1_slice2d2_brief_v1_1.md` (v1.1, henüz commit edilmedi — Architect tarafı)
**Çapraz referans:** `phase1_slice2d1_closeout.md`, `phase1_slice2d3_closeout.md`, `renderer_refactor_phase1_brief_v1_3.md`

---

## 1. Amaç

Slice 2d.2'nin **tarihsel narrative'i** — View-First prensibinin nasıl tamamlandığı, brief evrim hikayesi (v1.0 → v1.1 + 3 ana revize), AG keşfi + POC + Platform Owner görsel ön-kabul + snapshot mimarisi keşfi, DP1/DP2/DP3 kararları, no-op flip kanıtı, lessons learned.

Bu slice'ın **tarihsel kıymeti**: 4 Architect hatasının tek slice'ta yakalanması ve düzeltilmesi. Brief disipline'i ve Three-Claude orchestration olgunluğunun zirvesi.

---

## 2. Context — Slice 2d.1'den Slice 2d.2'ye

### Slice 2d.1'de bilinçle ertelenen iş

Slice 2d.1 brief v1.1 §4'te "filter integration zorunlu" iddiasını AG ampirik testle çürütmüş, view-filter integration'ı **Slice 2d.2'ye ertelemişti**. Ertelenme gerekçesi: filter görsel davranışı değiştirebilir (`pseudo-initial__on` siliniyor, start→entry remap), bu **ürün kararı** Slice 2d.1 hotfix scope'u dışında.

### Slice 2d.2'nin amacı

View-First prensibini tamamlamak:
- Wedge'e (yeni renderer path'i) `applyViewFilter` ekle
- Pipeline mimarisini simetrize et
- Sensor-systems görsel davranış değişikliğini Platform Owner onayı ile kabul et veya reddet
- ADR-005'e D-FILTER-01 yaz

### Pre-Slice 2d.2 mimari durum

```
                                  ┌─── (transformToBDD:616: applyViewFilter inside) ─── legacy
Wedge (pipeline.ts:95) ─── model ─┤
                                  └─── (raw model, no filter) ─── new renderer
```

**Asimetri:** Aynı view'da iki path farklı filtered durumla çalışıyor. View-First prensibinden taviz.

---

## 3. Brief Evrim Hikayesi (4 Ana Revize)

Slice 2d.2 brief'i **dört kritik iterasyondan** geçti. Her biri Architect'in farklı bir failure mode'unu açığa çıkardı, AG ampirik testle yakaladı. **Bu slice'ın en değerli süreç kazanımı.**

### Brief v1.0 (ilk taslak)

3 yaklaşım stratejisi:
- DP1: filter cleanup yaklaşımı (legacy'den kaldır)
- DP2: görsel davranış değişikliği kabul kriterleri (Tarayıcı Claude görsel otorite — yeni operating model!)
- DP3: görsel preview yöntemi

Pre-impl POC + Tarayıcı ön-kabul pattern'i (Slice 2d.3 POC pattern'inin ileri versiyonu) brief'e eklendi.

**Hata 1:** "Legacy filter cleanup: `bdd-transformer.ts:616` `applyViewFilter` çağrısı kaldırılır" iddiası, **kim çağırıyor verification yapılmadan** yazıldı.

### Brief v1.1 (AG discovery + POC sonrası)

AG Adım 0'da üç kritik sürpriz raporladı:

**🔴 DP1 — Brief'in en büyük hatası:** AG kanıtladı: `transformToBDD:616`'daki filter call **kaldırılamaz**. 59 test (`view-filters.test.ts` pipeline helper + `bdd-transformer.{test,state,robustness,new-features,audit}.test.ts` + `end-to-end.test.ts`) bu çağrıya bağlı.

→ Karar: **DP1 = (b) new-path-only filter.** Sadece `pipeline.ts:95` öncesi filter, `:616` dokunulmaz. Asimetri **output seviyesinde** çözülür (her iki path filtered model verir), call-site seviyesinde kalır (Faz 2'de legacy kaldırılınca doğal olarak çözülür).

**🔴 DP2 — Semantic problem (kritik):** AG POC ampirik veri:
```
sensor-systems FILTERED: pseudo-initial__on KAYBOLDU
                edge__on_initial_to_normal KAYBOLDU
```

AG yorumu: "Legacy renderer'da entry action node `entryAction → Normal` remap edge görünüyor, yeni renderer'da bu yok. `Normal'in On'un initial sub-state'i` bilgisi görsel olarak kayboluyor."

**🟡 DP3 — Görsel preview yöntemi:** SModel pre-layout, JSON snapshot direkt görsel değil. Lokal patch + Platform Owner direkt görsel veya structural delta?

### Brief v1.1 v0 — Architect Karar Süreci (DP2 odaklı)

Architect Karar: DP2 ölçülebilir kriter değil, **subjektif SysML semantik kararı**. Yeni operating model'in (Tarayıcı görsel otorite) **istisna durumu**: subjektif semantik kararlar **Platform Owner'a devredilir**.

DP3 = (a): AG geçici patch + lokal stack + Platform Owner direkt görsel inceleme.

### AG Pre-Impl POC Deploy

AG **olağanüstü disipline** ile:
1. Patch'i clearly-marked yorumlarla yazdı (`[SLICE-2d.2 POC PATCH — DO NOT COMMIT]`)
2. `.env`'e FF flag'i ekledi (gitignored)
3. DB migration durumunu kontrol etti, pending migration'ı uyguladı (bağımsız, zaten gerekliydi)
4. `pnpm dev` ile lokal stack'i background'da başlattı
5. **WS smoke test ile lokal stack'in gerçekten POST servis ettiğini ampirik kanıtladı** (`rendererUsed: 'new'`, 15 nodes, `pseudo-initial__on` yok)
6. Platform Owner için PRE vs POST karşılaştırma talimatları + model paste içeriği + cleanup script'leri hazırladı

### Platform Owner Görsel Ön-Kabul — DP2 KABUL

Muhlis lokal POST (localhost:5173) vs prod PRE (systemodel.com) side-by-side, sensor-systems STV view, **birebir aynı modeli** yapıştırdı. Sonuç:

**🔑 KRİTİK KEŞİF:** İki render **birebir aynı görünüyor.** Mevcut yeni renderer `pseudo-initial__on`'u (sub-state için initial daire) **zaten çizmiyor**. Filter onu IR'dan siliyor ama silinen şey zaten görünmüyordu → **görsel etki sıfır**.

**Anlamı:**
- AG'nin DP2 yorumu IR seviyesinde doğruydu, görsel seviyede no-op
- **Slice 2d.2 "iyi cinsten" slice**: mimari iyileşme + görsel nötr
- Operating model nüansı: subjektif görsel kararlar **gerçek render üzerinde** yapılmalı, IR diff'ten extrapolation yapılmamalı

Karar: **DP2 KABUL ✓**, full impl başlayabilir.

### Brief v1.1 (Architect tarafı, AG paslandı)

DP1/DP2/DP3 kararları kararlı + 3 atomic commit planı + ADR-005 D-FILTER-01 taslağı + test matrix detaylandırıldı.

**Hata 2 (henüz fark edilmedi):** §3.1'de "sensor-systems regen" direktifi yazıldı, **snapshot kim tarafından tüketiliyor verification yapılmadan**.

### AG Snapshot Mimarisi Keşfi (4. brief hatası)

AG impl başlamadan önce snapshot test mekanizmasını araştırdı. Üç test sitesi **aynı snapshot'ı tüketiyor**:

| Test | Input | Pre-fix | Post-fix |
|------|-------|---------|----------|
| `transformer.test.ts:132` | raw `transformAstToStateMachineIR(model)` | matches PRE | hâlâ PRE (transformer filter etmez) |
| `end-to-end.test.ts:82` direct | raw `transformAstToIR(model)` | matches PRE | hâlâ PRE |
| `end-to-end.test.ts:105` wedge | `wedge(model)` | matches PRE | filtreliyor → POST |

Brief'in "regen to filtered" direktifi **iki raw test'i kırardı**. Ayrıca property test'leri (`"two initial pseudos"`, `"local pseudo-initial inside On"`) golden file ile çelişen iddialarda bulunacaktı.

**Pattern (4. tekrar):** Brief v1.0 filter cleanup iddiası + Slice 2d.3 Sprotty iddiası + Slice 2d.1 filter zorunlu iddiası + Slice 2d.2 v1.1 snapshot regen iddiası = **aynı failure mode**: refactor/regen iddiası, kim tüketiyor/bağımlı verification yapılmadan.

AG 3 seçenek sundu:
1. Regen + 2 testi filtrele (brief direktifi, mimari karışık)
2. **Snapshot'ları ayır (split)** — raw + filtered ayrı dosyalar
3. Regen + tüm dosyayı filtered (raw coverage kaybı)

### Architect Karar: Seçenek 2 (split-snapshot)

Açık ara doğru cevap. Sebep:
- Test piramidi seviyesi → kendi golden'ı (mimari sağlığı)
- Coverage zenginleşir, kaybolmaz (her iki davranış sigortalı)
- Property test'leri raw snapshot ile uyumlu (semantic karışıklık yok)
- Brief hatasını düzelten doğru hamle

---

## 4. Implementation (3 Atomic Commit)

### Tactical Disipline (Slice 2d.3 Lesson Tekrarı)

Pre-commit hook her commit'te tüm suite çalıştırıyor → kırmızı ara-commit imkânsız. AG `fix + regen` tek commit'te birleştirdi, testler ayrı commit'lerde.

### Commits

| Commit | Paket | İçerik |
|--------|-------|--------|
| `ef3db82` | 1 | Filter integration (`pipeline.ts:95` öncesi, DP1=b) + 2 filtered golden (`expected-{ir,smodel}-filtered.json`) + wedge test redirect |
| `1f161b8` | 2 | +4 integration test (`end-to-end.test.ts`) |
| `dec3470` | 3 | ADR-005 Decision 5 / D-FILTER-01 |

3 atomic commit, hepsi yeşil. Test sayısı: 1138 → 1142 (+4).

### Snapshot Mimarisi (Final)

**Files:**
- `sensor-systems/expected-ir.json` — **byte-identical**, raw transformer golden
- `sensor-systems/expected-smodel.json` — **byte-identical**, raw renderer golden
- `sensor-systems/expected-ir-filtered.json` — **yeni**, filtered transformer golden
- `sensor-systems/expected-smodel-filtered.json` — **yeni**, filtered wedge golden

**Test eşleşmesi:**
- Transformer isolation test → raw golden, dokunulmaz
- Direct end-to-end test → raw golden, dokunulmaz
- Wedge end-to-end test → filtered golden (yeni)
- Property test'leri (`"two initial pseudos"`, `"local pseudo-initial inside On"`) → dokunulmaz, raw snapshot ile uyumlu

**Multi-root-part-states:** Filter no-op (entry action yok). Snapshot **byte-identical**, ek dosya gerekmez. Test ile teyit (wedge çıktısı = raw çıktısı).

### AG Bonus Disipline (Slice 2d.3'ten yeni)

- **Pre-deploy tsc verification:** Pre-commit hook esbuild kullanıyor, type checking yapmıyor. AG **deploy öncesi `pnpm --filter @systemodel/diagram-service build`** ile tsc çalıştırdı, production build'inin geçeceğini ön-doğruladı. Brief v1.3 canonical'ında olmayan ek önlem.

---

## 5. Production Deploy + Dogfood

### Deploy (Karar 2)

Brief v1.3 §3.1 canonical akış. AG **proaktif sürpriz** yakaladı:

**Production HEAD sürprizi:** Production `3301417`'deydi, brief'in beklediği `7df6cc6` değil. İki doc-only commit (Slice 2d.3 close-out + Slice 2d.2 brief v1.0) production'a deploy edilmemişti.

AG **panic etmedi, cross-reference yaptı**:
- `3301417` `dec3470`'in atası → fast-forward mümkün
- Doc-only commit'ler runtime etkisiz → güvenli
- DUR koşulu non-fast-forward değil → devam et

Bu, **brief v1.3 §6 stale-log forensic disipline'inin mantıksal kuzeni** — "beklenmedik state gördüğünde reflexif tepki verme, kontekst topla." Brief v1.4'e canonical: "Production HEAD beklenmedik ise → ancestor check, fast-forward kontrolü, runtime impact analizi."

### Deploy sonuç

| Adım | Sonuç |
|------|-------|
| Pull (3301417 → dec3470) | Fast-forward, 8 dosya |
| Build (per-package) | 4/4 EXIT 0, diagram-service kritik clean |
| PM2 restart | pid 2809610, ↺=0, online |
| /proc env cross-check | NODE_ENV + FF ikisi de config'den ✓ |
| Smoke | /health 200, /ready 200 |
| Counter baseline | `{totalRenders:0}` (restart sonrası sıfır) |

Hiçbir DUR koşulu.

### Self-Dogfood (Karar 3)

**🟢 Olağanüstü pozitif başlangıç:** AG ilk snapshot'ta deploy'dan 12 dk sonra zaten `state-machine.new: 343` görüldü — **production trafiği aktif**, 343 STV render geçti, hepsi yeni renderer + filter, hiçbiri fallback'e düşmedi.

Üçlü kanal:

**🖥️ Tarayıcı Claude:**
- Programatik DOM teyit: `pseudo-initial` element sayısı = 0 (görsel sezgiden çok daha güvenilir)
- On içindeki entry/do/exit + Normal/Degraded sağlam ✓
- SensorSystemStates + DeliverSSStates container'ları (Slice 2d.3) intact ✓
- Multi-root parite OK ✓
- 0 console error, status bar "✓ Sorun yok" ✓
- Tarayıcı bonus: top-level `pseudo-initial__top` gözlemi (Slice 2d.3 A′ selective + Slice 2d.2 filter no-op birleşik kanıtı)

**👁️ AG backend (counter):**
- `state-machine.new` periyodik artıyor (343 → daha fazla)
- `old-fallback-from-new` SIFIR
- pid sabit, ↺=0, mem stabil

**👁️ AG backend (log + monitor):**
- Sessiz, `[Wedge] threw` yok
- 0 satır error log

**Kanıt üçgeni hizalı → Slice 2d.2 KAPALI ✓**

---

## 6. Lessons Learned (Brief v1.4'e Geçecek)

### Anti-pattern (4. tekrar): Refactor/regen iddiası, bağımlılık verification olmadan

Tek slice'ta dört Architect failure mode:
- Slice 2d.1: "filter integration zorunlu" iddiası
- Slice 2d.3 v1.0: "Sprotty group decorator" iddiası
- Slice 2d.2 v1.0: "Legacy filter cleanup" iddiası (59 test bağımlı)
- Slice 2d.2 v1.1: "sensor-systems snapshot regen" iddiası (3 test sitesi paylaşıyor)

**Pattern aynı:** Brief'te "X kaldırılır/değiştirilir" iddiası → kim çağırıyor, kaç test bağımlı **verification yapılmadan**.

**Önlem (canonical):** Brief yazımında her "X dokunulacak/kaldırılacak" iddiası için **`grep -r "X" .` veya equivalent ile çağrı sitesi haritası** yapılmalı. AG'nin Adım 0 keşfi bu haritayı zorunlu kılar.

### Anti-pattern: IR diff'ten görsel sonuç çıkarma

Brief v1.0'da AG'nin POC IR diff'inden DP2 problemi çıkarttık (`pseudo-initial__on` silinmesi = "On'un initial sub-state'i kayıp"). **Görsel kontrol bunu çürüttü** — mevcut renderer o node'u zaten çizmiyordu. **IR seviyesinde tutarlı görünen değişiklik görsel seviyede no-op olabilir.**

**Önlem (canonical):** Subjektif görsel kararlar **gerçek render üzerinde** yapılır, IR'dan extrapolation değil. Pre-impl visual preview pattern bunun çözümü.

### Pre-impl Visual Preview Pattern (CANONICAL)

Slice 2d.2'de doğdu, kanıtlandı:
1. AG geçici patch yazar (clearly-marked, push edilmez)
2. AG lokal stack çalıştırır (Docker DB + pnpm dev)
3. AG WS smoke ile lokal stack'in gerçekten patch'i servis ettiğini ampirik kanıtlar
4. Platform Owner lokal POST vs prod PRE side-by-side görsel inceleme yapar
5. Kabul → impl başlar; Reddet → vazgeç (sıfır rollback maliyeti)

Brief v1.4'e canonical pattern. Görsel davranış değişikliği riski olan tüm gelecek slice'larda kullanılacak.

### Yeni Operating Model Nüansı

**Tarayıcı Claude görsel otorite ölçülebilir kriterler için.** Subjektif semantik kararlar (örn. "X SysML spec'ine uygun mu") Platform Owner'a devredilir. Bu nüans, yeni operating model'in Slice 2d.2'de ilk kez test edildiğinde keşfedildi.

**Tarayıcı'nın bonus disipline'i: Programatik DOM teyit.** "Görsel olarak görmedim" değil, DOM seviyesinde element sayısı saymak. Yanlış pozitif elemine için parent ID'leri kontrol etmek. Bu, görsel sezgiden çok daha güvenilir kanıt.

### Pre-deploy tsc Verification (CANONICAL)

Pre-commit hook esbuild kullanıyor, type checking yapmıyor. AG **deploy öncesi** `pnpm build` ile tsc çalıştırmalı, production build'inin geçeceğini ön-doğrulamalı. Brief v1.3 §3.1 canonical'ına eklenecek.

### Production HEAD Sürpriz Disipline (CANONICAL)

Production HEAD beklenmedik ise:
1. Ancestor check (mevcut HEAD pull edilecek HEAD'in atası mı?)
2. Fast-forward kontrolü
3. Runtime impact analizi (doc-only mi, code mi?)
4. Eğer fast-forward + runtime-safe → devam et
5. Aksi takdirde DUR + Architect koordinasyonu

### Üçlü Orchestration Yeni Doruk

Slice 2d.2'de **4 Architect failure mode tek slice'ta yakalandı**, hepsi AG ampirik testle + Platform Owner görsel ön-kabul ile düzeltildi. Three-Claude orchestration olgunluğunun zirvesi.

Süreç:
- Architect hipotez yazar
- AG ampirik test eder, sürpriz yakalarsa **DUR + raporlar**
- Platform Owner subjektif kararlar verir
- Tarayıcı Claude objektif görsel + DOM teyit yapar
- Karar ortak

Slice 2d.1: 16+ checkpoint → Slice 2d.3: 3 → Slice 2d.2: ~5 (DP1/DP2/DP3 + snapshot mimarisi + 3 impl-deploy-dogfood) ama **görünür değer çok daha yüksek** — 4 Architect hatası önlendi, mimari iyileşme + görsel nötr ideal sonuç.

---

## 7. Stats (Final)

| Metrik | Slice 2d.2 |
|--------|-----------|
| Atomic commits | 3 (filter integration + tests + ADR D-FILTER-01) |
| Test sayısı | 1138 → 1142 (+4 yeni, sıfır regression) |
| Snapshot dosya sayısı | 2 → 4 (raw byte-identical + filtered eklendi) |
| Mevcut frozen snapshot | Raw byte-identical (transformer golden), multi-root byte-identical |
| Production deploy | 1 (yeni FF gerekmedi) |
| Kullanıcı etkisi | 0 negatif, mimari iyileşme +1 (View-First prensibi output seviyesinde tamamlandı) |
| Rollback | 0 |
| Architect failure mode yakalama | **4** (filter cleanup + Sprotty + snapshot regen + IR diff'ten görsel çıkarma) |
| Yeni canonical pattern | **4** (pre-impl visual preview + pre-deploy tsc + production HEAD sürprizi + DOM programatik teyit) |
| Karar noktası | ~5 (DP1/DP2/DP3 + snapshot karar + Karar 1/2/3) |
| Toplam süre | ~4 saat aktif iş (yarım gün hedefi ✓) |
| Pattern olgunluk | Three-Claude orchestration doruk |

---

## 8. Açık Konular (Slice 2d.2 Sonrası)

**Yapılacak (öncelik sırası Architect kararı, sonraki):**

1. **Brief v1.4** — Lessons learned canonical'e geçir. Slice 2d.1 + 2d.3 + 2d.2'den biriken tüm pattern'ler ve anti-pattern'ler. ~45 dk doc work.
2. **Faz 1 Final Report** — Bütünsel bakış: Slice 1 → 1 prep B → 2a → 2b → 2c → 2d → 2d.1 → 2d.3 → 2d.2 → kapanış. Faz 2 hazırlığı.

**Backlog'da bekleyen (önceki):**
- Bug-RENDER-01: Frontend state cleanup on model switch
- Slice 2e (Faz 1.1): WS auth + HierarchicalFlagProvider
- Security B1/B2/B3: Post-Faz 1
- Bug-PRISMA-01: prisma seed-examples gitignore
- Bug-RENDER-03 (eğer talep gelirse): Container'lar için region/dashed stili
- **Yeni candidate:** Sub-state pseudo-initial daire çizimi (yeni renderer'da implement edilmemiş — `pseudo-initial__on`, `pseudo-initial__top` görsel desteği eksik). Slice 2d.2 dogfood'unda Tarayıcı tarafından gözlemlendi.

---

## 9. Sonuç

Slice 2d.2, View-First prensibini output seviyesinde tamamladı. `pipeline.ts:95` öncesi tek satırlık `applyViewFilter` çağrısıyla pipeline'ın yeni renderer path'i filtered model alıyor, legacy path'ı (`bdd-transformer.ts:616`) dokunulmadan kalıyor (59 test bağımlılığı). Asimetri output seviyesinde çözüldü, call-site seviyesinde Faz 2'ye teknik borç olarak kaldı.

Görsel sonuç: **sıfır değişiklik (no-op flip)**. Filter `pseudo-initial__on`'u IR'dan siliyor ama mevcut yeni renderer onu zaten çizmiyordu → kullanıcı için görsel fark yok, mimari iyileşme net.

Three-Claude orchestration tarihindeki en yoğun "Architect failure mode yakalama" slice'ı: 4 hata, 4 AG ampirik test/keşif/öneri ile düzeltildi. Pre-impl visual preview pattern + DOM programatik teyit + production HEAD sürprizi disipline'i + pre-deploy tsc verification = yeni canonical pattern'ler.

**Faz 1 Slice 2d.2 KAPALI.** State-machine refactor zinciri (Slice 2d.1 + 2d.3 + 2d.2) tam tamamlandı:
- Multi-root crash çözüldü (2d.1)
- Container labels eklendi (2d.3)
- View-filter integration yapıldı, View-First output seviyesinde tamam (2d.2)

Faz 1 Final Report'a ve Faz 2'ye hazır.
