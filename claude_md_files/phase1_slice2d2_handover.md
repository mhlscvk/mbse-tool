# Faz 1 Slice 2d.2 — Close-Out & Continuation Handover

**Son güncelleme:** 2026-05-24 (Slice 2d.2 KAPALI, view-filter integration production'da, no-op flip permanent)
**Branş:** master
**HEAD:** `dec3470` + bu commit (close-out + handover)
**Production HEAD:** `dec3470` ✓
**Önceki handovers:** `claude_md_files/phase1_slice2d1_handover.md`, `claude_md_files/phase1_slice2d3_handover.md`

---

## 1. TL;DR — Slice 2d.2 KAPALI, State-Machine Refactor Zinciri Tamam

View-filter integration yapıldı. `pipeline.ts:95` öncesi `applyViewFilter` çağrısı eklendi (DP1=b, new-path-only). Legacy `bdd-transformer.ts:616` dokunulmadı (59 test bağımlı). Asimetri output seviyesinde çözüldü, View-First prensibi tamamlandı.

**Görsel etki:** SIFIR (no-op flip). Filter `pseudo-initial__on`'u IR'dan siliyor, mevcut yeni renderer onu zaten çizmiyordu → kullanıcı için fark yok, mimari iyileşme net.

**Snapshot mimarisi:** Split — raw golden (transformer isolation testleri, byte-identical) + filtered golden (yeni, wedge testleri). Test piramidi seviyesi → kendi golden'ı.

**Test:** 1138 → 1142 (+4 integration test, sıfır regression).

**Production:** Permanent — yeni FF gerekmedi (mevcut `FF_STATE_MACHINE_NEW_RENDERER` Slice 2d.1'den aktif). Tarayıcı dogfood: görsel PRE ile birebir aynı (DOM programatik teyit, `pseudo-initial` count = 0). Counter: 343 STV render geçti deploy'dan sonra, hepsi yeni renderer + filter, fallback 0.

**State-machine refactor zinciri tam tamamlandı:**
- Slice 2d.1: Multi-root crash çözüldü (multi-seed root finding)
- Slice 2d.3: Container labels eklendi (A′ yaklaşımı, IR şeması korundu)
- Slice 2d.2: View-filter integration (View-First output seviyesinde tamam)

---

## 2. Bugün (2026-05-24) Yapılanlar

### Commits (master, push edildi)

```
<dec3470+>  Phase 1 Slice 2d.2: close-out narrative + handover (bu commit)
dec3470  Phase 1 Slice 2d.2: ADR-005 Decision 5 / D-FILTER-01
1f161b8  Phase 1 Slice 2d.2: +4 integration tests
ef3db82  Phase 1 Slice 2d.2: integrate view-filter into new-renderer path + filtered goldens
7df6cc6  Phase 1 Slice 2d.2: brief v1.0 (view-filter integration)
be61b21  Phase 1 Slice 2d.3: close-out narrative + handover
... (Slice 2d.3, Slice 2d.1)
```

### Slice 2d.2 Adım-Adım (özet)

**Adım 0a — Discovery (AG):** 
- Wedge integration mechanics (`pipeline.ts:95-109`)
- Filter çağrı sitesi haritası (`transformToBDD:616`, 59 test bağımlı)
- multi-root no-op kanıtı (entry action yok)

**Adım 0b — Pre-impl POC (AG):** 
- Geçici script ile filter sonrası SModel output üretildi
- sensor-systems IR diff: 16→15 nodes, 22→20 edges (`pseudo-initial__on` + 2 edge siliniyor)

**3 Karar Noktası (Architect):**
- **DP1:** (b) new-path-only filter, transformToBDD dokunulmaz
- **DP2:** Platform Owner görsel ön-kabul gerekli (subjektif SysML semantik kararı, Tarayıcı görsel otorite **istisna** — operating model nüansı)
- **DP3:** (a) lokal patch + Platform Owner direkt görsel inceleme

**Pre-impl Visual Preview (AG + Platform Owner):**
- AG geçici patch + lokal stack (Docker DB + pnpm dev) + WS smoke ile lokal stack'in gerçekten POST servis ettiği ampirik kanıtı
- Platform Owner lokal POST (localhost:5173) vs prod PRE (systemodel.com) side-by-side
- **Birebir aynı görüntü → mevcut yeni renderer `pseudo-initial__on`'u zaten çizmiyor**
- DP2 KABUL ✓

**Brief v1.1 (Architect):** DP kararları + 3 atomic commit planı

**AG Snapshot Mimarisi Keşfi (4. Architect failure mode):**
- Brief'in "regen" direktifi 3 test sitesini paylaşılan snapshot ile uyumsuz
- 3 seçenek: regen+test güncelle / split / regen+coverage kaybı
- **Architect karar:** Split (test piramidi seviyesi → kendi golden'ı)

**Implementation (3 atomic commit):**
- Filter integration + 2 filtered golden + wedge test redirect (ef3db82)
- +4 integration test (1f161b8)
- ADR-005 D-FILTER-01 (dec3470)
- Test: 1138 → 1142

**Deploy (AG, brief v1.3 §3.1 canonical):**
- Production HEAD sürprizi: 3301417'deydi, ancestor check ile fast-forward kanıtlı
- 4/4 build EXIT 0
- /proc env cross-check ✓
- pid 2809610, ↺=0

**Self-Dogfood (Karar 3):**
- Counter: 343 STV render, fallback 0
- Tarayıcı: DOM programatik teyit (`pseudo-initial` count = 0), no-op flip görsel kanıt
- Log: sessiz, `[Wedge] threw` yok
- **Kanıt üçgeni hizalı → Slice 2d.2 KAPALI**

---

## 3. Yeni Kazanılan Lessons Learned (Brief v1.4'e Geçecek — Detaylı Liste)

### 1. Anti-pattern: Refactor/regen iddiası, bağımlılık verification olmadan (4. tekrar)

Tek slice'ta dört Architect failure mode:
- Slice 2d.1: "filter integration zorunlu" iddiası
- Slice 2d.3 v1.0: "Sprotty group decorator" iddiası
- Slice 2d.2 v1.0: "Legacy filter cleanup" iddiası (59 test bağımlı)
- Slice 2d.2 v1.1: "sensor-systems snapshot regen" iddiası (3 test sitesi paylaşıyor)

**Pattern aynı:** Brief'te "X kaldırılır/değiştirilir" iddiası → kim çağırıyor, kaç test bağımlı **verification yapılmadan**.

**Önlem (canonical):** Brief yazımında her "X dokunulacak/kaldırılacak" iddiası için **`grep -r "X" .` veya equivalent ile çağrı sitesi haritası** yapılmalı. AG'nin Adım 0 keşfi bu haritayı zorunlu kılar.

### 2. Anti-pattern: IR diff'ten görsel sonuç çıkarma

Brief v1.0'da AG'nin POC IR diff'inden DP2 problemi çıkarttık (`pseudo-initial__on` silinmesi = "On'un initial sub-state'i kayıp"). **Görsel kontrol bunu çürüttü** — mevcut renderer o node'u zaten çizmiyordu.

**Önlem (canonical):** Subjektif görsel kararlar **gerçek render üzerinde** yapılır, IR'dan extrapolation değil. Pre-impl visual preview pattern bunun çözümü.

### 3. Pre-impl Visual Preview Pattern (CANONICAL)

Slice 2d.2'de doğdu, kanıtlandı:
1. AG geçici patch yazar (clearly-marked, push edilmez)
2. AG lokal stack çalıştırır (Docker DB + pnpm dev)
3. AG WS smoke ile lokal stack'in gerçekten patch'i servis ettiğini ampirik kanıtlar
4. Platform Owner lokal POST vs prod PRE side-by-side görsel inceleme yapar
5. Kabul → impl başlar; Reddet → vazgeç (sıfır rollback maliyeti)

Görsel davranış değişikliği riski olan tüm gelecek slice'larda kullanılacak.

### 4. Yeni Operating Model Nüansı

**Tarayıcı Claude görsel otorite ölçülebilir kriterler için.** Subjektif semantik kararlar (örn. "X SysML spec'ine uygun mu") Platform Owner'a devredilir.

**Tarayıcı'nın bonus disipline'i: Programatik DOM teyit.** "Görsel olarak görmedim" değil, DOM seviyesinde element sayısı saymak. Yanlış pozitif elemine için parent ID'leri kontrol etmek. Görsel sezgiden çok daha güvenilir kanıt.

### 5. Pre-deploy tsc Verification (CANONICAL)

Pre-commit hook esbuild kullanıyor, type checking yapmıyor. AG **deploy öncesi** `pnpm build` ile tsc çalıştırmalı, production build'inin geçeceğini ön-doğrulamalı.

### 6. Production HEAD Sürpriz Disipline (CANONICAL)

Production HEAD beklenmedik ise:
1. Ancestor check (mevcut HEAD pull edilecek HEAD'in atası mı?)
2. Fast-forward kontrolü
3. Runtime impact analizi (doc-only mi, code mi?)
4. Eğer fast-forward + runtime-safe → devam et
5. Aksi takdirde DUR + Architect koordinasyonu

### 7. Snapshot Mimarisi Disipline

Test piramidi seviyesi (transformer isolation / wedge end-to-end) → **kendi golden dosyası**. Paylaşılan snapshot mimarisi katmanlar arası bağımlılık yaratır, mimari sağlığa aykırı.

---

## 4. Açık Konular (Sıradaki Slice Candidate'lar)

**Yarın için (öncelik sırası Architect kararı):**

### Brief v1.4 (lessons learned canonical)

Slice 2d.1 + 2d.3 + 2d.2'den biriken tüm pattern'ler ve anti-pattern'ler. Yukarıdaki §3'teki 7 lesson learned + v1.3'teki mevcut anti-pattern'ler birleştirilir. ~45 dk doc work.

**Tahmini içerik:**
- Anti-patterns katalogu (mevcut + yeni 2)
- Yeni canonical pattern'ler (Pre-impl visual preview + Pre-deploy tsc + Production HEAD sürprizi + Snapshot mimarisi + DOM programatik teyit)
- Operating model: Three-Claude orchestration (Architect + AG + Tarayıcı + Platform Owner roller, yeni nüans dahil)
- Karar noktası tabanlı checkpoint pattern (Slice 2d.1 → 2d.3 → 2d.2 evrim)

### Faz 1 Final Report

Slice 1 → 1 prep B → 2a → 2b → 2c → 2d → 2d.1 → 2d.3 → 2d.2 → kapanış. Bütünsel bakış, Faz 2 hazırlığı.

**Tahmini içerik:**
- Faz 1 kapsamı + amaç
- Slice-by-slice özet (10 slice)
- Mimari kazanımlar (strangler-fig, counter sistemi, IR layer, view registry, multi-seed root finding, container labels, view-filter integration)
- Üçlü orchestration olgunluğu
- Faz 2 candidate'ları (legacy renderer kaldırma, yeni view type'ları, WS auth)

**Tahmini süre:** 1-2 saat

### Backlog'da bekleyen

- **Bug-RENDER-01:** Frontend state cleanup on model switch
- **Slice 2e (Faz 1.1):** WS auth + HierarchicalFlagProvider, per-user dogfood
- **Security B1/B2/B3:** Post-Faz 1
- **Bug-PRISMA-01:** prisma seed-examples gitignore (operasyonel temizlik)
- **Bug-RENDER-03 (eğer talep gelirse):** Container'lar için region/dashed stili (Slice 2d.3 A′ sade composite-state kullanıyor)
- **Yeni candidate (Slice 2d.2 dogfood'undan):** Sub-state pseudo-initial daire çizimi (yeni renderer'da implement edilmemiş — `pseudo-initial__on`, `pseudo-initial__top` görsel desteği eksik)

---

## 5. Production Durumu (Slice 2d.2 sonrası)

- **HEAD:** dec3470 (+ close-out commit, bu)
- **pm2:** api (35h+) + lsp (34h+) + diagram (pid 2809610, uptime ~30+ dk, online, ↺=0)
- **Env:** `FF_STATE_MACHINE_NEW_RENDERER=true` config-driven ✓ (Slice 2d.1'den permanent), `NODE_ENV=production` ✓
- **Counter:** `state-machine.new` artan, fallback 0, production aktif kullanım
- **Monitor:** Kapatıldı (Slice 2d.2 dogfood polling sonrası)

---

## 6. Önemli Dosyalar (Sıradaki Slice İçin)

### Kod (mevcut, değişmedi)

| Path | Sorumluluk | Slice 2d.2'de değişti? |
|------|-----------|----------------------|
| `packages/diagram-service/src/rendering/pipeline.ts:95-109` | Wedge + view-filter integration | ✓ (filter eklendi) |
| `packages/diagram-service/src/transformer/view-filters.ts` | `applyViewFilter` algoritması | ✗ |
| `packages/diagram-service/src/transformer/bdd-transformer.ts:616` | Legacy filter call | ✗ (59 test bağımlı) |
| `packages/diagram-service/src/rendering/state-machine/transformer.ts` | Multi-seed + container emit (Slice 2d.1+2d.3) | ✗ |
| `packages/diagram-service/src/rendering/state-machine/renderer.ts` | IR → SModelRoot | ✗ |
| `packages/shared-types/src/state-machine.ts` | IR şeması | ✗ |
| `packages/web-client/src/diagram/DiagramViewer.tsx` | Title-bar container mekanizması | ✗ |

### Test fixture'lar (Slice 2d.2'de değişti)

| Path | Durum |
|------|-------|
| `sensor-systems/expected-ir.json` | Byte-identical (raw transformer golden) |
| `sensor-systems/expected-smodel.json` | Byte-identical (raw renderer golden) |
| `sensor-systems/expected-ir-filtered.json` | **Yeni** (filtered transformer golden) |
| `sensor-systems/expected-smodel-filtered.json` | **Yeni** (filtered wedge golden) |
| `multi-root-part-states/expected-*.json` | Byte-identical (filter no-op kanıtı test ile teyit) |

### Dokümantasyon

| Path | Sorumluluk |
|------|-----------|
| `docs/adr/005-state-machine-renderer.md` | D-FILTER-01 eklendi (Slice 2d.2) |
| `claude_md_files/renderer_refactor_phase1_brief_v1_3.md` | Canonical ops (v1.4 sıradaki) |
| `claude_md_files/phase1_slice2d1_closeout.md` | Multi-root crash hotfix |
| `claude_md_files/phase1_slice2d3_closeout.md` | Container labels |
| `claude_md_files/phase1_slice2d2_closeout.md` | View-filter integration (bu commit) |

---

## 7. Pratik Notlar (Sıradaki AG Session İçin)

### Lokal repo durumu

- `.claude/settings.local.json` modified (alakasız, ignore)
- Untracked: Architect-tarafı brief'ler (eklenmiş veya yarın eklenecek)
- Landing WIP: Muhlis'in paralel workstream'i (System2Product), AG dokunmadı
- HEAD: `dec3470` + bu commit

### Önemli operasyonel canonical'lar (brief v1.3'te detay)

- PM2 env: `/proc/<pid>/environ` ground truth
- Build: per-package, turbo değil
- Git: `git push origin master`, deploy.sh değil
- Counter: `/internal/renderer-stats` (auth-free)
- Stale-log forensic: cross-reference protokolü
- Karar noktası tabanlı checkpoint: 3-7 hedef
- Brief evrim: discovery → v1.0 → AG keşif → v1.1 → impl
- **Pre-impl visual preview** (Slice 2d.2'den yeni): Görsel davranış değişikliği riski olan slice'larda
- **Pre-deploy tsc verification** (Slice 2d.2'den yeni): Deploy öncesi `pnpm build`
- **Production HEAD sürprizi disipline** (Slice 2d.2'den yeni): Ancestor check + fast-forward kontrolü

### İlk yapılacaklar (yeni AG session)

1. Bu handover'ı oku (otomatik, repo'da)
2. `git log --oneline -10` ile HEAD doğrula
3. Architect'in yarın yazacağı brief'i bekle (Brief v1.4 veya Faz 1 Final Report)
4. Brief gelince başla. İlk dokunulacak kod (slice'a göre):
   - **Brief v1.4:** `claude_md_files/`'a yeni dosya, kod yok
   - **Faz 1 Final Report:** `claude_md_files/`, kod yok
