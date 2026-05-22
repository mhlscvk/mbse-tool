# State Machine Render Conformance Audit
## SensorSystems Modeli Üzerinden Detaylı Hata Analizi

> **Note (2026-05-22):** Bu rapordaki "Kök sebep hipotezi" bölümleri Slice 2
> başlangıcında parser AST exploration'la doğrulandı (commit `74a521a`,
> Slice 1 prep B). Bazı hipotezler revize edildi — birkaç bug aslında
> parser-side bug'lar (transformer değil): qualified-name regex truncation
> (M4), nested state usage parent loss (M3), aggressive edge dedup (M6),
> do/done word boundary (M5). Bug-SM-01 zaten Slice 1 prep'te
> (commit `13c3c79`) parser fix ile çözüldü.
>
> **Lesson — audits should separate observation from diagnosis.**
> Observation kesin (render eksik, label yanlış); diagnosis hipotez
> (parser/transformer code analysis ile teyit gerekli). Bu rapor ilk
> yazıldığında tüm kök sebepleri transformer tarafında varsaymıştı;
> exploration testi bu varsayımı çürüttü. Faz 2'deki BDD audit'inde
> "Kök sebep hipotezi" bölümleri "hipotez, kod analizi sonrası
> doğrulanmalı" işaretiyle yazılacak.

## Kaynak Materyaller

- **Model:** `SensorSystems.sysml` — Systemodel platformunda yazılmış SysML v2 sensor sistemi modeli
- **Render:** `Deneme_SensorSystem_general_20260512-220623.png` — Systemodel'in mevcut transformer'ının ürettiği görsel çıktı
- **Referans:** UML 2.5 State Machine notation (olgun, kararlı temel) + SysML v2 1.0 Specification (2025-09 final) + OMG Pilot Implementation davranışı (PlantUML görselleştirme)

## Notation Hatırlatması

UML/SysML v2 state machine notation'un temel kuralları:

**State (durum):**
- Yuvarlatılmış dikdörtgen
- İçinde compartment'lar: ad, entry/do/exit actions, internal transitions, sub-states
- Stereotype `«state»` opsiyonel ama tipik gösterimde var

**Pseudo-state'ler:**
- **Initial:** Dolu siyah daire (●) — bir state machine'ın başlangıç noktası
- **Final:** Daire içinde dolu siyah daire (⊙) — terminasyon noktası
- Bu semboller "ad" taşımaz, sadece geometrik sembollerdir

**Transition (geçiş):**
- Kaynak state'ten hedef state'e ok
- Label format: **`<trigger>[<guard>] / <effect>`**
- SysML v2 ek olarak: **`via <port>`** modifier'ı (transition'ın hangi port üzerinden tetiklendiğini gösterir)
- Tam SysML v2 form: **`<trigger> via <port> [<guard>] / <effect>`**

**Compartment yapısı (bir state içinde):**
1. **Adı** (üstte, bold)
2. **Entry actions** (`entry / ...`)
3. **Do/internal actions** (`do / ...`)
4. **Exit actions** (`exit / ...`)
5. **Sub-states** (nested state machine — ayrı compartment olarak değil, **contained** olarak gösterilir, yani state içinde state)

---

## Bulgular

### BUG-SM-01 — Transition Label'larında Paket Adı Görünüyor (Kritik)

**Model (satır 33, 34, 55, 56):**
```
transition first Off accept ItemDefs::PowerOn via sensor2Platform then On;
transition first On accept ItemDefs::PowerOff via sensor2Platform then Off;
transition first Normal accept ItemDefs::BatteryPower via sensor2Platform then Degraded;
transition first Degraded accept ItemDefs::MainPower via sensor2Platform then Normal;
```

**Mevcut render:** Transition oklarının yanında "ItemDefs" yazıyor.

**Kural ihlali:**
- UML notation: Transition label trigger event ismini gösterir, **paket prefix'ini değil**
- Qualified name (`ItemDefs::PowerOn`) parse edilirken, görselleştirmede **son segment** (`PowerOn`) kullanılmalıdır
- Paket prefix yalnızca disambiguation gerektiren durumlarda eklenebilir, varsayılan değildir

