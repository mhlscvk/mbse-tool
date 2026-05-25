# Faz 2 Slice 3a — Close-Out & Continuation Handover

**Son güncelleme:** 2026-05-26 (Slice 3a KAPALI, W1 production'da, CP-4 atfı net)
**Branş:** master
**Baseline HEAD:** `ac3d6a4` (Faz 1 Final Report kapanışı)
**Slice 3a HEAD:** `08f0751` (W1 deploy) + bu doc commit (close-out + handover)
**Production HEAD:** `08f0751` ✓ (lokal == prod)
**Önceki handover:** `phase1_slice2d2_handover.md` (Faz 1 son slice) + Faz 1 Final Report
**Brief:** `phase2_slice3a_brief_v1_0.md` (Architect, probe-gated 2-slice)

---

## 1. TL;DR — Slice 3a KAPALI, Probe-Gated Yapı Çalıştı

Bug-RENDER-01'in **Part 1/2'si** tamamlandı. Slice 3a "probe-gated" tasarlandı: önce güvenli/altyapı fix'leri ship et (W1 = `data-node-id`), Tarayıcı re-probe gate'iyle node-persistence bug'ını **DOM-PRIMARY metodolojisinde** atfet, asıl fix'i Slice 3b'ye bırak.

**Kapsam sürprizi (CP-1):** W2 (ELK race cancel-guard) **zaten implement edilmişti** (`DiagramViewer.tsx:820` `if (cancelled) return;`). Re-discovery Defect #1 framing'i bir **kod-okuma kaçırması**ydı (offset 838-943 okundu, 608-838 okunmadı). W2 void edildi, slice W1-only'ye indi. Platform Owner kararı: W1 infra-only ship (W3 = Tarayıcı verifier).

**CP-4 atıf sonucu (S4 — karma defect):** Tarayıcı re-probe, `data-node-id` ile node-persistence'ı DOM seviyesinde doğruladı. **Primary root cause = React reconciliation / unmount path eksikliği** (server-side runtime probe'da elenmiş, ELK race CP-1'de elenmişti). Asıl fix Slice 3b'ye gider.

**Production:** W1 deploy edildi (`08f0751`), nginx fresh bundle serve ediyor, counter sağlıklı (`state-machine.new: 2107`, fallback 0), diagram-service dokunulmadı (19h kesintisiz uptime, ↺=0).

**Slice 3 saga'sının asıl dersi:** Anti-pattern #21 üç turda üç kez tetiklendi (sub-agent devralımı + iki kez kendi önceki turunun framing'i). Verification disipline'i (probe + kod-okuma) her seferinde yakaladı. Brief v1.5 #21 ıslahına materyal.

---

## 2. Discovery Zinciri (3 tur + gate)

| Tur | Dosya | İçerik | Sonuç |
|-----|-------|--------|-------|
| 1 (ilk Discovery) | **inline** (dosyalanmadı) | Selection-cleanup framing, state-owner haritası, cleanup effect envanteri | Defect #3 (multiSelectedNodeIds + parent selection reset); Explore-ajan "selection moot" devralımı düzeltildi |
| 2 (re-discovery) | `bug_render_01_rediscovery.md` | İki mimari defect (ELK race, WS no-correlation) + honest gap | Defect #1+#2 framing (sonradan ikisi de çürütüldü); R3 (data-node-id yok), R4 (kanal WS, SSE değil) |
| 3 (runtime probe) | `bug_render_01_runtime_probe.md` | Headless WS protocol probe | Defect #2 "out-of-order" ✗ refuted; uri-echo yokluğu ✓ confirmed; atıf client-side'a redirect |
| — (scope) | `bug_render_01_scope_proposal.md` | Probe-gated 2-slice önerisi | Brief v1.0 temeli |
| gate (CP-4) | bu handover §4 | Tarayıcı re-probe (data-node-id ile) | S4 karma defect, primary = React reconciliation |

**Not — ilk Discovery dosyalanmadı:** İlk Discovery raporu sohbet içinde inline verildi, repo'ya dosya olarak yazılmadı. Bulguları (Defect #3 = `multiSelectedNodeIds` + parent `diagramSelectedNodeId` switch'te reset edilmiyor; selection parent-controlled olduğundan internal selection moot) re-discovery'de "İlk Discovery'den devreden" bölümünde ve bu handover §6'da özetli. 3b için kaynak burası.

---

