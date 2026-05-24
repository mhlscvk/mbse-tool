# Faz 1 Slice 2d.1 — Close-Out Narrative (Brief v1.2)

**Versiyon:** v1.2 (Slice 2d.1 KAPALI sonrası, narrative + lessons learned)
**Tarih:** 2026-05-23 / 2026-05-24
**Author:** Architect Claude
**Slice durumu:** ✅ KAPALI. Production'da yeni state-machine renderer globally enabled, config-driven, permanent.
**Önceki brief:** `renderer_refactor_phase1_slice2d1_brief.md` (v1.0 + v1.1, implementasyon sırasında yazılan)
**Çapraz referans:** `phase1_slice2d1_handover.md` (AG handover), `phase1_slice2d_status.md` (önceki status), brief v1.3 (canonical ops)

---

## 1. Amaç

Bu doc **Slice 2d.1'in tarihsel narrative'i** — ne yaptık, neden bir yolda gittik, hangi sürprizler oldu, ne öğrendik. Implementasyon sırasında yazılan brief v1.0/v1.1 hipotezler içeriyordu; v1.2 ampirik olarak doğrulanmış gerçek hikayeyi anlatır.

Tarihsel kayıt amaçlı, **gelecek slice'larda direkt uygulanacak prosedürler v1.3'te** (canonical ops notes).

---

## 2. Context — Slice 2d'den Slice 2d.1'e

### Slice 2d (önceki)

State-machine yeni renderer pipeline'ı (transformer + IR + SModel) Faz 1 boyunca yazıldı, 5 commit production'a deploy edildi (env var false, davranış nötr). Self-dogfood için manuel flag açıldı, **gerçek SensorSystem.sysml modelinde transformer crash etti**:

```
TypeError: Cannot set properties of undefined (setting 'compartments')
    at transformAstToStateMachineIR (transformer.ts:206:12)
```

Strangler-fig wedge legacy'ye düştü (`rendering/pipeline.ts:107`), kullanıcı zarar görmedi, counter `old-fallback-from-new:2` ile bug'ı yakaladı. Flag kapatıldı, production stable, hotfix planlandı.

### Slice 2d.1 (bu)

**Hotfix amacı:** Transformer'ı SysML v2 idiomatic pattern'ini (`part { state X { ... } }`, multi-root) destekleyecek şekilde refactor et, anonim ama gerçekçi fixture ekle, defense-in-depth guard'lar koy, permanent global flip yap.

---

## 3. Root Cause (Kanıtlanmış)

`transformer.ts:162-166`:
```typescript
const stateDef = model.nodes.find(isStateDef);  // isStateDef = kind==='StateDefinition'
if (stateDef) { emitContainer(stateDef.id); }    // StateDefinition=0 → çağrılmıyor
```

Gerçek SysML v2 modelleri state machine'i **`part { state X { ... } }` pattern'i** ile kullanıyor (real SensorSystem: StateDefinition=0, StateUsage=12), izole `state def` değil. Üç ayrı kırık nokta hepsi aynı varsayıma bağlı:

- `:163` seed: sadece StateDefinition arıyor → bulamıyor → `emitContainer` çağrılmıyor → `irNodes` boş
- `:181` compartment loop `find()!`: boş `irNodes`'ta `undefined` döndürür → `:206` `compartments=` crash
- `:308` containment pass `find()!`: aynı varsayım, aynı bug

**Kavram hatası kaynağı:** Slice 2d fixture'ı (`sensor-systems/model.sysml`) izole `state def SensorSystemStates` kullanıyordu — gerçek dünyaya uymayan sentetik örnek. Transformer fixture'a göre yazıldı, gerçek modelde patladı.

---

## 4. Brief Evrim Hikayesi

Slice 2d.1 brief'i üç önemli iterasyondan geçti. Bu evrim **bu slice'ın en değerli süreç kazanımı** — gelecek brief'lerde tekrarlanabilir pattern.

### Brief v1.0 (ilk taslak)

Multi-root design için **3 seçenek** sundum (A: tek IR + roots listesi, B: IR[] döndürme, C: legacy parite + warning), AG'ye design proposal yapma yetkisi verdim. View-filter integration'ı zorunlu varsaydım.

**Hata:** AG'nin discovery raporundan önce design seçenekleri yazdım. Bu, kodu görmeden tasarım kararı vermek anlamına geliyordu — riskli.

### Brief v1.1 (AG discovery sonrası)