**Beklenen davranış:**
- `Off → On` ok'unun label'ı: `PowerOn via sensor2Platform`
- `On → Off`: `PowerOff via sensor2Platform`
- `Normal → Degraded`: `BatteryPower via sensor2Platform`
- `Degraded → Normal`: `MainPower via sensor2Platform`

**Güven seviyesi:** Yüksek — bu temel UML notation, SysML v2'ye özgü bir nüans değil

**Kök sebep (doğrulandı):** Parser regex'i (`sysml-text-parser.ts` accept trigger group: `\w+`) `::` karakterini yakalamıyor, qualified name `ItemDefs::PowerOn` AST'e `ItemDefs` olarak truncate edilmiş giriyor. Transformer hipotezi yanlıştı; problem parser tarafında. **Çözüldü:** Slice 1 prep (commit `13c3c79`, KARAR-4 / FR-PH1-09), regex `[\w:]+`'a genişletildi, regression test eklendi.

---

### BUG-SM-02 — `via <port>` Clause Kayboluyor (Kritik)

**Model:** Yukarıdaki tüm transition'larda `via sensor2Platform` clause var

**Mevcut render:** `via sensor2Platform` hiçbir transition label'ında görünmüyor

**Kural ihlali:**
- SysML v2 1.0 spec, state transition'larının `via PortReference` clause'unu graphical notation'da göstereceğini şart koşar
- Bu clause transition'ın hangi port (interaction point) üzerinden geldiğini belirtir, semantik olarak önemlidir
- Pilot implementation'ın 2025-09 release notes'unda PR #689 ("Transition trigger visualization (PlantUML). Corrected the visualization of triggers on state transitions") — yani bu konu spec'e göre düzeltilmiş

**Beklenen davranış:**
- Transition label format: `<trigger> via <port>` veya alternatif olarak iki-satırlı:
  ```
  PowerOn
  via sensor2Platform
  ```
- `via` kelimesi italic veya stereotipsiz, ama mutlaka görünür olmalı

**Güven seviyesi:** Yüksek — spec açık, pilot impl davranışı doğrulanmış

---

### BUG-SM-03 — Gövdesiz State Declaration View'dan Kayboluyor (Kritik)

**Model (satır 59):**
```
state Error;
```

**Model'deki Error state ile ilgili tüm transition'lar (satır 51, 52, 58, 60):**
```
transition first On accept ItemDefs::HealthNotOK then Error;
transition first Error then States::StateAction::done;
transition first Error then Off;
transition first Error accept ItemDefs::PowerOff then Off;
```

**Mevcut render:** Error state'i **görselde tamamen yok**, bu state'e bağlı 4 transition da yok.

**Kural ihlali:**
- UML/SysML v2: Her state declaration (gövdesiz olsun veya olmasın) view filter explicit olarak hariç tutmadıkça gösterilmelidir
- `state Error;` ile `state Error { ... }` arasındaki tek fark içeriktir; **görünürlük durumunu etkilemez**

