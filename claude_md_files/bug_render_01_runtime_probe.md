# Bug-RENDER-01 Runtime Probe Report

**HEAD:** `ac3d6a4` | **Tarih:** 2026-05-25
**Önceki:** `bug_render_01_rediscovery.md` (R1 iki defekt + 🔍 honest gap)
**Probe türü:** Backend WS-protocol probe (AG-domain, headless). **NOT browser** — bkz "Kapsam dürüstlüğü".

> **Kapsam dürüstlüğü (kritik):** Architect'in spec'lediği probe **browser + DevTools console** gerektiriyor (Model A aç → switch → console.log oku). Bu **Tarayıcı'nın rolü** — ben backend AG'yim, browser'ım yok, browser console çıktısı gözlemleyemem. Gözlemlemediğim browser çıktısını uydurmak, övülen "kanıtlamadığını kanıtlanmış sunma" disiplinini ihlal ederdi. Bunun yerine **çalıştırabildiğim backend-domain probe**'u yaptım (WS yanıt sıralaması/korelasyonu) — bu, atıf matrisini **server-side reordering'i ELEYEREK** daralttı. Tam DOM-mix atfı hâlâ Tarayıcı'nın browser run'ını bekliyor (instrumentation aşağıda hazır).

---

## 1. Ne Test Ettim (backend-runnable kısım)

Lokal diagram-service'i ayağa kaldırdım (build EXIT 0, `PORT=3009`, standalone, DB yok), tek WS bağlantısı (gerçek app gibi — `diagramClient` singleton) üzerinden:
- Model A (BÜYÜK: 400 state + 800 entry action, 33KB) **önce** gönder
- Model B (KÜÇÜK: 2 state, 84B) **hemen sonra** gönder (aynı tick)
- Yanıt sırasını, timestamp'i, hangi modeli, `uri` echo olup olmadığını ölç

**Hedef:** Defekt #2'nin "geç gelen A modeli B'yi overwrite eder (out-of-order)" mekanizması gerçek mi?

## 2. Probe Çıktısı (canlı, ✓ verified)

```
===== PROBE LOG =====
[7ms]   OPEN
[7ms]   SENT parse A (uri=file://A.sysml, 33320 bytes)
[8ms]   SENT parse B (uri=file://B.sysml, 84 bytes)
[139ms] RESP model=A (BIG)   childCount=2403 hasUriEcho=NO viewType=state-transition sampleIds=["pkg__BigSensorA","def__MachineA","usage__MachineA_sA0","usage__MachineA_sA1"]
[144ms] RESP model=B (small) childCount=7    hasUriEcho=NO viewType=state-transition sampleIds=["pkg__TestStates","def__MachineStates","usage__MachineStates_On","usage__MachineStates_Off"]

===== ANALYSIS =====
Send order:       A then B
Response order:   A then B
Out-of-order?     no (A then B, in order)
uri echo in resp: ABSENT → client cannot correlate
```

## 3. Atıf — Net Sonuç

### ✓ verified: Defekt #2 "out-of-order server reordering" mekanizması REPRODÜKE OLMADI
A (400× büyük) önce gönderildi, **önce yanıtladı**. Sebep — kod-kanıtlı: `websocket-server.ts:86` `parseSysMLText` **senkron** ve event-loop'u bloke ediyor; A'nın parse'ı bitene kadar B'nin handler'ı başlamıyor. `await renderDiagramWedge` async olsa da parse-dominant iş senkron olduğu için **tek bağlantıda mesajlar etkin olarak serialize oluyor** → yanıtlar **gönderim sırasında** geliyor. Cold-start (ilk state-transition → lazy `import()`) bile sırayı bozmadı.

**Sonuç:** Re-discovery'deki defekt #2'nin "geç A yanıtı reordering ile kazanır" çerçevesi **bu probe ile zayıfladı.** Server tek bağlantıda yeniden sıralamıyor.

