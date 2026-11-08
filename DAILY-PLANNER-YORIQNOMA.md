# Burgut: kunlik reja, so‘zlar va qurilmalar sinxronlash yangilanishi

## O‘rnatish

1. Hozirgi Supabase loyihangiz (`clsjhiielbgoykiolspk`) SQL Editor’ida **supabase/UPDATE_DAILY_WORDS.sql** faylini to‘liq bajaring. Oldingi 001–004 migratsiyalar bajarilgan bo‘lishi kerak. Mavjud loyiha uchun ALL_SETUP.sql ishlatmang.
2. Shu ZIP’dagi loyiha fayllari bilan GitHub repository’ni yangilang. `scripts`, `netlify`, `public`, `services`, `supabase` papkalari va `package.json`, `package-lock.json`, `netlify.toml` ildizda bo‘lsin.
3. Netlify’dagi mavjud saytingizni shu repository’ga ulang va deploy qiling. Build: `node scripts/check.mjs`; publish: `public`. Netlify yangi `web-push` bog‘liqligini avtomatik o‘rnatadi.
4. Avvalgi **aynan o‘sha domenni** ishlating; yangi Netlify sayt yaratish shart emas. Eski manzildagi anonim hisob shu domenning brauzer sessiyasida saqlanadi.
5. Saytni yangilang, yangi **Kunlik reja** bo‘limini oching. Jadval bo‘sh boshlanadi; test/demo rejalar paketga yozilmagan.

Faqat `public` papkasini qo‘lda yuklash frontendni yangilaydi. Yopiq sahifaga push eslatmalar uchun yangi server funksiyasi va environment variables ham deploy bo‘lishi shart. Bu paket Netlify hisobingizga avtomatik yuklanmagan; yangi SQL ham masofadan bajarilmagan.

## Telefon va kompyuterni bir hisobga ulash

Sayt manzilini telefonda ochishning o‘zi yetmaydi: login talab qilinmagani sabab har brauzer alohida Supabase anonim foydalanuvchisini yaratadi.

1. Asosiy hisobingiz turgan kompyuterda **Xarajat → Qurilmalarim → Telefonni ulash kodi** ni bosing.
2. Telefonda shu domenni oching, **Xarajat → Qurilmalarim → Kodni kiritish** ga kodni kiriting.
3. Har ikkala qurilmada ko‘rsatilgan **Hisob** belgisining 8 belgisi bir xil bo‘lsin.
4. Yangi xarajat kiriting. Kompyuterda Xarajat bo‘limi ochiq bo‘lsa, 15 soniya ichida yangilanadi; forma yozayotgan bo‘lsangiz, matningizni buzmaslik uchun avtomatik chizish kutiladi. “Sinxronlash” tugmasi ham bor.

Kod 10 daqiqa amal qiladi va bir martalik. Telefonda oldin yozilgan xarajatlar, rejalar va kunlik rejalar tranzaksiya ichida asosiy hisobga ko‘chiriladi. Bir xil ID to‘qnashsa yoki telefonda alohida so‘z tarixi/budjet bo‘lsa, avtomatik birlashtirish xato bilan to‘xtaydi; o‘quv tarixi qayta hisoblanmaydi, hech narsa o‘chirilmaydi. Bunday vaziyatda ikkala tarixni saqlash uchun avval zaxira olib, asosiy hisobni bo‘sh brauzer profilida ulang; brauzer xotirasini o‘chirib yubormang.

## Kunlik reja

- Kunlik vaqt chizig‘i: bir daqiqa = bir piksel; blok uzunligi davomiylikni bildiradi. Qisqa vazifalarni pastdagi vazifalar ro‘yxatidan ham ochish mumkin.
- Harakatlanuvchi hozirgi vaqt chizig‘i, hozirgi va keyingi vazifa, vaqt to‘qnashuvi ogohlantirishi.
- Kun, hafta, oy; barcha sanalarni tanlash; `+ Yangi reja` orqali nom, vaqt, kategoriya, rang, izoh, takrorlash va eslatma.
- Blok chapidagi tutqich bilan sichqoncha yoki barmoq orqali suring. Harakat 5 daqiqalik qadamga yaqinlashadi; faqat tanlangan kun o‘zgaradi. Klaviaturada blokni ochib vaqtni tahrirlash mumkin.
- Tahrirlash/o‘chirishda **Faqat shu kun** yoki **Shu kundan keyingi takrorlar** doirasi tanlanadi. Oldingi sanalarga tegishli jadval versiyalari bazada qoladi.
- Har kunning statusi alohida: bajarildi, bajarilmadi, jarayonda, o‘tkazib yuborildi. O‘tib ketgan, belgilanmagan reja tarixda bajarilmadi holatida qoladi.
- Statistika saqlangan jadval va kunlik statuslardan hisoblanadi. Rejasiz kunda foiz 0; streak uchun kamida bitta reja va hammasi bajarilgan bo‘lishi kerak. Kategoriya vaqti — bajarilgan vazifalarga ajratilgan vaqt, avtomatik sekundomer emas.
- Vaqt zonasi IANA formatida Supabase’da saqlanadi. Taqvim tanlangan zonaga o‘giriladi, tahrirlash esa rejaning asl zonasida. Yarim tundan o‘tuvchi reja ikki kunga bo‘linadi; `00:00` tugash vaqti kun oxiri hisoblanadi. Yozgi soatga o‘tishda mavjud bo‘lmagan vaqt rad etiladi.
- Yorug‘, qorong‘i yoki tizim rejimi. Sinxronlash xatosida yolg‘on “saqlandi” ko‘rsatilmaydi; forma ochiq qoladi. Oflayn faqat oxirgi yuklangan keshni ko‘rish mumkin, yangi kunlik reja yozish uchun internet kerak.

