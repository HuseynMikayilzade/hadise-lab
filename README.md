# Hadisə laboratoriyası

"Hadisələrdə əsas anlayışlar" təqdimatı (Tədqiqat analitikası, M545a2) üçün canlı eksperiment.
Auditoriya QR kodu skan edib iki suala cavab verir, proyektor ekranında cavablar canlı olaraq
A və B hadisələrinə, Venn diaqramına, ehtimallara və 95% Wilson etibarlılıq intervallarına çevrilir.

## Səhifələr

| URL | Təyinat |
| --- | --- |
| `/s/m545a2` | Proyektor ekranı (QR kod, Venn, ehtimallar) |
| `/s/m545a2?admin` | Eyni ekran + "Səsverməni bağla" və "Cavabları sil" düymələri (`ADMIN_TOKEN` tələb olunur) |
| `/s/m545a2?demo` | İnternet olmadan işləyən demo rejimi (yerli simulyasiya) |
| `/j/m545a2` | Telefon forması (QR buraya aparır) |

Başqa sessiya üçün URL-dəki kodu dəyişmək kifayətdir (`/s/mesq-1`, `/j/mesq-1`) - məşq və canlı çıxışın nəticələri qarışmır.

## Lokal işə salma

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # ehtimal məntiqinin testləri
```

Upstash açarları olmadan lokal rejimdə məlumat yaddaşda saxlanılır.

## Deploy (GitHub + Vercel)

1. GitHub-da yeni repo yaradın və kodu push edin:
   ```bash
   git init && git add . && git commit -m "Hadisə laboratoriyası"
   git branch -M main
   git remote add origin https://github.com/<istifadəçi>/hadise-lab.git
   git push -u origin main
   ```
2. Vercel-də **Add New → Project**, repo-nu import edin və deploy edin.
3. Layihədə **Storage** bölməsindən **Upstash Redis** (Marketplace) əlavə edib layihəyə qoşun.
   Açarlar (`KV_REST_API_URL` / `KV_REST_API_TOKEN` və ya `UPSTASH_REDIS_REST_*`) avtomatik əlavə olunur.
4. **Settings → Environment Variables** bölməsində `ADMIN_TOKEN` əlavə edin (uzun, təsadüfi sətir).
5. **Redeploy** edin. Bundan sonra `main`-ə hər push avtomatik production deploy olur.

## Çıxışdan əvvəl yoxlama siyahısı

- Bir gün əvvəl: `/s/m545a2?admin` açın, "Cavabları sil" ilə sıfırlayın.
- Telefonla **mobil internet** üzərindən QR-ı skan edib bir test cavabı göndərin, sonra yenidən sıfırlayın.
- Proyektor brauzerini tam ekran rejiminə keçirin (F11).
- İnternet problemi olarsa: `?demo` rejiminə keçin.

## Arxitektura

```
src/
├─ lib/
│  ├─ experiment.ts      # suallar və sessiya kodu qaydaları - sualları burada dəyişin
│  ├─ probability.ts     # domen məntiqi: ehtimallar, Wilson intervalı, asılılıq yoxlanışı
│  ├─ store/             # saxlama qatı: interfeys, Upstash Redis və lokal yaddaş
│  └─ http.ts            # API köməkçiləri
├─ app/
│  ├─ api/sessions/[code]/responses   POST - cavab göndərmək
│  ├─ api/sessions/[code]/stats       GET  - aqreqat nəticələr
│  ├─ api/sessions/[code]/admin       POST - aç / bağla / sıfırla
│  ├─ j/[code]           # telefon səhifəsi
│  └─ s/[code]           # proyektor səhifəsi
└─ components/           # Venn, StatCard, ScreenView, JoinForm, polling hook
```

Əsas qərarlar:

- **Polling (2 saniyə), WebSocket yox.** 30-40 nəfərlik auditoriya üçün kifayətdir, serverless mühitdə daha sadə və etibarlıdır.
- **Atomik yazma.** Status yoxlanışı, təkrar cihaz yoxlanışı və sayğac bir Redis Lua skriptində icra olunur.
- **Anonimlik.** Yalnız brauzerdə yaradılan təsadüfi cihaz ID-si və iki "bəli/xeyr" cavabı saxlanılır. Ekran yalnız aqreqat sayları oxuyur. Məlumat 7 gün sonra avtomatik silinir.
- **Wilson intervalı.** Kiçik n-də normal yaxınlaşmadan (Wald) daha dəqiqdir.
- **Asılılıq yoxlanışı konservativdir.** P(A | B) və P(A | B̄) intervalları kəsişmirsə "asılılıq əlaməti var" deyilir; kiçik n-də "aydın deyil" nəticəsi normaldır.
