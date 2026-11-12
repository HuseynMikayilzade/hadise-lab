# Ehtimal laboratoriyası

"Hadisələrdə əsas anlayışlar" təqdimatı (Tədqiqat analitikası, M545a2) üçün 9 canlı eksperiment.
Auditoriya QR kodu bir dəfə skan edir; təqdimatçı eksperimenti dəyişəndə telefonlar onu avtomatik açır,
proyektorda isə nəticələr canlı olaraq ehtimallara, intervallara və posteriorlara çevrilir.

Hər eksperiment auditoriyasız da işləyir ("Avtonom"): proqram gizli parametrləri təsadüfi seçir,
`crypto.getRandomValues` ilə real sınaqlar aparır, tezlik (Wilson) və bayes (Beta / Dirichlet) təxminləri ilə öyrənir,
"Gizli parametri göstər" düyməsi ilə həqiqəti öyrənilənin üzərinə qoyur. Heç nə əvvəlcədən yazılmayıb.
Təxminlər yalnız sınaqlardan hesablanır - gizli həqiqət yalnız müqayisə üçün göstərilir (bax: `src/experiments/truth-isolation.test.ts`).

## Eksperimentlər

| # | Eksperiment | Slayd bölməsi |
|---|---|---|
| 1 | Zər laboratoriyası | sınaq, Ω, klassik və statistik tərif |
| 2 | Hadisənin növünü tap | hadisələrin növləri, birgə / birgə olmayan |
| 3 | Fəsillər: tam qrup | tam qrup, bərabər imkanlı hadisələr, aksiomlar |
| 4 | Canlı Venn | əməllər, aksiomlardan nəticələr, şərti ehtimal, asılılıq |
| 5 | Doğum günü paradoksu | əks hadisə |
| 6 | Monte Karlo: π-ni tapaq | həndəsi ehtimal |
| 7 | Test müsbətdir - xəstəsən? | tam ehtimal və Bayes |
| 8 | Təsadüfi ardıcıllıq yaz | statistik tərif, tətbiq |
| 9 | Ağıllı A/B test | şərti ehtimal, Bayes, A/B testlər (Thompson sampling) |

## Səhifələr

| URL | Təyinat |
| --- | --- |
| `/s/m545a2?admin` | Proyektor + təqdimatçı idarəsi (`ADMIN_TOKEN` tələb olunur) |
| `/s/m545a2` | Yalnız proyektor görünüşü |
| `/s/m545a2?demo` | İnternet olmadan, yalnız avtonom rejim ("Demo" nişanı) |
| `/j/m545a2` | Telefon (QR buraya aparır) |

Rejimlər (hər eksperiment üçün ayrıca): **Auditoriya**, **Avtonom**, **Hər ikisi** (iki ayrı, işarələnmiş seriya).
Başqa sessiya üçün URL-dəki kodu dəyişmək kifayətdir (`/s/mesq-1`, `/j/mesq-1`) - məşq və çıxışın nəticələri qarışmır.

## Klaviatura qısayolları (proyektor, `?admin` və ya `?demo`)

| Düymə | Əməliyyat |
|---|---|
| ← / → | əvvəlki / növbəti eksperiment |
| R | cavabı göstər / gizlət (2, 5, 7) |
| C | səsverməni aç / bağla |
| Q | QR-ı böyüt / kiçilt |
| Space | avtonom rejimi başlat / dayandır |
| S | bir addım (bir sınaq) |
| + / - | sürət: 1, 10, 100, 1000 sınaq/s |
| N | yeni gizli həqiqət (yenidən başlat) |
| H | gizli həqiqəti göstər |

## Mühit dəyişənləri

| Dəyişən | Harada | Təyinat |
|---|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Vercel (Production) | Sessiya məlumatı. Vercel Upstash inteqrasiyası bunları (və ya `KV_REST_API_URL`, `KV_REST_API_TOKEN`) avtomatik əlavə edir. Vercel-də olmasalar, tətbiq işə düşmür. |
| `ADMIN_TOKEN` | Vercel (Production) | Təqdimatçı əməliyyatları üçün gizli açar (`x-admin-token`). Uzun, təsadüfi sətir. |
| `REDIS_TEST_URL`, `REDIS_TEST_TOKEN` | lokal / GitHub Secrets | Yalnız testlər üçün. **Ayrıca** Upstash bazası istifadə edin, production bazası yox. |

Lokal inkişafda Upstash açarları olmadan məlumat yaddaşda saxlanılır. Açarlar heç vaxt commit olunmur (`.env*` `.gitignore`-dadır, yalnız `.env.example` izlənir).

## Deploy: GitHub + Vercel + Upstash

1. **GitHub:** repo-nu yaradın və kodu göndərin (`git remote add origin ...`, `git push -u origin <branch>`).
   Pull request-lərdə və push-larda CI (typecheck, testlər, build) avtomatik işləyir.
2. **Vercel:** *Add New → Project*, GitHub repo-nu import edin. Framework avtomatik "Next.js" seçilir, əlavə ayar lazım deyil.
3. **Upstash Redis:** Vercel layihəsində *Storage → Marketplace → Upstash (Redis)* əlavə edin və layihəyə qoşun.
   REST açarları avtomatik mühit dəyişənlərinə yazılır.
4. **Açar:** *Settings → Environment Variables* bölməsinə `ADMIN_TOKEN` əlavə edin (məs. `openssl rand -hex 32`).
5. **Redeploy** edin. Bundan sonra production branch-ə hər push avtomatik deploy olur.
6. **Yoxlama:** `https://<domen>/s/m545a2?admin` açın, açarı daxil edin, bir eksperiment seçin;
   telefonla `/j/m545a2` açıb bir cavab göndərin və ekranda göründüyünü yoxlayın.

