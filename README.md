# Burgut — Netlify

Sayt Netlify’da, shaxsiy ma’lumotlar Supabase’da saqlanadi. Kompyuterni yoqib qo‘yish yoki Codex kerak emas. Brauzerda offline kesh, sessiya va hali yuborilmagan yozuvlar qoladi.

## 1. Supabase

Hozirgi loyiha: https://clsjhiielbgoykiolspk.supabase.co

Oldingi uchta SQL bajarilgan bo‘lsa `supabase/004_personal_records.sql` ni SQL Editor’da Run qiling. Yangi, bo‘sh loyiha uchun `supabase/ALL_SETUP.sql` ishlatiladi. Anonymous sign-ins yoqilgan bo‘lsin. Public kalit `public/cloud-config.js` ichida tayyor; service-role kaliti kerak emas.

## 2. Netlify

1. ZIP ichidagi fayllarni GitHub’dagi yangi private repository’ga yuklang. `netlify.toml`, `package.json`, `public`, `services`, `netlify`, `scripts`, `supabase` repository ildizida bo‘lsin.
2. Netlify’da **Add new project → Import an existing project → GitHub** orqali shu repository’ni tanlang.
3. Build command: `node scripts/check.mjs`; Publish directory: `public`. Base directory bo‘sh. `netlify.toml` qolgan sozlamalarni beradi.
4. Deploy tugagach berilgan HTTPS manzilni oching.

Oddiy Netlify Drop orqali faqat `public` papkasini tashlamang: yangiliklar, futbol va inglizcha audio uchun Functions ham deploy bo‘lishi kerak.

## 3. Eski hisobni ulash

Yangi saytda hali so‘z testi, reja yoki xarajat kiritmasdan oldin eski ishlayotgan Burgut’da qurilma ulash kodini yarating. Netlify saytidagi ulash oynasiga shu kodni kiriting. Kod 10 daqiqa amal qiladi, bir marta ishlatiladi. Telefonni ham xuddi shu tarzda ulang. Parol talab qilinmaydi.

Yangi manzil eski brauzer manzilining localStorage ma’lumotlarini o‘qiy olmaydi. Eski ilovada faqat lokal saqlangan xarajatlarni ko‘chirish uchun shu yangilangan kodni eski manzilda ham ishga tushirib sinxronlang yoki xarajatlarni yangi saytda qayta kiriting. Eski ilovani/keshni ma’lumotlar ko‘chmaguncha o‘chirmang.

Anonim hisob sessiyasini barcha qurilmalardan o‘chirish hisobga kirishni yo‘qotishi mumkin. Sozlamalardan zaxira JSON faylini saqlab qo‘ying; ishlayotgan qurilma orqali yangisini ulash mumkin.

## Tekshiruv

- Saytda Supabase holati ulangan va kutilayotgan yozuvlar soni 0 bo‘lsin.
- Bitta xarajat va reja qo‘shing; telefonni ulab, shu yozuvlar kelishini tekshiring.
- Telefon orqali xarajatni o‘chiring; kompyuterda yangilaganda yo‘qolishini tekshiring.
- Yangiliklar, futbol, inglizcha talaffuzni oching.

Mahalliy tekshiruv: `node scripts/check.mjs` va `node --test tests/*.test.mjs`.

Netlify deploy va yangi SQL bajarilishi bu paket tayyorlanganda masofadan bajarilmagan. Tashqi yangilik/audio manbalari mavjudligiga bog‘liq. Supabase Free loyihasi kam faollikda pauzaga tushishi mumkin; Netlify deploy buning oldini olmaydi.

Netlify Functions yo‘naltirishi: https://docs.netlify.com/build/functions/configuration/
