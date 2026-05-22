# Brief: Renderer Refactor — Phase 1 (State Machine View) — v1.2

## Sürüm Notları

**v1.2 (2026-05-22) — translation policy revision:** SysML v2 bir uluslararası dil standardı. Spec İngilizce, modellerdeki user-defined identifier'lar da İngilizce. Diagram'da gösterilen syntax token'ları (`entry /`, `via`, `[guard]`, `/ effect`, ileride `block`, `requirement` vb.) çevrilmez — raw kalır. Sadece **diagram'ın etrafındaki UI chrome** (Settings panel başlıkları, tooltip'ler, error toast'lar) `react-i18next` üzerinden geçer.

Etkiler:

- **KARAR-1 (v1.1: i18nKey-based translation)** → KARAR-1 (v1.2: SysML v2 verbatim, sadece UI chrome çevrilir). ADR-005 D1 aynı yönde amend edildi (`docs/adr/005-state-machine-renderer.md`).
- **FR-PH1-07** state-machine compartment key'leri kaldırıldı (`state_machine.compartment_entry` vb.). Sadece Settings panel'i için key'ler kalıyor.
- **FR-PH1-08** (frontend `labelText()` helper) **kalır** ama state-machine için no-op olur — `data.i18nKey` her zaman `undefined`, helper `label.text`'e düşer. Helper'ın varlığı **gelecek UI label'ları** için reserve (ör. "Click to edit" overlay'leri).
- **Slice 1 prep'teki SLabel.data field'ı** kalır — opsiyonel, ileride UI labels için kullanılır, state-machine için kullanılmaz.
- Transformer (Slice 2a) etkilenmez — IR compartment'ları `{kind: 'entry' | 'do' | 'exit', actions: [...]}` semantic yapısı taşır, label string'i değil.
- Renderer (Slice 2b) compartment header SLabel'larını `text: "entry /"` literal'ı ile üretir, `data.i18nKey` boş.

**v1.1'den farklar (özet):** AG'nin önkoşul araştırmasında ortaya çıkan iki mimari boşluk için kararlar eklenmişti:

1. **Bug-SM-01 kök sebep doğrulaması:** Audit raporu transformer'da "qualified name son segment alınmıyor" hipotezini öne sürmüştü. Gerçek kök sebep daha derinde — parser regex `\w+` `::` karakterini yakalamıyor, `PowerOn` AST'te hiç yok. **Karar: Parser regex genişletmesi + IR transformer'da son segment alımı** (M1 — Option A). [Hâlâ geçerli.]

