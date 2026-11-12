# Ehtimal laboratoriyası

"Hadisələrdə əsas anlayışlar" təqdimatı (Tədqiqat analitikası, M545a2) üçün 9 canlı eksperiment.
Auditoriya QR kodu bir dəfə skan edir; təqdimatçı eksperimenti dəyişəndə telefonlar onu avtomatik açır,
proyektorda isə nəticələr canlı olaraq ehtimallara, intervallara və posteriorlara çevrilir.

Hər eksperiment auditoriyasız da işləyir ("Avtonom"): proqram gizli parametrləri təsadüfi seçir,
`crypto.getRandomValues` ilə real sınaqlar aparır, tezlik (Wilson) və bayes (Beta / Dirichlet) təxminləri ilə öyrənir,
"Gizli parametri göstər" düyməsi ilə həqiqəti öyrənilənin üzərinə qoyur. Heç nə əvvəlcədən yazılmayıb.

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

Klaviatura (təqdimatçı): ← / → eksperiment, R cavabı göstər, C aç / bağla, Q QR ölçüsü, Space başlat / dayandır,
S bir addım, + / - sürət, N yeni gizli həqiqət, H gizli həqiqəti göstər.

## Lokal işə salma

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vahid testlər (Windows-da layihəni C:\ böyük hərfli yolla açın)
npm run build
```

Upstash açarları olmadan lokal rejimdə məlumat yaddaşda saxlanılır (Lua skriptlərinin JS əkizləri ilə).

### Uçdan-uca yoxlama

```bash
npm run build && ADMIN_TOKEN=local-test-token npx next start -p 3100
npx playwright install chromium
BASE=http://localhost:3100 ADMIN_TOKEN=local-test-token OUT=./shots node scripts/verify.mjs
```

Skript hər eksperimenti API ilə doldurur, telefon və proyektor ekran görüntülərini (1920×1080, 1280×720, 390×844) çəkir,
avtonom rejimi iki dəfə işlədib nəticələrin fərqli olduğunu, 1000 sınaq/s-də kadr tezliyini və oflayn demo rejimini yoxlayır.

## Deploy (GitHub + Vercel)

1. Repo-nu Vercel-də import edin.
2. **Storage** bölməsindən **Upstash Redis** əlavə edin (açarlar avtomatik əlavə olunur).
3. **Environment Variables**: `ADMIN_TOKEN` (uzun, təsadüfi sətir).
4. Redeploy. `main`-ə hər push avtomatik production deploy olur.

## Çıxışdan əvvəl

- `/s/m545a2?admin` açın, lazım olan eksperimentləri "Sıfırla" ilə təmizləyin.
- Telefonla **mobil internet** üzərindən bir test cavabı göndərin, sonra yenidən sıfırlayın.
- `?demo` səhifəsini bir dəfə açıq saxlayın: internet kəsilsə də bütün eksperimentlər avtonom işləyir.
- "Məşq" qutusu yalnız məşq üçündür (toxumlu generator, toxum ekranda görünür) - çıxışda söndürün.

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
- **Anonimlik.** Ad, il və ya şəxsi məlumat saxlanılmır; yalnız aqreqat saylar. 7 gün sonra silinir.
- **χ² hökmü** yalnız bütün gözlənilən saylar ≥ 5 olduqda verilir.
