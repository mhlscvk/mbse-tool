# Phase 2 Slice 6c — Adım 0 Keşif Raporu (Interface def/usage spurious edges)

**Slice:** Phase 2 Slice 6c — Bug-IV-DEF-USAGE-01 kök neden
**Yanıtlayan:** AG (Claude Code)
**Tarih:** 2026-05-28
**Brief:** `phase2_slice6c_discovery_brief.md`
**Repo HEAD:** `2a6fd8a` (Slice 6b kapanış)
**Yöntem:** Headless parse + parser kod analizi. Browser/runtime gerek yok — kanıt ham parser çıktısında.

> **🔑 TL;DR:** Spurious edge'ler **PARSER**'da üretiliyor (renderer/filter değil). İki **birleşik bug**: (A) `interface def { end <name> : <Type>; }` deklarasyonları **sıfır node** üretiyor — parser sessizce atıyor; (B) `resolveType(name)` flat **global** resolver, def-local scope yok (`sysml-text-parser.ts:514`). Sonuç: `interface connect usbC.a1 to converter.a1` içindeki `usbC` referansı, def-local end yokken kapsamda kalan tek `usbC`'ye — yani system-level `usage__device_usbC`'ye — bağlanıyor. **14 spurious edge** (10× `device_usbC → converter` + 4× `converter → power_adapter_usbA`) zaten **parsed model'de** mevcut. Fix katmanı: **paylaşılan parser** → tek dokunuşla hem IV hem GV hem AFV otomatik düzelir (Q4 ✓). ⚠️ **Mevcut altın fixture'lar kırılacak** (po-interfaces SModel çıktısı değişecek, doğru-yönde) — Aşama 1 impl'i golden re-gen gerektirir.

---

## §1 — Soruların Cevapları

### Q1 — Yanlış edge'ler nerede üretiliyor? (kök neden + minimal repro)

**Parser**, transformer/filter/renderer değil. Headless probe (po-interfaces, HEAD `2a6fd8a`):

```
=== Tüm node'lar (interface def end usbC/usbA ARANIYOR) ===
… usage__TypeA_to_TypeC_converter  PartUsage     converter
… usage__device_usbC               PortUsage     usbC     qn=USB_C
… usage__power_adapter_usbA        PortUsage     usbA     qn=USB_A
… (def-local end usbC/usbA: HİÇ YOK)

=== Spurious connections (parser'da zaten mevcut) ===
[association] name="usbC.a1 → converter.a1"   usage__device_usbC      ->  usage__TypeA_to_TypeC_converter
[association] name="usbC.a12 → converter.a12" usage__device_usbC      ->  usage__TypeA_to_TypeC_converter
… (×10 toplam: a1, a12, b1, b12, a4, b4, a9, b9, a6, a7)
[association] name="converter.pin4 → usbA.pin4" usage__TypeA_to_TypeC_converter  ->  usage__power_adapter_usbA
… (×4 toplam: pin4, pin1, pin3, pin2)
```

**Bug-A (Interface def end deklarasyonları YOK sayılıyor):** Model şu satırlara sahip:
```
interface def TypeA_to_TypeC {
    …
    end usbA : USB_A;
    end usbC : USB_C;
    …
}
```
Beklenen: `usage__TypeA_to_TypeC_usbA`, `usage__TypeA_to_TypeC_usbC` node'ları (def'in kendi end port'ları). Gerçek: hiçbiri yok. Parser bu satırları sessizce atıyor. `grep -n "\\bend\\s" sysml-text-parser.ts` sadece block-end indeks değişkenlerini bulur — **`end <name>:<Type>` SysML deklarasyonu için pattern/handler yok.**

**Bug-B (Flat global resolver, def-local scope yok):** `sysml-text-parser.ts:514` `function resolveType(name: string): SysMLNode | undefined` — global node listesinden ad-eşleşmesi yapıyor. `interface connect usbC.a1 …` parse edilirken `usbC`'yi çözümlerken **def-local context** dikkate alınmıyor. Bug-A ile birleşince: def-local `usbC` end node'u yok → resolver `usage__device_usbC` (system-level) buluyor → edge kaynak yanlış bağlanıyor.