### ✓ verified: Defekt #2'nin YAPISAL kısmı (korelasyon yok) gerçek ama latent
`hasUriEcho=NO` — yanıt `uri` taşımıyor (`websocket-server.ts:117-123`), client de korelasyon yapmıyor (`EditorPage.tsx:392`). AMA server in-order yanıtladığı için, **son `setDiagram` = son gönderilen parse**. Clean switch'te client B'yi son gönderiyor (load effect) → model = B. Yani korelasyonsuzluk **latent risk** (reconnect/pendingText replay veya client'ın stale-last göndermesi durumunda patlar), bu probe senaryosunda stale-A üretmiyor.

### 🔍 partial → REDIRECT: Node-persistence client-side
İki server-side mekanizma da (reordering yok + in-order delivery) **A'nın node'larının stable B render'ında kalmasını AÇIKLAMIYOR.** Re-discovery R1.0'da kanıtlandı: render yalnız `model.children`'dan beslenir + `key={node.id}` → model=B ise A unmount edilmeli. Server B'yi temiz, son, in-order veriyor. → **DOM-mix client-side render/reconciliation kaynaklı** (ELK stale-write defekt #1 + React/SVG reconciliation), bu **AG-domain dışı, Tarayıcı browser probe'u gerektiriyor.**

**Architect matrisine göre sonuç:** "Hiçbiri (server-side) açıklamıyorsa → üçüncü faktör (client render) → durum raporla, hipotez kurma." → **Durumu raporluyorum, hipotez kurmuyorum.** Node-persistence'ın kesin client-side mekanizması (defekt #1 stale-write mi, React reconciliation mı, izlenmemiş nested-render mi) **Tarayıcı'nın aşağıdaki instrumentation'ı çalıştırmasıyla** atfedilecek.

---

## 4. Tarayıcı İçin Hazır Instrumentation (commit edilmez, lokal)

Tam DOM-mix atfı için Tarayıcı (browser + DevTools) şunu çalıştırır:

```ts
// EditorPage.tsx — diagramClient.onModel handler (~392):
diagramClient.onModel((model, diags) => {
  console.log('[PROBE setDiagram]', { ts: Date.now(), currentFileId: fileId, currentViewType: viewType,
    childIds: model?.children?.map(c => c.id) ?? [] });
  setDiagram(model); setDiagnostics(diags);
});

// DiagramViewer.tsx — ELK .then success path (~908, setPositions ÖNCESİ):
console.log('[PROBE ELK.then]', { ts: Date.now(), cancelled,
  posKeys: [...newPositions.keys()], nodeIdSetKey });

// DiagramViewer.tsx — render input (renderNodes ~1688):
console.log('[PROBE render-input]', { ts: Date.now(), modelChildIds: model?.children?.map(c=>c.id) ?? [] });
```

**Atıf matrisi (Tarayıcı doldurur):**
| Browser gözlemi | Atıf |
|---|---|
| `[setDiagram]` switch SONRASI stabilize olan SON çağrı A'nın id'lerini içeriyor | Defekt #2 (client stale-last / reconnect) — server değil |
| SON `[setDiagram]` temiz B AMA `[ELK.then]` `cancelled=true` iken A'nın posKeys'iyle fire ediyor | Defekt #1 (ELK stale-write) PRIMARY |
| SON `[setDiagram]` temiz B, `[render-input]` temiz B, ama DOM'da A `<g>`'leri var | React/SVG reconciliation (4. defekt) — render audit |

**Ön-koşul:** R3 (`data-node-id`) eklenirse Tarayıcı DOM-tespiti `querySelectorAll('[data-node-id]')` ile kesinleşir (şu an text+bbox ile yapıyor).

---

## 5. Verification Etiketi Özeti

| Bulgu | Etiket |
|---|---|
| WS yanıtı `uri` echo etmiyor (korelasyon imkânsız) | ✓ verified @ ac3d6a4 (kod + probe hasUriEcho=NO) |
| Tek bağlantıda yanıtlar gönderim-sırasında (reordering YOK) | ✓ verified (canlı probe: A→B sent, A→B resp) |
| Sebep: `parseSysMLText` senkron, event-loop bloke → serialize | ✓ verified (kod websocket-server.ts:86 + probe davranışı) |
| Defekt #2 "out-of-order kazanır" mekanizması | ✗ REFUTED (bu probe) — latent yapısal risk olarak kalır |
| Defekt #1 (ELK no-cancel-guard) | ✓ verified (kod, re-discovery) — konum stale eder, node üretmez |
| Node-persistence (DOM-mix) kök nedeni | 🔍 partial — client-side, Tarayıcı browser probe gerekli |
| Üçüncü faktör (React/SVG reconciliation) ihtimali | 🔍 hypothesis — yalnız browser probe ile elenir/doğrulanır |

**Özet:** Backend probe, atıf alanını **server-side'ı eleyerek** daralttı. Kesin atıf için tek eksik = Tarayıcı'nın browser instrumentation run'ı. Ben (AG) bunu yapamam; dürüstçe Tarayıcı'ya devrediyorum.