AG Adım 0'da discovery raporu verdi. **Kritik bulgu:** `renderer.ts:284-292` zaten `containedSet` ile multi-root tüketim yapıyor. IR şemasına `roots` eklemeye gerek yok, renderer dokunulmuyor — multi-root sorunu **tamamen transformer-side**.

Bu bulgu üzerine v1.0'daki 3 seçeneği sildim, v1.1'de tek tasarım yazdım: transformer'ın seed'ini "tüm top-level state node'ları" yap, view-filter ile entegrasyon kur (Package altına reparent edilmiş state'leri root olarak tanı).

**Hata (henüz fark edilmedi):** "View-filter integration zorunlu" iddiasını brief'e yazdım. Gerekçe: discovery raporundaki "filter çıktısı doğal olarak Package'ın doğrudan child'ları" gözlemi. Ama bu gözlemden "zorunlu" sonucuna atladım — **ampirik test yapmadım**.

### Brief v1.1 + ampirik düzeltme (AG Adım 3 sürprizi)

AG Adım 3'te implementasyona başlarken çift-filter riskini araştırdı, `applyViewFilter`'ın sensor-systems fixture'ına etkisini ampirik olarak ölçtü:

```
sensor-systems  RAW      : nodes=8 edges=11 pseudos=[pseudo-initial__on, ...]
sensor-systems  FILTERED : nodes=7 edges=10 pseudos=[...]
                pseudo-initial__on KAYBOLDU
                StartNodes: raw=2 → filtered=1
```

**Bulgu 1:** Wedge ham model veriyor, legacy `bdd-transformer.ts:616` filter'ı içeride çağırıyor. Wedge'e filter eklersem legacy double-filter olur → asimetri.

**Bulgu 2:** Filter'ın "entry action varsa start→entry remap" mantığı sensor-systems'in `pseudo-initial__on`'unu siliyor. Mevcut frozen snapshot raw'dan donduruldu → filter integration testleri kırar.

**Bulgu 3 (kritik):** Multi-seed fix'i **filter gerektirmiyor**. Transformer non-state node'ları zaten ignore ediyor. Raw model üzerinde multi-seed çalışıyor — `ModeAlpha/ModeBeta`'nın composition parent'ı `unit` (PartUsage, state değil) → ikisi de "top-level container" olarak doğru tespit ediliyor.

AG DURDU, raporladı, üç seçenek sundu:
- **A:** Raw multi-seed (minimal)
- **B:** Filter integration (brief §4 niyeti, snapshot regen gerekli)
- **C:** A şimdi + B ayrı slice

**Architect kararı: C.** Gerekçe:
1. Bu slice "hotfix" — crash çöz, kullanıcı görselini bozma
2. Filter integration sensor-systems'in `pseudo-initial__on`'unu siler → legacy davranış değişikliği → ürün kararı, hotfix scope dışı
3. Brief v1.1 §4'ün "filter zorunlu" iddiası ampirik olarak yanlıştı
4. "Qname walk: ilk non-state ata'da dur" elegant çözüm, frozen snapshot tehlikesini sıfırlıyor

**Lesson:** Brief'te bir tasarım iddiası ne kadar "açık" görünse de, ampirik olarak doğrulanana kadar "hipotez" işareti taşımalı. AG'nin ampirik testi olmasaydı yanlış yöne giderdik.

---

## 5. Implementation Hikayesi (Atomic Commit'ler)

| Commit | Açıklama | Test sayısı | Behavior change |
|--------|----------|-------------|-----------------|
| `b35d9ad` | Defense guards (`find()!` → guard'lı `find()`) | 1003 → 1003 | YOK (sadece guard) |
| `c7d3185` | Multi-seed root-finding (raw model) + qname walk fix + `isStateLike` predicate | 1003 → 1003 | Multi-root için davranış değişikliği (yeni özellik), mevcut testler yeşil |
| `cdd05ef` | Anonim multi-root fixture + +9 test | 1003 → 1012 | Sadece test, kod yok |
| `2217c0e` | Global flip (ecosystem.config.cjs) | 1012 → 1012 | Sadece config, kod yok |
| `a523e90` | Close-out handover dosyası | 1012 → 1012 | Sadece doc |

**Test sayısı netleştirme:** Root `pnpm test` = api 340 + diagram 663 = **1003**. Pre-commit hook = api + diagram + web-client (128) = **1131**. Brief'lerde "1131" denirken pre-commit hook kastediliyor (full coverage).

**Atomic disipline:** Her commit kendi başına yeşil. Bisect yapılabilir. History aydınlık.

**Anonim fixture (`multi-root-part-states/model.sysml`):**
- 35 satır, anonim isimler (SystemAlpha, UnitContext, ModeAlpha, ModeBeta, Idle, Active, Running, Paused, Open, Closed)
- Multi-root pattern (iki bağımsız state machine aynı part içinde)
- Nested + composite (ModeAlpha→Active→{Running, Paused})
- Entry/do/exit action'lar (slash form: `entry action begin` → "begin" compartment)
- 6 transition, 0 parse diagnostic
- README.md eklendi (sibling sensor-systems pattern)
- Architect review onayıyla eklendi (§5 zorunlu şartlar tamamı karşılandı)

**Helper kararı (`findTopLevelStates`):** **Inline** kaldı, `utils.ts`'e çıkarılmadı. Gerekçe:
- Seed mantığı lokal `parentByChild` map'ine bağlı — dışarı çıkarsa parametre olarak taşımak gerekir
- Renderer'ın `containedSet` mantığı IR `containedNodes` üzerinde çalışıyor; transformer'ın seed mantığı AST composition parent üzerinde — **farklı veri, farklı hesap**
- Ortak helper zorlama abstraction olurdu

---

## 6. Production Deploy + Dogfood

### Aşama 1: Push (~5 dk)

`74247fa → cdd05ef` fast-forward, remote HEAD teyit, deploy.sh kullanılmadı, untracked dosyalar dahil edilmedi.

### Aşama 2: Production deploy (manuel flag) (~25 dk)

Brief §9.2 4 checkpoint disipliniyle:
- **Pull:** `9b43279 → cdd05ef`, conflict yok
- **Build:** Per-package 4/4 EXIT=0, sıfır TS hatası (api-server bonus temiz)
- **PM2 reset + manuel flag:** `pm2 delete + FF=true pm2 start --update-env`, `/proc/<pid>/environ` ground-truth ✓
- **Smoke:** HTTP 200/200 + pm2 online + log forensic (stale `[Wedge] threw` izleri elendi)

**Stale-log forensic kanıt:** AG smoke sırasında `[Wedge] threw` görünce panik yapmadı, cross-reference yaptı (pm_uptime + log mtime + restart history). Hatalar pre-fix dogfood'un izleriydi. Reflexif rollback yapsaydık doğru fix'i geri sarmış olacaktık.

### Aşama 3-4: Self-dogfood (~25 dk)

**Üçlü kanal:**

- 🖥️ **Tarayıcı Claude (görsel):** Multi-root render (2 makine yan yana), nested hierarchy (Normal/Degraded On içinde), compartments (entry/do/exit action'lar), transition'lar, pseudo-state'ler, 0 console error. Screenshot.
- 👁️ **AG (backend log):** Snapshot polling (blocking `pm2 logs --raw` değil). Log sessiz, monitor `bt5pstsou` hiç tetiklenmedi.
- 👁️ **Counter (`/internal/renderer-stats`):** `state-machine.new:6, fallback:0`. Belirleyici kanıt.

**Tarayıcı Claude'un disiplini:**
- DevTools panel açılamadığında pes etmedi — WebSocket monkey-patch + DOM analizi + console + network kombinasyonu ile alternative yol buldu
- `rendererUsed` field'ını WS recv frame'inden okuyamadığında **"yakalanamadı"** dedi, hipotez kurmadı (geçen self-dogfood'da "frontend client-side parse ediyor olabilir" yanlış hipotezi öğrenildi)
- Brief beklentisi vs gerçek model uyumsuzluğunu yakaladı (Error state / HealthNotOK eski fixture'da vardı, gerçek modelde yok — Architect hatası, Tarayıcı yutmadan raporladı)

**Kanıt üçgeni hizalı.** Pre-fix `{new:1, fallback:2}` → Post-fix `{new:6}, fallback YOK`. Tarayıcı'nın gördüğü görsel **legacy fallback değil**, yeni renderer'ın kendisi.

### Aşama 5: Permanent flip (F.1-F.8) (~15 dk)

`ecosystem.config.cjs` diagram.env'e `FF_STATE_MACHINE_NEW_RENDERER: 'true'` (+3 satır, açıklamayla — counter kanıtını referans yorum). Commit `2217c0e`, push, prod pull, PM2 restart **komut satırında FF YOK** (config'den env yüklemesi).

**Ground-truth (F.6) belirleyici teyit:**
```
diagram pid: 2488090
FF_STATE_MACHINE_NEW_RENDERER=true   ✓
NODE_ENV=production                  ✓
```

Cross-check: FF + NODE_ENV birlikte config'den geldi → env-loading'in tüm section'u doğru.

Post-flip baseline: HTTP 200/200, counter sıfırlandı (`{totalRenders:0}`, beklenen), pm2 online ↺=0, monitor sessiz → TaskStop.

---

## 7. Bug-RENDER-02 — UX Defekti Yakalama

Tarayıcı Claude screenshot'ında **multi-root container'larının (SensorSystemStates, DeliverSSStates) isim label'ları görünmüyor** — kullanıcı "hangi 'On' hangi sisteme ait" anlayamıyor.

**AG'nin teknik analizi:** Doğrudan Step 3a tasarımının doğal sonucu — top-level container state'leri "state def" rolü oynuyor, node olarak çizilmiyor. Pre-fix tek-root durumda gizliydi, multi-root görünür yaptı.

**Karar:** Backlog'a (Bug-RENDER-02). Hotfix scope dışı, scope creep yapılmadı. Slice 2d.3 candidate.

**Yorum:** Bu **iyi cinsten regression** — multi-root hotfix'i UX gap'ini görünür yaptı. Bug bir feature surface'i açtı.

---

## 8. Checkpoint Sayısı — Operasyonel Gözlem

**Slice 2d.1 toplam ~16 checkpoint:**
- Adım 1-3 (kod): 3
- Aşama 1-2 (deploy): 4
- Aşama 4 (dogfood): 2
- Aşama 5 (flip): **8 (F.1-F.8)**

**Gereksiz checkpoint sayısı:** ~10. Özellikle F.1-F.8 her komut için ayrı onay aldı — aslında 3 paket × 3 onay yeterliydi:
1. Flip'i başlat (F.1+F.2+F.3: edit + test + commit + push)
2. Production'da aktif et (F.4+F.5: pull + restart)
3. **F.6 ground-truth doğrulama** — gerçek belirleyici nokta + F.7-F.8 smoke + rapor

**Sebep:** Brief §13'te "her checkpoint'te DUR" yazmıştım — defensive overengineering. AG'nin **kendi disiplinli auto-DUR refleksleri** vardı zaten (sürpriz çıkınca otomatik dururdu), brief'e gereksiz "DUR" eklemek attention loss yarattı.

**Pattern (v1.3'te canonical):** Karar noktası tabanlı checkpoint, komut paketleri halinde, AG'ye "sürpriz olursa zaten dur" yetkisi.

---

## 9. Lessons Learned (Canonical — v1.3'e geçecek)

### 1. Brief tasarım iddiası ampirik test edilene kadar HİPOTEZ

v1.1 §4 "filter integration zorunlu" iddiası yanlıştı. AG ampirik testte yakaladı. **Architect kuralı:** Discovery raporundaki gözlem = veri, brief'te tasarım = karar. Discovery → tasarım atlanırken ampirik doğrulama gerekli. Brief'te "iddia mı, doğrulanmış mı" işaret edilmeli.

### 2. Stale-log forensic — reflexif rollback yasak

Rollback DUR koşulu görüldüğünde otomatik aksiyon YAPMA. Cross-reference zorunlu:
- `pm2 jlist | jq` ile process pm_uptime
- `stat -c %Y` ile log mtime
- `out.log` içindeki "Service running" startup banner sayısı (her restart bir tane ekler)
- Error log mtime current process start time'ından önce → STALE

### 3. Counter = ortak ground-truth dili

Three-Claude orchestration'da sayısal kanıt görsel kanıttan daha güçlü:
- Görsel "legacy fallback" da temiz görünebilir → yanılgı
- Counter `old-fallback-from-new` artarsa hotfix başarısız → kesin
- Tarayıcı (UI) + AG (backend) + Architect (karar) hepsi counter'a referans

### 4. PM2 env ground-truth

`/proc/<pid>/environ` canonical, `pm2 env` false-negative riski. Cross-check için FF + NODE_ENV birlikte doğrula (env-loading'in tüm section'u aldığı kanıtı).

### 5. Scope cleanliness — UX defekti hotfix sırasında değil

Bug-RENDER-02 (container labels) self-dogfood'da yakalandı. Hotfix'e dahil etmedik. Brief scope ihlali yapılmadan backlog'a alındı. Yorgunluk yönetimi + sürdürülebilir tempo disipline'in parçası.

### 6. Karar noktası tabanlı checkpoint (yeni)

Brief'te DUR sayısı karar noktası sayısına eşit olmalı, komut sayısına değil. Slice 2d.2+'da paket halinde checkpoint, AG'ye otomatik geçiş yetkisi. Detay v1.3'te.

### 7. Üçlü orchestration handover

Bu slice'ta Architect sohbet sıfırlandı (akşam → ertesi sabah → akşam tekrar), iki seviyeli handover kullandık:
- **AG handover** (`phase1_slice2d1_handover.md`): repo'da, AG otomatik okur
- **Architect handover** (`architect_context_handover_2026-05-24.md`): yeni Architect sohbetine ilk mesaj olarak yapıştırılır

Her ikisi de cross-verified (AG bunun "uygun" olduğunu doğruladı, ben de Architect handover'ı yazarken AG handover'ından kanıt çektim). Pattern olgunlaştı.

---

## 10. Stats (Final)

| Metrik | Değer |
|--------|-------|
| Atomic commits | 5 (defense + multi-seed + fixture/test + flip + handover) |
| Test sayısı | 1003 → 1012 (root) / 1122 → 1131 (pre-commit hook) — net +9 yeni |
| Mevcut frozen snapshot | Byte-identical (zero regression) |
| Production deploy | 2 (manuel flag dogfood + permanent flip) |
| Kullanıcı etkisi | 0 (strangler-fig wedge işini yaptı) |
| Rollback | 0 (stale-log forensic yanlış rollback'i önledi) |
| Sürpriz yakalama | 2 (filter integration ampirik test + UX defekti) |
| Yeni backlog | Bug-RENDER-02, Slice 2d.2 (filter integration) |
| Pattern olgunluk | 7 lessons learned (canonical v1.3'e geçecek) |
| Toplam süre | ~8 saat aktif iş (brief evrim + impl + deploy + dogfood + flip + handover) |
| Checkpoint sayısı | 16+ (gereksiz fazlalık ~10, v1.3'te azaltma planı) |

---

## 11. Açık Konular (Slice 2d.1 Sonrası)

**Yapılacak (öncelik sırası Architect kararı):**

1. **Brief v1.3** (canonical ops notes) — bu doc'un yanında yazıldı, lessons learned'ı prosedürlere döken referans
2. **Slice 2d.2 brief** (filter integration) — sensor-systems snapshot regen, görsel parite analizi, ADR-005 D-FILTER-01, Platform Owner onayı
3. **Slice 2d.3 brief** (Bug-RENDER-02, container labels) — 3 yaklaşım keşif (renderer-side group / wedge multi-diagram / frontend grouping), AG keşif + karar
4. **Faz 1 Final Report** — Slice 2d.2 sonrası, Faz 2 hazırlığı

**Backlog'da bekleyen (önceki):**
- Bug-RENDER-01: Frontend state cleanup on model switch
- Slice 2e (Faz 1.1): WS auth + HierarchicalFlagProvider, per-user dogfood
- Security B1/B2/B3

---

## 12. Sonuç

Slice 2d.1, Faz 0'da yapılan mimari yatırımın (strangler-fig + counter sistemi + IR layer + view registry) **kriz anında ne kadar değerli olduğunu kanıtladı**. Pre-fix multi-root crash:
- Strangler-fig wedge yakaladı → kullanıcı zarar görmedi
- Counter sistemi bug'ı tanılaması saatler değil dakikalar sürdü
- IR layer izolasyonu sayesinde fix sadece transformer-side, renderer dokunulmadı

Three-Claude orchestration ilk kez tam yoğun bir hotfix'te denendi:
- AG'nin ampirik test reflexi Architect hatasını yakaladı (filter integration ertelendi)
- Tarayıcı Claude'un disiplinli ham raporu (hipotez yok, kanıt var) görsel doğrulamayı kesinleştirdi
- Architect'in karar verme rolü (scope cleanliness, rollback önleme, karar noktası ayarlama) süreci yönetti

Brief evrim disiplini (v1.0 → v1.1 → ampirik düzeltme) **gelecek slice'larda tekrarlanabilir pattern**. Discovery → tasarım → ampirik doğrulama → implementasyon akışı oturdu.

**Faz 1 Slice 2d.1 KAPALI.** Yeni state-machine renderer globally enabled, production stable, sıfır regression, sıfır kullanıcı etkisi.
