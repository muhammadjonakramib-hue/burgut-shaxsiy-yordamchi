# Burgut: 1000 so‘z va oflayn yodlash

Bu paket avval tayyorlangan Kunlik reja, so‘zlar va qurilmalarni ulash o‘zgarishlarini ham o‘z ichiga oladi. Jonli Netlify sayti hali avtomatik yangilanmadi.

## O‘rnatish

1. ZIPni oching. GitHub loyihangizga paketdagi barcha fayl va papkalarni, jumladan `scripts`, `netlify`, `public` va `supabase`ni yuklang. `node_modules` kerak emas.
2. Netlify shu repository bilan ishlasin: build command `node scripts/check.mjs`, publish directory `public`. `netlify.toml` bu qiymatlarni belgilaydi. Faqat `public` papkasini qo‘lda yuklash server funksiyalarini joylashtirmaydi.
3. Mavjud saytning ayni manzilini yangilang. Boshqa domen brauzer tomonidan yangi ilova hisoblanadi; eski qurilma hisobi va yuborilmagan javoblar avtomatik o‘tmaydi.
4. Oldingi 005–007 migratsiyalar bajarilgan bo‘lsa, bu oflayn yangilanish uchun SQL ishlatish kerak emas. Ular hali bajarilmagan bo‘lsa, avvalgi `supabase/UPDATE_DAILY_WORDS.sql` va `DAILY-PLANNER-YORIQNOMA.md` bo‘yicha yakunlang. Eski o‘quv jadvallarini qayta yaratmang.

## Telefonda internetsiz ishlatish

1. Internet bilan saytni oching. So‘zlar bo‘limida **Oflayn tayyorlash**ni bosing.
2. **1000 ta so‘z qurilmaga yuklangan** yozuvini kuting.
3. Brauzer menyusidan **Bosh ekranga qo‘shish / Ilovani o‘rnatish**ni tanlang. iPhone’da Safari → Ulashish → Bosh ekranga qo‘shish.
4. Internetni uzing va o‘rnatilgan ilovani oching. So‘zlar, tarjimalar, mavjud misollar va test ishlaydi. Javoblar qurilmada navbatga yoziladi; internet qaytganda Supabase’ga asl ID va javob berilgan vaqt bilan yuboriladi.
5. Telefon va kompyuterni ayni hisobga ulash uchun ilovadagi **Telefonni ulash kodi**dan foydalaning. Faqat sayt manzilini ochish hisoblarni birlashtirmaydi.

Birinchi marta internetsiz saytni yuklab bo‘lmaydi. Brauzer ma’lumotlarini tozalash yoki maxfiy rejim mahalliy nusxa va yuborilmagan javoblarni yo‘qotishi mumkin. Oflayn nusxa yuklangan qurilmada saqlanadi. Yangiliklar, bulut sinxronlash va Telegram uchun internet zarur.

## Lug‘at

- Jami **1000 yozuv: 132 turkcha, 868 inglizcha**. Ikki tilga teng taqsimlanmagan.
- Avvalgi so‘zlarning kalitlari va misollari saqlandi. Yangi so‘zlar qo‘shildi; qaytarish sanalari yoki o‘rganish tarixi qayta hisoblanmadi.
- Turkcha yangi tanlov faqat manbasi ko‘rsatilgan B1, keyin mavjud mezon bo‘yicha B2. Oflayn tanlangan 5 talik kunlik ro‘yxat saqlanadi; keyingi kun yangi ro‘yxatda avvalgi oflayn kunlarda ajratilgan so‘zlar qayta yangi deb olinmaydi. Ikki qurilma bir payt oflayn o‘rgansa, ro‘yxatlarni darhol tenglashtirish imkoni yo‘q; internet qaytganda o‘quv javoblari saqlanadi va serverdagi kunlik ro‘yxat olinadi.
- Yangi 668 inglizcha yozuvda misol yoki IPA to‘qilmadi. Ularning misol maydoni hozircha bo‘sh; oldingi misollar saqlangan. Bank manbalari va cheklovlari: `public/WORD-SOURCES.md`.
- Inglizcha audioni oflayn ijro etish uchun qurilmada mahalliy **English (United Kingdom)** ovozi bo‘lishi kerak. Internetdagi yozib olingan audiolar to‘liq paketga kiritilmagan. Mahalliy UK ovozi bo‘lmasa ilova buni aytadi; uni AQSh talaffuziga yashirin almashtirmaydi.
- Oflayn yangi javoblar bulutga yetguncha server hisoblaydigan statistika va yangi takrorlash sanalari yangilanmasligi mumkin. Mavjud takrorlash algoritmining lokal nusxasi yaratilmagan.

## O‘zgargan fayllar

