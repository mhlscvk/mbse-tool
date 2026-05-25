# Bug-RENDER-01 Scope Proposal (AG — implementer kafasıyla)

**HEAD:** `ac3d6a4` | **Tarih:** 2026-05-25
**Girdi:** `bug_render_01_rediscovery.md` + `bug_render_01_runtime_probe.md`
**Etiket disipline:** Effort sayıları **🔍 estimate** (kesin değil — Platform Owner "kesin" sanmasın). Bağımlılık/yapı önerileri kod-kanıtlı (✓).

> **Kritik bağlam (probe sonrası):** Probe, **node-persistence'ın kök nedenini henüz ATFETMEDİ** (server-side elendi → client-side, Tarayıcı browser probe bekliyor). Yani **headline bug'ın FIX'i henüz sorumlulukla scope'lanamaz.** Bu, slice yapısı önerimi doğrudan şekillendiriyor: önce güvenli/kanıtlı fix'ler + verification altyapısı ship et, attribution'ı aç, SONRA headline fix'i scope'la.

---

## B1. Slice Yapısı Önerisi → **Probe-gated 2-slice (reframed option b)**

Architect'in üç seçeneğinin hiçbiri tam oturmuyor çünkü hepsinde örtük varsayım var: "node-persistence defekti biliniyor." Bilinmiyor (probe redirect etti). Önerim:

### Slice 3a — "Safe fixes + verification infra" (ŞİMDİ ship edilebilir)
**İçerik:**
- **R3: `data-node-id={node.id}`** her node `<g>`'sine (~10 site) — Tarayıcı DOM-tespit verifier prereq'i
- **Defekt #1: ELK `.then` cancelled-guard** (DiagramViewer.tsx:908-938 → `if (cancelled) return;` setPositions öncesi) — GERÇEK fix, switch sonrası **mis-positioned/floating element**'leri düzeltir (Tarayıcı'nın gördüğü y=660 sallanma)
- **Brief v1.4 appendix:** §5.2/§6 render-kanalı düzeltmesi (WS değil SSE conflation) + anti-pattern #21 honest-gap örneği