## Lokal işə salma və testlər

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test             # vahid testlər + store müqavilə testləri (yaddaş əkizi)
npm run build
```

Windows qeydi: VS Code layihəni kiçik hərfli `c:\` yolu ilə açarsa vitest iki nüsxə yükləyir və testlər səhv verir;
terminalda `C:\...` (böyük hərf) yolundan işə salın.

### Redis müqavilə testləri (real Upstash)

Eyni müqavilə testləri (`src/lib/session/store.test.ts`) həmişə yaddaş əkizində işləyir. Test açarları verildikdə
həm də real Upstash-da işləyir - yalnız orada Lua skriptləri həqiqətən icra olunur. Hər test təsadüfi
`test-*` sessiya kodu istifadə edir və açarlar 7 gün sonra avtomatik silinir.

```bash
# bash
REDIS_TEST_URL=https://<test-baza>.upstash.io REDIS_TEST_TOKEN=<test-açarı> npm test
```

```powershell
# PowerShell
$env:REDIS_TEST_URL = "https://<test-baza>.upstash.io"; $env:REDIS_TEST_TOKEN = "<test-açarı>"; npm test
```

Nəticədə `LabStore contract (upstash)` testləri görünməlidir. CI-da eyni testlər üçün GitHub repo-ya
`REDIS_TEST_URL` və `REDIS_TEST_TOKEN` *Secrets* əlavə edin.

### Uçdan-uca yoxlama (production build)

```bash
npm run build
ADMIN_TOKEN=<öz-açarınız> npx next start -p 3100
npx playwright install chromium
BASE=http://localhost:3100 ADMIN_TOKEN=<öz-açarınız> OUT=./shots node scripts/verify.mjs
```

Skript hər eksperimenti API ilə doldurur, telefon və proyektor ekran görüntülərini (1920×1080, 1280×720, 390×844) çəkir,
avtonom rejimi iki dəfə işlədib nəticələrin fərqli olduğunu, 1000 sınaq/s-də kadr tezliyini və oflayn demo rejimini yoxlayır.
Ekran görüntüləri (`shots/`) commit olunmur.

## Çıxışdan əvvəl yoxlama siyahısı

- [ ] Bir gün əvvəl: real Redis müqavilə testlərini işlədin (yuxarıya bax).
- [ ] `/s/m545a2?admin` açın, açarı daxil edin, istifadə ediləcək eksperimentləri "Sıfırla" ilə təmizləyin.
- [ ] Telefonla **mobil internet** üzərindən QR-ı skan edin, bir test cavabı göndərin, sonra yenidən sıfırlayın.
- [ ] Bütün eksperimentlərin rejimini yoxlayın (Auditoriya / Avtonom / Hər ikisi).
- [ ] "Məşq" qutusu **söndürülüb** (başlıqda "Məşq: toxum" nişanı görünməməlidir).
- [ ] Proyektor brauzerini tam ekrana keçirin (F11), QR böyük olsun; hamı qoşulandan sonra Q ilə kiçildin.
- [ ] Ehtiyat: ikinci tabda `/s/m545a2?demo` açıq saxlayın - internet kəsilsə də bütün eksperimentlər avtonom işləyir.

## Arxitektura

```
src/
├─ experiments/<id>/          # bir eksperiment = bir qovluq
│  ├─ definition.ts           # saf: Zod sxemi, limit, planSubmission, computeView, mühərrik hook-ları
│  ├─ Projector.tsx, Phone.tsx
├─ experiments/registry.ts    # server üçün təhlükəsiz reyestr (API, worker, testlər)
├─ experiments/registry.projector.ts / registry.phone.tsx
├─ engine-worker/             # Web Worker: avtonom mühərrik, ≤10 kadr/s xülasə
├─ lib/engine/                # RNG, samplerlər (Marsaglia-Tsang), qoşma yeniləmələr, χ², OR, Thompson, logistik reqressiya
├─ lib/stats/                 # ad günü, Bayes, Monte Karlo, seriyalar
├─ lib/session/               # store: Redis (Upstash) və yaddaş əkizi, atomik Lua skriptləri
└─ app/api/sessions/[code]/   # state, join, admin, experiments/[exp]/{view,submissions,assign}
```

Yeni eksperiment: `src/experiments/<id>/` qovluğu, `EXPERIMENT_IDS`-ə id və iki reyestrə bir sətir.

Əsas qərarlar:

- **Polling (2-2,5 s), versiya ilə.** Dəyişməyən vəziyyət yenidən çəkilmir; gizli tabda dayanır.
- **Atomik yazma.** Aktivlik, status, açılış, cihaz limiti, A/B təyinatı və sayğaclar bir Lua skriptində.
- **Təsadüfilik serverdə.** Zər və Monte Karlo nöqtələri `crypto.randomInt` ilə; A/B variantını server seçir və saxlayır.
- **Gizli həqiqət izolyasiyası.** `summarize()` təxminləri yalnız modeldən hesablayır; testlər hər eksperiment üçün
  həqiqətlə və həqiqətsiz xülasələrin eyni olduğunu yoxlayır.
- **Anonimlik.** Ad, il və ya şəxsi məlumat saxlanılmır; yalnız aqreqat saylar. 7 gün sonra silinir.
- **χ² hökmü** yalnız bütün gözlənilən saylar ≥ 5 olduqda verilir.
