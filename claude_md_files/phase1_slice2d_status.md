# Faz 1 Slice 2d — Status & Self-Dogfood Reproduce Notu

**Son güncelleme:** 2026-05-23 (code deploy başarılı, self-dogfood bug ortaya çıkardı, flag kapatıldı, root cause kanıtlandı)
**Branş:** master
**HEAD (push'lanacak):** bu commit — `Phase 1 Slice 2d status: self-dogfood reproduce + root cause`
**Live commit (production):** `9b43279` (Slice 2c + brief; deploy edildi)
**Brief:** `claude_md_files/renderer_refactor_phase1_slice2d_brief.md` (S-2D-1/B1/B2 düzeltmeleri bu doc'ta canonical)
**Önceki handover:** `claude_md_files/phase1_slice2_handover.md` (Slice 2 a+b)

---

## 1. TL;DR — Nerede Kaldık

Slice 2d **code deploy başarılı** — 5 commit (`74a521a → 9b43279`) production'da, env var **default false** (davranış nötr). Self-dogfood için flag geçici açıldı, **yeni renderer gerçek SensorSystem.sysml'de crash etti**, wedge legacy'ye düştü (strangler-fig safety net), kullanıcı zarar görmedi. Flag tekrar kapatıldı. Root cause reproduce ile kesin kanıtlandı.

**Sonraki adım:** Slice 2d.1 hotfix (transformer root-finding refactor). Architect brief'i yazacak.

## 2. Code Deploy — Başarılı

- **Delivery:** `git push origin master` (`0e86a76 → 9b43279`), prod `git pull origin master` fast-forward `74a521a → 9b43279`.
- **Build:** per-package (shared-types → api-server `npx tsc || true` → diagram-service → web-client), **`pnpm build` (turbo) KULLANILMADI** çünkü api-server'ın pre-existing TS hataları turbo'yu HALT ediyor. `deploy.sh:182-187` pattern'i.
- **Migration:** yok (kod-only, schema değişmedi).
- **Smoke:** `/api/health`, `/api/ready`, diagram `/health`+`/ready` hepsi yeşil; 3 servis online.
- **Stale red herring:** diagram-error.log'da `Cannot find module '../../package.json'` izi var ama **2026-05-10'dan** (pm2_dist_paths fix öncesi); bugünkü deploy'a ait değil, mevcut kod `process.cwd()` kullanıyor.

## 3. Brief Düzeltmeleri (canonical — brief v1.3'e girecek)

Brief'in §4 ve §12 varsayımları yanlıştı:

- **S-2D-1 (env var formatı):** Kod `RENDERER_FLAG_*` DEĞİL `FF_` prefix kullanıyor. `EnvFlagProvider.isEnabled()` (`getFlag()` değil), `feature-flags.ts:30`: `FF_${flag.toUpperCase().replace(/-/g,'_')}`. **Doğru env var: `FF_STATE_MACHINE_NEW_RENDERER=true`**.
- **B1 (build):** `pnpm build` = `turbo run build` → api-server TS exit 2'de HALT eder. Per-package build + api-server `tsc || true` şart.
- **B2 (git delivery):** `deploy.sh`'ın `REMOTE_BRANCH=claude/onedrive-local-integration-GtEz8` STALE (o branch tamamen master'ın içinde). `deploy.sh` ayrıca `git add -A` yapıyor (untracked brief'leri süpürür). **Kullanma** — düz `git push origin master` + prod `git pull origin master`.
- **PM2 env gotcha:** Düz `pm2 restart diagram` önceki `--update-env` ile cache'lenen env'i KORUR (flag açık kalır). Gerçek reset: `pm2 delete diagram && pm2 start ecosystem.config.cjs --only diagram`. Doğrulama `pm2 env` ile DEĞİL `/proc/$(pm2 pid diagram)/environ` ile (pm2 env false-negative veriyor).

## 4. Self-Dogfood — Bug Ortaya Çıktı

**Counter kanıtı (smoking gun):**
```
byViewType.state-machine: { new: 1, old-fallback-from-new: 2 }
```
- `new:1` = sentetik test (basit Off/On modeli, ws://localhost:3002/diagram → `rendererUsed:new`, `smodel.id: state-machine__...`)
- `old-fallback-from-new:2` = browser Claude'un 2 SensorSystem açılışı → yeni renderer fırlattı → wedge legacy fallback → **görsel birebir aynı** (kullanıcı eski render gördü, "fark yok" bu yüzden)

**Browser Claude'un "dead code / backend çağrılmıyor" hipotezi YANLIŞ.** Frontend WS kullanıyor (`diagram-client.ts:42` `new WebSocket(.../diagram)`, `EditorPage.tsx:742` server-side parse). WS bağlantıları Network tab'ın "WS" filtresinde, "fetch/xhr"de değil — browser Claude xhr listesine baktığı için kaçırdı. Client-side parser YOK (`web-client` sadece `elkjs` layout için).

## 5. Root Cause — Kanıtlandı

**Tam stacktrace (reproduce):**
```
TypeError: Cannot set properties of undefined (setting 'compartments')
    at transformAstToStateMachineIR (transformer.ts:206:12)
```

**AST analizi (gerçek SensorSystem.sysml):**
```
StateDefinition: 0   ← HİÇ YOK
StateUsage: 12       [SensorSystemStates, On, Normal, Degraded, DeliverSSStates, On, Off, ...]
transition: 9 · composition: 111 · parse diagnostics: 5
```

**Yapı:** `package { part def { part : X { state SensorSystemStates { state On { state Normal {...} }}}}}` — state machine bir **`part`'ın içine `state` USAGE olarak gömülü**, standalone `state def` DEĞİL. Bu idiomatic SysML v2 / MagicGrid pattern'i.

**Mekanizma:** `transformer.ts:162-166`:
```typescript
const stateDef = model.nodes.find(isStateDef);   // isStateDef = kind==='StateDefinition'
if (stateDef) { emitContainer(stateDef.id); }     // StateDefinition=0 → HİÇ çağrılmıyor
```
→ `irNodes` boş, `stateIrIdByAstId` boş → compartment loop (`:181`) `irNodes.find(...)!` her StateUsage için `undefined` → `:206` `irNode.compartments=` crash. `find()!` non-null assertion yalan.

**Neden testler geçti:** Fixture (`sensor-systems/model.sysml`) `state def SensorSystemStates` (StateDefinition) kullanıyor. Gerçek model `state SensorSystemStates` (StateUsage in part). Fixture izole-def varsayımı kavram hatasıydı.

## 6. Hotfix Scope — DERİN (Slice 2d.1)

`find()!` guard tek başına YETERSİZ — crash'i önler ama boş diagram üretir (state'ler emit edilmez), wedge throw görmez, fallback yapmaz → kullanıcı boş STV görür (fallback'ten beter).

**Architect'in onayladığı hotfix planı (yarın):**
1. **Root-finding = view-filter integration:** Legacy `view-filters.ts:filterStateTransitionView` "STV scope" sorusunu zaten çözüyor. Transformer'ı **filtered AST ile besle**, kendi root-finding'ini yapma. Davranış paritesi + View-First prensibi.
2. **Multi-root support:** SensorSystem'de iki bağımsız state machine var (SensorSystemStates + DeliverSSStates). Transformer çoklu root seed desteklemeli.
3. **Defense-in-depth:** `find()!` guard, boş IR no-op, anlamlı log (asıl fix değil, savunma).
4. **New fixture:** gerçek SensorSystem'in minimal **anonimize** subset'i (part def SystemContext→PartA, SensorSystemStates→States1, business logic yok, sadece pattern). Repo'ya commit edilebilir (IP değil).
5. **Tests:** transformer + renderer + end-to-end, hem mevcut fixture hem yeni fixture geçer.
6. **Re-deploy + re-self-dogfood**, sonra global flip kararı.

**Tahmin:** 4-6 saat (root-finding refactor + scoping + anonimize fixture + test en yoğun).

## 7. Production Durumu (session sonu)

- **Live commit:** `9b43279` (Slice 2c + brief + Slice 2d code).
- **Flag:** KAPALI (`pm2 delete + start ecosystem` ile temiz reset, `/proc` env'de FF_ yok).
- **Counter:** restart sonrası sıfır; yeni STV render'ları `old-default` (eski pipeline, davranış nötr).
- **Servisler:** api/lsp/diagram online.
- **Kullanıcı etkisi:** YOK — herkes eski (legacy) STV render'ını görüyor, deploy öncesiyle birebir aynı.

## 8. Reproduce Artifact'leri

- `packages/diagram-service/scripts/reproduce-sensor-bug.ts` — **commit edildi**, gitignore'dan çıkarıldı. Bir model dosyasını `scripts/sensorsystem-real.sysml`'den okur; dosya yoksa anlamlı mesaj verir. Yarın anonimize fixture ile çalışacak.
- `packages/diagram-service/scripts/sensorsystem-real.sysml` — **gitignored + session sonunda SİLİNDİ** (Muhlis'in gerçek model IP'si, sadece bugünkü reproduce için kullanıldı). DB id `cmolrsqrq002oglb7a41d5fz5`, sahibi muhliscevik@outlook.com, proje "Deneme".

## 9. Storage Detayı (gelecek reference)

- SysML dosyaları **DB-stored:** `sysml_files.content` (`@db.Text`), columns camelCase (`"projectId"`), PostgreSQL container `systemodel-db`, user `postgres`, db `systemodel`.
- Çekme: `docker exec systemodel-db psql -U postgres -d systemodel -tAc "SELECT content FROM sysml_files WHERE id='...';"`

## 10. Strangler-Fig Validation

Faz 0 mimari yatırımı bugün karşılığını verdi: yeni renderer crash etti → wedge legacy'ye düştü → **kullanıcı zarar görmedi**. Counter sistemi (Slice 5) bug'ı `old-fallback-from-new` bucket'ıyla yakaladı. Self-dogfood production'a global flip'ten ÖNCE gerçek bir bug'ı ortaya çıkardı — iki aşamalı deploy'un (Yol C) tam amacı.

## 11. Sonraki AG Session — İlk Adımlar

1. **Bu handover'ı oku** — tam bağlam burada.
2. **`git log --oneline -10`** — HEAD bu status commit'i olmalı.
3. **Architect'in Slice 2d.1 hotfix brief'ini bekle** (root-finding via view-filter integration + multi-root + anonimize fixture).
4. Brief gelince başla. İlk dokunulacak: `transformer.ts:162-166` (root-finding), `view-filters.ts:filterStateTransitionView` (scope), yeni anonimize fixture.