**Neden tek slice:** Üçü de tek-paket (DiagramViewer + doc), düşük risk, **bağımsız kullanıcı değeri var** (#1 görünür mis-positioning'i düzeltir → option-b'nin "infra-only zero-value deploy" eleştirisini geçersiz kılar; data-node-id tek başına değil, gerçek fix'le ship oluyor). Deploy edilince **Tarayıcı node-persistence'ı temiz DOM ile atfeder.**

### [GATE] Tarayıcı re-probe (3a deployed) → node-persistence atfı
3a'daki `data-node-id` + instrumentation ile Tarayıcı `bug_render_01_runtime_probe.md §4` matrisini doldurur. **Bu olmadan 3b scope'lanamaz.**

### Slice 3b — "Attributed node-persistence fix + interaction cleanup" (attribution SONRASI)
**İçerik (attribution'a göre kesinleşir):**
- Node-persistence fix (atfedilen defekt: ya client stale-guard, ya React/SVG reconciliation, ya WS korelasyon — hangisiyse)
- **Defekt #3: interaction state cleanup** (`multiSelectedNodeIds` + parent `diagramSelectedNodeId/EdgeId` switch'te reset) — ilk Discovery bulgusu, attribution'dan bağımsız ama aynı slice'ta mantıklı
- **R2 guard** (Monaco autosave stale-closure) — SADECE Tarayıcı/teyit cross-file PUT corruption gösterirse
- **Regression test'ler** (atfedilen defekt için — sıfırdan)

**Reddedilen alternatifler:**
- **Tek slice (3):** RED — headline fix henüz scope edilemez (attribution pending); büyük PR + bilinmeyen kapsam.
- **4 alt-slice:** RED — overhead, momentum kaybı; #1+R3 ayırmak gereksiz (ikisi birlikte güvenli+değerli).

---

## B2. Effort Tahmini (🔍 estimate — kesin değil)

### Slice 3a
| Kalem | 🔍 Tahmin | Not |
|---|---|---|
| Implementation | 2-3 saat | data-node-id ~10 site mekanik; ELK guard ~3 satır ama dikkatli (async effect); appendix ~30dk |
| Test yazımı | 2-3 saat | ELK cancel-guard regression (async effect testi — RTL veya effect extraction, DiagramViewer testi SIFIRDAN); data-node-id render assertion |
| Pre-deploy build/tsc | **Düşük risk** | Tek paket (web-client), tip değişikliği yok; api-server pre-existing tsc toleransı etkilenmez |
| Deploy + dogfood | 30-45 dk | web-client build + pm2 (veya static SPA serve) + Tarayıcı re-probe (dogfood'u ikiye katlar: hem fix teyit hem attribution) |

### Slice 3b
| Kalem | 🔍 Tahmin | Not |
|---|---|---|
| Implementation | **1-2 gün — attribution'a BAĞLI** | client stale-guard ~yarım gün; React reconciliation fix ~yarım gün; **WS korelasyon (uri/requestId echo) = multi-package (shared-types+diagram-service+diagram-client+EditorPage) ~1-2 gün + backend dokunuşu** |
| Defekt #3 (interaction cleanup) | 2-3 saat | cleanup effect'e setMultiSelectedNodeIds(new Set()) vb + parent reset (EditorPage + belki TrainingPage) |
| Test yazımı | 3-4 saat | node-persistence regression + interaction reset testi |
| R2 guard (opsiyonel) | 1-2 saat | sadece corruption teyit edilirse |
| Pre-deploy build/tsc | **Orta risk EĞER WS korelasyon** | multi-package → shared-types tip değişikliği → diagram-service + web-client tip uyumu; `pnpm build` 4/4 EXIT 0 pre-flight ZORUNLU (brief v1.4 §3.1.1) |
| Deploy + dogfood | 45-60 dk | WS korelasyon ise diagram-service de deploy + restart + counter dogfood; aksi halde web-client only |

**🔍 Toplam kaba:** 3a ~1 gün (impl+test+deploy), 3b ~1.5-2.5 gün (attribution'a göre). **Bu sayılar tahmin — özellikle 3b attribution belirsizliği taşıyor.**

---

## B3. Bağımlılık Sırası (✓ kod-kanıtlı)

```
1. data-node-id (R3)  ──┐
                        ├─► Slice 3a (birlikte ship, tek deploy)
2. ELK cancel-guard(#1)─┘         │
                                  ▼
3. [GATE] Tarayıcı re-probe (3a'nın data-node-id'siyle temiz DOM tespiti)
   → node-persistence ATFI
                                  │
                                  ▼
4. Node-persistence fix (atfedilen) ─┐
5. Interaction cleanup (#3) ─────────├─► Slice 3b
6. R2 guard (varsa) ─────────────────┘
7. Regression test'ler (atfedilen defekt için)
```

**Kritik bağımlılıklar:**
- **data-node-id, fix-verification'ın ön-koşulu (✓ verified):** Şu an SVG node'larında DOM identity YOK (re-discovery R3). Tarayıcı stale-tespiti text-content+bbox ile kırılgan. `data-node-id` olmadan **herhangi bir node-level fix'i temiz doğrulayamayız.** → R3 ZORUNLU ÖNCE.
- **Node-persistence fix, Tarayıcı attribution'ına BAĞLI (✓ probe ile kanıtlı):** Server-side elendi; client-side mekanizma browser probe olmadan bilinmiyor. Attribution'dan önce fix yazmak = hipoteze-fix (anti-pattern #13). → GATE ZORUNLU.
- **ELK cancel-guard (#1) bağımsız (✓):** Attribution'dan bağımsız gerçek fix → 3a'da güvenle gidebilir, hem değer üretir hem 3a'yı "infra-only" olmaktan çıkarır.
- **Interaction cleanup (#3) bağımsız (✓):** Node-persistence'tan ayrı eksen; 3b'de toplanır.

---

## Özet (Platform Owner kararı için)

| Soru | AG önerisi |
|---|---|
| Slice yapısı | **Probe-gated 2-slice:** 3a (data-node-id + ELK guard + appendix) → Tarayıcı attribution gate → 3b (node-persistence fix + interaction cleanup + tests) |
| Neden tek/dört değil | Tek: headline fix scope edilemez (attribution pending). Dört: gereksiz overhead. İki: 3a güvenli+değerli, attribution'ı açar. |
| İlk ne gider | data-node-id + ELK cancel-guard (3a), birlikte |
| Headline fix ne zaman | 3b'de, Tarayıcı attribution'ından SONRA |
| 🔍 Effort | 3a ~1 gün, 3b ~1.5-2.5 gün (attribution belirsizliği) — **tahmin, kesin değil** |
| Backend dokunuşu | 3a: HAYIR. 3b: SADECE node-persistence = WS korelasyon çıkarsa (multi-package) |

**Brief v1.0 için açık DP:** (1) 3a'yı şimdi onaylayıp Tarayıcı gate'ini paralel kurmak mı, yoksa Tarayıcı probe'unu ÖNCE (instrumentation lokal, data-node-id'siz kırılgan ama mümkün) yapıp tek seferde tam scope mu? AG önerisi: **3a-first** — çünkü ELK guard + data-node-id zaten kesin gerekli, beklemeye gerek yok, ve 3a deployed olunca Tarayıcı'nın attribution'ı çok daha güvenilir olur.
