# Phase 2 — Slice 3a Brief v1.0

**Slice ID:** Slice 3a (Bug-RENDER-01 — probe-gated, Part 1 of 2)
**Tarih:** 2026-05-26
**Önceki:** Faz 1 Final Report v1.0 + Brief v1.4 (canonical ops)
**Discovery turu:** 3 tur (ilk Discovery + re-discovery + runtime probe)
**Production HEAD (baseline):** `ac3d6a4`
**Approach:** Probe-gated 2-slice (3a → GATE → 3b)

---

## §1 — Scope + Verification Etiketi Özeti

### 1.1 Slice 3a Kapsamı (Ship Now)

| Work Item | Açıklama | Risk | Kaynak |
|-----------|----------|------|--------|
| **W1** | `data-node-id` attribute eklemek (~10 site) | Düşük | `bug_render_01_rediscovery.md` R3 |
| **W2** | Defect #1 ELK race fix (`.then` cancellation guard) | Düşük | `bug_render_01_rediscovery.md` R1 #1 — ✓ verified @ `ac3d6a4` |
| **W3** | Tarayıcı re-probe spec (gate verification) | Sıfır kod riski | Bu brief §4.3 |
| **W4** | Brief v1.4 appendix (delta-only) | Sıfır kod riski | Bu brief Appendix A |

