# Phase 2 Slice 5 — Discovery Report (Sub-state Pseudo-Initial)

**HEAD:** `6c22cb0` (lokal == origin == prod) | **Tarih:** 2026-05-26
**Görev:** Slice 2d.2 backlog ("sub-state pseudo-initial daire implement edilmemiş") vs Slice 3a cross-verify ("kod var, iddia yanlış") çelişkisini kanıtla.
**Method:** Statik kod-okuma (Q1/Q3/Q4/Q5) + Q2 için Tarayıcı browser-probe prep. Etiketler: ✓ verified / 🔍 partial / ⚠️ assumed (anti-pattern #21).

> **Headline:** İki önceki iddia da **imprecise**. Gerçek: backend **VE** frontend pseudo-initial'i tam destekliyor (transformer→renderer `startnode` SNode→DiagramViewer CONTROL-node dolu daire). **AMA** STV view-filter, entry-action'lı parent'ın sub-state start node'unu **KASITLI gizliyor** (ADR-005 D-FILTER-01). Yani "sub-state daire yok" muhtemelen **bug değil, tasarım.** Tek açık ampirik soru: **top-level** `pseudo-initial__top` prod'da görünür çiziliyor mu (Q2, Tarayıcı). Çiziliyorsa claim tamamen moot.

---

## Soru 1 — Kod 3 konumda var mı? (Slice 3a iddiasını doğrula)

| Konum | Bulgu | Etiket |
|-------|-------|--------|
| **transformer** | `transformer.ts:6-7` pseudo-state'leri container-scoped emit ediyor (On'un local initial'i ≠ top-level). `transformer.test.ts:60-71`: 3 pseudo-state (2 initial + 1 final), `:109-118` "On içine pseudo-initial". (Cross-verify "transformer:60-61" aslında test satırı; emit mantığı transformer.ts gövdesinde.) | ✓ verified — pseudo-initial IR üretiliyor |
| **renderer** | `renderer.ts:186` `pseudoStateToSNode` → SNode `id: node.id` (**remap YOK**, `pseudo-initial__on` aynen), `size: 24×24` (`:39`), `cssClasses: ['startnode']` (`:106` `pseudoCssClass('pseudo-initial')→'startnode'`), keyword «start». `:148` `children.push(pseudoStateToSNode(...))`. Test `renderer.test.ts:60-66`. | ✓ verified — startnode SNode üretiliyor |
| **DiagramViewer** | **"pseudo"/"initial" string'i YOK** (grep boş). Frontend `cssClass='startnode'` üzerinden çiziyor: `:358` `CONTROL_CSS` (startnode dahil), `:193` `startnode: '#222222'` (dolu koyu daire), `:558/:572` control node fixed size. Cross-verify "DiagramViewer:2288-2301" **imprecise** — mekanizma string değil, `startnode` cssClass. | ✓ verified (kod var) / ⚠️ cross-verify line ref imprecise |

**Tanı:** Slice 3a "kod var, iddia kategorik yanlış" — backend için DOĞRU, ama DiagramViewer atfı imprecise (startnode cssClass, "pseudo" değil). Kod zinciri **uçtan uca tam.**

---

## Soru 2 — Production'da render ediliyor mu? (🔍 Tarayıcı GEREKLİ)

**Statik okumayla kapatılamaz** — runtime DOM gerekli. **Tarayıcı browser-probe prep (Architect Tarayıcı'ya paslar):**

- **Model:** STV view + composite state içeren bir model. **Fixture: sensor-systems** (`On` composite + entry action → `pseudo-initial__on`; ayrıca top-level `pseudo-initial__top`).
- **Selector (Slice 3a `data-node-id` ARTIK MEVCUT — `[id*=]` DEĞİL):**
  ```js
  // Top-level initial — render bekleniyor:
  document.querySelector('[data-node-id="pseudo-initial__top"]')
  // Tüm pseudo-initial'lar:
  [...document.querySelectorAll('[data-node-id*="pseudo-initial"]')].map(e=>e.getAttribute('data-node-id'))
  // startnode görseli (dolu daire) — cssClass/renkle:
  // bbox + fill kontrolü: ~24px, fill #222222
  ```
- **Beklenen (kod + filter'a göre):**
  - `pseudo-initial__on` (sub-state) **YOK** → filter kasıtlı gizliyor (Soru 3, ADR D-FILTER-01) = doğru davranış.
  - `pseudo-initial__top` (top-level) **VAR + görünür dolu daire** → kod destekliyor.
- **Atıf matrisi:**
  | Gözlem | Sonuç |
  |--------|-------|
  | `pseudo-initial__top` var + görünür | **Claim tamamen MOOT** — bug yok, slice gereksiz |
  | `pseudo-initial__top` var ama görünmez (0px/floating/overlap) | **Gerçek bug** — top-level initial render defekti (dar fix) |
  | `pseudo-initial__top` yok | Filter top-level'ı da mı düşürüyor? → filter scope incelemesi |

---

## Soru 3 — Bug tanımı + kaynak (devralınan claim)

**Tam claim metni:** `phase1_slice2d2_closeout.md:332` + `phase1_slice2d2_handover.md:183`:
> "**Yeni candidate:** Sub-state pseudo-initial daire çizimi (yeni renderer'da implement edilmemiş — `pseudo-initial__on`, `pseudo-initial__top` görsel desteği eksik). Slice 2d.2 dogfood'unda **Tarayıcı tarafından gözlemlendi.**"

**Kanıt temeli (closeout:98, 215):** Tarayıcı "DOM programatik teyit: `pseudo-initial` element sayısı = **0**" + "iki render birebir aynı → renderer zaten çizmiyor".

**⚠️ Bu kanıt GEÇERSİZ (anti-pattern #21):** Slice 2d.2, **Slice 3a'dan ÖNCE** (`data-node-id` o zaman YOKTU — Slice 3a R3'ün eklediği şey). 2d.2'de SVG `<g>`'lerde id/data-node-id **hiç yoktu** → `[id*="pseudo-initial"]` (Brief v1.5 §5.2.1 deseni) **her node tipi için 0** döner = false negative. "Renderer çizmiyor" sonucu bu geçersiz probe'a + "görsel birebir aynı"ya dayanıyor. 🔍 2d.2'nin tam selector komutu alıntılanmadı, ama by-id probe pre-3a geçersizdir.

**Çelişen ikinci iddia:** `architect_to_architect_handover_2026-05-25.md:88`: "iddia kategorik yanlış, kod var (transformer:60-61, renderer:186-200, DiagramViewer:2288-2301)" — backend doğru, DiagramViewer ref imprecise (Soru 1).

**Tanı:** Backlog claim, geçersiz bir DOM probe'a (pre-3a by-id) + görsel sezgiye dayanıyordu. Slice 3a cross-verify kodu doğru gördü ama line-ref'i imprecise'di. **İkisi de tam değil.**

---

## Soru 4 — Test infrastructure

- **Backend: VAR** ✓ — `transformer.test.ts:60-71` (pseudo emisyon), `renderer.test.ts:60-66` (startnode SNode 24×24), `end-to-end.test.ts:268-283` (wedge `pseudo-initial__on` düşürür, `pseudo-initial__top` korur). Fixture: **sensor-systems** (On composite + entry → local initial + top-level initial).
- **Frontend: YOK** ⚠️ — web-client'te startnode/state-machine/pseudo render testi yok (grep "No files found"). DiagramViewer'ın startnode'u dolu daire çizdiğini doğrulayan test **eksik** (RTL harness Slice 3b'de geldi — kullanılabilir).
- **Reprodüksiyon:** sensor-systems otomatize edilebilir (backend); frontend render için Slice 3b RTL harness + mock-model ile startnode-render testi yazılabilir.

---

## Soru 5 — Çakışan iş kalemleri

- **Bug-RENDER-03:** Container'lar için region/dashed stili — "sadece talep gelirse, spekülatif" (`final_report:378`). Pseudo-initial ile **alakasız** (composite-state görsel stili). ✗ çakışma yok.
- **TODO/FIXME:** state-machine renderer/transformer'da **YOK** (eşleşmeler landing/System2product, alakasız). ✓
- **Counter telemetri:** sub-state/nested için ayrı bucket yok. ✗
- **Tanı:** Bağımsız; çakışma yok.

---

## §Sentez — Slice 5 gerçekte ne?

**Filter'ın kasıtlı davranışı (✓ verified):** `view-filters.ts:150-226` `filterStateTransitionView`:
- `:162-164` "Hide start nodes when an entry action node exists in the same parent (entry action replaces the start circle in STV)"
- `:166-174` entry-action'lı parent'ın start node'u gizlenir; `:198-226` start→entry edge remap.

→ **Sub-state pseudo-initial'in görünmemesi = STV view-filter tasarımı (ADR-005 D-FILTER-01), bug değil.** sensor-systems'te `On`'un entry action'ı var → `pseudo-initial__on` kasıtlı gizli. `pseudo-initial__top` (entry-remap yok) korunur.

**Slice 5'in iki olası gerçeği (Q2 belirler):**
1. **Claim MOOT (en olası):** top-level initial görünür çiziliyor + sub-state kasıtlı filtreli → **slice gereksiz**, backlog'dan düşülür (sadece frontend test borcu #4 + dokümantasyon kalır).
2. **Dar gerçek bug:** top-level `pseudo-initial__top` kod desteğine rağmen prod'da görünmüyorsa → küçük render fix + frontend test.

**Önerilen sıra (Brief v1.5 §8.3):** Q2 Tarayıcı probe → (a) MOOT ise: backlog kapat + opsiyonel frontend startnode-render testi (Slice 3b RTL); (b) gerçek bug ise: dar fix brief'i. **Brief yazımı Q2 sonucuna gate'li** — şimdi brief yazmak (a)/(b) bilinmeden tahmin olur (anti-pattern #13).

---

## Verification Etiketi Özeti

| Bulgu | Etiket |
|-------|--------|
| transformer + renderer pseudo-initial üretiyor | ✓ verified @ `6c22cb0` |
| DiagramViewer startnode'u CONTROL dolu daire çiziyor | ✓ verified (cssClass, "pseudo" string değil) |
| Cross-verify "DiagramViewer:2288-2301" line-ref | ⚠️ imprecise (mekanizma startnode) |
| STV filter sub-state start'ı kasıtlı gizliyor (D-FILTER-01) | ✓ verified (`view-filters.ts:162-174` + e2e test) |
| 2d.2 "count=0" probe pre-3a geçersiz (false negative) | 🔍 partial (by-id pre-3a geçersiz; tam komut alıntılanmadı) |
| Backend test coverage | ✓ verified (3 test dosyası) |
| Frontend render test coverage | ⚠️ yok (boşluk) |
| Prod'da top-level initial görünür mü | 🔍 honest gap — Q2 Tarayıcı GEREKLİ |
| Bug-RENDER-03 / TODO çakışması | ✗ yok (verified) |

— Discovery, Architect Claude, 2026-05-26 (commit edilmedi — inceleme bekliyor)