**Dotted-path collapse (Slice 6b Adım 0' bulgusu) — sekonder ama ilgili:** `usbC.a1` parser'da `usbC`'ye collapse oluyor (sub-port leaf değil, parent'a bağlanma). Bu Slice 6b'de IV K1 mekanizmasını besledi. Slice 6c'de aynı collapse her edge'i parent-pair'a düşürüyor; ama **asıl bug** Bug-A+B (scope/yokluk). Collapse düzeltilse bile, end yokluğu spurious edge'leri sürdürürdü (sub-port `usbC.a1` çözümlenirken `usbC` yine system'e gider).

> ✅ **Q1 net:** Spurious edge'ler **parser çıktısında zaten mevcut** — transformer/filter/renderer onları yalnız taşıyor. Kök neden parser-level iki coupled bug: end-deklarasyon handler eksik + global resolver scope-blind.

### Q2 — K3.2 ile çelişki var mı? (def gövde gösterimi)

**Çelişki YOK.** K3.2 (Slice 6a kararı) `ref flow` / `ref binding` gibi **annotation-style body item**'ları IV'de gizler. Interface def'in **structural parts** (`part converter` + içindeki port'lar + içerideki `interface connect`'ler) **gerçek yapısal içerik**, K3.2 kapsamı dışı. Mevcut render def container'ını + converter'ı + içerideki 8 valid edge'i (a1↔pin4 vs.) doğru gösteriyor. **Bug görsel yapı değil, kodda-olmayan cross-context edge'ler.** K3.2 mevcut haliyle korunur, dokunmaya gerek yok.

### Q3 — Doğru gösterim — Aşama 2 seçenekleri (Platform Owner kararı)

**Aşama 1 (parser fix) sonrası TÜM seçenekler aşağıdaki HİJYENİK zemine kavuşur:** spurious edge yok, def-local end usbC/usbA gerçek node, def'in kendi `interface connect`'leri doğru bağlanmış.