**Beklenen davranış:**
- `Error` state'i basit yuvarlatılmış dikdörtgen olarak çizilmeli (sadece adı, compartment yok)
- `On → Error`, `Error → done`, `Error → Off` (iki tane: biri trigger'lı biri triggersız) transition'ları çizilmeli

**Güven seviyesi:** Yüksek

**Kök sebep hipotezi:** Transformer'da `state X { ... }` (StateUsage with body) ile `state X;` (StateUsage without body) farklı kod yollarına gidiyor olabilir; ikincisi accidentally skip ediliyor olabilir

---

### BUG-SM-04 — Pseudo-State'ler Render Edilmiyor (Kritik)

**Model'deki pseudo-state referansları (satır 50, 52, 57, 61):**
```
transition first States::StateAction::start accept ItemDefs::HealthOK then Normal;
transition first Error then States::StateAction::done;
transition first States::StateAction::start then Off;
transition first On then States::StateAction::done;
```

`States::StateAction::start` ve `States::StateAction::done` SysML v2 standard library'sinde tanımlı pseudo-state markerlarıdır.

**Mevcut render:** Bu pseudo-state'ler hiç görünmüyor. Initial ve final state'ler render edilmemiş.

**Kural ihlali:**
- UML notation: Initial pseudo-state **dolu siyah daire** (● — `\u25CF`), final pseudo-state **çift daire** (⊙ — dış daire içinde dolu nokta)
- Bu semboller textual ada sahip değildir, transformer onları **özel olarak tanımalı** ve geometrik sembol üretmeli
- SysML v2 pilot implementation PlantUML'de bu için `[*]` syntax kullanır (PlantUML state diagram konvansiyonu)

**Beklenen davranış:**
- Görselde **iki initial pseudo-state** olmalı:
  - Üst seviyede (`SensorSystemStates` içinde): `start → Off` ok'unun kaynağı
  - `On` state'inin içinde (sub-state machine için): `start → Normal` ok'unun kaynağı
- Görselde **iki final pseudo-state** olmalı:
  - Üst seviyede: `On → done` ok'unun hedefi
  - `On` içinde: `Error → done` (Error On içindeyse — modelde Error'ın hangi seviyede olduğu net değil, aşağıda not)

**Güven seviyesi:** Yüksek — UML temelli

**Not — Error'ın yeri:** Model dikkatlice okununca, `state Error;` deklarasyonu (satır 59) `On` state'inin **dışında** (ama `SensorSystemStates` içinde) görünüyor. Yani Error, On'a parallel bir state. Bu durumda `transition first Error then States::StateAction::done` — Error'dan SensorSystemStates'in final state'ine geçiş. Bu noktayı transformer'da doğru yakalamak önemli.

**Kök sebep (doğrulandı):** Parser `parseTransitionBody` first/then regex'i (`\w+`) qualified name'leri yakalamıyordu — `States::StateAction::start` → `States` truncate. `States` adlı node yok → `resolveNodeAtOffset` undefined → transition silently dropped (AST'e hiç girmiyor). Audit'in ilk hipotezi "pseudo-state render edilmiyor" yan-etki olarak transformer'a bağlamıştı; gerçek kök sebep parser'da. **Çözüldü:** Slice 1 prep B (commit `74a521a`, M4-A). `\w+` → `[\w:]+`, son `::` segmenti `SPECIAL_NAMES` lookup için kullanılıyor.

---

### BUG-SM-05 — Nested Action Hiyerarşisi Düz Gösteriliyor

**Model (satır 35-41):**
```
entry action activation {
    action powerControl;
    action powerProtect;
    action activateSubsystems;
    first powerControl then powerProtect;
    first powerProtect then activateSubsystems;
}
```

`powerControl`, `powerProtect`, `activateSubsystems` — bunlar `activation` action'ının **içinde** olan sub-action'lar.

**Mevcut render:** Görsel olarak `On` state'inin içinde:
- `activateSubsystems` (sadece bir tanesi)
- `entry action / activation`

Yani üç sub-action'dan biri görünüyor, ikisi (`powerControl`, `powerProtect`) yok. Ve `activateSubsystems` `activation`'ın **içinde** değil, `On`'un doğrudan altında.

**Kural ihlali:**
- Composite action'ın sub-action'ları parent action'ın **içinde** nested olarak gösterilmelidir
- State compartment'ında `entry / activation` görünürken, `activation`'ın içeriği opsiyonel olarak expand edilebilir veya ayrı bir action diagram'a referans verilebilir
- Sub-action'lardan **bazılarını gösterip bazılarını atlamak tutarsızlıktır** — ya hepsi ya hiçbiri

**Beklenen davranış (iki kabul edilebilir seçenek var):**

**Seçenek A — Sade:** `On`'un entry compartment'ında sadece:
```
entry / activation
```
Sub-action'lar gizli (action içeriği ayrı view'da görüntülenir).

**Seçenek B — Detaylı:** `On`'un entry compartment'ında:
```
entry / activation:
   1. powerControl
   2. powerProtect
   3. activateSubsystems
```
Veya nested action box'ları (PlantUML state diagram'da bu sınırlı).

**Güven seviyesi:** Orta — kesin "hangi view bunu nasıl gösterir" SysML v2-spesifik bir karar, ama mevcut davranış kesinlikle yanlış (kısmi gösterim).

---

### BUG-SM-06 — On State'inin Compartment'ları Eksik

**Model'de On state'inin içinde tanımlı action'lar (satır 35-49):**
- `entry action activation { ... }` → görselde var ("entry action / activation")
- `do action controlHealth { action controlComunicationwithSubsystems { ... } }` → **görselde yok**
- `exit action checkPowerStatus { action turnOffEachSubsystemInSafeOrder; }` → görselde var ("exit action / checkPowerStatus")

**Mevcut render:** `do action controlHealth` görselde hiç yok. `activateSubsystems` ayrı bir compartment olarak görünüyor (ama Bug-SM-05'te belirtildiği gibi yanlış yerde).

**Kural ihlali:**
- State compartment yapısı tutarlı olmalı: entry / do / exit hepsi gösterilmeli, hiçbiri eksik bırakılmamalı (varsa)
- "Sadece bazılarını göster" view filter'ı varsa explicit olmalı

**Beklenen davranış:**
- On state'inin compartment'ları sırasıyla:
  - `entry / activation`
  - `do / controlHealth`
  - `exit / checkPowerStatus`

**Güven seviyesi:** Yüksek

**Kök sebep (kısmen doğrulandı):** Pre-Slice 1 prep B AST'te `On → do action / controlHealth` composition edge'i mevcuttu. M3-A nested state ownership'i düzeltti (`On → Normal`, `On → Degraded` artık doğru). Bu SM-06'nın doğrudan parser sebebini açıklamıyor; render eksiği büyük ihtimalle transformer-side compartment generator'da (do compartment'ını çıkartmıyor olabilir). Phase 1 transformer TDD'sinde yeniden ele alınacak. Audit'in M3-A'ya tek başına bağladığı varsayım eksikti — gerçek scope transformer+parser ortak.

---

### BUG-SM-07 — Sub-State'lerin Action'ları Eksik

**Model — Normal state (satır 6-22):**
```
state Normal {
    entry action checkPowerSource;
    do action operationActions { ... }
    exit action TBD { ... }
    doc /* ... */
}
```

**Model — Degraded state (satır 23-32):**
```
state Degraded {
    entry action decreasePowerConsumption;
    do action restrictedOperations { ... }
    exit action ;
    doc /* ... */
}
```

**Mevcut render:** Normal ve Degraded state'leri **sadece adlarıyla** çiziliyor. İçlerindeki entry/do/exit action'lar görünmüyor.

**Kural ihlali:**
- Aynı transformer üst state (`On`) için action'ları gösterirken sub-state'ler için göstermiyorsa, davranış tutarsız
- Ya tüm seviyelerde action'lar gösterilmeli, ya hiçbirinde gösterilmemeli — view filter ne olduğuna karar vermeli

**Beklenen davranış:**
- Normal state compartment'ları:
  - `entry / checkPowerSource`
  - `do / operationActions`
  - `exit / TBD`
- Degraded state compartment'ları:
  - `entry / decreasePowerConsumption`
  - `do / restrictedOperations`
  - `exit /` (boş, model bunu öyle bırakmış — gösterilmeli veya gizlenmeli, ama tutarlı şekilde)

**Güven seviyesi:** Yüksek

**Kök sebep (doğrulandı):** Parser `Pre-create container usage nodes` bloğu (`sysml-text-parser.ts:1031`) findOwnerUsage çağırmıyordu. `state Normal { ... }` ve `state Degraded { ... }` body'li olduğu için pre-create yoluna düşüyor, owner her zaman enclosing def (`SensorSystemStates`) olarak hesaplanıyordu — On'a parent olarak bağlanmıyordu. Bu durumda transformer'ın "what's inside On" sorgusu Normal/Degraded'ı bulamıyor; render'da On içi boş, Normal/Degraded ise top-level siblings olarak görünüyor. Action ownership (entry/do/exit ile Normal arasındaki edge) ayrı code path'inden geliyordu ve doğruydu, ama nested state usage parent'ı yanlış olduğu için transformer'ın hiyerarşik traversal'i sub-states'in compartment'larını çekemiyordu. **Çözüldü:** Slice 1 prep B (commit `74a521a`, M3-A). Pre-create bloğuna findOwnerUsage check'i eklendi (mevcut diğer usage path'leriyle aynı pattern). Phase 1 transformer hâlâ bu hiyerarşiyi tüketme katmanına ihtiyaç duyacak — fakat parser artık doğru bilgiyi veriyor.

---

### BUG-SM-08 — Eksik Transition'lar

Modelde tanımlı ama görselde olmayan transition'lar:

| # | Model (satır) | Transition | Görselde? |
|---|---|---|---|
| 1 | 50 | `start → Normal` (HealthOK) | Yok |
| 2 | 51 | `On → Error` (HealthNotOK) | Yok |
| 3 | 52 | `Error → done` | Yok |
| 4 | 57 | `start → Off` | Yok |
| 5 | 58 | `Error → Off` (triggersız) | Yok |
| 6 | 60 | `Error → Off` (PowerOff trigger) | Yok |
| 7 | 61 | `On → done` (triggersız) | Yok |

7 transition eksik. Bunların 5 tanesi Error veya pseudo-state ile ilgili (yani Bug-SM-03 ve Bug-SM-04'ün yan etkisi — kaynak veya hedef render edilmediği için transition da çizilmiyor). Ama 2 tanesi bağımsız:

- `On → done` (satır 61) — On render ediliyor, done değil
- (Belki başka bir kombinasyon)

**Beklenen davranış:** Modelde tanımlı her transition render edilmeli; kaynak veya hedef yoksa transformer önce o state'i çizmeli, sonra transition'ı.

**Güven seviyesi:** Yüksek

**Kök sebep (doğrulandı — iki ayrı parser bug'u):**

1. **M4-A — qualified pseudo-state references silently dropped.** `parseTransitionBody`'deki `first/then` regex (`\w+`) `::` yakalamıyordu. `States::StateAction::start` → `States` truncate → `resolveNodeAtOffset` undefined → transition AST'e hiç girmiyordu. 4 pseudo-state transition'ı bu yüzden eksikti. Audit'in "yan etki" nitelendirmesi yanlıştı — pseudo-state node'lar tarafından değil, transition'lar parser tarafından dropped ediliyordu. **Çözüldü:** commit `74a521a` (Slice 1 prep B, M4-A), regex `[\w:]+`'a genişletildi, son `::` segmenti pseudo-state lookup için kullanılıyor.

2. **M6-A — parallel transitions silently deduplicated.** Parser'ın sonundaki `uniqueConnections` filter (`sysml-text-parser.ts:3108`) edge'leri `src→tgt:kind` ile dedup ediyordu — paralel iki `Error → Off` transition'ı (biri triggersız, diğeri PowerOff trigger ile) aynı key'e map oluyor, ikincisi siliniyordu. UML/SysML state machine semantiğinde paralel transition'lar meşru. **Çözüldü:** commit `74a521a` (Slice 1 prep B, M6-A), dedup key'e `name` eklendi. Composition davranışı korundu (hep boş name), transition'lar artık label'a göre ayrışıyor.

7 eksik transition'dan 5'i M4-A ile, 1'i M6-A ile, geri kalan 1'i (`On → Error` — wait, this was already in the rendered output as transition__anon_1450 in our exploration) — actually re-check: audit'in tablosundaki "7 eksik" yapı pre-Slice 1 prep döneminden. Post-parser-fix exploration AST'i 11/11 transition'ı doğru üretiyor. Audit'in original tablosu görsel render eksikliği üzerinden kuruldu, ki transformer-side problemleri de içerebilir; ancak parser tarafı artık tüm 11 transition'ı sağlıyor. Phase 1 transformer TDD'si bu 11 transition'ı IR'a aktarıp render etmekle yükümlü.

**Yan bulgu — M5-A (audit'te tespit edilmemişti):** AST exploration sırasında parser'ın iki adet phantom `do action / ne` DoActionUsage node'u ürettiği görüldü. Kök sebep: `STATE_BEHAVIOR_RE` regex'inde keyword sonrası `\b` yoktu, `States::StateAction::done;` içindeki `do` matchliyor, `ne` action name olarak yakalanıyordu. **Çözüldü:** commit `74a521a` (Slice 1 prep B, M5-A), `\b(entry|exit|do)\b` (keyword sonu word boundary). Bu bug görselde "fazladan do compartment" olarak görünmemiş olabilir (transformer view filter elemiş olabilir) — ama AST kirliydi, audit'in tek başına render karşılaştırmasıyla yakalayamadığı bir sınıf bulgu örneği.

---

### BUG-SM-09 — Layout: Ekran Dışına Çıkan Çizgi

**Mevcut render:** Görselin sağ tarafında bir ok ucu (`>`) var, başlangıcı görselde değil — bu çizgi ekran dışından geliyor.

**Kural ihlali:** Render output tüm transition'ları viewport içinde tutmalı. ELK layout viewBox'ı tüm element'leri kapsayacak şekilde hesaplanmalıdır.

**Güven seviyesi:** Yüksek — bu temel layout doğruluğu

**Kök sebep hipotezi:** Eksik render edilen pseudo-state'ler nedeniyle transition'ın bir ucu hesaplanmamış pozisyonda kalıyor, ELK orphan edge'i dışarı atıyor.

---

### BUG-SM-10 — Off ve On Arası İki Ok'un Yön Belirsizliği

**Model:** İki ayrı transition:
```
transition first Off accept ItemDefs::PowerOn via sensor2Platform then On;    // Off → On
transition first On accept ItemDefs::PowerOff via sensor2Platform then Off;   // On → Off
```

**Mevcut render:** Off ile On arasında iki ok var, ikisi de "ItemDefs" diyor (Bug-SM-01). Hangisinin hangi yönde olduğu ok başlarından da tam ayırt edilemiyor — özellikle ok başları küçük ve yakın.

**Kural ihlali:** Bidirectional ilişki değil iki ayrı tek-yönlü transition var, label'lar bunları net ayırmalı.

**Beklenen davranış:** Bug-SM-01 düzeldikten sonra bu otomatik düzelir (label'lar `PowerOn` ve `PowerOff` olduğunda yön açık olur). Ama ok başlarının da net olduğundan emin olmak gerek.

**Güven seviyesi:** Yüksek

---

## Doğru Render — Sözel Tanım

SensorSystems modelinin state machine view'unun doğru render'ı şöyle olmalı:

**Top-level container:** `SensorSystemStates : stv` (state view)

**İçeride üç state ve iki pseudo-state:**

1. **Initial pseudo-state** (●) — üst tarafa yerleştirilmiş, görünür çıkış noktası
2. **Off state** — yuvarlatılmış dikdörtgen, sadece adı (içerik yok modelde)
3. **On state** — yuvarlatılmış dikdörtgen, içinde:
   - Compartment 1: `entry / activation`
   - Compartment 2: `do / controlHealth`
   - Compartment 3: `exit / checkPowerStatus`
   - Compartment 4 (nested area): İki sub-state ve bir initial pseudo-state
     - Initial pseudo-state (●)
     - **Normal state** — yuvarlatılmış dikdörtgen, içinde:
       - `entry / checkPowerSource`
       - `do / operationActions`
       - `exit / TBD`
     - **Degraded state** — yuvarlatılmış dikdörtgen, içinde:
       - `entry / decreasePowerConsumption`
       - `do / restrictedOperations`
       - `exit /` (veya gizlenir)
     - Transitions inside On:
       - `start → Normal` (label: `HealthOK`)
       - `Normal → Degraded` (label: `BatteryPower via sensor2Platform`)
       - `Degraded → Normal` (label: `MainPower via sensor2Platform`)
4. **Error state** — yuvarlatılmış dikdörtgen, sadece adı (içerik yok modelde)
5. **Final pseudo-state** (⊙) — alt tarafa yerleştirilmiş

**Top-level transitions:**
- `initial → Off` (triggersız)
- `Off → On` (label: `PowerOn via sensor2Platform`)
- `On → Off` (label: `PowerOff via sensor2Platform`)
- `On → Error` (label: `HealthNotOK`)
- `On → final` (triggersız)
- `Error → Off` (triggersız)
- `Error → Off` (label: `PowerOff`)
- `Error → final` (triggersız)

---

## Hata Önceliği Sınıflandırması

| Bug | Etki | Öncelik | Kategori |
|---|---|---|---|
| BUG-SM-01 | Tüm transition'lar yanlış etiketli | P0 | Encoding |
| BUG-SM-02 | SysML v2 spec ihlali | P0 | Encoding |
| BUG-SM-03 | State view'dan kayıp | P0 | View selection |
| BUG-SM-04 | Pseudo-state'ler eksik | P0 | Encoding |
| BUG-SM-08 | 7 transition eksik | P0 | View selection (3,4'ün yan etkisi) |
| BUG-SM-09 | Layout dışı çizgi | P0 | Layout |
| BUG-SM-06 | On compartment'ları eksik | P1 | View selection |
| BUG-SM-07 | Sub-state action'ları eksik | P1 | View selection |
| BUG-SM-10 | Ok yön belirsizliği | P1 | Encoding (P0'larla otomatik düzelir) |
| BUG-SM-05 | Nested action gösterim | P2 | Encoding |

**P0:** Faz 1'de mutlaka çözülmeli
**P1:** Faz 1'de tercihen çözülmeli
**P2:** Faz 1'in stretch goal'u, gerekirse Faz 1.1'e ertelenebilir

---

## Şüpheli Noktalar — Pilot Implementation Doğrulaması Gerekli

Aşağıdaki noktalarda SysML v2 spec'inin **tam yorumu** UML temelinden farklı olabilir. Antigravity Claude bu noktalara geldiğinde Pilot Implementation'da somut örnekle doğrulamak isteyebilir:

1. **`via <port>` label formatı** — Tek satır mı (`PowerOn via sensor2Platform`), iki satır mı, italic mi? Pilot impl'de bir örnekle doğrulansın.

2. **Composite action'ın gösterimi** — `entry action activation { ... }` content nasıl gösteriliyor? Sadece ad mı, içerik expand mı, ayrı view'a referans mı?

3. **`exit action ;` (boş action)** — Gösterilsin mi gizlensin mi? Spec'te explicit kural yok büyük ihtimalle, tutarlı bir kabul lazım.

4. **`do action` vs `entry action` vs `exit action` stereotype'ı** — Compartment label'ı `do /`, `entry /`, `exit /` mi yoksa stereotype prefix mi? UML'de varsayılan slash notation.

5. **Pseudo-state sembollerinin pozisyonu** — Initial state'in pozisyonu otomatik mi (ELK karar versin), heuristic mi (üst-merkez)? Pilot impl davranışını gözlemleyelim.

Bu beş nokta için sen veya Antigravity Claude SysON / Pilot Implementation'da küçük bir test modeli açıp doğrudan görebilir. Diğer 10 bug için bu doğrulama gerekmez — UML/notation temelleri yeterli.

---

## Antigravity Brief'ine Nasıl Entegre Edilir

Bu raporu Faz 1 brief'inin **"Referans — Bilinen Bug'lar"** bölümünün altına ek olarak ver. Şu giriş cümlesiyle:

> "Aşağıdaki conformance audit raporu, mevcut sistemin SensorSystems modelinde ürettiği render'ın UML 2.5 ve SysML v2 1.0 spec'ine karşı yapılan denetiminin sonuçlarıdır. Yeni renderer her bug'ı sistematik olarak adreslemelidir. P0 etiketli olanlar Faz 1'de blocker, P1 hedefli, P2 stretch."

Her bug **regression test fixture'ı** olarak çıkarılmalı. Faz 1 sonunda yeni renderer SensorSystems modelini bu rapor doğrultusunda render etmelidir.
