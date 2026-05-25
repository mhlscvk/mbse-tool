# Faz 1 Brief v1.4 — Canonical Operational Notes

**Versiyon:** v1.4 (Slice 2d.1 + 2d.3 + 2d.2 sonrası, Faz 1 state-machine refactor zinciri tamam)
**Tarih:** 2026-05-25
**Author:** Architect Claude
**Önceki sürümler:** v1.0 (Faz 1 ilk brief), v1.1 (Slice 2c eklemeleri), v1.2 (Slice 2d.1 narrative), v1.3 (Slice 2d.1 sonrası canonical ops)
**Çapraz referans:** `phase1_slice2d1_handover.md`, `phase1_slice2d3_handover.md`, `phase1_slice2d2_handover.md`, `renderer_refactor_strategy_v2.md`, `docs/adr/005-state-machine-renderer.md`

---

## Amaç

Bu doc **canonical operasyonel prosedürler ve pattern kataloğu**. Slice 2d.1 + 2d.3 + 2d.2'nin lessons learned'ları burada **direkt uygulanabilir komutlar ve kurallar** olarak duruyor. Gelecek slice'larda (2e, Faz 2) AG ve Architect bu doc'a referans verecek.

**Lifecycle:** Sürekli güncelleme. Yeni slice'larda yeni pattern öğrenildikçe v1.5, v1.6 olarak iterasyon. v1.2 (tarihsel narrative) sabit, v1.3 ve sonrası (canonical) yaşayan dokümantasyon.

**v1.4 delta özet** (v1.3 üzerine):
- §1: Pre-deploy tsc verification + test breakdown drift düzeltme (340+674=1014/1142, CLAUDE.md güncellenmesi notu)
- §3.2: Production HEAD sürpriz disiplini (yeni alt-bölüm)
- §4.1: Counter endpoint host-only browser erişim uyarısı
- §4.4: Health endpoint canonical (yeni alt-bölüm, `/health` path)
- §5.1: Tarayıcı görsel otorite nüansı (tablo güncellemesi)
- §5.2: Render kanalı WS/SSE deployment farkı + DOM programatik teyit
- §5.4: Counter PRIMARY kanıt vurgusu, kanıt üçgeni öncelik tablosu
- §6.4: Post-flush log yorumu (yeni alt-bölüm)
- §7.4: Olgunluk eğrisi notu (16+ → 3 → 3 trendi)
- §8.3: Discovery → Revision → Impl 4-adım canonical teyit
- §8.4: Pre-impl Visual Preview Pattern (yeni alt-bölüm)
- §8.4.1: PRE screenshot arşivleme + aynı view zorunluluğu (yeni alt-bölüm)
- §9.4: Handover backlog verification etiketi (yeni alt-bölüm, AG önerisi)
- §10.3: #13 güncelle (4 tekrar), #19 + #20 + #21 ekle
- §10.4: Test Mimarisi Disipline (yeni alt-bölüm)
- §11-§12-§13: Slice 2d.2/2d.3 tamamlanma güncellemeleri + state machine kapanış teyidi entegrasyonu

---

## 1. Test Sayım — Root vs Pre-commit Hook

**Önemli ayrım:**

**Güncel formül (Slice 2d.1 + 2d.3 + 2d.2 sonrası, AG canlı ölçüm 2026-05-25):**

```
root pnpm test  = api-server + diagram-service       = 340 + 674 = 1014
pre-commit hook = api + diagram + web-client         = 340 + 674 + 128 = 1142
```