| Seç. | Tanım | Etki | Maliyet |
|---|---|---|---|
| **(i)** | IV'de interface def container'ını **hiç gösterme**; sadece system part + usbA↔usbC + tip label | MagicGrid Referans 2 ile bire bir; IV en sade | Renderer-level filtre (IV-specific) |
| **(ii)** | Def'i **kendi visual section**'ında göster (converter + def-local ends + iç edge'ler), system kısmından **görsel olarak ayır** | MagicGrid 2-view aynı render'da | Layout/grouping geliştirmesi (orta-büyük) |
| **(iii)** | Aşama 1 fix sonrası **mevcut akış**: def + system aynı IV'de ama spurious bridge'ler yok, def-local ends doğru gösteriliyor | Minimal değişiklik, hijyenik | Sıfır ek iş (Aşama 1 zaten yapar) |

**Önerim (AG): (iii) Aşama 1'in doğal çıktısı → Aşama 2 sonra karar.** Sebep:
- Aşama 1'in parser fix'i (iii)'ü **bedavaya** üretir — ekstra iş yok.
- Platform Owner Aşama 1 sonrası canlıyı görür, *o noktada* (i) veya (ii)'ye geçmek isterse karar verir.
- (i)/(ii) IV-specific renderer dokunuşu = ek scope, K1/K2.2 fix disiplinine paralel ama Aşama 1'den **bağımsız**.

Yani **Aşama 1 = parser fix = (iii) doğal sonuç**. Aşama 2 = Platform Owner görsel inceleme sonrası karar.

### Q4 — Fix katmanı (cross-view etki)

**PARSER (paylaşılan).** Tek dokunuş → IV + GV + AFV + STV (tüm görüş) **otomatik** düzelir. Hem yeni IV renderer (Slice 6a) hem legacy `bdd-transformer.ts` (GV ve diğerleri) **aynı parsed model**'i okur. Parser düzeltilince her görüş için doğru `device_usbC`'yi `usage__system_device.usage__device_usbC`'ye, def-local `usbC`'yi `def-local end`'e bağlar.

> Bu **#22.4 cross-view safety**'nin tersine ironik bir durum: Slice 6b'de identity-by-construction ile cross-view güvende kalmıştık (renderer fix); burada fix paylaşılan parser'da olduğu için **cross-view ETKİSİ KAÇINILMAZ ve İSTENİR** (hepsi düzelir). Bug zaten cross-view (Platform Owner her ikisini de pasladı).

---

## §2 — Aşama 1 Ön Fix Yaklaşımı

**Hedef:** Spurious edge'ler **parsed model'den** kalksın. Renderer/filter dokunmasın.

**Adımlar (impl brief'i tarafından netleştirilir, ama yön net):**
1. **Parser: `end <name> [: <~?Type>]` pattern + handler.** Interface def gövdesi parse edilirken (def'in `{...}` range'i içinde):
   - Pattern: `^\s*end\s+(\w+)\s*(?::\s*(~)?([\w:]+))?\s*[;{]` (named end; opsiyonel conjugate `~`).
   - Her match için yeni `SysMLNode` oluştur: `kind: 'PortUsage'`, `id: usage__<DefName>_<endName>`, `name: <endName>`, `qualifiedName: ['~']?<Type>`, parent = interface def. Composition edge (def → endNode) ekle. Type için `typereference` edge (endNode → typeDef) ekle (mevcut PortUsage handler emsali, `sysml-text-parser.ts:282-310` civarı).
2. **Resolver: def-local scope.** `interface connect <a> to <b>` parse edilirken **çağrı sitesinin** def context'inde önce **def-local çocukları** (yeni end node'ları + part'lar) ara; sonra global'e düş. Minimal değişiklik: mevcut `resolveType` üstüne `resolveInScope(name, contextDefId)` wrapper'ı; def context'inden gelen çağrılar bu wrapper'ı kullansın.
3. **(Opsiyonel scope dışı, ayrı slice'a bırakılabilir):** Dotted-path leaf resolution (`usbC.a1` → end_usbC'nin sub-port'una bağla, parent'a değil). Slice 6b'nin K1 mekanizmasını da çözer ama oradaki edge fan zaten çalışıyor. Aşama 1'in MUST'ı değil.

**Sonuç (Aşama 1 sonrası beklenen po-interfaces parsed model):**
- ✅ Yeni node'lar: `usage__TypeA_to_TypeC_usbA`, `usage__TypeA_to_TypeC_usbC` (def'in çocukları).
- ✅ `interface connect usbC.a1 to converter.a1` → kaynak = `usage__TypeA_to_TypeC_usbC` (def-local), hedef = `usage__converter_a1` (veya dotted-collapse hâlâ varsa `usage__TypeA_to_TypeC_converter`). Her durumda kaynak **device.usbC değil, def-local usbC** → spurious bridge yok.
- ✅ Spurious 14 edge **kaybolur**; def-internal 8 edge (zaten doğru a1↔pin4 vs.) **kalır**.
- ✅ System-level `interface : TypeA_to_TypeC connect power_adapter.usbA to device.usbC` zaten doğruydu (`usage__system_power_adapter → usage__system_device`), değişmez.

---

## §3 — ⚠️ Kritik Uyarı: Golden Fixture'lar Kırılacak

**Bug-IV-DEF-USAGE-01 fix'i parsed model'i değiştirir** (kasıtlı, doğru-yönde). Etkilenecek mevcut altın fixture'lar:
- `tests/fixtures/interconnection/po-interfaces/expected-smodel.json` — 14 spurious edge kalkar, 2 yeni end node eklenir → SModel'in `children` listesi farklı (sayı ve içerik).
- `tests/fixtures/interconnection/po-flows/expected-smodel.json` — `flows.sysml` `interface def 'Fuel Interface' { end : Outlet; end : ~Outlet; … }` ANONİM end'ler (isim yok!). Parser pattern'ı isim gerektirecek mi yoksa anonim de destekleyecek mi? 🔍 (aşağıda).
- `tests/fixtures/interconnection/po-conjuge/expected-smodel.json` — `conjuge` modeli `interface` keyword'ü kullanıyor ama def değil usage; etkilenmez (hızlı sanity).
- Diğer 4 self-author fixture (`basic/multi-port/conjugated/inheritance`) — `interface def` ile end'i olan yok → etkilenmez.

Suite etkisi:
- IV differential oracle (`new === transformToBDD(model,'interconnection')`) **her iki tarafta da değişir** (parser fix shared) → byte-identical eşitlik **korunur**, ama altın **sayısal eski sayılarla uyumsuz** (golden re-gen gerek).
- View-filters / bdd-transformer testleri **etkilenebilir** — interface def içeren modeller varsa. Quick check (Adım 0 sınırı): kapsamlı suite çalıştırması Aşama 1 impl'inin parçası.

**Aşama 1 impl'inde:** parser fix + golden re-gen + Platform Owner manuel sanity (yeni altın görsel olarak doğru mu?). Bu **bilinçli baseline değişikliği**, regresyon değil. Impl brief'i bunu açıkça çağırmalı.

---

## §4 — Honest Gaps (🔍)

1. **🔍 Anonim end'ler:** `flows.sysml`'in `interface def 'Fuel Interface' { end : Outlet; end : ~Outlet; … }` ifadeleri isimsiz end. Parser pattern'ı `end\s+(\w+)\s*:` named gerektiriyor mu, yoksa anonim de destekleyecek (`end\s*:\s*…`)? SysML v2 spec'i izin verir; pattern her ikisini de yakalamalı. **Impl detayı.**
2. **🔍 Dotted-path leaf resolution kapsam dışı kararı:** `usbC.a1` collapse'i Aşama 1'de DOKUNULMUYOR (Slice 6b K1 fix offset-fan ile zaten kompanse ediyor). Eğer Aşama 1 fix'i sonrası IV görsel olarak `usbC.a1`'in def-local end'in *altında* küçük sub-port olarak görünmesi istenirse — ayrı slice (Slice 6d?) iş. Aşama 1'in iddiası değil.
3. **🔍 Parser kod yapısı keşfi:** Hangi fonksiyon `def-local context`'i biliyor? Mevcut `defPositions`/`usagePositions` (sysml-text-parser.ts:782, 977) range yapıları var ama scoped resolver kullanmıyor. Impl brief'i call-site haritası gerektirir (§8.2.1) — Aşama 1 impl'inden önce kısa Adım 0' kod tarama turu olabilir.
4. **🔍 Conjugate end (`end consumer : ~FuelPort`) handling:** Slice 6b'de conjugated port usage için `~` prefix preserve ediliyor. End deklarasyonu için aynı pattern uygulanmalı; pattern'a `(~)?` opsiyonel ekle.

---

## §5 — Architect Kararı Bekleyen Noktalar (Slice 6c impl brief'ine girecek)

1. **Aşama 1 scope onayı:** Parser fix (end nodes + scoped resolver) — onayla.
2. **Anonim end pattern:** Named-only mi, anonim de destek mi? (Önerim: anonim de destek — `flows.sysml` zaten kullanıyor.)
3. **Golden re-gen iş akışı:** Aşama 1 impl'inde re-generate edilip Platform Owner manual sanity mi, yoksa golden'ı tamamen kaldırıp sadece differential-oracle'a mı yaslan? (Önerim: re-gen + Platform Owner görsel sanity — Aşama 2 baseline'ı olur.)
4. **Aşama 2 ertelendi mi?** Q3 önerim (iii) Aşama 1'in doğal sonucu; (i)/(ii) Aşama 2 — Platform Owner Aşama 1 sonrası karar versin diye **ertelemeyi öneriyorum**.

---

**Adım 0 tamam.** Kök neden **iki coupled parser bug** (end-handler yok + scope-blind resolver), kanıt zinciri ham parsed model'de. Fix katmanı **paylaşılan parser** → cross-view otomatik (kaçınılmaz ve istenir). Aşama 1 ön yaklaşımı net (end node oluştur + def-local scope). **Kritik uyarı:** mevcut altın fixture'lar kırılacak — Aşama 1 impl'i golden re-gen + Platform Owner manuel sanity gerektirir. Impl brief'ini bekliyorum.

— AG (Claude Code), Slice 6c Adım 0