## 3. Implementation Özeti

### Değişen kod
| Path | Değişiklik | Diff |
|------|-----------|------|
| `packages/web-client/src/components/Diagram/DiagramViewer.tsx` | 11× `key={node.id}` → `key={node.id} data-node-id={node.id}` | 1 dosya, 11 satır değişti (git: +11/−11, her satır yeniden yazıldı) |

### Work item durumu
| WI | Açıklama | Durum |
|----|----------|-------|
| **W1** | `data-node-id={node.id}` — 11 node-root `<g>` site | ✓ done, deploy edildi `08f0751` |
| **W2** | Defect #1 ELK race cancel-guard | ✗ **void** — CP-1'de zaten mevcut bulundu (`DiagramViewer.tsx:820`) |
| **W3** | Tarayıcı post-deploy DOM re-probe (gate) | ✓ Tarayıcı yürüttü, CP-4 atfı (§4) |
| **W4** | Brief v1.4 → v1.5 appendix delta | ⏳ Slice 3b kapanışında Architect yazar (kaynak: brief v1.0 Appendix A + bu handover §5) |

### W1 çağrı sitesi haritası (✓ verified @ `08f0751`)
`key={node.id}` taşıyan 11 node-root `<g>` (hepsi `renderNodes.map` render dallarının kök element'i): satır 2164, 2204, 2259, 2274, 2293, 2310, 2330, 2392, 2471, 2517, 2574. Re-discovery "~10" demişti; gerçek **11** (2574 sayılmamıştı). Tek `replace_all` ile uygulandı, üretilen JSX 11 dalın hepsinde geçerli.

---

## 4. CP-4 Atıf Detayı (Tarayıcı Re-Probe — Verification Etiketi Disipline'i, Brief v1.4 §9.4)

Tarayıcı, `data-node-id` canlıyken (`08f0751` prod) re-probe yaptı. Metodoloji artık DOM-PRIMARY: `document.querySelectorAll('[data-node-id]')` (eski text-fingerprint + bbox sekonder kaldı).

**Sonuç: S4 — karma (mixed) defect.** Primary root cause = **React reconciliation / unmount path eksikliği.**

### Stale node id'leri (✓ verified @ `08f0751`)
| id | Tür |
|----|-----|
| `behavior__On_entry_activation` | ✓ verified — gerçek stale (Model A entry action'ı, B'de yok, switch sonrası DOM'da kaldı) |
| `behavior__Normal_entry_checkPowerSource` | ✓ verified — gerçek stale |
| `state__Normal` | ⚠️ false-stale — name collision artefaktı (A ve B'de aynı id; A'nın kalıntısı değil) |
| `state__Degraded` | ⚠️ false-stale — name collision artefaktı |

### Diğer gözlemler
- **Floating bbox y=795:** Stale node'lar container bbox dışında floating. **ELK guard ÇÜRÜTÜLMEDİ** — guard çalışıyor (CP-1 doğrulaması); floating sadece **stale (unmount edilmemiş) node'lara** ait, yeni layout onları konumlandırmıyor. Yani floating, ELK race değil, reconciliation kalıntısının yan etkisi. (Re-discovery'nin "floating = ELK race imzası" hipotezi de böylece düzeltildi.)
- **`totalSvgs: 5`** (PRE'de 2 idi): **orphan SVG root birikimi** — yan bulgu. Switch'lerde eski SVG root'lar temizlenmiyor olabilir. 3b Discovery'de incele.
- Console error: yok (sessiz stale, crash değil — re-discovery beklentisiyle tutarlı).

### Atıf zinciri (üç turun elemeleri)
1. Server-side (WS out-of-order / merge) — ✗ runtime probe'da elendi (in-order, stateless)
2. ELK stale-write (Defect #1) — ✗ CP-1'de elendi (guard line 820 mevcut)
3. **React reconciliation / unmount path — ✓ CP-4 primary** (keyed render'a rağmen eski node `<g>`'leri DOM'da kalıyor; name-collision id'leri reconciliation'ı karıştırıyor olabilir)

---

## 5. Anti-Pattern #21 Saga'sı (Slice 3 Dersi → Brief v1.5 #21 Islahı)

Slice 3 boyunca **devralınan iddia** anti-pattern'i üç kez tetiklendi, her seferinde verification disipline'i yakaladı:

| Tur | Devralınan/üretilen iddia | Çürüten kanıt |
|-----|---------------------------|---------------|
| 1 | Explore-ajan: "selection state temizlenmiyor (selectedNodeId/EdgeId stale)" | Kendi kod-okuma: selection parent-controlled → internal moot; gerçek stale = `multiSelectedNodeIds` |
| 2 | Re-discovery (kendi): "Defect #2 WS out-of-order → stale model kazanır" | Kendi runtime probe: sync parse event-loop'u bloke ediyor → in-order responses |
| 3 | Re-discovery (kendi): "Defect #1 `.then`'de cancel-guard yok" | CP-1 kod-okuma: guard `:820`'de mevcut (önceki tur offset 838-943 okumuş, 608-838 okumamış) |

**Ders:** Anti-pattern #21 sadece "sayım yuvarlama" değil. **Devralınan iddialar — başka ajandan VEYA kendi önceki turundan — kendi kanıt zincirinle `✓ verified` etiketi koyana kadar varsayım sayılmalı.** Özellikle Tur 2-3, **kendi önceki raporunun** framing'inin de doğrulanması gerektiğini gösterdi (sub-agent'a güvenmemek yetmez). Brief v1.5 #21 ıslahı bu materyali kullanacak.

---

## 6. Slice 3b'ye Devredilenler (Architect Brief v1.0 Input'u)

| Item | Açıklama | Etiket |
|------|----------|--------|
| **Birincil** | React reconciliation / unmount path defekti — keyed render'a rağmen stale node `<g>`'leri DOM'da kalıyor (CP-4 primary atıf) | ✓ verified @ `08f0751` (DOM probe) |
| **İkincil** | Defect #3 — `multiSelectedNodeIds` (DiagramViewer-local) + parent `diagramSelectedNodeId/EdgeId` (EditorPage) switch'te reset edilmiyor; cleanup effect (`:497-505`) sadece layout reset ediyor | ✓ verified @ `ac3d6a4` (ilk Discovery, inline) |
| **Opsiyonel** | R2 — autosave `handleChange` stale-closure timing riski (`EditorPage.tsx:737`); cross-file PUT corruption teyit gerekirse | ⚠️ assumed (Monaco onChange semantiği doğrulanmalı) |
| **Yan bulgu** | `totalSvgs: 5` (PRE 2) — orphan SVG root birikimi; 3b Discovery'de incele, scope dahil/dışı kararı orada | 🔍 partial (CP-4 gözlemi) |
| **Test altyapısı** | RTL harness kurulumu (`@testing-library/react` ekleme) — 3a'da accepted deviation; 3b'de düzeltilir, ilk component-mount testi | accepted deviation → 3b |
| **sizeOverrides/positionOverrides asimetrisi** | Cleanup positionOverrides siliyor (`:503`), sizeOverrides silmiyor; bug mı kasıt mı belirsiz | 🔍 partial (re-discovery R3) |

**3b Discovery notu:** Name-collision id'leri (`state__Normal` iki modelde de var) reconciliation'ı nasıl etkiliyor — birincil araştırma ekseni. `data-node-id` artık mevcut → 3b fix verification DOM-PRIMARY yapılabilir.

---

## 7. Verification Zinciri (CP-1 → CP-4)

| CP | Karar noktası | Sonuç |
|----|---------------|-------|
| **CP-1** | DP-3a-1 (edge identity?) + DP-3a-2 (cancelled closure scope?) | DP-3a-1: edge `data-edge-id` 3b'ye ertelendi (W1 = nodes only). DP-3a-2: **W2 void bulgusu** — guard `:820` mevcut, tek async layout path (`elk.layout` `:819`), tüm setter'lar guard sonrası. ✓ verified @ `ac3d6a4` |
| **CP-2** | W1 impl + lokal test | `tsc --noEmit` exit 0; web-client 128/128; pre-commit hook full suite 1142/1142 (340+674+128). RTL harness yok → unit test accepted deviation (W3 = verifier). |
| **CP-3** | Production deploy + regression | `08f0751` push + prod fast-forward; web-client build (vite, 39s) → `index-D7hzvMny.js`; nginx fresh bundle serve ✓; `data-node-id` served bundle'da mevcut; counter `state-machine.new: 2107` / fallback 0; diagram pid 2809610 / 19h / ↺=0 (dokunulmadı) |
| **CP-4** | Tarayıcı re-probe atfı | S4 karma defect, primary = React reconciliation/unmount (§4) |

---

## 8. Production Durumu (Slice 3a sonrası)

- **HEAD:** `08f0751` (+ bu doc commit), lokal == prod
- **Deploy tipi:** web-client static SPA (nginx serve), **PM2 restart YOK** — `ecosystem.config.cjs` sadece api/lsp/diagram içeriyor, web-client static
- **PM2 diagram:** pid `2809610`, ~19h uptime (Slice 2d.2'den beri restart yok, 3a deploy etkilemedi), ↺=0, online
- **Counter:** `state-machine.new: 2107` (artıyor), `old-fallback-from-new: 0` (sağlık göstergesi korundu)
- **Untracked prod artifact:** `seed-examples.{js,d.ts,map}` (Bug-PRISMA-01, pull'u engellemiyor, brief v1.4 §3.3)
- **Brief v1.4** canonical operasyonel referans olmaya devam ediyor

---

## 9. Process Gözlemleri (Faz 1 Pattern'lerinin Slice 3'te Performansı)

- **Üçlü orchestration olgunluğu devam etti:** 4 checkpoint hedefe oturdu (brief v1.4 §7.4 olgunluk eğrisi: 16+ → 3 → 3 → 4). AG auto-DUR refleksleri W2-void'i CP-1'de yakaladı (implement'a geçmeden durdu).
- **PRE screenshot disipline'i** (brief v1.4 §8.4.1): Tarayıcı uyguladı; ama `data-node-id` ön-koşulu nedeniyle PRE-with-identity ancak 3a deploy sonrası elde edilebildi (brief §6 notu doğrulandı).
- **Verification etiketi disipline'i** (✓/⚠️/🔍): tüm turlarda + bu handover'da tutarlı.
- **Honest-gap işaretleme** (re-discovery R1.4) ve **kanıt-karşısında-tez-geri-çekme** (runtime probe + CP-1): Brief v1.5 canonical pattern adayları (brief v1.0 Appendix A.3, A.4).
- **Backend-AG vs Tarayıcı rol ayrımı netleşti:** AG browser probe yapamaz (W3'ü Tarayıcı yürüttü); AG bunun yerine headless WS protocol probe yaptı (kendi domain'i). Bu ayrım brief v1.5'e operating-model notu.

---

## 10. Sıradaki AG Session İçin İlk Yapılacaklar

1. Bu handover'ı oku (otomatik, repo'da)
2. `git log --oneline -5` ile HEAD doğrula (`08f0751` + bu doc commit)
3. **Architect'in Slice 3b brief v1.0'ını bekle** — scope CP-4 atfına göre: birincil React reconciliation/unmount fix + Defect #3 + RTL harness + (3b Discovery'de) orphan-SVG + sizeOverrides asimetrisi kararı
4. Brief gelince Slice 3b Adım 0 Discovery ile başla:
   - React reconciliation: keyed render'da stale `<g>` neden kalıyor — name-collision id'leri (`state__Normal`) reconciliation etkisi
   - `data-node-id` artık mevcut → fix verification DOM-PRIMARY
   - RTL harness (`@testing-library/react`) kur → ilk component-mount testi
5. Anti-pattern #21 dersini uygula: **kendi önceki tur framing'ini bile** doğrulamadan canonical kabul etme.

---

## 11. Önemli Dosyalar

| Path | Sorumluluk |
|------|-----------|
| `packages/web-client/src/components/Diagram/DiagramViewer.tsx` | W1 (`data-node-id`); render path (`renderNodes.map` ~2127+), cleanup effect (`:497-505`), ELK layout effect (`:606-943`, guard `:820`) |
| `packages/web-client/src/pages/EditorPage.tsx` | Defect #3 (parent selection `:99`/`:1154-1157`), autosave (`:737`), model delivery (`:392`) |
| `claude_md_files/phase2_slice3a_brief_v1_0.md` | Architect brief (probe-gated, Appendix A = v1.5 delta kaynağı) |
| `claude_md_files/bug_render_01_rediscovery.md` | 3-tur discovery (R1-R4) |
| `claude_md_files/bug_render_01_runtime_probe.md` | Headless WS probe (Defect #2 out-of-order çürütüldü) |
| `claude_md_files/bug_render_01_scope_proposal.md` | Probe-gated 2-slice önerisi |
| `claude_md_files/renderer_refactor_phase1_brief_v1_4.md` | Canonical ops (v1.5 sıradaki) |
