# Renderer Refactor — Faz 1 Slice 2 (a + b) Oturum Devir Notu

**Son güncelleme:** 2026-05-22 (Slice 2a + 2b commit'lendi ve push edildi, henüz deploy edilmedi)
**Branş:** master
**Live commit (production):** `74a521a` (Slice 1 prep B — parser fixes)
**HEAD (master):** `2d838ad` (Slice 2b — renderer + SModelRoot fixture)
**Strateji:** `claude_md_files/renderer_refactor_strategy_v2.md`
**Aktif brief:** `claude_md_files/renderer_refactor_phase1_brief_v1_2.md` (v1.1 çıkar context'inden)
**Audit:** `claude_md_files/state_machine_conformance_audit.md` (Bug-SM-04/06/07/08 root cause amendments commit'lenmiş)
**ADR:** `docs/adr/005-state-machine-renderer.md` (D1 v1.2, IR ID convention, §Decisions deferred 6 madde)
**Önceki handover:** `claude_md_files/phase1_slice1_2_handover.md` (Slice 1 prep + Slice 2 prep — superseded by this doc)
**Backlog:** `claude_md_files/diagram_render_backlog.md` (Bug-RENDER-01)

---

## 1. TL;DR — Nerede Kaldık

Faz 1'in **transformer + renderer çekirdek implementasyonu bitti.** Parser → Transformer → Renderer zinciri end-to-end çalışıyor, sensor-systems fixture'ında 16 SNode + 22 SEdge ile audit'in "Doğru Render"ına uygun output veriyor. Tüm 1117 test geçiyor (api 340 + diagram 649 + web 128).

**Slice 2c (registry + view-type-mapper + Settings UI + integration test)** ve **Slice 2d (production deploy + dogfooding)** kaldı. Mevcut deploy hâlâ `74a521a` (Slice 1 prep B); 4 yeni commit yerel ve uzakta push edildi ama prod'da değil — registry boş, yeni renderer kullanılmıyor, wedge `old-default` outcome'unda kalıyor.

Son live snapshot (deploy'dan 57 dakika sonra): 32 render — general 22, state-transition 8, interconnection 1, action-flow 1, hepsi `old-default` + `unmapped`. Beklenen — Slice 1 prep B davranış preservation.

## 2. Tamamlanan İş Zinciri

```
2d838ad Phase 1 Slice 2b: state-machine renderer + SModelRoot fixture
fd677f4 Phase 1 Slice 2a docs: brief v1.2 + audit amendments + render backlog
330913e Phase 1 Slice 2a: state-machine transformer + IR fixture + ADR-005
74a521a Phase 1 Slice 1 prep B: four state-machine parser fixes              ← LIVE
13c3c79 Phase 1 Slice 1 (prep): parser regex + frontend label hook
```

### Slice 1 prep (`13c3c79`) — LIVE
Parser accept regex `\w+` → `[\w:]+` (KARAR-4 / FR-PH1-09), Bug-SM-01 kök sebep çözümü. Frontend `labelText()` helper + SLabel.data field (FR-PH1-08, KARAR-1 ön hazırlık).

### Slice 1 prep B (`74a521a`) — LIVE
Dört parser fix tek atomik commit:
- **M3-A:** Nested state usage parsing — Pre-create container bloğuna findOwnerUsage eklendi. `state On { state Normal { ... } }` artık doğru parent'lanıyor.
- **M4-A:** first/then regex `[\w:]+` + last `::` segment normalization. Qualified pseudo-state refs (`States::StateAction::start`) resolve oluyor.
- **M5-A:** STATE_BEHAVIOR_RE `\b(entry|exit|do)\b` — `done` içindeki `do` artık matchlemiyor, phantom DoActionUsage yok.
- **M6-A:** uniqueConnections dedup key'e name eklendi — paralel transitions korunuyor.

Regression: 4 targeted state.test.ts (56 → 60) + 10 assertion'lı parser-state-machine-integration.test.ts + sensor-systems/model.sysml fixture.

### Slice 2a (`330913e`) — pushed, not deployed
`transformAstToStateMachineIR()` — packages/diagram-service/src/rendering/state-machine/transformer.ts. AST → StateMachineIR. 7 FR-PH1-01 davranışsal gereksinim implement edildi. 8 transformer test, fixture-equality dahil. ADR-005 ilk yazımı (D1 v1.1, IR ID convention, §Decisions deferred 5 madde).

### Slice 2a docs (`fd677f4`) — pushed, not deployed
Brief v1.2 (SysML v2 syntax verbatim, KARAR-1 yeniden yazımı), audit doc amendments (Bug-SM-04/06/07/08 root cause), Bug-RENDER-01 backlog.

### Slice 2b (`2d838ad`) — pushed, not deployed
`stateMachineToSModelRoot()` — packages/diagram-service/src/rendering/state-machine/renderer.ts. IR → SModelRoot. Legacy STV encoding pattern'ine birebir uyumlu (önkoşul 4.1 araştırması sonucu). 8 renderer test, fixture-equality + i18nKey invariant assertion. expected-smodel.json hand-written 16 SNode + 22 SEdge. IRMetadata'ya `sourceFile?: string` field eklendi.

## 3. Production Durumu

- **Live commit:** `74a521a`
- **Deploy zamanı:** 2026-05-22 ~21:55 UTC (Slice 1 prep B reload)
- **Production:** https://systemodel.com, Hetzner 65.109.134.254, PM2 api/lsp/diagram 3 servis online
- **PM2 status (son snapshot):** 57m uptime, ↺=15 (deploy reload), 0 May 22 error
- **Counter snapshot:** `{"totalRenders":32, "byViewType":{"general":{"old-default":22}, "state-transition":{"old-default":8}, "interconnection":{"old-default":1}, "action-flow":{"old-default":1}}, "unmapped":32}` — hepsi `old-default` + `unmapped`, davranış preservation onaylı

### Bilinen açık konular

- **Bug-RENDER-01** (`claude_md_files/diagram_render_backlog.md`): Model switch'inde frontend diagram state cleanup bug'ı. Hard refresh fix ediyor. Triage Medium, Faz 1.1 veya user şikayetinde ele alınır. Slice 2c/2d'yi bloklamaz.
- **SSE 503 `/mcp` pattern:** Architect notu — kapanabilir Claude Desktop polling'i; refactor sürecince gerek yok.
- **Pre-existing TS warnings:** `mcp/resources.ts`, `routes/mcp.ts`, `middleware/auth.test.ts` — implicit `any`, mevcut/üretkinlikte etkisiz.

## 4. Slice 2c Hazırlık

Mevcut transformer + renderer yazıldı ama **henüz registry'ye kayıtlı değil**. Wedge production'da `state-machine` view'ı için renderer arıyor, bulamıyor, eski pipeline'a düşüyor. Slice 2c bu son bağlantıyı kuruyor.

### Görevler

1. **View-type-mapper update** — `packages/diagram-service/src/rendering/view-type-mapper.ts`. Legacy `'state-transition'` → DiagramViewType `'state-machine'` mapping ekle. Mevcut: `null` (= unmapped, counter `unmapped` bucket'ına yazıyor).

2. **Registry registration** — `packages/diagram-service/src/rendering/state-machine/index.ts` oluştur:
   ```typescript
   export const stateMachineRenderer: ViewRenderer<StateMachineIR> = {
     viewType: 'state-machine',
     transformAstToIR: transformAstToStateMachineIR,
     toSModelRoot: stateMachineToSModelRoot,
   };
   ```
   Sonra bootstrap'ta (muhtemelen `src/index.ts` veya wedge initialization'da) lazy register:
   ```typescript
   viewRegistry.register('state-machine', () => import('./rendering/state-machine/index.js').then(m => m.stateMachineRenderer));
   ```

3. **Settings UI toggle** (FR-PH1-05) — `packages/web-client/src/pages/SettingsPage.tsx`. Per-user feature flag `state-machine-renderer-beta` (default false). PATCH `/api/users/me/feature-flags` ile persist. Faz 0 hierarchical-flag infrastructure'ı zaten var, sadece UI gerekiyor.

4. **i18n key'leri** (FR-PH1-07, v1.2 — sadece UI chrome):
   - `settings.renderer_beta.title`
   - `settings.renderer_beta.state_machine_label`
   - `settings.renderer_beta.state_machine_description`
   
   Compartment key'leri **eklenmez** — KARAR-1 v1.2: SysML v2 syntax verbatim.

5. **Integration test fixture** — sensor-systems end-to-end (`packages/diagram-service/tests/integration/state-machine.integration.test.ts`): parse → IR → SModelRoot tek test, fixture'larla doğrula.

### Önemli not — SModelRoot.id wedge uyumluluğu

Renderer şu an `state-machine__${sourceFile}` üretiyor. Legacy `state-transition__${uri}` üretiyor. Frontend bu id'yi opaque kullanıyor (Sprotty internal), parse etmiyor — kontrol et ama büyük olasılıkla sorun değil. Eğer frontend somewhere id format'a bağımlıysa, view-type-mapper'da SModelRoot.id'yi legacy pattern'e map et.

## 5. Slice 2d Hazırlık

### Görevler

1. **Deploy runbook** — Faz 0 deployment runbook pattern'ini takip et (`claude_md_files/phase0_deployment_runbook.md` referans). Bu deploy migration içermez, sadece kod + frontend.

2. **Production smoke** — flag default false. Davranış değişmemeli. `/internal/renderer-stats` izle:
   - byViewType dağılımı önceki snapshot'larla uyumlu olmalı
   - state-transition bucket'ında `old-default` outcome'u kalır (flag false), `unmapped` boşalır (mapper artık dolu)

3. **Dogfooding adımı (Platform Owner manuel)** — Muhlis kendi hesabında flag açar:
   - sensor-systems modelini state-transition view'da aç
   - Yeni renderer çalışmalı, counter'da `state-machine.new` outcome görünmeli
   - Audit checklist tekrar: 10 bug'ın IR/renderer seviyesinde düzelmiş olması
   - Görsel: pseudo-state'ler (●, ⊙), nested Normal/Degraded, "PowerOn via sensor2Platform" temiz label'lar

4. **Final report** — Faz 0 final report pattern'i (`docs/phase-0-final-report.md`).

### Faz 1 deploy gates (architect kararı bekleyebilir)

- Dogfooding period — kaç gün/render Platform Owner flag açık dursun?
- Global default true geçiş kriteri: error rate < X, manual visual confirmation, kullanıcı bug raporu yokluğu

## 6. Açık Mimari Kararlar

### Çözülmüş

- **S1 (empty exit):** Compartment hiç eklenmez. Transformer'da implement edildi (Slice 2a).
- **S2 (pseudo-state encoding):** Legacy CSS class'ları yeniden kullanıldı (`startnode` / `donenode`). Frontend değişikliği yok (önkoşul 4.1).
- **S3 (nested action SM-05):** Seçenek A (sade) — sub-action'lar gizli, sadece parent action adı. Transformer'da implement edildi.
- **S4 (Settings toggle):** 2-state (on/off), null payload → global default. Slice 2c'de UI yapılacak.
- **S5 (edge order):** AST source order — Slice 2a transformer'da implement edildi, Slice 2b renderer korudu.
- **KARAR-1 (translation policy):** v1.2 — SysML v2 syntax verbatim, sadece UI chrome çevrilir. ADR-005 D1 amended.
- **Decisions deferred §1-5:** ADR-005 §Notes — implementasyon sırasında karar verilen 5 nokta (via label format, composite action, empty exit, stereotype prefix, pseudo-state position).
- **Decisions deferred §6:** AST node ID stability — `transition__anon_${offset}` source-fragile, snapshot equality normalize ediyor.

### Bekleyen / İzleme

- **Bug-SM-09 (orphan edge ekran dışı):** Renderer fix etmedi — kök sebep eksik pseudo-state'lerdi, ki artık IR'da var. Slice 2d smoke test'inde tekrar görünür mü kontrol et.
- **Bug-SM-10 (Off↔On yön belirsizliği):** Bug-SM-01 fix'i ile otomatik düzelmesi bekleniyor (label'lar PowerOn/PowerOff). Slice 2d smoke test'inde doğrula.
- **Bug-SM-05 Option A vs B:** Slice 2a'da Option A uygulandı. Slice 2d production smoke'da gerçek hissedilirse Option B (Faz 1.1) düşünülür.
- **Layout determinism (ADR-005 §7):** ELK random.seed Slice 2c veya 2d sırasında explicit set edilebilir — şu an deterministic değil ama snapshot test'lerini etkilemiyor.

## 7. Operating Model Hatırlatıcısı

- **Architect** (sohbet Claude'u): brief yazar, review yapar, mimari karar verir. Bu oturumda 9 directive turu geçti (M3/M4/M5/M6 onayları, KARAR-1 v1.2 değişikliği, S1-5 cevapları, commit pattern, vb.).
- **Antigravity** (sen, AG): implementer + tactical architect, yarı-otonom. Sınır: M7+ veya scope-büyütücü ana bulgular → durup architect'e gel.
- **Platform Owner** (Muhlis): manuel review + merge + Settings UI dogfooding step + production smoke test.
- Brief'ler `claude_md_files/` altında (uncommitted working docs — handover'lar, briefler).
- Audit ve formal docs `claude_md_files/` altında committed olabilir (`state_machine_conformance_audit.md` v2.0.0+ commit'lenmiş durumda).
- ADR'ler `docs/adr/` altında (`005-state-machine-renderer.md`).
- Backlog `claude_md_files/diagram_render_backlog.md` (Bug-RENDER-01).

## 8. Sonraki Oturumda İlk Yapacakların

1. **Bu handover'ı oku** — tam bağlam burada.
2. **Brief v1.2'yi context'e al** (`claude_md_files/renderer_refactor_phase1_brief_v1_2.md`). v1, v1.1 çıkar (yalnız v1.2 geçerli).
3. **`git log --oneline -10`** ile son commit'leri görsel olarak doğrula. HEAD = `2d838ad` olmalı.
4. **`pnpm --filter @systemodel/diagram-service test`** ile baseline'ı çalıştır — 649 test geçmeli (api 340 + diagram 649 + web 128 = 1117 total).
5. **Production durumu kontrol et:**
   ```bash
   ssh root@65.109.134.254 'curl -s http://localhost:3002/internal/renderer-stats'
   ```
   Beklenen: counter doğal artmış, hepsi `old-default + unmapped` (yeni renderer henüz registry'de değil).
6. **Architect kanalından Slice 2c onayı bekle.** Bu handover Slice 2c için detaylı plan içerir, ama implementasyon başlamadan önce architect'in herhangi bir scope/sıra revizyonu olup olmadığını öğren.
7. **İlk dokunulacak dosyalar (Slice 2c başlangıcı):**
   - `packages/diagram-service/src/rendering/view-type-mapper.ts` (mapping ekle)
   - `packages/diagram-service/src/rendering/state-machine/index.ts` (yeni — ViewRenderer object'i export)
   - Wedge bootstrap (muhtemelen `src/index.ts` veya benzer)
   - `packages/web-client/src/pages/SettingsPage.tsx` (toggle UI)
   - `packages/web-client/src/locales/{en,tr}.json` (3 settings key)

## 9. Önemli Dosyaların Konumları

| Tip | Konum |
|---|---|
| Bu handover | `claude_md_files/phase1_slice2_handover.md` |
| Aktif brief | `claude_md_files/renderer_refactor_phase1_brief_v1_2.md` |
| Audit (committed) | `claude_md_files/state_machine_conformance_audit.md` |
| Render backlog (committed) | `claude_md_files/diagram_render_backlog.md` |
| Strategy | `claude_md_files/renderer_refactor_strategy_v2.md` |
| Önceki handover (Slice 1) | `claude_md_files/phase1_slice1_2_handover.md` |
| ADR-005 (committed) | `docs/adr/005-state-machine-renderer.md` |
| Transformer (committed) | `packages/diagram-service/src/rendering/state-machine/transformer.ts` |
| Renderer (committed) | `packages/diagram-service/src/rendering/state-machine/renderer.ts` |
| Transformer test | `packages/diagram-service/src/rendering/state-machine/transformer.test.ts` |
| Renderer test | `packages/diagram-service/src/rendering/state-machine/renderer.test.ts` |
| Integration test | `packages/diagram-service/src/rendering/state-machine/parser-state-machine-integration.test.ts` |
| model.sysml fixture | `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/model.sysml` |
| expected-ir.json fixture | `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-ir.json` |
| expected-smodel.json fixture | `packages/diagram-service/tests/fixtures/state-machine/sensor-systems/expected-smodel.json` |
| StateMachineIR type | `packages/shared-types/src/diagram-ir/state-machine.ts` |
| IRMetadata type | `packages/shared-types/src/diagram-ir/common.ts` |
| ViewRenderer interface | `packages/diagram-service/src/rendering/view-registry.ts` |
| Wedge pipeline | `packages/diagram-service/src/rendering/pipeline.ts` |
| Legacy bdd-transformer | `packages/diagram-service/src/transformer/bdd-transformer.ts` |
| View filters (STV) | `packages/diagram-service/src/transformer/view-filters.ts` |
| DiagramViewer (FE) | `packages/web-client/src/components/Diagram/DiagramViewer.tsx` |
| Faz 0 deployment runbook | `claude_md_files/phase0_deployment_runbook.md` |
| Faz 0 final report | `docs/phase-0-final-report.md` |

## 10. Live Commit Zinciri (chronological)

```
2d838ad Phase 1 Slice 2b: state-machine renderer + SModelRoot fixture        ← HEAD (master, origin)
fd677f4 Phase 1 Slice 2a docs: brief v1.2 + audit amendments + render backlog
330913e Phase 1 Slice 2a: state-machine transformer + IR fixture + ADR-005
74a521a Phase 1 Slice 1 prep B: four state-machine parser fixes              ← LIVE on production
13c3c79 Phase 1 Slice 1 (prep): parser regex + frontend label hook
54dc47f Phase 0 session handover for next AG session
410c6f7 Slice 5: stats bucket = raw legacy ViewType when no mapping exists
507c219 Fix TS build: add missing 'connections' field to SysMLModel test fixture
bbc6c0f Add Phase 0 deployment runbook to claude_md_files/
85fb996 Phase 0 docs: link state machine conformance audit
711141f Renderer refactor Phase 0 (Slice 4): tests, ADRs, architecture, final report
4d3d6f6 Renderer refactor Phase 0 (Slice 3): wedge + observability
a168125 Renderer refactor Phase 0 (Slice 2): API surface
7fecaaf Renderer refactor Phase 0: IR foundation
```

Live: `74a521a`. HEAD master = origin master = `2d838ad`. 4 commit deploy bekliyor (Slice 2a/2b code + docs). Sonraki deploy Slice 2c sonrası ya da Slice 2d'de planlanır.

---

**Özet bekleyen iş:** Architect onayı → Slice 2c (registry registration + view-type-mapper + Settings UI + integration test) → Slice 2c commit + push → Slice 2d (production deploy + dogfooding + audit checklist + final report). Faz 1 close.
