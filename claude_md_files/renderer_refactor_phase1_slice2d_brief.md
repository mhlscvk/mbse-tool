# Brief: Faz 1 Slice 2d — Deploy + Dogfooding + Final Report

## 1. Bağlam

Slice 2a + 2b + 2c commit'leri master'da, deploy bekliyor. Production hâlâ Slice 1 prep B (`74a521a`) — yeni transformer + renderer + registry wiring + Settings UI **kodda var, prod'da yok**.

Bu slice **Faz 1'in kapanışı**:
1. Code deploy → davranış değişmez (env var default false)
2. Self-dogfood → sen prod'da yeni renderer'ı gözle gör
3. Env var flip → global true, tüm kullanıcılar yeni renderer'ı görür
4. Final report → Faz 1 sonu, Faz 2 hazırlığı

**Aciliyet:** Düşük. Faz 1 deploy edilmese de production stable. Ama 5 commit deploy beklemekten daha fazla beklememeli.

**Tahmini süre:** 2-3 saat.

## 2. Stratejik Karar (Architect tarafından verildi)

**Yol C — Env Var Flip (Compromise).** Brief v1.2 KARAR-2 "dogfooding flag" tasarımı şu an structural olarak çalışmıyor (Settings toggle DB'ye yazıyor ama WS auth yok, EnvFlagProvider env var okuyor). Iki yol vardı:

- **A:** Sadece env var flip — per-user toggle ölü kalır, herkes etkilenir
- **B:** WS auth + HierarchicalFlagProvider yaz — ~1-2 gün scope creep
- **C:** Env var flip şimdi, WS auth Slice 2e olarak Faz 1.1'e — **seçildi**

**Gerekçe:** Yeni renderer test kapsamı yeterli (1122 test, audit'in 10 bug'ı tip + IR + SModelRoot seviyesinde adreslendi). State-transition view trafiği düşük (%4-25), yan etki sınırlı. Real-world feedback hemen başlar. WS auth (Slice 2e) sonradan eklenir, per-user opt-in/out o zaman gelir.

## 3. Hedef

Faz 1 production'da, yeni renderer aktif, tüm state-transition view'larında çalışıyor. Final report yazılı, Faz 2 brief'i için veri toplama başladı.

## 4. Önkoşullar

### 4.1. Mevcut env var sistemi
- `EnvFlagProvider` `RENDERER_FLAG_*` prefix'li env var'ları okuyor (Faz 0)
- `state-machine-new-renderer` flag adı tanımlı (`RENDERER_FLAGS` constant)
- Env var: `RENDERER_FLAG_state-machine-new-renderer=true` global default'u açar
- Yokluğunda fallback: `false`

### 4.2. PM2 ecosystem config
- `/opt/systemodel/ecosystem.config.cjs` env var'ları taşıyor
- `pm2 reload ecosystem.config.cjs --update-env` env var değişikliğini uygular

### 4.3. Test fixture'lar
- Sensor-systems fixture (`tests/fixtures/state-machine/sensor-systems/`) prod'da yok ama test'lerde
- Self-dogfood için **gerçek user model'leri** kullanılacak — Muhlis'in mevcut SensorSystem.sysml, TestStates.sysml gibi

## 5. Fonksiyonel Gereksinimler

### FR-2D-01: Code Deploy (Env Var Default False)

5 commit'i production'a al, env var **default false** ile:
1. `git pull origin master` (5 commit zinciri: 13c3c79 → 0e86a76)
2. `pnpm install --frozen-lockfile`
3. `pnpm build`
4. `pm2 reload ecosystem.config.cjs --update-env`

**Beklenen davranış:** Hiçbir kullanıcı için yeni renderer aktif değil. `byViewType` bucket'ları hâlâ `old-default` outcome'unda. Sayaç davranışı değişmez.

**Doğrulama:**
- `/api/health`, `/api/ready` yeşil
- `/internal/renderer-stats` snapshot al — `new` outcome'u yok olmalı
- PM2 log'larında yeni hata yok
- Settings UI'da Renderer Beta bölümü görünür (toggle çalışır ama backend'e ulaşan etkisi yok henüz)