## Brauzer yopiq bo‘lgandagi push eslatmalar

Infratuzilma paketda mavjud: `daily-reminders.mjs` Netlify scheduled function har daqiqada ishlaydi, Supabase’dagi obunalarga Web Push yuboradi. Takroriy yuborishni cheklaydigan lease/jurnal, muddati tugagan obunalarni tozalash, vaqt zonalari va har kunning statusini tekshirish bor.

Netlify Environment variables’da **Functions** muhiti uchun quyidagilarni belgilang:

| Nomi | Qiymat |
|---|---|
| `SUPABASE_URL` | `https://clsjhiielbgoykiolspk.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase’dagi server uchun service_role kaliti; faqat Netlify environment’da |
| `VAPID_PUBLIC_KEY` | O‘zingiz yaratgan ochiq Web Push kaliti |
| `VAPID_PRIVATE_KEY` | Shu juftlikning maxfiy Web Push kaliti |
| `VAPID_SUBJECT` | `mailto:sizning-haqiqiy-emailingiz` |

VAPID juftligini o‘z kompyuteringizda, bog‘liqliklar o‘rnatilgach, `node scripts/create-push-keys.mjs` orqali yarating. Maxfiy kalitlarni chatga, GitHub’ga yoki public JS’ga qo‘ymang. `VITE_`/`NEXT_PUBLIC_` prefikslari kerak emas. Qiymatlar saqlangach qayta deploy qiling.

Keyin ilovada **Kunlik reja → Eslatmalar** tugmasini bosing va brauzer ruxsatini bering. Server sozlanmaguncha interfeys faqat sahifa ochiq paytdagi eslatmalar ishlashini aytadi. iPhone’da brauzer imkoniyatiga qarab saytingizni Home Screen’ga qo‘shish kerak bo‘lishi mumkin. OS/brauzer ruxsati, internet, uyqu rejimi va Supabase pauzasi sabab eslatma mutlaq kafolatlanmaydi. Bildirishnomani bosish `#daily` sahifasini ochadi.

Bu maxfiy kalitlar berilmaganligi sabab yopiq brauzerdagi push yetkazilishi ushbu ishda jonli tekshirilmagan. Kod va DB ruxsatlari alohida testlarda tekshiriladi.

## So‘z yodlashdagi o‘zgarishlar

- Takrorlash, baholash, interval va eski navbatni yig‘ish funksiyalari o‘zgarishsiz. `tests/repetition-baseline.json` SHA-256 qiymatlari bilan 11 funksiya va 001/002 SQL fayllarining bir xilligini tekshiradi.
- Faqat ruxsat berilgan yangi turkcha so‘zlar tanlovi almashtirilgan: manbasi tekshirilgan B1 ro‘yxati, keyin B2. O‘tish uchun mavjud `isLearned` mezoni qo‘llanadi: B1 ro‘yxatidagi barcha so‘zlar o‘rganilgan belgisiga ega bo‘lishi kerak. Bu til darajasi bo‘yicha sertifikat emas, ilovadagi ro‘yxatning tugashi.
- Bir kunning 5 tagacha yangi turkcha so‘zi Supabase’da saqlanadi; sahifa yoki qurilma almashtirilganda to‘plam almashmaydi. O‘rganilgan yoki o‘quv kartasi mavjud so‘z yana “yangi” qilib olinmaydi. Takrorlashda esa eski so‘zlar oldingi qoidalar bilan chiqadi.
- 100 ta eski turkcha va 200 ta inglizcha so‘zning ID kalitlari saqlangan; 32 ta qo‘shimcha turkcha so‘z qo‘shilgan. Jami manbasi tekshirilgan darajalar: B1 32 ta, B2 20 ta. Eski darajasi ishonchli aniqlanmagan so‘zlar bazadan o‘chmagan; yangi B1/B2 to‘plamga kirmaydi, eski takrorlarda qoladi.
- Turkcha misollardagi aralash o‘zbekcha gaplar tuzatilgan. 132 ta turkcha kartochkada misolning o‘zbekcha tarjimasi bor. Audio, IPA va turkcha TTS so‘rovi yo‘q.
- Inglizcha talaffuz: haqiqiy lug‘at IPA ma’lumoti, faqat UK audiosi, u bo‘lmasa faqat `en-GB` qurilma ovozi. US ovoziga yashirin o‘tmaydi. Qurilmada Britaniya ovozi bo‘lmasa tushunarli xabar chiqadi.
- 200 inglizcha so‘zdan 196 tasi uchun manbadan IPA/audio metama’lumoti keshga olingan, 36 tasida UK audio bor. Qolganida onlayn manba va en-GB TTS ishlatiladi. IPA yo‘q bo‘lsa taxmin qilinmaydi, “IPA manbada topilmadi” ko‘rsatiladi. Aksenti manbada aniq belgilanmagan IPA “lug‘at IPA” deb ko‘rsatiladi, UK deb taqdim etilmaydi.
- Audio so‘rovi kartani qayta chizib test holatini buzmaydi. Bir nechta tugma tez bosilganda faqat oxirgi tanlangan so‘z aytiladi. Xatodan keyin qayta urinish mumkin.