**Slice'lar boyunca diagram-service test sayısı evrim:**
- Pre-Slice 2d.1: 663
- Slice 2d.1: +9 (multi-root transformer + e2e + edge) → 672 (raporlanan 663 v1.3'te güncellenmemişti)
- Slice 2d.3: +5 multi-root container + +2 def-vs-usage = +7 → 670 (overlap düzeltmesi)
- Slice 2d.2: +4 integration test → 674

**Kullanım:**
- **Lokal hızlı test:** `pnpm test` (1014) — geliştirme döngüsünde yeterli
- **Commit öncesi tam coverage:** Pre-commit hook otomatik (1142) — web-client da dahil
- **Production deploy öncesi:** Pre-commit hook ZORUNLU. Web-client'i atlamak frontend regression riski

**Brief yazımı:** "1142 yeşil" derken pre-commit hook kastediliyor. "1014 yeşil" derken manuel `pnpm test`.

**Sayım değişirse:** Yeni test eklenince bu doc güncellenmeli (v1.5, v1.6...). **CLAUDE.md de güncellenmeli** (AG 2026-05-25 raporu: CLAUDE.md hala 1009 baseline'ında, drift birikiyor).

---

## 2. PM2 Operasyonları (Canonical)

### 2.1 Env doğrulama — Ground Truth

```bash
cat /proc/$(pm2 pid <app>)/environ | tr "\0" "\n" | grep -E "FF_|NODE_ENV"
```

**Kurallar:**
- `pm2 env <app>` **KULLANMA** — false-negative riski (Slice 2d.1'de kanıtlandı, cache'lenen env'i göstermeyebilir)
- Cross-check için en az 2 env var birlikte (örn. FF + NODE_ENV) — env-loading'in tüm section'u aldığını kanıtlar
- Beklenmeyen değer veya eksik var → DUR, rollback

### 2.2 Restart (env değişikliği için)

```bash
pm2 delete <app>
pm2 start ecosystem.config.cjs --only <app>
```

**Kurallar:**
- `pm2 restart <app>` **KULLANMA** — cache'lenen `--update-env` flag'ini KORUR
- `pm2 reload <app>` **KULLANMA** — graceful restart, env cache aynı sorun
- `pm2 delete + start` kombo: env baştan yüklenir, ecosystem.config.cjs'ten gelir

### 2.3 Manuel flag açma (geçici test için)

```bash
pm2 delete <app>
FF_<NAME>=true pm2 start ecosystem.config.cjs --only <app> --update-env
```

**Kurallar:**
- Sadece **geçici dogfood** için (production'da kalmamalı)
- Permanent flip için ecosystem.config.cjs edit + commit + deploy (geçici flag bırakma)
- `--update-env` flag'i komut satırı env'lerinin cache'lenmesini sağlar

### 2.4 Flag rollback (manuel veya config-based)

```bash
pm2 delete <app>
pm2 start ecosystem.config.cjs --only <app>   # config'deki state'e döner
```

Sonra `/proc` ile doğrula — komut satırı env'i gitmiş, config env'i aktif olmalı.

### 2.5 Log management

```bash
pm2 flush <app>          # log dosyalarını temizler (truncate)
pm2 logs <app> --lines 50 --nostream --raw   # son N satır, blocking değil
pm2 logs <app> --raw --lines 0   # canlı tail, BLOCKING
```

**Kurallar:**
- **`pm2 flush` self-dogfood öncesi yap** — stale log'lar yeni vs eski hatayı ayırt etmeyi zorlaştırır
- Canlı tail blocking olduğu için **AG snapshot polling tercih etsin** (tail -n 120 + grep, persistent dosya zaten kayıp yok)
- Monitor (background grep): `tail -F | grep -E "pattern"` — failure-channel için

---

## 3. Build & Deploy (Canonical)

### 3.1 Per-package build

```bash
cd packages/shared-types && pnpm build
cd packages/api-server && npx tsc || true   # pre-existing TS errors tolerated
cd packages/diagram-service && pnpm build
cd packages/web-client && pnpm build
```

**Kurallar:**
- `pnpm build` (turbo, root) **KULLANMA** — api-server pre-existing TS hatalarında HALT eder, tüm pipeline durur
- API-server'da `npx tsc || true` — tolerated (pre-existing hatalar geliştirme borcu, çözülmediği sürece)
- Sıra önemli: shared-types önce (diğerleri import ediyor), api/diagram/web sonra (paralelize edilmez şu an)
- Eğer api-server hata sayısı **dramatik artarsa** (örn. 50+ yeni error) DUR ve raporla — gerçek regression olabilir
- Production'da **sadece değişen paket**i build etmek yeterli ama disipline için tüm sequence (config-only değişiklik bile) önerilir

### 3.1.1 Pre-deploy tsc Verification (CANONICAL, Slice 2d.2'den)

**Sorun:** Pre-commit hook esbuild kullanır, type checking YAPMAZ. esbuild syntax error yakalar, semantic TS error yakalamaz. Lokal `pnpm test` geçer ama deploy build'i HALT edebilir.

**Önlem:** AG **deploy öncesi** `pnpm build` ile tsc'yi ön-çalıştırır, production build'inin geçeceğini lokal'de teyit eder.

```bash
# Deploy öncesi lokal pre-flight (her slice deploy'undan önce):
cd packages/shared-types && pnpm build
cd packages/diagram-service && pnpm build
cd packages/web-client && pnpm build
# api-server için: npx tsc || true (pre-existing toleransı)
```

**Kurallar:**
- Lokal `pnpm build` 4/4 EXIT 0 değilse deploy başlama
- TS error sayısı api-server'da artmışsa (baseline'a göre) DUR, root cause analiz
- Bu adım Slice 2d.2'de doğdu — deploy sırasında sürpriz halt olmadı, lokal teyit önceden yapıldı

### 3.2 Git delivery

```bash
# Lokalde:
git push origin master

# Production'da:
ssh root@65.109.134.254 'cd /opt/systemodel && git pull origin master'
```

**Kurallar:**
- `deploy.sh` **KULLANMA** — stale `REMOTE_BRANCH` config + `git add -A` (untracked brief'leri süpürür)
- Manuel branch checkout **KULLANMA** — master fast-forward yeterli
- Pull öncesi `git status --short` ile prod working tree kontrolü (Slice 2d'de untracked prisma artifact'leri vardı, pull'u engellemediler ama kontrol disipline'i şart)
- Pull sonrası `git log --oneline -1` ile HEAD teyit

### 3.2.1 Production HEAD Sürpriz Disiplini (CANONICAL, Slice 2d.2'den)

**Sorun:** Production HEAD beklenmedik commit'te olabilir (paralel workstream, manuel müdahale, eski deploy). Reflexif `git pull` veya `git reset` ile karşılık verme tehlikeli.

**Protokol (5 adım):**

```bash
# 1. Mevcut production HEAD:
ssh root@<host> 'cd /opt/systemodel && git rev-parse HEAD'
# → örn. 3301417 (beklenenden farklı)

# 2. Ancestor check — production HEAD lokaldeki HEAD'in atası mı?
ssh root@<host> 'cd /opt/systemodel && git merge-base --is-ancestor <prod_HEAD> <local_HEAD>; echo $?'
# → 0: ata, 1: değil

# 3. Fast-forward kontrolü — pull yapılırsa diverge olur mu?
ssh root@<host> 'cd /opt/systemodel && git fetch origin && git merge-base --is-ancestor HEAD origin/master; echo $?'
# → 0: fast-forward mümkün, 1: diverge

# 4. Runtime impact analizi — aradaki commit'ler ne?
ssh root@<host> 'cd /opt/systemodel && git log --oneline <prod_HEAD>..origin/master'
# → doc-only mi (md, ADR), code mi?

# 5. Karar:
# - Ata + fast-forward + doc-only → pull devam et
# - Ata + fast-forward + code change → ek dogfood gerekebilir, Architect onayı
# - Ata değil VEYA diverge → DUR, Architect koordinasyonu
```

**Slice 2d.2'de uygulama:** Prod HEAD 3301417'deydi (beklenenden eski), ancestor check ile fast-forward kanıtlı, aradaki commit'ler doc-only (System2Product brief'leri). Pull devam etti, smoke temiz.

**Anti-pattern:** "Prod HEAD farklı → hemen reset --hard" YAPMA. Önce ancestor + diverge + impact analizi.

### 3.3 Untracked artifact'ler

Production'da bazı build artifact'leri untracked olarak duruyor:
- `packages/api-server/prisma/seed-examples.{d.ts,js,map}` (gitignore'a eklenmemiş, scope dışı, Bug-PRISMA-01 backlog candidate)
- Bunlar pull'u engellemiyor

---

## 4. Counter Endpoint

### 4.1 Endpoint canonical

```
GET http://localhost:3002/internal/renderer-stats
```

**Auth:** Yok (internal endpoint, **host-only erişim**)

**ÖNEMLİ — Browser session'dan erişim:** Bu endpoint sadece sunucu localhost'undan çağrılabilir. Tarayıcı Claude bunu prod URL'inden (`systemodel.com/internal/renderer-stats`) çağırırsa **SPA shell HTML döner** (HTTP 200 ama body Monaco environment script'i — SPA router catch-all). **Bu endpoint deploy edilmedi anlamına gelmez**, sadece browser'dan erişilemez. Counter doğrulaması **AG kanalından** (SSH + `curl localhost:3002`) yapılmalı.

**Admin endpoint (`/api/admin/renderer-stats`):** Bearer token ister, browser session'dan erişilemez. Internal endpoint dogfood için yeterli.

### 4.2 Response format

```json
{
  "totalRenders": <number>,
  "byViewType": {
    "<view-type>": {
      "<outcome>": <count>
    }
  },
  "unmapped": <number>
}
```

**Outcome'lar:**
- `new` — yeni renderer başarılı
- `old-fallback-from-new` — yeni renderer crash, wedge legacy'ye düştü
- `old-default` — flag kapalı veya view-type mapping yok
- `old-fallback-not-registered` — flag açık ama renderer kayıtlı değil

### 4.3 Counter okuma akışı

```bash
ssh root@<host> 'curl -s http://localhost:3002/internal/renderer-stats'
```

**Dogfood yorumu:**
- Yeni renderer çalışıyor → `new` artar
- Yeni renderer crash → `old-fallback-from-new` artar (kritik: hotfix başarısız)
- Restart sonrası counter sıfırlanır (in-memory, persistent değil) — baseline

### 4.4 Health Endpoint (CANONICAL, AG kapanış teyidinden)

```
GET http://localhost:3002/health
```

**NOT:** Path **`/health`**, `/api/health` DEĞİL. AG 2026-05-25 kapanış teyidinde brief tablosundaki `/api/health` path'i 404 verdi, doğrusu `/health`.

**Response:**
```json
{"status":"ok","service":"diagram-service","uptime_seconds":<N>}
```

**Kullanım:**
- Servis sağlık teyidi (HTTP 200 + JSON)
- `uptime_seconds` pm2 uptime ile cross-check (tutmuyorsa restart yaşandı demek)
- Smoke test ve canlı durum sorgularında brief v1.3 §3 build/deploy sonrası kullanılmalı

---

## 5. Self-Dogfood Disipline

### 5.1 Üçlü orchestration

| Kanal | Sorumluluk |
|-------|-----------|
| 🖥️ **Tarayıcı Claude** | Browser UI: WS panel inceleme, görsel doğrulama (**ölçülebilir kriterler için otorite**), screenshot, DOM analizi |
| 👁️ **AG (backend)** | Log snapshot polling, monitor (background grep), counter sorgu |
| 🧭 **Architect** | Kanıt üçgenini değerlendirme, karar (flip / rollback / şüphe → ek inceleme) |
| 👤 **Platform Owner (Muhlis)** | **Subjektif SysML semantik kararlar** (örn. "X spec'e uygun mu", "görsel değişiklik kabul edilir mi") |

**Operating model nüansı (Slice 2d.2'de keşfedildi):**
Tarayıcı Claude görsel otorite **ölçülebilir kriterler** için (element sayısı, console error, network response). Subjektif SysML semantik kararları (örn. "pseudo-initial silinmesi anlamlı mı") Platform Owner'a devredilir. Slice 2d.2'de DP2: Pre-impl Visual Preview pattern bu devri kanıtladı (lokal POST vs prod PRE side-by-side, Platform Owner kabul).

### 5.2 Tarayıcı Claude için canonical akış

Bkz. `tarayici_claude_dogfood_brief.md` template. Özet:
1. systemodel.com login + DevTools (Network → render kanalı: **WS veya SSE** filtresi, Console, Elements)
2. Proje + dosya aç + view sekmesi seç → render kanalı tetikler
3. Render kanalı frame/event'lerini incele → server response `rendererUsed` ara (kanal WS ise frame, SSE ise event payload)
4. Console error/warn ara
5. Görsel kontrol (multi-root, nested, compartments, transitions, pseudo-states)
6. Screenshot
7. Counter sorgu — **browser'dan ÇALIŞMAZ** (bkz. §4.1). Counter doğrulaması AG kanalından
8. Raporlama: kanıt-temelli ham, hipotez yok

**Kritik kurallar:**
- Render kanalını doğru tespit et — production deployment'a göre WS veya SSE olabilir. Tarayıcı Claude 2026-05-25 dogfood'unda kanalın SSE olduğunu keşfetti, WS panel boş çıktı.
- XHR/Fetch'te diagram trafiği YOK
- Hipotez kurma, kanıt topla
- DevTools panel açılamazsa fallback: WebSocket.prototype.send monkey-patch + DOM analizi (Slice 2d.1'de Tarayıcı Claude'un yaptığı)
- **`rendererUsed` marker'ı render kanalında bulunamazsa:** counter (AG kanalı) primary kanıt, DOM dolaylı kanıt (yeni renderer'a özgü davranış özellikleri — örn. multi-root, container labels, pseudo-initial yokluğu) sekonder kanıt

### 5.2.1 DOM Programatik Teyit (CANONICAL, Slice 2d.2'den)

**Sorun:** Görsel sezgi yanıltıcı olabilir — bir node "yok gibi görünür" ama 1px boyutta bir köşede çizilmiş olabilir. "Görsel olarak görmedim" yetersiz kanıt.

**Doğrusu:** DOM seviyesinde **element sayısı saymak** ve **parent ID kontrolü** yapmak.

**Kullanım örneği (Slice 2d.2):**
```javascript
// "pseudo-initial__on" filter sonrası IR'dan silindi, mevcut renderer onu zaten çizmiyor mu?
const pseudoInitials = document.querySelectorAll('[id*="pseudo-initial"]');
console.log('pseudo-initial element count:', pseudoInitials.length);
// → 0 ise: renderer zaten çizmiyor (no-op flip kanıtı)
// → >0 ise: silinen IR node'u hala DOM'da, renderer crash var

// Yanlış pozitif elemine için parent kontrolü:
pseudoInitials.forEach(el => {
  console.log('parent:', el.closest('[id*="state-"]')?.id || 'orphan');
});
// → parent ID listesi expected ile match ediyor mu?
```

**Kurallar:**
- Görsel davranış sorgulanırken element count + parent kontrolü yap
- "Sayı 0" iddia ederken querySelectorAll sonucunu rapor et (görsel iddia değil, sayısal kanıt)
- WS frame içeriği + DOM count + counter — üçü hizalı ise davranış kanıtlı

### 5.3 AG için canonical akış (backend polling)

```bash
# Snapshot polling (blocking değil):
ssh root@<host> 'wc -l /root/.pm2/logs/diagram-out.log /root/.pm2/logs/diagram-error.log; tail -n 120 /root/.pm2/logs/diagram-out.log'

# Failure channel monitor (background):
ssh root@<host> 'tail -F -n 0 /root/.pm2/logs/diagram-out.log /root/.pm2/logs/diagram-error.log 2>&1 | grep -E --line-buffered "New renderer threw|exception|MODULE_NOT_FOUND"'

# Counter snapshot:
ssh root@<host> 'curl -s http://localhost:3002/internal/renderer-stats'
```

**Kurallar:**
- `pm2 logs --raw --lines 0` **KULLANMA** turn-based ortamda — blocking
- Snapshot polling kayıpsız (dosya persistent), ~90 sn'de bir özet
- Sürpriz çıkarsa anında raporla

### 5.4 Kanıt üçgeni

Karar verirken üç bağımsız kaynak hizalı olmalı:

| Kaynak | Pozitif sinyal | Öncelik |
|--------|---------------|---------|
| 👁️ **Counter (AG)** | `<view>.new` arttı, `old-fallback-from-new` ARTMADI | **PRIMARY** — ground-truth |
| 🖥️ Tarayıcı | Görsel temiz, 0 console error, DOM count beklenen, render kanalı marker (varsa) | Sekonder |
| 👁️ Log + monitor (AG) | Sessiz veya sadece startup banner, `[Wedge] threw` YOK | Sekonder |

**Counter PRIMARY ground-truth dili:**
- Yeni renderer çalıştı vs legacy fallback: sadece counter ayırt eder
- Görsel "temiz" görünebilir ama yeni renderer crash etmiş + legacy'ye düşmüş olabilir (yanıltıcı pozitif)
- Counter `new` artışı + `old-fallback-from-new` sıfır → yeni renderer'ın gerçekten çalıştığı kanıtı

**Tek kanal yetmez:**
- Counter `new` artmış olabilir AMA görsel broken ise → renderer çalışıyor ama yanlış output. Görsel doğrulama şart.
- Log sessiz olabilir AMA görsel veya counter problemli → render-time vs startup-time hata ayrımı.
- Görsel temiz + log sessiz ama counter eksik → yine de teyit gerekli (render hiç yapılmamış olabilir)

**Üçü hizalı → flip onayı. Counter eksik → flip ERTELENİR. Sekonder kanal eksik → ek inceleme ama parsiyel onay mümkün.**

---

## 6. Stale-Log Forensic (Anti-Pattern)

### 6.1 Sorun

PM2 log dosyaları truncate edilmiyor (manuel `pm2 flush` olmadıkça). Eski instance'ların hataları yeni instance'ın log'unda görünebilir. **Rollback DUR koşulu yanlış tetiklenebilir.**

### 6.2 Cross-reference protokolü (canonical)

Rollback DUR koşulu görüldüğünde **otomatik aksiyon YAPMA**, önce:

```bash
# 1. Mevcut process start time:
ssh root@<host> 'pm2 jlist | jq ".[] | select(.name==\"<app>\") | .pm2_env.pm_uptime"'
# → epoch ms, örn. 1748019288000

# 2. Log dosyası mtime:
ssh root@<host> 'stat -c "%Y %n" /root/.pm2/logs/<app>-*.log'
# → epoch sn, dosya başına

# 3. out.log içindeki startup banner sayısı:
ssh root@<host> 'grep -c "Service running" /root/.pm2/logs/<app>-out.log'
# → her restart bir tane ekler, beklenenden çoksa stale içerik var

# 4. Şüpheli hata satırının pozisyonu:
ssh root@<host> 'grep -n "Wedge.*threw" /root/.pm2/logs/<app>-out.log'
# → satır numarasına bak, mevcut process'in startup banner'ından önce mi sonra mı
```

**Karar matrisi:**
- Hata satırı mevcut process startup'ından **önce** → STALE, rollback yapma
- Hata satırı mevcut process startup'ından **sonra** → GERÇEK, rollback yap
- Log dosyası mtime current process start'ından **önce** → tüm log stale, hatalar geçmişten

### 6.3 Önlem: `pm2 flush` self-dogfood öncesi

```bash
ssh root@<host> 'pm2 flush <app>'
ssh root@<host> 'wc -l /root/.pm2/logs/<app>-*.log'   # 0 baseline teyit
```

Bu, dogfood sırasında çıkan herhangi bir error'ın **kesinlikle yeni** olmasını garanti eder.

### 6.4 Post-Flush Log Yorumu (CANONICAL, Slice 2d.2 kapanış teyidinden)

**Sorun:** `pm2 flush` sonrası log dosyaları boş kalır. Eğer process restart olmazsa, **startup banner ("Service running") da yeniden basılmaz**. Bu durumda `grep -c "Service running"` = 0 sonucu **stale değil**, "süreç hala flush'tan beri çalışıyor" anlamına gelir.

**Yorum matrisi (Slice 2d.2 kapanış teyidi 2026-05-25):**

| Durum | "Service running" sayısı | Log boyutu | Yorum |
|-------|--------------------------|------------|-------|
| Normal çalışma | 1+ (restart sayısı + 1) | >0 | Sağlıklı |
| Post-flush, restart yok | 0 | 0 | **Mümkün olan en sağlıklı durum** — sıfır error |
| Post-flush, restart oldu | 1+ | >0 | Restart sayısı kontrol et |
| Eski log + restart yok | "Service running" var ama eski | >0 (eski mtime) | Stale forensic gerekli |

**Kanıt üçgenindeki tamamlayıcı:** Post-flush boş log durumunda render kanıtı **counter'da** (counter in-memory, restart sonrası sıfırlanır ama post-flush + restart-yok durumunda counter restart öncesindeki son baseline'dan **artmaya devam etmiştir** — 2026-05-25'te 343 → 2095, 15h+ kesintisiz). PM2 uptime + counter artışı = sağlıklı.

---

## 7. Karar Noktası Tabanlı Checkpoint (Pattern)

### 7.1 Sorun (Slice 2d.1'den)

Slice 2d.1'de toplam ~16 checkpoint vardı, ~10'u gereksizdi. Özellikle F.1-F.8 her komut için ayrı onay aldı.

### 7.2 Pattern

**Checkpoint sayısı = karar noktası sayısı**, komut sayısı değil.

**Karar noktası:** Yön değiştirebilen bir aksiyon (production'a aktif etme, rollback, scope açma)
**Komut paketi:** Önceki onayın doğrudan devamı olan teknik adımlar (build, commit, pull → push paketinin parçası)

### 7.3 Brief şablonu

```markdown
### Paket X — [Karar noktası adı]

Komutlar:
- Komut 1
- Komut 2
- Komut 3

AG: Komutları sırayla çalıştır, **sadece** şu durumlarda DUR:
- Beklenmedik hata (non-zero exit, conflict, exception)
- Beklenen output sapması (örn. test sayısı farklı, HTTP 200 değil)
- Ampirik test başarısız (örn. /proc env doğrulama)

Normal flow: hepsi yeşilse konsolide rapor, sonraki paket onayı için bekle.
```

### 7.4 Hedef checkpoint sayıları ve olgunluk eğrisi

| Slice türü | Hedef |
|-----------|-------|
| Hotfix (Slice 2d.1 gibi) | 5-7 |
| Feature slice (Slice 2d.2 gibi) | 7-10 |
| Major refactor | 10-15 |
| Mimari değişiklik | 15+ ama paketle |

**Olgunluk eğrisi (Slice 2d.1 → 2d.3 → 2d.2):**

| Slice | Checkpoint sayısı | Karar noktası | Verimlilik |
|-------|-------------------|---------------|-----------|
| 2d.1 | 16+ | ~6 gerçek karar | Düşük (mikromanage) |
| 2d.3 | 3 | 3 gerçek karar | Yüksek |
| 2d.2 | 3 DP + paketler | 3 gerçek karar | Yüksek |

**Trend:** Doğru yönde — checkpoint sayısı = karar noktası sayısı. AG auto-DUR refleksleri olgunlaştı, Architect mikromanage azaldı. Bu disipline kanıtı, **olgunluk göstergesi**.

### 7.5 Architect sorumluluğu

Brief yazarken kendine sor:
1. Bu checkpoint **karar noktası mı**, yoksa **komut tamamlama** noktası mı?
2. Bu checkpoint'i atlasak ne olur? "Sürpriz çıkarsa AG zaten durur" → checkpoint gereksiz
3. 10+ checkpoint varsa brief'i revize et

### 7.6 AG sorumluluğu

Brief'te "DUR" demese bile AG'nin **kendi disiplinli auto-DUR refleksleri** çalışır:
- Beklenmedik exit code
- Beklenen output sapması
- Ampirik test failure
- Production-impacting irreversible aksiyon öncesi
- Stale-log forensic gerektiren durumlar

Architect bunlara güvenmeli — gereksiz mikromanage yapmamalı.

---

## 8. Brief Evrim Disipline

### 8.1 Ampirik doğrulama zorunluluğu

**Kural:** Brief'te bir tasarım iddiası **ampirik test edilene kadar HİPOTEZ**, ne kadar açık görünse de.

**Pattern:**
1. Discovery raporu → **veri** (kod yapısı, dependency'ler, mevcut davranış)
2. Brief tasarımı → **karar** (yeni yapı, scope)
3. Ampirik doğrulama → **kanıt** (gerçekten çalışıyor mu, sürpriz var mı)
4. Implementasyon → **uygulama** (kanıtlanmış tasarımı kod'a çevirme)

Slice 2d.1'de Adım 3 (ampirik) atlandı (Brief v1.1 §4 filter zorunlu iddiası). AG implementasyon sırasında yakalayıp DUR'du. Doğru pattern: **Adım 0 discovery'de sentetik proof + ampirik doğrulama yap, brief tasarımına bunu yedirme**.

### 8.2 Brief'te hipotez işareti

Brief'te tasarım kararı yazılırken:
- ✓ "Bu çalışır" iddiası → **kanıt referansı şart** (örn. "AG discovery §3'te kanıtlandı: renderer.ts:284-292 multi-root tüketim yapıyor")
- ⚠️ "Bu çalışması beklenir" hipotezi → **HIPOTEZ etiketi + ampirik doğrulama checkpoint'i** (örn. "Adım 0'da ampirik test: filter sensor-systems output'unu değiştiriyor mu?")

### 8.2.1 Çağrı sitesi haritası (CANONICAL, Slice 2d.1+2d.3+2d.2 4-tekrar pattern'den)

**Kural:** Brief yazımında her **"X dokunulacak / kaldırılacak / değiştirilecek"** iddiası için **çağrı sitesi haritası** zorunlu.

```bash
# Brief'te "X kaldırılacak" yazmadan önce:
grep -rn "X" packages/ --include="*.ts" --include="*.tsx"
# → Kim çağırıyor? Kaç test bağımlı? Side-effect var mı?
```

**Pattern (Slice 2d.1 + 2d.3 v1.0 + 2d.2 v1.0 + 2d.2 v1.1 — 4 tekrar):**
- Slice 2d.1: "filter integration zorunlu" iddiası — sensor-systems snapshot'ı bozardı
- Slice 2d.3 v1.0: "Sprotty group decorator" iddiası — Sprotty kurulu değildi
- Slice 2d.2 v1.0: "Legacy filter cleanup" iddiası — 59 test bağımlıydı
- Slice 2d.2 v1.1: "sensor-systems snapshot regen" iddiası — 3 test sitesi paylaşıyor

Her dört vakada AG Adım 0'da yakaladı, brief revize edildi. Önlem: Architect brief yazarken çağrı haritası adımını **atlama**, AG'nin Adım 0 keşfi bunu zorunlu kılsın.

### 8.3 Brief revision pattern (4-adım canonical)

| Sebep | Versiyon |
|-------|----------|
| Discovery raporu sonrası ilk taslak | v1.0 |
| AG Adım 0 keşfi sonrası design simplification/revize | v1.1 |
| Ampirik bulgu sonrası tasarım revize | v1.X+1 |
| Slice close-out narrative | v1.X+1 (final) |

**4-adım canonical (Slice 2d.1 doğdu, Slice 2d.3 ve 2d.2'de teyit edildi):**
1. **Architect brief v1.0** (hipotezler)
2. **AG Adım 0 keşif** (ampirik veri + POC)
3. **Architect brief v1.1** (kanıtlı tasarım)
4. **AG implementation** (atomic commit'ler)

Slice 2d.1: v1.0 → v1.1 → v1.2 (close-out). Slice 2d.3: v1.0 → v1.1 → impl. Slice 2d.2: v1.0 → AG snapshot mimarisi keşfi → v1.1 → impl. Bu pattern gelecek slice'larda standart.

### 8.4 Pre-impl Visual Preview Pattern (CANONICAL, Slice 2d.2'den)

**Amaç:** Görsel davranış değişikliği riski olan slice'larda **deploy öncesi** kullanıcı algısını teyit et. Sıfır rollback maliyeti.

**5 adım:**

1. **AG geçici patch yazar** — clearly-marked (`// TEMP: visual preview, do not commit`), push edilmez
2. **AG lokal stack çalıştırır** — Docker DB + pnpm dev (lokal production simulation)
3. **AG WS smoke ile patch'i ampirik kanıtlar** — lokal stack'in gerçekten patch'i servis ettiğini WS frame içeriği ile teyit eder (lokal serve doğrulaması)
4. **Platform Owner side-by-side görsel inceleme** — lokal POST (localhost:5173) vs prod PRE (systemodel.com) yan yana, tarayıcıda
5. **Karar:**
   - Kabul → impl başlar
   - Reddet → vazgeç (sıfır rollback maliyeti, kod merge edilmedi)

**Kullanım koşulu:** Görsel davranış riski olan tüm slice'larda. ADR-005 D-FILTER-01 gibi semantic değişiklikler şart.

**Slice 2d.2'de kanıt:** Filter `pseudo-initial__on`'u IR'dan siliyor, ama mevcut renderer onu zaten çizmiyordu → lokal POST = prod PRE birebir aynı görüntü. Platform Owner DP2 kabul → impl başladı, deploy temiz, kullanıcı için no-op flip.

**Anti-pattern:** IR diff'ten görsel sonuç çıkarma (bkz. §10.3 #20). Subjektif görsel kararlar gerçek render üzerinde yapılır, IR'dan extrapolation değil.

### 8.4.1 PRE Screenshot Arşivleme Disiplini (CANONICAL, Slice 2d.2 kapanış teyidinden)

**Sorun:** Slice 2d.2'de Platform Owner görsel ön-kabul (DP2) verdi ama PRE screenshot'ı **arşivlemedi**. Kapanış teyidi (2026-05-25) sırasında Madde 7 (no-op flip eşitlik kanıtı) için PRE referansı arandığında dağınık dosya sisteminde aranmak zorunda kalındı, bulunan screenshot da **farklı view'daydı** (GV embed STV, standalone STV değil) → karşılaştırma parsiyel kaldı.

**Kurallar (Slice 2d.2'den sonra zorunlu):**

1. **PRE screenshot zorunlu arşivlenir** — Pre-impl Visual Preview adımı 4'te (Platform Owner side-by-side karşılaştırma) görülen prod PRE görseli ekran kaydı olarak alınır
2. **Arşiv yeri:** Slice close-out doc'una ek (`claude_md_files/phase1_slice<N>_visual_preview_pre.png`) veya repo dışı `outputs/` klasörü
3. **Aynı view kuralı:** PRE ve POST screenshot'ları **aynı view-type'ta** alınır (örn. STV → STV, GV → GV). Embed edilmiş view'lar (örn. GV içinde STV) standalone view ile birebir karşılaştırılamaz, davranışsal parite ile yetinilir
4. **Metadata:** Screenshot dosya adında veya yanındaki not'ta tarih, view-type, slice referansı yazılır
5. **Close-out doc'ta referans:** Slice close-out'unda "PRE screenshot: <path>" satırı zorunlu

**Kanıt:** Slice 2d.2 close-out'ta bu disipline uygulanmasaydı, kapanış teyidinde Madde 7 ⚠️ ŞÜPHELİ olarak kalır, retroaktif sökmece gerekirdi.

---

## 9. Handover Disipline (Üçlü Orchestration)

### 9.1 İki seviyeli handover

**AG handover** (`claude_md_files/phase1_slice<N>_handover.md`):
- Repo'da, commit edilir
- AG yeni session'da otomatik okur
- İçerik: kapatılan iş, açık konular, sonraki adımlar, kod path'leri, operasyonel detaylar

**Architect handover** (`/mnt/user-data/outputs/architect_context_handover_<date>.md` veya benzeri):
- Repo dışı, Architect kendi dosyalarında
- Sen yeni Architect Claude sohbetine ilk mesaj olarak yapıştırırsın
- İçerik: refactor özeti, lessons learned, açık konular, kişisel bağlam

### 9.2 Cross-verification

Yeni AG session açıldığında handover'ı okur, repo state ile cross-verify yapar:
- HEAD beklenen mi
- Untracked dosyalar handover'da açıklanmış mı
- Yeni commit'ler var mı (paralel workstream)

Slice 2d.1'de AG bunu yaptı: `2217c0e → a523e90 → 3af584a` zincirini gördü, `3af584a` (System2Product) renderer scope dışı diye netleştirdi.

### 9.3 Handover içeriği checklist

**AG handover'da olmalı:**
- [ ] Mevcut HEAD + production HEAD
- [ ] Son commit listesi (slice'a ait)
- [ ] Bugün yapılanların özeti
- [ ] Lessons learned özet
- [ ] Açık konular (sonraki slice candidate'ları) **— her item için verification etiketi (bkz. §9.4)**
- [ ] Kod path'leri (gelecek slice'lar için)
- [ ] Operasyonel detaylar (yeni canonical pattern'ler)

**Architect handover'da olmalı:**
- [ ] Operating model (Three-Claude + Platform Owner)
- [ ] Refactor genel mimarisi
- [ ] Bugünün özeti
- [ ] Lessons learned
- [ ] Açık konular + öncelik analizi **— her item için verification etiketi (bkz. §9.4)**
- [ ] Önemli dosyalar (brief'ler, ADR'ler, kod)
- [ ] Operasyonel gotcha'lar
- [ ] Kişisel bağlam (Platform Owner)
- [ ] İlk yapılacaklar (yeni Architect'in adımları)

### 9.4 Handover Backlog Item Verification Etiketi (CANONICAL, AG önerisi 2026-05-25)

**Sorun:** Handover'da bir backlog item yazıldığında ("X implement edilmemiş", "Y bağımlı", "Z henüz yapılmadı"), bu **doğrulanmış olgu mu** yoksa **o an varsayım mı** ayırt edilemiyor. Bir sonraki AG/Architect session'ı bu item'ları "doğru" kabul edip iş kuruyor.

**Slice 2d.2 vakası (AG 2026-05-25 raporu):** Handover §4'te "yeni candidate: sub-state pseudo-initial daire çizimi (yeni renderer'da implement edilmemiş)" yazıyordu. Ama canlı kod kontrolü (transformer.ts:60-61 + renderer.ts:186-200 + DiagramViewer.tsx:2288-2301) generic render yolunun MEVCUT olduğunu gösterdi. Handover iddiası kategorik olarak yanlıştı; gerçek soru farklıydı.

**Kural:** Handover backlog item'ları **verification etiketi** taşır:

| Etiket | Anlam | Gerekli kanıt |
|--------|-------|---------------|
| ✓ verified @ commit X | Bu iddia commit X'te ampirik olarak doğrulandı | `grep`/`git show`/test output referansı |
| ⚠️ assumed | Bu iddia handover yazarının sanısı, doğrulanmadı | Yok — bir sonraki session önce doğrulamalı |
| 🔍 partial — see §N | Kısmen doğrulandı, eksik kısımlar §N'de | Detaylı not |

**Brief v1.3 §8.2 hipotez etiketinin handover'lara genişletilmesi.** Brief'lerde uygulanıyordu, handover'larda eksikti — bu boşluk Slice 2d.2 backlog claim'inde patladı.

**Slice 2d.2 backlog item'ları için retroaktif etiketleme örneği:**

- "Sub-state pseudo-initial daire çizimi implement edilmemiş" → ⚠️ assumed (AG 2026-05-25 cross-check: generic yol mevcut, gerçek soru farklı — discovery gerekli)
- "Bug-PRISMA-01 prisma seed-examples gitignore" → ✓ verified @ commit dec3470 prod-side untracked, lokal tracked-and-correct
- "Legacy renderer kaldırma" → 🔍 partial — Faz 2 boyunca 6+ view tipi porto edilmeli, tek slice değil (§N: Faz 2 final report)

---

## 10. Anti-Patterns Kataloğu

Slice 2d.1 + 2d.3 + 2d.2 ve önceki slice'lardan biriken anti-pattern'ler. Brief yazımı ve implementation sırasında kontrol listesi.

### 10.1 Kod anti-pattern'leri

| # | Anti-pattern | Doğrusu |
|---|--------------|---------|
| 1 | `find()!` non-null assertion | `find()` + null check + log |
| 2 | Fixture izole pattern varsayımı | Idiomatic real-world pattern (part-state usage) |
| 3 | IR şemasına `roots` field'ı ekleme | Renderer zaten multi-root, transformer-side seed yeterli |
| 4 | Transformer'a "view scope" mantığı yazma | Filter-pipeline-transformer ayrımı koru (view-first) |
| 5 | Helper'ı premature olarak çıkarma | Inline + atomic; renderer/transformer farklı veri-aynı pattern → ortak helper zorlama |

### 10.2 Operasyonel anti-pattern'leri

| # | Anti-pattern | Doğrusu |
|---|--------------|---------|
| 6 | Env var format `RENDERER_FLAG_*` | `FF_*` (feature-flags.ts:30 template literal) |
| 7 | `pnpm build` (turbo) production'da | Per-package + api-server `tsc \|\| true` |
| 8 | `deploy.sh` kullanma | Düz `git push origin master` + prod `git pull` |
| 9 | `pm2 restart` flag rollback için | `pm2 delete + start ecosystem.config.cjs` |
| 10 | `pm2 env` env doğrulama | `/proc/<pid>/environ` ground truth |
| 11 | Reflexif rollback (log error görünce) | Stale-log forensic cross-reference önce |
| 12 | `pm2 logs --raw --lines 0` blocking | Snapshot polling (tail -n 120 + grep) |

### 10.3 Süreç anti-pattern'leri

| # | Anti-pattern | Doğrusu |
|---|--------------|---------|
| 13 | **Brief tasarım iddiası ampirik test olmadan** (4 tekrar pattern) | "HİPOTEZ" etiketi + Adım 0'da ampirik doğrulama + **çağrı sitesi haritası** (`grep -rn`) |
| 14 | Her komut için ayrı checkpoint | Karar noktası tabanlı, komut paketi halinde |
| 15 | Scope creep (UX defekti hotfix'e dahil) | Backlog'a, scope cleanliness |
| 16 | Browser self-dogfood'da XHR/Fetch tab | WS tab (backend WS üzerinden konuşuyor) |
| 17 | Görsel doğrulamayı tek başına yeterli sayma | Kanıt üçgeni (görsel + counter + log) |
| 18 | Hipotez kurma ("muhtemelen X") | Kanıt-temelli ham rapor, hipotez yok |
| **19** | **Failing-test commit pattern pre-commit hook ile uyumsuz** (Slice 2d.3) | Snapshot regen + fix tek commit'te; yeni testler ayrı yeşil commit'lere böl |
| **20** | **IR diff'ten görsel sonuç çıkarma** (Slice 2d.2) | Subjektif görsel kararlar gerçek render üzerinde — Pre-impl Visual Preview pattern (§8.4) |
| **21** | **Sayım iddiasını kafadan yuvarlama** (Slice 2d.2 close-out, Architect öz-eleştirisi) | "X adet" derken sayım kaynağı belirt: handover §N veya delta haritası referansı. Yuvarlama yapma — yanlış sayı sonradan disipline ihlali olur |

**#13 detay (4-tekrar pattern):**
- Slice 2d.1: "filter integration zorunlu" iddiası → sensor-systems snapshot'ı bozardı
- Slice 2d.3 v1.0: "Sprotty group decorator" iddiası → Sprotty kurulu değildi (`grep -ri sprotty` boş)
- Slice 2d.2 v1.0: "Legacy filter cleanup" iddiası → 59 test bağımlıydı
- Slice 2d.2 v1.1: "sensor-systems snapshot regen" iddiası → 3 test sitesi paylaşıyor

Önlem: Brief yazımında her "X dokunulacak" iddiası için `grep -r "X" .` çağrı sitesi haritası şart (§8.2.1).

### 10.4 Test Mimarisi Disipline (CANONICAL, Slice 2d.2'den)

**Kural:** Test piramidi seviyesi (transformer isolation / wedge end-to-end / e2e) → **kendi golden dosyası**.

**Sorun:** Paylaşılan snapshot mimarisi katmanlar arası bağımlılık yaratır. Bir katmanda regen, diğer katmandaki testleri kırar veya yanlış coverage gösterir.

**Slice 2d.2 vakası:**
- `sensor-systems/expected-ir.json` ve `expected-smodel.json` üç test sitesi tarafından paylaşılıyordu (transformer unit, wedge integration, e2e)
- View-filter integration sonrası IR değişiyor, ama transformer isolation testleri filter'sız ham output bekliyor
- Architect ilk brief'te "regen" dedi → 3 test sitesi tepkisi farklı
- AG keşfi: split mimarisi (paylaşılan değil, katman başına dosya) çözüm

**Çözüm — Split snapshot mimarisi:**

```
fixtures/state-machine/sensor-systems/
├── expected-ir.json              # Transformer isolation (raw, byte-identical)
├── expected-smodel.json          # Wedge integration (raw renderer output)
├── expected-ir-filtered.json     # YENİ: Filter sonrası IR (filtered transformer test)
└── expected-smodel-filtered.json # YENİ: Filter sonrası SModel (filtered wedge test)
```

**Kurallar:**
- Test piramidi seviyesi başına ayrı golden dosyası
- Paylaşılan snapshot **kasıtlı tasarım kararı** olmadıkça AVOID
- Eğer paylaşım gerekiyorsa: ADR'de gerekçe belgele, hangi katmanlar paylaşıyor netleştir
- Regen kararı verirken: hangi katmanlar etkilenir, mevcut paylaşım yapısı neyi koruyor analizi şart

**Architect failure mode (4. tekrar — Slice 2d.2'de):**
Brief'te "regen" direktifi paylaşılan snapshot mimarisini bilmiyordu. AG keşfetti, Architect karar (split). Önlem: snapshot regen kararı vermeden önce **kim okuyor** haritası şart (`grep -r expected-ir.json`).

---

## 11. Kod Path'leri (Quick Reference)

### State machine pipeline

| Path | Sorumluluk | Son slice'larda değişti? |
|------|-----------|----------------------|
| `packages/diagram-service/src/rendering/state-machine/transformer.ts` | AST → IR transformation | ✓ 2d.1 (multi-seed, qname walk, defense guards), ✓ 2d.3 (top-level state container emit) |
| `packages/diagram-service/src/rendering/state-machine/renderer.ts` | IR → SModelRoot | ✗ (multi-root tüketim zaten vardı `:284-292`) |
| `packages/diagram-service/src/rendering/state-machine/index.ts` | Barrel + registration | ✗ |
| `packages/diagram-service/src/rendering/state-machine/types.ts` | IR şeması | ✗ (korundu, A′ yaklaşımı şemaya dokunmadı) |
| `packages/diagram-service/src/rendering/state-machine/transformer.test.ts` | Unit tests | ✓ 2d.1 (+6 multi-root), ✓ 2d.3 (+5 container) |
| `packages/diagram-service/src/rendering/state-machine/end-to-end.test.ts` | E2E tests | ✓ 2d.1 (+2 multi-root), ✓ 2d.3 (+2 def-vs-usage) |
| `packages/diagram-service/src/rendering/state-machine/parser-state-machine-integration.test.ts` | Parser integration | ✗ |

### Strangler-fig + counter

| Path | Sorumluluk | Son slice'larda değişti? |
|------|-----------|----|
| `packages/diagram-service/src/rendering/pipeline.ts:95-109` | Wedge try/catch + view-filter integration | ✓ 2d.2 (applyViewFilter eklendi) |
| `packages/diagram-service/src/rendering/feature-flags.ts:30` | Flag mantığı (`FF_*` template) | ✗ |
| `packages/diagram-service/src/rendering/renderer-stats.ts` | Counter (in-memory, `/internal/renderer-stats` endpoint) | ✗ |
| `packages/diagram-service/src/rendering/view-type-mapper.ts` | View type → IR mapping | ✗ |
| `packages/diagram-service/src/rendering/view-registry.ts` | Lazy renderer loader | ✗ |
| `packages/diagram-service/src/rendering/wedge.ts` (veya pipeline) | Strangler-fig fallback logic | ✗ |

### Transformer/filter shared

| Path | Sorumluluk | Son slice'larda değişti? |
|------|-----------|----|
| `packages/diagram-service/src/transformer/view-filters.ts` | `filterStateTransitionView`, `applyViewFilter` | ✗ (algoritma korundu, çağrı sitesi 2d.2'de eklendi) |
| `packages/diagram-service/src/transformer/bdd-transformer.ts:616` | Legacy filter call | ✗ (2d.2'de korunmaya karar verildi — 59 test bağımlı, DP1=b new-path-only) |
| `packages/diagram-service/src/parser/sysml-text-parser.ts` | SysML v2 text → AST | ✗ |

### Frontend (container labels desteği)

| Path | Sorumluluk | Son slice'larda değişti? |
|------|-----------|----|
| `packages/web-client/src/diagram/DiagramViewer.tsx:2197` | Nested+hasChildren → title-bar container çizimi | ✗ (zaten doğru, 2d.3 A′ yaklaşımı bu mekanizmayı kullanıyor) |

### Fixture'lar

| Path | İçerik | Son slice'larda değişti? |
|------|--------|----|
| `tests/fixtures/state-machine/sensor-systems/model.sysml` | Eski fixture (izole `state def`, yanlış pattern ama testler geçiyor) | ✗ |
| `tests/fixtures/state-machine/sensor-systems/expected-ir.json` | Raw transformer golden (filter'sız) | ✗ (byte-identical, raw isolation) |
| `tests/fixtures/state-machine/sensor-systems/expected-smodel.json` | Raw wedge golden | ✗ (byte-identical) |
| `tests/fixtures/state-machine/sensor-systems/expected-ir-filtered.json` | **YENİ** filtered transformer golden | ✓ 2d.2 |
| `tests/fixtures/state-machine/sensor-systems/expected-smodel-filtered.json` | **YENİ** filtered wedge golden | ✓ 2d.2 |
| `tests/fixtures/state-machine/multi-root-part-states/model.sysml` | Multi-root anonim fixture | ✓ 2d.1 (oluşturuldu) |
| `tests/fixtures/state-machine/multi-root-part-states/expected-*.json` | Multi-root frozen snapshot | ✓ 2d.1 (oluşturuldu), ✓ 2d.3 (container labels regen) |

### Production

| Path | Sorumluluk |
|------|-----------|
| `/opt/systemodel` | Repo root |
| `/root/.pm2/logs/diagram-*.log` | PM2 log dosyaları |
| `ecosystem.config.cjs` | PM2 process config (env burada, Slice 2d.1'de FF eklendi, permanent) |

---

## 12. ADR İlişkileri

**ADR-005 (state-machine-renderer):**
- D1: Translation policy (SysML v2 keyword verbatim)
- §6: AST stability guarantee
- §7: Layout determinism (snapshot regen güvenli)
- **D-FILTER-01 (Slice 2d.2'de tamamlandı):** View-filter pipeline-level integration
  - Karar: `applyViewFilter` `pipeline.ts:95` öncesinde, new-renderer path için
  - Trade-off: Legacy `bdd-transformer.ts:616` korundu (59 test bağımlı), asimetri output seviyesinde çözüldü
  - Pseudo-state remap: `pseudo-initial__on` siliniyor (entry action varsa start→entry remap)
  - Görsel davranış: Slice 2d.2'de no-op flip (mevcut renderer pseudo-initial'i zaten çizmiyordu) — Pre-impl Visual Preview ile teyitli

**Slice 2d.3'te ADR güncellemesi yapılmadı** — A′ yaklaşımı şema değişikliği değil, transformer-side davranış genişletmesi. IR şeması korundu, yeni decision gerekmedi.

---

## 13. Update Log

| Versiyon | Tarih | Değişiklik |
|----------|-------|-----------|
| v1.0 | Faz 1 başı | İlk Faz 1 brief |
| v1.1 | Slice 2c sonrası | Slice 2 eklemeleri |
| v1.2 | Slice 2d.1 sonrası | Slice 2d.1 narrative (tarihsel) |
| v1.3 | 2026-05-24 | Canonical ops notes (PM2, build, counter, dogfood, stale-log forensic, checkpoint, brief evrim, handover, anti-patterns 18 madde) |
| **v1.4** | **2026-05-25** | **Slice 2d.1 + 2d.3 + 2d.2 sonrası: 5 yeni canonical pattern (pre-deploy tsc, prod HEAD sürprizi, DOM programatik teyit, Pre-impl Visual Preview, Test Mimarisi Disipline) + 3 yeni anti-pattern (#19 failing-test pre-commit, #20 IR diff'ten görsel, #21 sayım yuvarlama) + 2 nüans (Tarayıcı görsel otorite ölçülebilir, çağrı sitesi haritası zorunluluğu) + 1 olgunluk göstergesi (checkpoint trendi 16+ → 3 → 3) + ADR D-FILTER-01 tamam. State machine kapanış teyidinden (2026-05-25) sonra eklenen düzeltmeler: §1 test breakdown drift (340+674=1014/1142, CLAUDE.md güncellenmesi notu) + §4.1 counter endpoint host-only browser erişim uyarısı + §4.4 health endpoint canonical (`/health`, `/api/health` değil) + §5.2 render kanalı WS/SSE deployment farkı + §5.4 counter PRIMARY kanıt vurgusu + §6.4 post-flush log yorumu + §8.4.1 PRE screenshot arşivleme + aynı view zorunluluğu + §9.4 handover backlog verification etiketi. Toplam yeni: 5 pattern, 3 anti-pattern, 9 kapanış-teyidi düzeltmesi.** |
| v1.5 | (planlanan) | Faz 1 Final Report sonrası: Faz 2 hazırlık notları, Slice 2e ön-çalışma |
| v1.6 | (planlanan) | Slice 2e (WS auth + HierarchicalFlagProvider) sonrası |