### FR-2D-02: Self-Dogfood (Production'da)

**Platform Owner manuel adımları:**

1. **Production'da env var'ı geçici aç** (sadece test için):
   ```bash
   ssh root@65.109.134.254 'cd /opt/systemodel && RENDERER_FLAG_state-machine-new-renderer=true pm2 reload diagram --update-env'
   ```
   Veya ecosystem.config.cjs'i bir saat için flip et.

2. **Browser'da hard refresh** ile yeni session aç:
   - https://systemodel.com
   - SensorSystem.sysml veya başka state machine modeli aç
   - **State Transition view'a** geç (STV)
   - Render'ı gözle

3. **Audit checklist'i tekrarla** (state_machine_conformance_audit.md'deki 10 bug):
   - SM-01: Trigger label sadece event ismi (PowerOn, not ItemDefs::PowerOn)?
   - SM-02: `via <port>` modifier görünür?
   - SM-03: Bodyless state (Off, Error) görselde?
   - SM-04: Pseudo-state'ler (initial, final) UML standard?
   - SM-05: Composite action sade gösterim (activation only, sub-action'lar gizli)?
   - SM-06: On state'in tüm compartment'ları (entry/do/exit)?
   - SM-07: Sub-state'lerin (Normal, Degraded) action'ları?
   - SM-08: 11/11 transition görünür?
   - SM-09: Orphan edge yok, viewport içinde?
   - SM-10: Paralel transition'lar (Error→Off iki ayrı ok)?

4. **Karşılaştırma:**
   - Eski state-transition view (env var false) ile yeni (env var true) ekran görüntüleri
   - Görsel kanıt FR-2D-04 final report'ta kullanılacak

5. **Counter doğrulama:**
   ```bash
   ssh root@65.109.134.254 'curl -s http://localhost:3002/internal/renderer-stats | jq .'
   ```
   - `byViewType['state-machine'].new` artmış olmalı
   - Diğer view'lar (general, interconnection) hâlâ `old-default`

### FR-2D-03: Env Var Flip (Production Kalıcı)

**Eğer FR-2D-02 temiz:**

1. `ecosystem.config.cjs` güncellenir:
   ```javascript
   env: {
     // ...
     RENDERER_FLAG_state_machine_new_renderer: 'true',
     // veya: RENDERER_FLAG_state-machine-new-renderer hangi format env tarafından destekleniyorsa
   }
   ```

2. Commit ve push:
   ```bash
   git add ecosystem.config.cjs
   git commit -m "Phase 1 Slice 2d: enable state-machine renderer globally"
   git push origin master
   ```

3. Production reload:
   ```bash
   ssh root@65.109.134.254 'cd /opt/systemodel && git pull && pm2 reload ecosystem.config.cjs --update-env'
   ```

4. **5-15 dakika gözlem:**
   - `/internal/renderer-stats` çoğu `state-machine` render `new` outcome'unda
   - PM2 log'larında yeni hata yok
   - SSE/WS bağlantıları stabil

**Eğer FR-2D-02 bozuk (yan etki, görsel regression, performance):**

- Env var'ı kapat
- Bug'ı analiz et, AG'ye yeni brief (Faz 1.1 veya hotfix)
- Slice 2d şu noktada durur, transformer/renderer fix sonrası tekrar denenir

### FR-2D-04: Final Report

`docs/phase-1-final-report.md` (yeni dosya, Faz 0 final raporu pattern'inde):

**İçerik:**

1. **Özet:** Faz 1 nedir, ne yapıldı, ne yapılmadı
2. **Commit zinciri:** 6 commit (Slice 1 prep + Slice 1 prep B + Slice 2a + Slice 2a docs + Slice 2b + Slice 2b handover + Slice 2c + Slice 2d)
3. **Test deltası:** Faz 0 sonu 1086 → Faz 1 sonu (Slice 2c sonrası) 1122 test
4. **Audit bug regression:** 10 bug'ın her birinin durumu (çözüldü/kısmen/Faz 1.1'e ertelendi)
5. **Görsel kanıtlar:** Eski vs yeni state-transition render ekran görüntüleri (FR-2D-02'den)
6. **Production durumu:** Live commit, env var durumu, counter snapshot
7. **Açık konular (Slice 2e için):**
   - WS auth + HierarchicalFlagProvider — per-user opt-in/out çalışmıyor
   - Bug-RENDER-01 (state cleanup on model switch) — backlog'da
   - Layout determinism (ADR-005 §7) — gözlemlendi, hint sistemine ihtiyaç olabilir
   - SM-05 nested action Seçenek B (eğer prod kullanıcısı feedback verirse)
8. **Faz 2 hazırlık:** BDD renderer için audit yapma zamanı (general view veya BDD-specific?)
9. **Lessons learned:**
   - Audit metodolojisi evrilmesi (observation + diagnosis ayrımı)
   - Slice 1 prep B'nin yan etkisi (parser fix tüm view'ları iyileştirdi)
   - Translation policy (SysML v2 syntax verbatim)
   - Per-user dogfooding altyapısı eksik kalması (WS auth gap)

### FR-2D-05: Audit Doc Final Güncelleme

`claude_md_files/state_machine_conformance_audit.md`:

- Her bug için **final status** ekle: "Çözüldü (Slice 2c commit d8fabe6 + global env var flip Slice 2d)" veya "Faz 1.1'e ertelendi"
- 10 bug'ın hepsinin "Test ile doğrulama" satırı eklenmiş olmalı (transformer.test.ts, renderer.test.ts, end-to-end.test.ts referansları)
- Lesson note (top-of-doc) güncellenir: Faz 1 deneyimi eklenir

## 6. Non-Functional Gereksinimler

### NFR-2D-01: Rollback Plan
- Eğer FR-2D-02'de görsel regression → env var off
- Eğer FR-2D-03 sonrası prod'da issue → env var off, commit rollback gerek yok (sadece env var)
- Backup: pre-deploy DB snapshot Faz 0'da yapıldı, hâlâ geçerli (`/root/backup/pre-phase0-20260515-192257.sql`)

### NFR-2D-02: Observability
- Self-dogfood + global flip arasında en az 30 dakika gözlem
- Counter snapshot her aşamada alın (pre-deploy, post-deploy false, post-flip true)
- PM2 log'lar her aşamada temiz (yeni error yok)

### NFR-2D-03: Documentation Drift
- ADR-005 son güncelleme — herhangi bir Slice 2d implementation kararı
- Brief v1.2 son durumu yansıtmalı (eğer scope değişikliği olursa v1.3)

## 7. Kabul Kriterleri

### Code Deploy (FR-2D-01)
- [ ] 5 commit production'da (HEAD = `0e86a76` veya sonrası)
- [ ] `/api/health`, `/api/ready` yeşil
- [ ] PM2 3 servis online
- [ ] Counter: `new` outcome'u yok (env var default false)
- [ ] Settings UI'da Renderer Beta bölümü görünür

### Self-Dogfood (FR-2D-02)
- [ ] Geçici env var ile yeni renderer aktif
- [ ] State-transition view'da audit checklist 10 bug için kontrol edildi
- [ ] En az 1 model (örn. SensorSystem.sysml) yeni renderer ile render oldu
- [ ] Counter: `byViewType['state-machine'].new > 0`
- [ ] Ekran görüntüleri (eski vs yeni) alındı

### Global Flip (FR-2D-03)
- [ ] `ecosystem.config.cjs` env var ile commit'lendi
- [ ] Production'a deploy edildi
- [ ] 5-15 dakika gözlem temiz (yeni hata yok)
- [ ] Counter çoğunluğu `new` outcome'unda

### Final Report (FR-2D-04)
- [ ] `docs/phase-1-final-report.md` yazıldı
- [ ] Audit doc final status'leri eklenmiş
- [ ] Görsel kanıtlar dahil
- [ ] Lessons learned bölümü dolu

### Behavior Preservation
- [ ] Flag kapalı kullanıcılar için davranış birebir aynı (env var test sırasında)
- [ ] Diğer view'lar (general, interconnection) etkilenmedi
- [ ] Bundle size aşımı yok (NFR-PH1-01 sınırları)

## 8. Kısıtlar

- WS auth + HierarchicalFlagProvider Slice 2e'ye ertelendi — bu slice'ta yapılmıyor
- Per-user Settings toggle **çalışmaya devam ediyor** ama backend'de etki etmiyor (cosmetic only)
- Settings UI bug değil — Slice 2e'de DB-backed reader ile bağlanacak
- Migration yok, sadece env var değişikliği

## 9. Deliverable Listesi

### Configuration
1. `ecosystem.config.cjs` (env var update)

### Documentation
2. `docs/phase-1-final-report.md` (yeni)
3. `claude_md_files/state_machine_conformance_audit.md` (final status updates)

### Deploy Artifacts (otomatik)
4. Git commit: `Phase 1 Slice 2d: enable state-machine renderer globally`
5. Production deploy log

### Görsel
6. Ekran görüntüleri (eski vs yeni state-transition render) — Final report'a ekli

## 10. Sıra Önerisi

1. **Code deploy** (env var default false) — 5 commit prod'a iner
2. **Smoke test** — health/ready/stats counter
3. **Geçici env var ile self-dogfood** — sen browser'da gözle gör, 30 dk gözlem
4. **Karar:** Temiz mi? → 5. adım. Bozuk mu? → DURU, Slice 2e veya hotfix
5. **Global flip** — ecosystem.config.cjs commit, prod'a deploy
6. **15 dakika gözlem** — counter, PM2 log, SSE/WS stability
7. **Audit doc + Final report yaz**
8. **Commit + push final docs**

## 11. Slice 2e Hazırlık (Faz 1.1)

Bu slice'tan sonra **Slice 2e brief'i** yazılacak:

**Scope:**
- WebSocket auth (JWT token validation on WS connect)
- `HierarchicalFlagProvider` (DB-backed user flag layer + env var fallback)
- Settings toggle gerçekten etki eder
- Per-user dogfooding/opt-out

**Süre:** ~1-2 gün
**Öncelik:** Faz 1.1, Faz 2 başlamadan önce

## 12. Açık Sorular (Implementation Sırasında)

**S-2D-1:** Env var format — `RENDERER_FLAG_state-machine-new-renderer` ile `RENDERER_FLAG_state_machine_new_renderer` arasında hangi format? `EnvFlagProvider`'ın `getFlag()` implementasyonunu kontrol et. Dash mı underscore mu beklediği önemli.

**S-2D-2:** Ecosystem.config.cjs'in env section'unda zaten başka `RENDERER_FLAG_*` var mı? Yoksa pattern'i takip et, yeni ekle.

**S-2D-3:** Self-dogfood için **session-level env var** mı vermeli, yoksa **ecosystem'i geçici update** mu? Önerim: `pm2 reload ... --update-env` ile session-level (ecosystem.config.cjs commit etme), test sonrası ya geri al ya da kalıcı flip ile commit.

Bu sorular implementation'u block etmez, AG kendisi en iyi karar verir.

## 13. Süre Tahmini

**İndikatif:** 2-3 saat.

- Code deploy + smoke: 30 dk
- Self-dogfood gözlem: 30-45 dk
- Karar + global flip: 15 dk
- Final report yazımı: 1-1.5 saat (görsel ekleme, audit doc update, lessons learned)