## O‘zgargan fayllar

Yangi frontend: `public/planner-core.mjs`, `planner.mjs`, `planner.css`, `word-levels.js`, `word-audio.mjs`, `pronunciation-core.mjs`, `pronunciation-data.json`, `words-premium.css`.

Integratsiya: `public/index.html`, `burgut.html`, `app.js`, `cloud-sync.js`, `sw.js`, `words.js`; talaffuz serveri `services/pronunciation.mjs`; `netlify/functions/api.mjs`.

Push: `netlify/functions/daily-reminders.mjs`, `scripts/create-push-keys.mjs`, `package.json`, `package-lock.json`.

SQL: 005 — jadval versiyalari, kunlik holatlar, sozlamalar; 006 — push obunasi/jurnali; 007 — yangi turkcha kunlik to‘plam va xavfsiz qurilma ulash. 001–004 o‘zgarishsiz qolgan. Yangi jadvallarda RLS bor, barcha yozuvlar auth orqali o‘z egasiga bog‘lanadi. Yangi SQL so‘z takrorlash sanalari yoki tarixini yangilamaydi.

## Tekshirish

`node scripts/check.mjs` — sintaksis.

`node --test tests/*.test.mjs` — takrorlashning o‘zgarmagani, lug‘at kalitlari/darajalari, talaffuz, oflayn xarajat navbati, pairing, PostgreSQL RLS, tahrirlash konflikti, takroriy rejalarning alohida kunlari, statistika, vaqt zonalari.

Mobil (390px) va desktop (1440px) brauzerda qo‘shish, tahrirlash, status, drag-and-drop, sahifani yangilash, kun/hafta/oy, dark/light, turkcha audio yo‘qligi, test variantlari va en-GB TTS fallback mahalliy test ma’lumotlari bilan tekshirilgan. Production Supabase yozuvlari test uchun o‘zgartirilmagan.

## Manbalar

- Daraja ro‘yxatlari: İstanbul Üniversitesi Dil Merkezi, İstanbul Yabancılar İçin Türkçe B1 va B2 kitoblarining **Kelime Listesi** sahifalari. Har bir tasdiqlangan so‘zda `levelSource.url` va `page` bor. [B1](https://elkitab.org/wp-content/uploads/2017/06/B1-DERS-KITABI.pdf), [B2](https://elkitab.org/wp-content/uploads/2017/06/B2-ders-kitab%C4%B1.pdf). Misollar va o‘zbekcha tarjimalar ilova uchun tahrirlangan; kitobdagi uzun matnlar ko‘chirilmagan.
- [Free Dictionary API](https://dictionaryapi.dev/): IPA va audio metama’lumotlari; har audio uchun source/license saqlanadi.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/).
- [Web Push kutubxonasi](https://github.com/web-push-libs/web-push), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).

## Yakuniy tekshiruv dalili

2026-11-07: hozir ishlayotgan `ornate-alfajores-5402f7.netlify.app/app.js` yuklab olinib, boshlang‘ich mahalliy app.js bilan solishtirildi: satr tugashlarini normalizatsiya qilganda butun fayl bir xil. Takrorlashga tegishli 11 funksiya jonli saytdagi nusxa bilan ham bir xil. 28 ta avtomatlashtirilgan test o‘tdi, mobil va desktop brauzer jarayonlari o‘tdi. SQL sinovlari alohida PGlite PostgreSQL muhitida bajarildi; sizning Supabase bazangiz bu sinovlarda o‘zgartirilmadi.