**Scope dışı (Slice 3b'ye devir):**

| Defect / Item | 3b'ye devir gerekçesi | Etiket |
|---------------|----------------------|--------|
| **Defect #2** (WS uri/requestId correlation) | Yapısal defect ama latent — runtime probe ile out-of-order mekanizması ✗ refuted; reconnect-replay senaryosu açık | 🔍 latent, attribution pending |
| **Defect #3** (interaction state cleanup — `multiSelectedNodeIds` + parent `diagramSelectedNodeId`) | İlk Discovery'de tespit; SVG persist ile aynı kullanıcı senaryosunu paylaşmıyor (çoklu-seçim repro gerekir); 3a'da W2 ile aynı kod path'ine dokunur, çakışma riski | ✓ verified, post-attribution slice |
| **R2 guard** (autosave handleChange stale closure) | Re-discovery R2'de tespit; teyit gerekirse 3b'ye | ⚠️ assumed risk |
| **SVG persist root cause attribution** | Runtime probe sunucu-side çürüttü; client-side ELK vs reconciliation vs WS-stale-replay arası atfedilemedi; **W1 deploy edildikten sonra Tarayıcı re-probe ile atfedilecek** | 🔍 unattributed |
| **sizeOverrides/positionOverrides asimetrisi** | Re-discovery'de gözlem; niyet (kasıt mı bug mı) belirsiz | 🔍 partial |

### 1.2 Verification Etiketi Disipline'i (Brief v1.4 §9.4)

Bu brief'teki her iddia aşağıdaki üç etiketten birini taşır:
- **✓ verified @ commit X** — kod okundu, satır referansı var
- **🔍 partial** — kısmen teyit, runtime probe veya ek discovery gerekebilir
- **⚠️ assumed** — varsayım, doğrulanmadı

---

## §2 — Discovery Kaynakları

Üç turluk Discovery zinciri, hepsi `ac3d6a4` baseline'da:

| Dosya | İçerik | Verification |
|-------|--------|--------------|
| `claude_md_files/bug_render_01_discovery.md` (varsayılan ad — AG ilk Discovery raporu) | Selection-cleanup framing + state owner haritası | ✓ verified @ `ac3d6a4` — multi-select/parent reset bulgusu (Defect #3) |
| `claude_md_files/bug_render_01_rediscovery.md` | İki mimari defect + honest gap | ✓ verified — Defect #1 (ELK race), Defect #2 (WS no-correlation); 🔍 honest gap — DOM-mix atfı |
| `claude_md_files/bug_render_01_runtime_probe.md` | Headless WS protocol probe | ✓ refuted — Defect #2 out-of-order mekanizması; ✓ confirmed — `uri` echo eksikliği yapısal |
| `claude_md_files/bug_render_01_scope_proposal.md` | Probe-gated 2-slice önerisi | Bu brief temel alır |

**Tarayıcı kanıtı:** Production `systemodel.com` HEAD `ac3d6a4` — 8 stale text label + 6 stale `<rect>` Model A'dan persist; switch sonrası 3 saniye stable; console error yok. Görsel + DOM ground truth (text fingerprint + bbox containment metodolojisi, `data-node-id` yokluğu nedeniyle).

---

## §3 — Work Items

### §3.1 — W1: `data-node-id` Attribute Eklemek

**Hedef:** SVG render path'inde her node `<g>` element'ine `data-node-id={node.id}` ekle. Bu, post-fix verification için Brief v1.4 §5.4 "DOM PRIMARY" disipline'inin bu renderer'da uygulanabilir olmasını sağlar.

**Çağrı sitesi haritası** (✓ verified @ `ac3d6a4`, kaynak: re-discovery R3):

- `packages/web-client/src/components/Diagram/DiagramViewer.tsx` — render path'inde `key={node.id}` taşıyan ~10 yer (re-discovery raporu somut satır numaralarını listeliyor; AG implementation öncesi `grep -n "key={node.id}" DiagramViewer.tsx` ile bu listeyi `✓ verified @ <new-commit>` etiketiyle yeniden doğrulayacak)

**Tasarım kararı:** Attribute adı `data-node-id` (slug-style, React JSX attribute filter'ından geçer, DOM'a düşer). Edge'lere ayrıca `data-edge-id` eklemek **3b'ye devredilir** (gerek olunca eklenir, 3a scope dar tut).

**Karar Noktası DP-3a-1:** Edge'lere de `data-edge-id` eklensin mi? **3a'da hayır** — Tarayıcı re-probe'da node identity yeterli (atfedilen DOM-mix node-level). Edge identity gerekirse 3b'de eklenir.

**Verification:** Build sonrası lokal'de DOM'a düşüyor mu? `pnpm dev` + `document.querySelectorAll('[data-node-id]').length` Tarayıcı'da çalıştırılır. ✓ verifier.

---

### §3.2 — W2: Defect #1 ELK Race Cancellation Guard

**Hedef:** Async ELK layout `.then` success path'ine `cancelled` guard ekle. Önceki model'in layout hesabı switch sonrası resolve olursa `setPositions`/`setIbdSizes`/`setElkEdgeRoutes`/`setTransform` ÇAĞRILMASIN.

**Mevcut durum** (✓ verified @ `ac3d6a4`, kaynak: re-discovery R1.1):

- `packages/web-client/src/components/Diagram/DiagramViewer.tsx:908-941`
- `.catch` (939) `cancelled` kontrol ediyor; `.then` (908-938) etmiyor
- Cleanup `cancelled = true` set ediyor (941)

**Tasarım kararı:** `.then` body'sinin başına `if (cancelled) return;` ekle. Tek satır değişiklik.

```ts
// MEVCUT (sözde-kod):
.then(layoutResult => {
  setPositions(layoutResult.positions);
  setIbdSizes(layoutResult.layoutSizes);
  setElkEdgeRoutes(layoutResult.edgeRoutes);
  setTransform({ ... });  // auto-fit
})
.catch(e => {
  if (cancelled) return;
  // error handling
})

// FIX:
.then(layoutResult => {
  if (cancelled) return;  // ← EKLENİYOR
  setPositions(layoutResult.positions);
  setIbdSizes(layoutResult.layoutSizes);
  setElkEdgeRoutes(layoutResult.edgeRoutes);
  setTransform({ ... });
})
```

**Beklenen etki:** Tarayıcı'nın gördüğü "container dışına sallanan checkPowerSource kutuları" imzası ELK race kaynaklıysa bu fix tek başına çözer. SVG persist'in bütünü çözülmezse Slice 3b'de attribute kalan mekanizmaya bağlanacak.

**Karar Noktası DP-3a-2:** `cancelled` flag scope'u doğru mu? AG implementation öncesi cleanup effect'in `cancelled` closure'unu hangi useEffect'in ürettiğini ve `.then`'in aynı closure'a erişiminin olup olmadığını ✓ verified ile teyit etmeli. Eğer closure mismatch varsa fix scope büyür (useRef gerekebilir).

**Verification:** Lokal'de Tarayıcı re-probe — büyük model A → küçük model B switch, ELK race signature'ı (floating kutular) kaybolduysa ✓. Eğer hâlâ varsa atfedilen mekanizma değişir.

---

### §3.3 — W3: Tarayıcı Re-Probe Spec (Post-Deploy Gate)

**Hedef:** Slice 3a deploy edildikten sonra Tarayıcı'nın atfedilemeyen SVG persist bug'ını **`data-node-id` ile DOM PRIMARY metodolojisinde** yeniden test etmesi. Sonuç Slice 3b'nin scope'unu belirleyecek.

**Re-probe scope (Tarayıcı'ya pass edilecek mesaj):**

1. Production deploy sonrası `systemodel.com` HEAD `<3a-commit>` üzerinde
2. Aynı repro: Model A (action node'lar içeren) → Model B (action node'sız) switch
3. **PRIMARY DOM probe:**
   ```js
   // Switch öncesi
   const preIds = [...document.querySelectorAll('[data-node-id]')].map(e => e.dataset.nodeId);
   // Switch sonrası 3 saniye bekle
   const postIds = [...document.querySelectorAll('[data-node-id]')].map(e => e.dataset.nodeId);
   const staleIds = postIds.filter(id => preIds.includes(id) && !modelBExpectedIds.includes(id));
   ```
4. Sekonder probe: text fingerprint (eski yöntem, karşılaştırma için)
5. ELK race signature kontrol: floating kutular (TestStates container bbox dışı) hâlâ var mı?

**Atıf matrisi (Tarayıcı re-probe sonucu):**

| Gözlem | Slice 3b scope'u |
|--------|------------------|
| `staleIds.length === 0` + ELK signature ✗ | **W2 tek başına çözdü.** Slice 3b: sadece Defect #3 (interaction state) + R2 guard + Brief v1.5 yazımı |
| `staleIds.length === 0` + ELK signature ✓ kalıyor | **W2 yetersiz** — ELK race çözüldü ama farklı bir layout/render path defekti var; ek discovery gerekir |
| `staleIds.length > 0` (DOM-level stale persist) | **Atfedilen mekanizma client-side React reconciliation veya WS replay** — Slice 3b'de ek discovery turu + fix |
| `staleIds` kısmı eşleşiyor (ör. sadece çocuk node'lar persist) | **Karma defect** — Slice 3b'de detaylı atıf turu |

**Karar Noktası DP-3a-3:** Re-probe sonucunda Slice 3b scope'u Platform Owner'a sunulacak ve karar alınacak (Slice 3b brief v1.0 yazımı).

---

### §3.4 — W4: Brief v1.4 Appendix (Delta-Only)

**Hedef:** Brief v1.4'te düzeltilmesi gereken iki bilgi yanlışı + Slice 3 boyunca gözlemlenen iki yeni canonical pattern adayı bu brief'in **Appendix A**'sında belgelensin (AG ayrı dosya açmaz, Brief v1.4 → v1.5 geçişi Slice 3 tamamlandığında yapılır).

Detay için bu brief'in **Appendix A** bölümüne bakınız.

---

## §4 — Implementation Plan

### §4.1 — Sıra

```
Adım 1: W1 (data-node-id)
  ├─ Çağrı sitesi haritası ✓ verified (grep, satır sayım)
  ├─ Implementation
  ├─ Lokal test (DOM'a düşüyor mu)
  └─ Pre-deploy `pnpm build` + `tsc` semantic check
  
Adım 2: W2 (ELK race guard)
  ├─ cancelled closure scope ✓ verified (DP-3a-2)
  ├─ Implementation (tek satır)
  ├─ Lokal test (Model A büyük → Model B küçük switch, ELK signature kaybı)
  └─ Pre-deploy `pnpm build` + `tsc` semantic check

Adım 3: PRE screenshot arşivleme (Brief v1.4 §8.4.1)
  └─ AG Tarayıcı'ya repro setup mesajı, Tarayıcı PRE state screenshot + DOM dump alır

Adım 4: Deploy (`git push origin master` + prod `git pull` + PM2 reload)
Adım 5: Counter teyit + uptime teyit
Adım 6: Tarayıcı re-probe (W3, atıf turu)
Adım 7: AG slice 3a close-out handover yazımı
```

### §4.2 — Test Stratejisi (Brief v1.4 §10.4 Disipline'i)

**Mevcut durum:** DiagramViewer için test coverage SIFIR (ilk Discovery'de ✓ verified). Slice 3a yeni test ekler ama **dar tutar** (3b'de daha kapsamlı test yazımı planlanıyor).

**Karar Noktası DP-3a-4:** Test yaklaşımı seçeneği:

- **Seçenek A (önerilen):** ELK race fix'i için **reset helper extraction + unit test**. Yani `.then` body'sini ayrı bir helper'a çıkar (`applyElkLayout(cancelled, result, setters)`), unit test'te `cancelled = true` ile setter'ların çağrılmadığını assert et. Brief v1.4 §10.4 disipline'i ile uyumlu (saf helper, izole test).
- **Seçenek B:** RTL component test — `DiagramViewer` mount + mock model switch + assertion. Daha karmaşık, ~2400 satır bileşeni mock'lamak zorlu.

**3a için Seçenek A önerilir.** B Slice 3b'ye devredilir.

**`data-node-id` için test:** Snapshot veya RTL render test — `<DiagramViewer model={mockModel}>` mount + `container.querySelectorAll('[data-node-id]').length === mockModel.children.length` assertion.

### §4.3 — Pre-Deploy Disipline'i (Brief v1.4 §3.2.1, §5.X)

- **`pnpm build`** (turbo) — production'a HALT eder, sadece lokal'de
- **Per-package `tsc --noEmit`** semantic check — esbuild yapmıyor (Brief v1.4 §3.2.1)
- **Production HEAD ancestor check** — fast-forward öncesi (Brief v1.4 §3.2.1 5-adım protokol)

---

## §5 — Karar Noktası Tabanlı Checkpoint'ler (Brief v1.4 §7)

Hedef: 3-7 checkpoint. Slice 3a görece dar, 4 checkpoint yeterli:

| CP # | Karar Noktası | Beklenen Çıktı |
|------|---------------|----------------|
| **CP-1** | DP-3a-1 (edge identity 3a'da mı?) + DP-3a-2 (cancelled closure scope ✓?) | AG Discovery raporu uzatması (`grep -n key=` çıktısı + closure scope teyidi). Eğer DP-3a-2'de closure mismatch çıkarsa Architect karar verir (useRef extend mi, scope büyütme mi). |
| **CP-2** | W1 + W2 implementation tamamlandı, lokal test geçti | AG raporu: değişen dosyalar, satır farkları, lokal test çıktısı (DOM query + Model A→B switch ELK signature kontrolü). Architect onay → deploy. |
| **CP-3** | Production deploy sonrası counter teyit + uptime + Tarayıcı PRE screenshot arşivlendi | Counter `totalRenders` arttı, fallback 0, PM2 uptime sıfırdan başladı (deploy fingerprint). Architect onay → Tarayıcı re-probe. |
| **CP-4** | DP-3a-3 (Tarayıcı re-probe atıf sonucu) | Atıf matrisi sonucu → Architect Slice 3b scope kararı → AG handover yazımı tetiklenir. |

---

## §6 — PRE Screenshot Arşivleme (Brief v1.4 §8.4.1)

**Zorunlu PRE state'ler (Tarayıcı'ya pass edilecek):**

1. **Model A açık, STV view, switch öncesi** — DOM PRIMARY: `[data-node-id]` count + id listesi (3a deploy sonrası elde edilebilir; pre-3a'da yok)
2. **Switch sonrası 3 saniye, stable** — DOM PRIMARY: stale id'ler var mı? + bbox containment (ELK signature kontrol için)
3. **(Opsiyonel) ELK race izolasyonu** — Büyük Model A (1000+ node) → küçük Model B switch; W2 öncesi/sonrası karşılaştırma için lokal'de yapılabilir

**Sakla:** Tarayıcı her screenshot'a caption (timestamp, model id, hangi state) eklesin. CP-3'te Architect'e iletilir.

---

## §7 — Test Mimarisi (Brief v1.4 §10.4)

Yukarıda §4.2'de özetlendi. Kısaca:

- **Helper extraction pattern:** `.then` body'si saf helper'a çıkar
- **Unit test izole:** mock setter'lar + `cancelled` flag toggle
- **Test dosyası:** `packages/web-client/src/components/Diagram/__tests__/DiagramViewer.elk-race.test.ts` (yeni dosya)
- **Coverage hedefi:** 3a'da sadece ELK race + `data-node-id` smoke; 3b'de geniş

---

## §8 — Deploy + Verification Sırası

```bash
# Lokal (AG)
git status                                    # working tree clean?
pnpm build                                    # turbo, all packages
# (lokal test yeterli görünüyor)
git add -A
git commit -m "Slice 3a: data-node-id + ELK race guard (Bug-RENDER-01 part 1/2)"

# Pre-deploy (AG)
git fetch origin master
git merge-base --is-ancestor origin/master HEAD   # ancestor check
git log origin/master..HEAD --oneline             # impact analizi

# Deploy (AG)
git push origin master

# Production (AG SSH)
ssh root@65.109.134.254
cd /path/to/repo
git pull
pnpm install --frozen-lockfile                # eğer paket değişimi varsa
pnpm build                                    # production build
pm2 reload diagram                            # veya web-client process

# Verification (AG)
curl -s localhost:<port>/internal/renderer-stats | jq    # counter teyit
pm2 status                                                # uptime sıfırdan
```

**Counter teyit:** `state-machine.new` artmaya devam etmeli, `fallback: 0` korunmalı. Slice 3a state-machine path'ine dokunmuyor ama deploy regression yapmadığını kanıtlamak için zorunlu kontrol.

**Tarayıcı re-probe:** CP-3'ten sonra ayrı turda, W3 spec'i ile.

---

## §9 — Slice 3a Tamamlanma Kriterleri

3a "kapalı" sayılır eğer:

- ✓ W1 implementation tamamlandı, DOM'a `data-node-id` düşüyor (lokal + prod)
- ✓ W2 implementation tamamlandı, ELK race fix lokal'de teyit edildi (büyük Model A → küçük Model B switch)
- ✓ Unit test yazıldı, CI yeşil
- ✓ Production deploy tamamlandı, counter ve uptime sağlıklı
- ✓ Tarayıcı re-probe yapıldı, DP-3a-3 atıf matrisi sonucu kayıt altında
- ✓ AG handover (`phase2_slice3a_handover.md`) yazıldı
- ✓ Architect Slice 3b scope kararı verdi (atıf sonucuna göre)

---

## §10 — Slice 3b Geçiş Notları

Slice 3b'nin scope'u **CP-4'teki Tarayıcı re-probe atıf sonucuna göre** belirlenecek. Olası senaryolar:

**Senaryo S1: ELK race tek başına çözdü** (en iyi durum)
- Slice 3b scope: Defect #3 (interaction state cleanup) + R2 autosave guard (gerekirse) + Brief v1.5 yazımı
- Effort: 🔍 estimate 1-1.5 gün (AG'nin scope_proposal'da verdiği range'in alt ucu)

**Senaryo S2: DOM-level stale persist hâlâ var** (en zor durum)
- Slice 3b scope: Ek discovery turu (React reconciliation veya WS replay mekanizması) + atfedilen fix + Defect #3 + Brief v1.5
- Effort: 🔍 estimate 2-2.5 gün

**Senaryo S3: Karma sonuç** (orta durum)
- Slice 3b scope: Senaryoya göre fix subset'i + Defect #3 + Brief v1.5
- Effort: 🔍 estimate 1.5-2 gün

3b brief v1.0 yazımı Slice 3a kapanışında başlar.

---

# Appendix A — Brief v1.4 Deltası (Slice 3 boyunca biriken düzeltmeler)

Bu appendix Brief v1.4 → v1.5 geçişi için biriktirilen düzeltme + yeni canonical pattern adaylarını listeler. Slice 3 (3a + 3b) kapandığında Architect Brief v1.5'i tam sürüm olarak yazar; bu appendix kaynak materyal görevi görür.

## A.1 — Düzeltme: §5.2 / §6 Render Kanalı

**Mevcut Brief v1.4 §5.2/§6 ifadesi:** "Render kanalı production deployment'a göre WS veya SSE."

**Doğru ifade** (✓ verified @ `ac3d6a4`, kaynak: re-discovery R4 + runtime probe):

- **Render kanalı her zaman WebSocket** `/diagram` endpoint'i
- Frame format: `{kind:'model', model, diagnostics, viewType, _meta}` (kaynak: `diagram-service/websocket-server.ts:117-123`)
- Client tarafı: `packages/web-client/src/lib/diagram-client.ts:42` — `new WebSocket('${proto}//${location.host}/diagram')`
- Sunucu tarafı: stateless, connection-per-IP rate limiting

**SSE (`/api/.../events?token=<JWT>`) AYRI kanal:**
- File-change event stream
- Kaynak: `packages/server/src/routes/files.ts:18`
- Consumed at: `EditorPage.tsx:590-606`
- **Render trafiği değil** — file save/change notifications

**Brief v1.4 §5.2 düzeltme önerisi:**
```
ESKİ: "Render kanalı production deployment'a göre WS veya SSE."
YENİ: "Render kanalı: WebSocket /diagram (kind:'model'). File-change event stream
       ayrı kanal: SSE /api/.../events?token (kind:notification frame'leri)."
```

**Brief v1.4 §6.X düzeltme önerisi:** Render kanalı kontrolünde "Tarayıcı'da Network panel SSE görürse bu file-change kanalıdır, render WS'i ayrı endpoint" notu eklenmeli.

---

## A.2 — Anti-Pattern #21 Ek Örnek (sayım yuvarlama → kanıtlanmamış-iddia)

**Mevcut Brief v1.4 §10.3 #21:** "Sayım iddiası yaparken kaynak referansı belirt — kafadan yuvarlama anti-pattern'i."

**Ek örnek (Slice 3 boyunca):**

İlk Discovery'de AG, önceki sub-agent ("Explore-ajan") raporuna dayanarak `selectedNodeId/EdgeId temizlenmiyor` iddiasını üretti. Re-discovery turunda kendi kod okumasıyla bunun **yanlış** olduğunu tespit etti (selection parent-controlled, internal moot). Bu **anti-pattern #21'in genişlemiş hali** — sadece sayım yuvarlama değil, **devralınan iddiaları kendi kanıt zincirinizle doğrulamadan canonical kabul etmeme** disipline'i.

**Brief v1.5 §10.3 #21 önerilen genişletme:**
```
#21 — Doğrulanmamış-iddia: kafadan yuvarlama VEYA başka kaynaktan devralma.
Sayım/iddia yaparken (a) sayım kaynağını referansla VEYA (b) iddia başka bir
ajandan/raporda geliyorsa kendi kanıt zincirinizle ✓ verified etiketi koyana
kadar varsayım sayın. Re-discovery turunda Explore-ajan'ın "selection moot"
iddiası yanlış çıktı; AG kendi kod okumasıyla düzeltti.
```

---

## A.3 — Yeni Canonical Pattern Adayı #1: Kanıt-Karşısında-Tez-Geri-Çekme

**Slice 3 gözlemi:**

Re-discovery turunda AG, "WS uncorrelated → out-of-order reordering" mekanizmasını verified defect olarak tanımladı (Defect #2). Runtime probe turunda **kendi probe'u bu mekanizmayı çürüttü** (sync parse + event loop block → in-order responses). AG çürütme sonucunu rapora **dürüstçe** yazdı: "bu re-discovery'min framing'i yanlıştı."

**Önerilen canonical pattern (Brief v1.5'e):**

```
Canonical Pattern: Kanıt-Karşısında-Tez-Geri-Çekme

Bir tezi (mimari defect iddiası, root cause atfı, vb.) yeni kanıt (probe,
runtime test, ek kod okuma) çürüttüğünde, tez sahibi (AG, Architect, Tarayıcı):

1. Eski tezin yanlış olduğunu RAPORDA AÇIKLA, sessizce silme
2. Çürüten kanıt zincirini referansla (komut çıktısı, satır numarası, vb.)
3. Yeni atfı ✓ verified veya 🔍 partial olarak etiketleyerek devam et

Karşıt anti-pattern: eski tezi sessizce reframe etme veya yeni rapora taşımama
("biz öyle dememiştik" pattern'i).

Slice 3 örneği: AG re-discovery Defect #2 "out-of-order" framing'i runtime
probe ile ✗ refuted; AG bunu probe raporunun başına dürüstçe yazdı.
```

---

## A.4 — Yeni Canonical Pattern Adayı #2: Honest-Gap-İşaretleme (🔍)

**Slice 3 gözlemi:**

Re-discovery turunda AG, DOM-mix bug'ının kesin atfını static kod okuma ile yapamadı. **Hipotez kurmak yerine** 🔍 etiketi ile honest gap belirtti: "static reading bunu kapatamıyor, runtime probe gerek." Bu disipline, "uydurma-eldeci-bilgi" anti-pattern'inin önündeki en güçlü bariyer.

**Önerilen canonical pattern (Brief v1.5'e):**

```
Canonical Pattern: Honest-Gap-İşaretleme (🔍 etiket disipline'i)

Bir iddianın doğrulanması ajan'ın mevcut araç setiyle (kod okuma, headless
probe, browser dogfood) mümkün değilse:

1. Hipotezi YAZMA, gap'i AÇIKLA — "bu kanıtlanmadı çünkü X gerekir"
2. Gap'i kapatacak somut probe/teyit spec'ini yaz (başka ajan veya tur için)
3. Bağımlı kararı (slice scope, fix öncelik) gap kapanana kadar erteleyebilirsen
   ertele; ertelenemezse gap'in altında "🔍 assumed" ile devam et

Slice 3 örneği: AG re-discovery R1.4 honest gap — DOM-mix atfı static reading'le
kapanmadı, AG runtime probe spec'i hazırladı (Tarayıcı için browser instrumentation).
Hipotez kurmadı.
```

---

## A.5 — Brief v1.5 Yazım Notu

Brief v1.5 tam sürüm yazımı **Slice 3b kapanışında** yapılır (3a + 3b sentezi). Bu appendix v1.5'in §5.2/§6 düzeltmesi + §10.3 #21 genişletmesi + yeni canonical pattern §10.X.X madde başlıkları için kaynak materyal.

---

# Son

**Architect onayı bekleniyor.** Onay sonrası bu brief AG'ye paslanır, AG CP-1'den başlar (DP-3a-1 + DP-3a-2 doğrulaması).

— Architect Claude, 2026-05-26