2. **i18n entegrasyon mismatch'i:** v1 KARAR-1 server-side renderer'da `tr()` çağrısı önerdi ama diagram-service'in i18n entry'si yok, WS request'inde locale taşımıyor. **v1.1 kararı: IR sembolik label'lar taşır (i18nKey field), çeviri frontend'de DiagramViewer render path'inde yapılır.** [**v1.2'de superseded** — SysML v2 syntax verbatim, yeni KARAR-1 aşağıda.]

## 1. Bağlam

Bu brief, diagram renderer refactor'ının **ikinci sprint'i**. Faz 0 production'da çalışıyor: 5 slice, 1086 test, granüler observability, view registry lazy loading, hiyerarşik feature flag altyapısı. Tüm `byViewType` bucket'ları şu an `old-default` outcome'u ile dolu çünkü hiçbir mapping yok.

Faz 1'de **state-machine view renderer**'ını yazıp registry'ye kaydederek bir bucket'ı `new` outcome'a taşıyoruz. Aynı zamanda audit raporundaki 10 bug'ı çözüyoruz.

Referans dokümanlar:
- `claude_md_files/renderer_refactor_strategy_v2.md`
- `claude_md_files/renderer_refactor_phase0_brief_v3_1.md`
- `claude_md_files/state_machine_conformance_audit.md` ← **10 bug katalogu, regression checklist**
- `docs/diagram-renderer-architecture.md`
- `docs/adr/001-discriminated-union-ir.md`

## 2. Hedef

State-machine view renderer'ını şu sözleşmeye uygun şekilde yaz:

```typescript
ViewRenderer<StateMachineIR> {
  viewType: 'state-machine';
  transformAstToIR(model, viewSpec): StateMachineIR;
  toSModelRoot(ir): SModelRoot;
}
```

Registry'ye lazy-load kaydet, view-type-mapper'da `'state-transition' → 'state-machine'` entry'sini doldur, dogfooding flag ile prod'a deploy et. Platform Owner per-user flag açtığında state-machine view'larda yeni renderer çalışır, audit raporundaki 10 bug'ın tümünde düzelme görmeli.

## 3. Tasarım Kararları (Architect tarafından verildi)

### KARAR-1: SysML v2 Syntax Verbatim, Sadece UI Chrome Çevrilir

**v1.2'de tam revize.** SysML v2 bir uluslararası dil standardı — TypeScript veya SQL gibi. Spec İngilizce yazılıyor, modellerdeki user-defined identifier'lar (state name `Off`, trigger `PowerOn`, port `sensor2Platform`) İngilizce kalıyor. Syntax token'larını (`entry /`, `via`, `[guard]`, `/ effect`) çevirmek karışık çıktı üretir (`Giriş / startEngine` gibi) — okunabilirliği bozar, snapshot test'leri locale'a göre forklanmak zorunda kalır. Cameo, Eclipse Papyrus, OMG Pilot Implementation hepsi syntax'ı İngilizce gönderiyor.

**Mimari ayrım:**
- **IR:** Yapı, anlam, ilişkiler (locale-bağımsız, discriminated-union literal'lar — `compartment.kind = 'entry'`)
- **SModelRoot:** Layout-ready veri + raw SysML v2 string'leri (locale-bağımsız)
- **DiagramViewer rendering:** SLabel.text'i olduğu gibi gösterir; `data.i18nKey` yoksa fallback aynen kullanılır
- **UI chrome (Settings, tooltips, errors):** `react-i18next` üzerinden çevrilir

**Implementation:**

IR seviyesinde aynı (compartment.kind discriminated union literal):
```typescript
compartment.kind = 'entry'
```

SModelRoot üretirken (renderer.toSModelRoot):
```typescript
// Compartment header SLabel:
{
  type: 'label',
  id: '...',
  text: 'entry /',                         // canonical SysML v2 syntax
  cssClasses: ['compartment-label'],
  // data.i18nKey YOK — syntax çevrilmez
}
```

Frontend label rendering path'inde (DiagramViewer.tsx — Slice 1 prep'te eklendi, **kalmaya devam ediyor**):
```typescript
const text = label.data?.i18nKey ? tr(label.data.i18nKey) : label.text;
```
State-machine için `data.i18nKey` her zaman `undefined`, helper `label.text`'e short-circuit eder. Helper **gelecek UI label'ları** için reserve — örn. Phase 2+'ta diagram üzerinde overlay olarak bindirilebilecek "Click to edit" mesajları.

**Generalised rule (gelecek phases için):**
- SysML v2 keyword'leri, structural punctuation, ve user-defined isimler → **hiçbir zaman çevrilmez**
- Sadece **diagram'ın etrafındaki UI chrome** (panel başlıkları, button label'ları, validation message'ları) → i18n
- Slice 1 prep'te eklenen SLabel.data field'ı opsiyonel ve gelecek UI label'ları için reserve

**Gerekçe:**
- Snapshot test'leri locale-independent kalır (tek `expected-ir.json`, tek `expected-smodel.json`)
- Diagram-service i18n entry'sine ihtiyaç yok
- WS protokol değişikliği yok
- Mevcut comparable tools ile uyumlu (engineer learnability)
- Forward-compatible: BDD/IBD/Requirement gibi Faz 2+ renderer'lara aynı kural uygulanır

**Karşılaşılabilecek edge case'ler:**
- Eski transformer'ın ürettiği SLabel'larda da `data.i18nKey` yok — helper aynı code path'ten geçer, davranış değişmez
- Frontend i18n parity test'i `state_machine.*` key'leri gerektirmez (FR-PH1-07'de kaldırıldılar); sadece Settings panel key'leri gerekli

### KARAR-2: Dogfooding Flag ile Deploy
Flag-gated. Platform Owner kendi hesabında flag açar, real-world model'ler ile test eder, hazır olduğunda global default true.

**Gerekçe:** Strangler fig pattern'in asıl niyeti. Real-world dogfooding. Fallback güvenli — kullanıcılar bozulma görmez.

### KARAR-3: Kapsam — Tüm 10 Bug
P0+P1+P2 hepsi. SM-05 (nested action) zor olabilir; gerçekten zorlu çıkarsa Faz 1.1'e erte, ama default dahil.

### KARAR-4: Bug-SM-01 Parser Fix
**v1'den eklendi:** Audit raporu Bug-SM-01'in transformer-level fix gerektireceğini söyledi. Önkoşul araştırmasında AG kök sebebin parser regex'inde olduğunu buldu — `accept` regex'i `\w+` kullanıyor, `::` karakterini yakalamıyor, qualified name'in son segmenti AST'te hiç yok.

**Fix yolu (Option A — düşük scope):**
1. `packages/diagram-service/src/parser/sysml-text-parser.ts` içindeki accept regex:
   - Eski: `/\baccept\s+(after\s+[\d[\].\w]+|\w+)(?:\s+via\s+(\w+))?/`
   - Yeni: `/\baccept\s+(after\s+[\d[\].\w]+|[\w:]+)(?:\s+via\s+(\w+))?/`
   - Değişiklik: trigger group `\w+` → `[\w:]+` (qualified name'in tamamını yakalar)
2. AST `SysMLConnection.name` field'ı qualified name'i ezberler (örn. `"ItemDefs::PowerOn via sensor2Platform"` veya parser yapısına göre normalize edilmiş hali)
3. IR transformer name'i parse eder:
   ```typescript
   const triggerSegments = rawTrigger.split('::');
   const trigger = triggerSegments[triggerSegments.length - 1];  // 'PowerOn'
   ```

**Risk analizi:**
- Parser regex değişikliği geriye uyumlu (AST shape aynı, sadece name field içeriği daha tam)
- Parser test'leri (`packages/diagram-service/src/parser/__tests__/`) kontrol edilmeli — bazı testler qualified name'in truncate edildiğini varsayıyor olabilir
- AST consumer'lar (sql-formatter, MCP tool, AI prompts) name field'ını okuyorsa, daha uzun string ile karşılaşabilir; ama bu bilgi kaybı değil, bilgi eklemesi — büyük ihtimalle break etmez
- Sub-bug oluşma ihtimali: Eğer eski davranış (truncate) başka bir yerde **explicit olarak** test ediliyor veya kullanılıyorsa, o test fail eder ve düzeltilir

**Doğrulama:**
- Parser test suite'i çalıştır (`pnpm --filter @systemodel/diagram-service test parser`)
- AST consumer'larda grep at: `connection.name`, `node.name` ile arama, qualified name beklemeyen yer varsa not düş

**Eğer Option B (yapısal AST field'lar) tercih edilseydi:** SysMLConnection'a `triggerRef`, `viaPortRef`, `guardExpr`, `effectName` ayrı field'lar eklenecekti. Daha temiz ama parser refactor + shared-types değişikliği + tüm AST consumer'lar etkilenir. Faz 1 scope'unu aşıyor. Option B Faz 2+'da düşünülür (audit-driven, eğer başka view'lar da benzer parsing gereksinimi duyarsa).

## 4. Önkoşullar — Mevcut Sistem Doğrulaması

### 4.1. Mevcut state machine rendering kodu
`transformToBDD` içinde:
- State machine view path'leri (`if (viewType === 'state-transition')` veya benzeri) nerede?
- State node SModelRoot'ta nasıl temsil ediliyor (`type` field değeri)?
- Transition edges hangi type, label nasıl set ediliyor?
- Pseudo-state'ler şu an çiziliyor mu (büyük ihtimalle hayır — SM-04 bulgusu), çiziliyorsa nasıl encode ediliyor?

Bu bilgi, yeni renderer'ın görsel uyumluluğu için kritik.

### 4.2. View dropdown options
Frontend view dropdown tam liste? State machine ile ilişkili olanlar hangileri? (Sadece `state-transition` mı, başka var mı?)

### 4.3. SysML v2 state machine AST node tipleri
Parser çıktısında state machine için `kind` değerleri:
- `state-def`?
- `state-usage`?
- `transition-usage`?
- `accept-action-usage`?
- Pseudo-state'ler parser-level nasıl?

Bu, transformer'ın AST'i nasıl gezeceğini belirler.

### 4.4. Frontend i18n entegrasyonu kontrolü
Mevcut diagram label'larında i18n kullanılıyor mu, hardcode mu? Slice 5'te `tr()` zaten projeye girmişti — diagram-service tarafında nasıl?

## 5. Fonksiyonel Gereksinimler

### FR-PH1-01: State Machine Transformer (AST → IR)

`packages/diagram-service/src/rendering/state-machine/transformer.ts`

**Davranışsal gereksinimler:**

**1. Trigger label parsing (SM-01 + SM-02 düzeltmesi):**

**Önkoşul:** Parser regex KARAR-4'e göre güncellendi. `accept ItemDefs::PowerOn via sensor2Platform` artık AST'te qualified name'in tamamıyla yakalanıyor.

Transformer mantığı:
```typescript
// AST'ten gelen raw connection name (parser fix sonrası):
const rawName = transitionNode.name;  // örn. "ItemDefs::PowerOn via sensor2Platform"

// Parse:
const viaMatch = rawName.match(/^(.+?)\s+via\s+(\S+)$/);
const triggerPart = viaMatch ? viaMatch[1] : rawName;
const viaPort = viaMatch ? viaMatch[2] : undefined;

// Son segment:
const triggerSegments = triggerPart.split('::');
const trigger = triggerSegments[triggerSegments.length - 1];

// TransitionLabel oluştur:
const label: TransitionLabel = {
  trigger,                              // 'PowerOn' (paket adı YOK)
  modifier: viaPort ? `via ${viaPort}` : undefined,
  guard: undefined,   // future: AST'te guard expression parsing
  effect: undefined,  // future: AST'te effect action parsing
};
```

Edge case'ler:
- Trigger yoksa (`transition first X then Y` triggersız) → `label = {}`
- Sadece guard veya effect (gelecek SysML v2 sürümleri) → şimdilik undefined, ileride eklenir

**2. Bodyless state handling (SM-03):**
`state Error;` → IR node:
```typescript
{
  kind: 'state',
  name: 'Error',
  compartments: [],     // boş, undefined değil
  containedNodes: [],
  containedEdges: []
}
```

**3. Pseudo-state recognition (SM-04):**
- `States::StateAction::start` → `{ kind: 'pseudo-initial', name: undefined }`
- `States::StateAction::done` → `{ kind: 'pseudo-final', name: undefined }`
- Her container (üst seviye + her composite state) için ayrı pseudo-state instance

**4. Nested state machine handling (SM-04 + SM-06 + SM-07):**
- Composite state'ler (`On` içinde `Normal`, `Degraded`) → `containedNodes` ve `containedEdges` doldurulur
- Sub-state'lerin kendi compartment'ları görünür
- Her composite state kendi initial pseudo-state'ine sahip olabilir

**5. Compartment yapısı (SM-06 + SM-07):**
```typescript
{
  kind: 'entry' | 'do' | 'exit',
  actions: [{ name: '<action name>', semanticRef: {...} }]
}
```
- `entry action X` → `{ kind: 'entry', actions: [{ name: 'X', ... }] }`
- Birden fazla action varsa `actions: [...]`
- **`exit action ;` (boş action) handling**: Compartment hiç eklenmez. (Architect varsayılan, soru S1'de)

**6. Transition collection (SM-08):**
- Modeldeki **her** transition declaration IR'a girer
- Source veya target eksikse önce pseudo-state node'u eklenir
- Hiçbir transition silently atılmaz

**7. Nested action handling (SM-05 — P2):**
**Seçenek A (Architect varsayılan, soru S3):**
`entry action activation { action powerControl; ... }` → `actions: [{ name: 'activation' }]` — sub-action'lar gizli.

Eğer implementasyon sırasında Seçenek B daha doğru görünürse, brief'e not düş ve Architect'e sor.

### FR-PH1-02: State Machine Renderer (IR → SModelRoot)

`packages/diagram-service/src/rendering/state-machine/renderer.ts`

**Davranışsal gereksinimler:**

**1. Output şema uyumluluğu:**
Mevcut `transformToBDD`'nin state machine view'unda ürettiği SModelRoot şeması ile birebir aynı node/edge tipleri (sadece içerik doğru). Önkoşul 4.1'in cevabı bu şemayı verir.

**2. Label rendering (KARAR-1 yeni uygulaması):**

SModelRoot SLabel'lar `i18nKey` data field'ı ile çıkarılır, çeviri frontend'de yapılır.

**Transition label (raw English fallback + i18n yok):**
```typescript
// Transition label içeriği user-defined isimleri + structural keyword'leri karıştırır.
// 'via' literal'i SysML v2 syntax, dolayısıyla çevrilmez (raw kalır).
const parts: string[] = [];
if (label.trigger) parts.push(label.trigger);  // 'PowerOn' — user-defined
if (label.modifier) parts.push(label.modifier);  // 'via sensor2Platform' — raw SysML syntax
if (label.guard) parts.push(`[${label.guard}]`);
if (label.effect) parts.push(`/ ${label.effect}`);
const labelText = parts.join(' ');

const sLabel = {
  type: 'label',
  id: `${edge.id}-label`,
  text: labelText,  // i18n yok (user-defined data + SysML syntax)
  cssClasses: ['transition-label'],
};
```

**Compartment label (structural — i18nKey ile):**
```typescript
// 'entry' literal IR'da. SModelRoot'ta i18n hint ile:
const compartmentSLabel = {
  type: 'label',
  id: `${state.id}-compartment-${comp.kind}-header`,
  text: `${comp.kind} /`,  // English fallback ('entry /')
  cssClasses: ['compartment-header'],
  data: { i18nKey: `state_machine.compartment_${comp.kind}` },  // 'state_machine.compartment_entry'
};
```

Action satırı (compartment içeriği):
```typescript
// "activation" — user-defined name, çevrilmez:
const actionSLabel = {
  type: 'label',
  id: `${state.id}-compartment-${comp.kind}-action-${i}`,
  text: action.name,  // raw user data
  cssClasses: ['compartment-action'],
};
```

**Frontend tarafında (FR-PH1-08 yeni):**
DiagramViewer'ın label render path'i, SLabel'da `data.i18nKey` varsa `tr()` ile çevirir, yoksa `text` field'ı kullanır.

```typescript
// packages/web-client/src/components/Diagram/... (label render path):
const displayText = label.data?.i18nKey
  ? tr(label.data.i18nKey as string)
  : label.text;
```

Bu fallback pattern eski renderer'ı kırmaz — eski SModelRoot'larda `data.i18nKey` yok, `text` field'ı raw kullanılır.

**3. Pseudo-state geometrisi:**
- `pseudo-initial`: dolu siyah daire (UML standard)
- `pseudo-final`: çift daire (içerde dolu)
- SModelRoot encoding önkoşul 4.1'in cevabına göre

**4. Nested state container:**
Composite state'lerin sub-state'leri SModelRoot'ta nasıl temsil ediliyor (`children` array, ayrı container node, vb.) — önkoşul 4.1.

**5. Orphan edge önleme (SM-09):**
Edge'in source veya target node'u SModelRoot'ta yoksa edge eklenmez.

### FR-PH1-03: View Type Mapper Update

`packages/diagram-service/src/rendering/view-type-mapper.ts`:

```typescript
export function mapToDiagramViewType(legacy: ViewType): DiagramViewType | null {
  switch (legacy) {
    case 'state-transition': return 'state-machine';
    default: return null;
  }
}
```

### FR-PH1-04: Registry Registration

`packages/diagram-service/src/index.ts` veya bootstrap:

```typescript
viewRegistry.register('state-machine', () =>
  import('./rendering/state-machine/index.js').then(m => m.stateMachineRenderer)
);
```

`packages/diagram-service/src/rendering/state-machine/index.ts`:

```typescript
export const stateMachineRenderer: ViewRenderer<StateMachineIR> = {
  viewType: 'state-machine',
  transformAstToIR: transformAstToStateMachineIR,
  toSModelRoot: stateMachineToSModelRoot,
};
```

### FR-PH1-05: Settings UI Feature Flag Toggle

`packages/web-client/src/pages/SettingsPage.tsx` içine bölüm:

```
┌─────────────────────────────────────┐
│ Renderer Beta                       │
├─────────────────────────────────────┤
│ [ ] State Machine (new renderer)    │
│     Audit raporunda tanımlanmış 10  │
│     bug için yeni implementasyon.   │
└─────────────────────────────────────┘
```

Toggle:
- 2-state (on/off) — Architect varsayılan, soru S4
- On → `PATCH /api/users/me/feature-flags` : `{ 'state-machine-new-renderer': true }`
- Off → `PATCH /api/users/me/feature-flags` : `{ 'state-machine-new-renderer': null }` (delete, global default'a düşer)

i18n key'leri (en + tr parity):
- `settings.renderer_beta.title`
- `settings.renderer_beta.state_machine_label`
- `settings.renderer_beta.state_machine_description`

### FR-PH1-06: Sensor-Systems Fixture'ını Doldur

```
packages/diagram-service/tests/fixtures/state-machine/sensor-systems/
  model.sysml                  # SensorSystem modeli tam içerik
  expected-ir.json             # Hand-written IR (audit "Doğru Render" temel alınarak)
  expected-smodel.json         # Hand-written SModelRoot
  reference/
    notes.md                   # 10 bug checklist, her birinin status'u
    pilot-screenshot.png       # Manuel — Platform Owner SysON/Pilot Impl'den çekecek
```

**Test:**
```typescript
it('should render SensorSystem correctly per audit document', async () => {
  const fixture = await loadFixture('sensor-systems');
  const renderer = await viewRegistry.get('state-machine');
  const ir = renderer.transformAstToIR(fixture.model, viewSpec);
  expect(ir).toEqual(fixture.expectedIR);
  
  const sModelRoot = renderer.toSModelRoot(ir);
  expect(sModelRoot).toEqual(fixture.expectedSModelRoot);
});
```

### FR-PH1-07: i18n Keys (UI Chrome Only)

**v1.2 revizyonu:** State-machine compartment key'leri (`state_machine.compartment_entry/do/exit/internal`) kaldırıldı — KARAR-1 (v1.2) gereği SysML v2 syntax verbatim. Sadece **diagram'ın etrafındaki UI chrome** çevrilir.

Yeni key'ler (`en.json` + `tr.json` parity zorunlu):

```
settings.renderer_beta.title                       → "Renderer Beta" / "Render Beta"
settings.renderer_beta.state_machine_label         → "State Machine (new)" / "Durum Makinesi (yeni)"
settings.renderer_beta.state_machine_description   → "..." / "..."
```

Translation review için `docs/translation-review.md`'ye ekle. Compartment header'lar (`entry /`, `do /`, `exit /`) raw SysML v2 syntax olarak SLabel.text'te dolar.

### FR-PH1-08: Frontend Label Translation Hook (Reserved for Future UI Labels)

**v1.1'de eklendi, v1.2'de scope daraltıldı:** KARAR-1 (v1.2) gereği SysML v2 syntax çevrilmez, dolayısıyla state-machine SLabel'larında `data.i18nKey` her zaman `undefined`. Slice 1 prep'te eklenen `labelText()` helper'ı **kalır** ama state-machine için no-op olarak çalışır — `label.text`'e short-circuit eder, mevcut davranışla byte-identical.

`packages/web-client/src/components/Diagram/...` içindeki label rendering kodu (Slice 1 prep'te deploy edildi):

```typescript
// Slice 1 prep'te eklenen helper (DiagramViewer.tsx:380-385):
const text = label.data?.i18nKey ? tr(label.data.i18nKey) : label.text;
```

**Neden helper kalıyor:** Gelecek UI label'ları (Phase 2+'ta diagram üzerine bindirilebilecek "Click to edit", "Locked by X", "Edit needed" gibi platform-generated overlay'ler) için reserve. SysML v2 syntax bu kategoride değil; sadece **platformun kendi ürettiği UI label'ları** kategoride.

**Önemli notlar:**
- Tip: `SModelRoot` types Sprotty'den geliyor, `SLabel.data` field'ı opsiyonel
- Bu pattern eski SModelRoot'ları kırmaz — `data.i18nKey` yoksa `text` field'ı kullanılır (fallback)
- Hem yeni hem eski renderer'lar aynı code path'ten geçer; davranış aynı

**Test:**
- Mevcut diagram render testlerinde davranış değişmemeli (zaten Slice 1 prep'te doğrulandı)
- State-machine renderer'da `data.i18nKey` set edilmemeli (FR-PH1-07'de listelenen key'ler sadece UI chrome için)
- Compartment label test'i: SLabel.text == "entry /" (raw), data.i18nKey == undefined

### FR-PH1-09: Parser Regex Update (Bug-SM-01 Fix)

**v1.1'de yeni:** KARAR-4'ün implementasyonu.

`packages/diagram-service/src/parser/sysml-text-parser.ts` accept regex değişimi:

```typescript
// Eski:
const acceptMatch = /\baccept\s+(after\s+[\d[\].\w]+|\w+)(?:\s+via\s+(\w+))?/.exec(line);

// Yeni:
const acceptMatch = /\baccept\s+(after\s+[\d[\].\w]+|[\w:]+)(?:\s+via\s+(\w+))?/.exec(line);
```

Tek değişiklik: trigger group `\w+` → `[\w:]+`.

**Önkoşul kontrolü implementasyon öncesi:**
- Parser test suite (`packages/diagram-service/src/parser/__tests__/`) bu değişikliğin başka bir testi kırıp kırmadığını kontrol et
- Eğer kırılan test varsa: bu test eski (truncate edilmiş) davranışı **explicit** test ediyor mu, yoksa **incidentally** üzerinde mi düşülmüş? Explicit ise testi yeniden değerlendir.

**Doğrulama:**
- `accept ItemDefs::PowerOn via sensor2Platform` parse edildiğinde `SysMLConnection.name` veya muadili "ItemDefs::PowerOn" + "sensor2Platform" bilgilerini taşımalı (parser'ın internal structure'ına göre)
- Mevcut `accept SomeSignal` (qualified name'siz) hâlâ çalışmalı


## 6. Non-Functional Gereksinimler

### NFR-PH1-01: Bundle Size
- State machine renderer **lazy chunk** olmalı
- Lazy chunk size: <50KB minified, <15KB gzip
- Initial bundle delta: ≤ 0.5KB gzip (Faz 0 baseline'ından)

### NFR-PH1-02: Performance
- Transform + toSModelRoot süresi: SensorSystem benzeri model için <50ms
- Mevcut transformToBDD'ye göre ≤2x yavaşlama kabul edilir

### NFR-PH1-03: Type Safety
- `any` yasak
- IR discriminated union exhaustiveness korunur
- Tüm fonksiyonlar tip-tam

### NFR-PH1-04: Test Coverage
- Sensor-systems fixture testi
- Her transformer fonksiyonu unit testi (label parsing, pseudo-state, nested)
- Her bug için regression test (10 madde)
- Minimum 30 yeni test

### NFR-PH1-05: Observability
- Yeni renderer çağrıldığında `byViewType['state-machine'].new` artar
- Fallback olursa `byViewType['state-machine'].old-fallback-from-new` artar
- Hata durumunda structured log

## 7. Kabul Kriterleri

### Audit Bug Regression (10 — kritik)
- [ ] **SM-01**: Transition label sadece trigger event ismini gösterir
- [ ] **SM-02**: `via <port>` modifier render edilir
- [ ] **SM-03**: Gövdesiz state görselde mevcut
- [ ] **SM-04**: Pseudo-state'ler (initial/final) UML standard geometride
- [ ] **SM-05** (P2): Seçenek A uygulanmış (veya 1.1'e ertelenmiş, dökümante)
- [ ] **SM-06**: On state compartment'larının tümü çizilir
- [ ] **SM-07**: Sub-state action'ları çizilir
- [ ] **SM-08**: Modeldeki tüm transition'lar görselde
- [ ] **SM-09**: Orphan edge yok, viewport doğru
- [ ] **SM-10**: İki state arası iki ok'un yönü net

### Functional
- [ ] Sensor-systems fixture testi geçer
- [ ] Registry'ye state-machine kayıtlı, lazy load çalışıyor
- [ ] View-type-mapper `'state-transition' → 'state-machine'` döner
- [ ] Wedge: flag açıkken sayaç `new` kaydediyor

### UI
- [ ] Settings'te Renderer Beta bölümü görünür
- [ ] State Machine toggle PATCH endpoint'ine doğru payload gönderir
- [ ] Flag açıkken yeni renderer'ın çıktısı, kapalıyken davranış değişmez

### Documentation
- [ ] ADR-005: state machine renderer design
- [ ] sensor-systems/reference/notes.md: audit checklist
- [ ] state_machine_conformance_audit.md güncellendi (her bug "Çözüldü" + commit hash)
- [ ] i18n key'leri translation-review'a eklendi

### Behavior Preservation
- [ ] Mevcut 1086+ test geçer (yeni testler dahil 1116+)
- [ ] Flag kapalı kullanıcı için davranış birebir aynı
- [ ] Bundle delta NFR-PH1-01 sınırlarını karşılar

## 8. Kısıtlar

- Mevcut `transformToBDD` kodu değişmemeli
- SModelRoot şeması frontend'i kırmamalı (yeni node type'lar varsa frontend render desteği eklenir)
- i18n parity (en + tr) korunmalı
- Lazy load şart — initial bundle'a state machine kodu girmez

## 9. Deliverable Listesi

### Code
1. `packages/diagram-service/src/rendering/state-machine/transformer.ts`
2. `packages/diagram-service/src/rendering/state-machine/renderer.ts`
3. `packages/diagram-service/src/rendering/state-machine/index.ts`
4. `packages/diagram-service/src/rendering/view-type-mapper.ts` (update)
5. `packages/diagram-service/src/index.ts` (registry registration)
6. `packages/diagram-service/src/parser/sysml-text-parser.ts` (accept regex update — KARAR-4)
7. `packages/web-client/src/pages/SettingsPage.tsx` (UI bölümü)
8. `packages/web-client/src/components/Diagram/...` (label render i18nKey hook — FR-PH1-08)
9. `packages/web-client/src/i18n/en.json` + `tr.json` — yeni key'ler

### Fixtures
9. `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/model.sysml`
10. `expected-ir.json`
11. `expected-smodel.json`
12. `reference/notes.md`
13. (Manuel — Platform Owner) `reference/pilot-screenshot.png`

### Tests
14. `transformer.test.ts` — unit testler
15. `renderer.test.ts` — unit testler
16. `integration.test.ts` — fixture-based end-to-end

### Docs
17. `docs/adr/005-state-machine-renderer.md`
18. `claude_md_files/state_machine_conformance_audit.md` (update)
19. `docs/translation-review.md` (i18n key'ler)

## 10. Sıra Önerisi

1. Önkoşulları doğrula (4.1, 4.2, 4.3, 4.4) — **TAMAMLANDI** (v1.1 review turunda)
2. **Parser regex fix (KARAR-4)** — accept regex genişlet, parser testlerini koş, kırılan varsa değerlendir
3. **Frontend label hook (FR-PH1-08)** — DiagramViewer label render path'inde i18nKey kontrolü; mevcut davranış korunmalı (test geçer)
4. ADR-005 taslağı (kararları yaz, KARAR-1/2/3/4 dahil)
5. Manuel `expected-ir.json` yaz (audit "Doğru Render" temel alınarak)
6. Transformer TDD: expected-ir'a yaklaşan testler + transformer
7. Manuel `expected-smodel.json` yaz (i18nKey'lerle SLabel'lar)
8. Renderer TDD: expected-smodel'a yaklaşan testler + renderer
9. View-type-mapper update + registry registration
10. Settings UI toggle + i18n key'ler
11. Integration test fixture
12. Local smoke: flag aç, sensor-systems render et, audit checklist + Türkçe label kontrolü
13. Deploy: runbook + dogfooding adımı
14. Production smoke: Platform Owner flag aç, audit checklist tekrar
15. Final report

**Kritik sıralama notu:** Adım 2 (parser fix) ve 3 (frontend hook) **bağımsız ön hazırlık adımları**. İkisi de yeni renderer'a değil mevcut sisteme dokunuyor. Yanlış giderse erken sezilir, scope creep riski düşer. Bu iki adım bittikten sonra Faz 1'in asıl iş (transformer + renderer) başlar.

## 11. Açık Sorular (Architect varsayılan cevaplarıyla)

Implementasyon sırasında daha iyi bir karar görürsen Architect'e sor:

**S1: `exit action ;` (boş action) gösterilir mi?**
Varsayılan: Hayır, compartment hiç eklenmez. Audit raporu netleştirmemiş.

**S2: Pseudo-state SModelRoot encoding**
Önkoşul 4.1'in cevabına bağlı. Frontend desteği yoksa yeni node type + frontend renderer komponenti Faz 1 scope'unda.

**S3: SM-05 (nested action) Seçenek A mı B mi?**
Varsayılan: A (sade). Sub-action'lar gizli, sadece parent action adı gösterilir.

**S4: Settings toggle 2-state mi 3-state mi?**
Varsayılan: 2-state (on/off). Off → null payload → global default'a düşer.

Bu varsayılanlar ilerleme için yeterli. Bir tanesinin gerçekten yanlış olduğunu görürsen Architect'e sor, dur.

## 12. Süre Tahmini

**İndikatif:** 2-3 hafta. Faz 0 1-1.5 haftada bittiği için doğal genişleme — transformer + renderer + fixture + UI + 30 test. AG kendi tahminini önkoşullardan sonra revize edebilir.

## 13. Bağlantılı İçerik Fırsatı

Faz 1 bitince LinkedIn post'ları:
- "State machine view'un 10 bug'ı, audit-driven düzeltme"
- "View-First architecture in practice — Phase 1 results"
- "Dogfooding feature flags — how I rolled out a renderer to myself first"
- "Tip seviyesinde bug önleme: discriminated union IR'ın getirisi"