- `public/sw.js`: to‘liq yuklanmagan keshni tayyor deb faollashtirmaslik, bir versiyadagi fayllar bilan oflayn ochilish, faqat Burgut keshlarini tozalash.
- `public/offline.js`: yuklash/tayyorlik holati, o‘rnatish taklifi, doimiy saqlash ruxsati so‘rovi.
- `public/index.html`, `public/burgut.html`: oflayn modulni ulash.
- `public/words.js`, `public/WORD-SOURCES.md`: 1000 yozuv va manba izohi.
- `public/word-levels.js`: yangi turkcha kunlik ro‘yxatni qurilmada saqlash. Qaytarish algoritmi o‘zgarmagan.
- `public/cloud-sync.js`: oflayn holatda egasining identifikatorini tiklash, eskirgan sessiya bilan ham lokal navbatning ishlashi.
- `public/word-audio.mjs`: oflaynda ortiqcha lug‘at so‘rovlari yubormaslik, faqat mahalliy UK ovozini tanlash.
- `public/app.js`: oflayn tayyorlash tugmasi, eski sozlama matnlarini tuzatish. Ferma haqidagi namuna olib tashlangan; ulanmagan Telegram uchun chalg‘ituvchi sinov tugmasi o‘rniga BotFather havolasi.
- `tests/offline.test.mjs`: so‘zlar soni, takrorlanmas kalitlar, yangi kun va qayta ochilish testi.

## Tekshiruv

31 avtomatik test o‘tdi. Himoyalangan 11 funksiya hamda `001_learning.sql` va `002_device_sync.sql` SHA-256 solishtirishdan o‘tdi. Kunlik reja va avvalgi so‘z interfeysi brauzer sinovidan o‘tdi.

Alohida Edge sinovi: ilovani yuklash → internetni uzish → eskirgan Auth sessiyasi bilan sahifani qayta ochish → 5 turkcha so‘z → test javobi → yana qayta ochish → internetni yoqish → ayni javobning asl ID/vaqti bilan bir marta qabul qilinishi. Test haqiqiy Supabase o‘rniga sinov serveridan foydalandi; ishlab turgan bazaga yozilmadi.

## Telegram

Telegram internetsiz yangi xabar yubormaydi yoki olmaydi. `@buuuurgutbot` uchun server kodi paketga qo‘shildi, ammo webhook hali jonli ulanmagan.

Bot buyruqlari: `/start`, `/turkcha 1`, `/inglizcha 1`, `/qidir kitob`, `/sayt`. Bu lug‘at botidir: Supabase’dagi shaxsiy xarajatlarni o‘qimaydi va test natijalarini yozmaydi. Yodlash/test oflayn ilovada davom etadi. Botda ikkinchi takrorlash algoritmi yaratilmagan.

Ulash:

1. Paketni GitHub orqali Netlifyga deploy qiling.
2. Kompyuterda paketni oching. `scripts/connect-telegram.ps1`ni PowerShell’da ishga tushiring. Masalan, paket papkasida PowerShell ochib: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\connect-telegram.ps1`.
3. Skript BotFather tokenini yashirin kiritishni so‘raydi. Tokenni chatga yubormang. U faylga yozilmaydi va serverga joylashtirilmaydi; faqat Telegram bilan ulash vaqtida shu kompyuter jarayonida ishlatiladi.
4. Botga `/start` yozing. Skript bitta shaxsiy chatni aniqlaydi va sizga Netlify uchun `TELEGRAM_OWNER_ID` hamda `TELEGRAM_WEBHOOK_SECRET` qiymatlarini ko‘rsatadi. Ularni Netlify → Environment variables’da maxfiy, Functions scope bilan qo‘shing va qayta deploy qiling. Skriptda Enter bosing.
5. Skript Netlify funksiyasini tekshiradi, webhookni o‘rnatadi va uning manzilini qayta o‘qib tasdiqlaydi. So‘ng botga `/start`ni yana yozing. Skript mavjud webhookni o‘zboshimchalik bilan almashtirmaydi.

Yangi fayllar: `services/telegram.mjs`, `services/telegram-words.json`, `netlify/functions/telegram.mjs`, `scripts/connect-telegram.ps1`, `tests/telegram.test.mjs`. Funksiya faqat maxfiy webhook sarlavhasi va belgilangan egasining shaxsiy chatiga javob beradi. Bot tokeni brauzer fayllarida yo‘q.

Texnik manba: [Telegram webhook hujjati](https://core.telegram.org/bots/api#setwebhook), [Netlify Functions](https://docs.netlify.com/build/functions/overview/). Telegram webhook javobi orqali `sendMessage` bajariladi. Jonli token bilan ulanish bu tekshiruvda bajarilmadi; token kiritilmaguncha botni ishlayapti deb hisoblamang.
