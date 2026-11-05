// Har bir turkum uchun amaliy foyda / xavf / harakat qoidalari.
// Bu matn maqoladan ko'chirilmaydi — turkumga qarab tuzilgan tekshiruv ro'yxati.

const PLAYBOOK = {
  biznes: {
    benefit: ['O‘rganish uchun: talab, xarajat va daromad o‘rtasidagi bog‘liqlikni tahlil qiling.'],
    risk: ['Bitta kompaniya yoki mamlakat misoli boshqa bozorda aynan takrorlanmasligi mumkin.'],
    action: ['Xabardan biznesga ta’sir qiladigan omilni ajrating: xarajat, talab yoki raqobat. Darsdagi bir tushuncha bilan bog‘lang.'],
  },
  boshqaruv: {
    benefit: ['O‘rganish uchun: qaror qabul qilish, jamoa va jarayon boshqaruvi bo‘yicha misol.'],
    risk: ['Natijani baholashda kompaniya hajmi va sharoitlaridagi farqlarni hisobga oling.'],
    action: ['Muammo, boshqaruv qarori va natijani uch jumlada yozing; natija berilmagan bo‘lsa, uni taxmin qilmang.'],
  },
  ilm: {
    benefit: ['O‘rganish uchun: tadqiqot qanday savolga javob berganini va amaliy qo‘llanishini aniqlang.'],
    risk: ['Dastlabki tadqiqot natijasi tayyor mahsulot yoki kafolatlangan foyda degani emas.'],
    action: ['Asl tadqiqot havolasini izlang; usul, cheklovlar va mustaqil tekshiruv borligini ko‘ring.'],
  },
  muhim: {
    benefit: ['O‘rganish uchun: voqeaning kundalik hayot, ta’minot va iqtisodga aloqasini kuzating.'],
    risk: ['Rivojlanayotgan voqealarda dastlabki ma’lumotlar o‘zgarishi mumkin.'],
    action: ['Voqea sanasi va yangilanish vaqtini tekshiring; asosiy faktni ikkinchi ishonchli manba bilan solishtiring.'],
  },
  subsidiya: {
    benefit: [
      "Xarajatning bir qismi qoplanishi yoki arzon kredit/lizing olish imkoniyati paydo bo'ladi.",
      "To'lov muddati cho'zilsa, mavsumiy pul tanqisligi yengillashadi.",
    ],
    risk: [
      "Ariza muddati o'tkazib yuborilsa, mablag' keyingi davrga qoladi.",
      "Hujjatlar to'liq bo'lmasa yoki maqsadli ishlatilmasa, ariza rad etiladi yoki mablag' qaytariladi.",
    ],
    action: [
      "Qaror matnini lex.uz da ochib, ariza muddati, kim olishi mumkinligi va hujjatlar ro'yxatini yozib oling.",
      "Tuman agrosanoat bo'limi yoki bank bilan bog'lanib, aniq talablarni yozma so'rang.",
    ],
  },
  qoida: {
    benefit: [
      "Talablar aniq bo'lsa, mahsulotni qonuniy va yuqori narxda sotish, sertifikat olish osonlashadi.",
      "Nazorat tartibi oldindan ma'lum bo'lsa, jarima va to'xtab qolish xavfi kamayadi.",
    ],
    risk: [
      "Yangi talabga moslashmasangiz jarima, mahsulotni sotishni to'xtatish yoki qaytarish xavfi bor.",
      "Hisobot va hujjatlar eski tartibda yuritilsa, tekshiruvda muammo chiqadi.",
    ],
    action: [
      "Yangi talabni tuman veterinariya xizmati bilan solishtiring va farqni bir varaqqa yozing.",
      "Sertifikat, emlash daftari va sut jurnalini yangi talabga moslab yangilang.",
    ],
  },
  ozuqa: {
    benefit: [
      "Arzonroq yoki to'yimliroq ratsion 1 litr sut tannarxini pasaytiradi.",
      "Yangi qo'shimcha sog'lik va sut miqdorini yaxshilashi mumkin.",
    ],
    risk: [
      "Yangi ozuqani birdan kiritish oshqozon buzilishi, sut miqdori va hidining o'zgarishiga olib keladi.",
      "Narx o'zgarsa, oylik yem xarajati rejadan chiqib ketadi.",
    ],
    action: [
      "Yangi yemni 10–15 boshda 7–10 kun sinab ko'ring, sut miqdori va holatini yozib boring.",
      "Ratsionni zootexnik bilan qayta hisoblang va kamida 2 haftalik yem zaxirasini ushlang.",
    ],
  },
  sogish: {
    benefit: [
      "Sog'ish tezligi va sut sifati (somatik hujayra, bakteriya) yaxshilanadi, ish vaqti qisqaradi.",
      "Avtomatlashtirish sog'uvchining xatosini kamaytiradi.",
    ],
    risk: [
      "Qimmat investitsiya; servis va ehtiyot qism bo'lmasa, buzilishda sut yo'qotiladi.",
      "Elektr yoki suv bosimi yetmasa, uskuna rejimda ishlamaydi.",
    ],
    action: [
      "Kafolat muddati, servis shartnomasi va ehtiyot qism narxini yozma so'rang.",
      "Kamida 3 ta taklifni solishtiring; elektr quvvati va suv bosimini oldindan tekshiring.",
    ],
  },
  raqamli: {
    benefit: [
      "Har bir molning identifikatsiyasi, sog'lig'i va sut ko'rsatkichlari bir joyda ko'rinadi — qaror tezroq qabul qilinadi.",
      "Aniq yozuv subsidiyaga ariza berishda va tekshiruvda dalil bo'ladi; yo'qolgan molni topish osonlashadi.",
    ],
    risk: [
      "Tizim, abonent to'lovi va xizmat ko'rsatish xarajati kutilganidan oshishi mumkin.",
      "Internet yoki elektr uzilsa, ma'lumot yo'qolishi; eski yozuvlar bilan mosligini oldindan tekshirish kerak.",
    ],
    action: [
      "Tizim narxi, abonent to'lovi va ma'lumot kimga tegishli ekanini shartnomada aniqlashtiring.",
      "Avval 10–15 boshda sinab ko'ring: bir oy yozuv yuritib, xodimga qulayligini baholang.",
    ],
  },
  sogliq: {
    benefit: [
      "Kasallikning oldini olish sut yo'qotishi va veterinariya xarajatini kamaytiradi.",
      "Podada sog'lom mol ko'proq sut beradi va tezroq qayta bo'g'oz bo'ladi.",
    ],
    risk: [
      "Emlash yoki karantin qoidasi buzilsa, kasallik podada tez tarqaladi.",
      "Dorini ruxsatsiz ishlatish sutni topshirishda muammo keltiradi.",
    ],
    action: [
      "Emlash kalendarini yangilang va yangi molni 30 kun alohida saqlang.",
      "Veterinar bilan poda uchun oldini olish rejasini tuzing.",
    ],
  },
  bozor: {
    benefit: [
      "Narx va talab o'zgarishini oldin bilsangiz, sotish va xaridni to'g'ri vaqtga qo'yasiz.",
      "Tannarxni bilgan holda marjani himoya qilasiz.",
    ],
    risk: [
      "Narx tushishi yoki xaridor shartlarining o'zgarishi daromadni kamaytiradi.",
      "Bitta xaridorga bog'lanib qolish muzokara kuchini pasaytiradi.",
    ],
    action: [
      "Haftalik sut narxini yozib boring — 3 oylik dinamika ko'rinadi.",
      "Ikkinchi xaridor bilan ham gaplashib, shartlarni solishtirib turing.",
    ],
  },
  jahon: {
    benefit: [
      "Jahon amaliyoti va texnologiyasini o'z sharoitingizga moslab qo'llash mumkin.",
      "Yangi uskuna va ozuqa tendensiyasini oldin bilib, narxni solishtirasiz.",
    ],
    risk: [
      "Boshqa iqlim, bozor va qonunchilik — to'g'ridan-to'g'ri ko'chirish foyda bermasligi mumkin.",
      "Import uskuna uchun servis va ehtiyot qism O'zbekistonda bo'lmasligi mumkin.",
    ],
    action: [
      "G'oyani kichik sinovda (10–15 bosh yoki bitta bo'lim) tekshiring.",
      "Narx, yetkazib berish va servisni O'zbekiston sharoitida hisoblab ko'ring.",
    ],
  },
};

const SEASON_NOTE = {
  1: "Qishda suv va isitish sharoitini, yozda esa issiq stressni hisobga oling.",
  2: "Qishda suv va isitish sharoitini, yozda esa issiq stressni hisobga oling.",
  12: "Qishda suv va isitish sharoitini, yozda esa issiq stressni hisobga oling.",
  4: "Bahorda emlash va parazitga qarshi ishlov muddatini tekshiring.",
  5: "Bahorda emlash va parazitga qarshi ishlov muddatini tekshiring.",
  6: "Yozda issiq stress va suv sarfini kuzatib boring.",
  7: "Yozda issiq stress va suv sarfini kuzatib boring.",
  8: "Yozda issiq stress va suv sarfini kuzatib boring.",
};

/**
 * @param {object} cls classify() natijasi
 * @param {object} item maqola
 * @param {object} farm {cows, name}
 */
export function buildImpact(cls, item, farm = {}, now = new Date()) {
  const primary = cls.primary || "jahon";
  const pb = PLAYBOOK[primary] || PLAYBOOK.jahon;
  const benefit = [...pb.benefit];
  const risk = [...pb.risk];
  const action = [...pb.action];
  if (['biznes', 'boshqaruv', 'ilm', 'muhim'].includes(primary)) return { benefit, risk, action };

  const cows = Number(farm.cows) || 0;

  if (cls.signals?.hasPercent) {
    benefit.push(`Matnda ${cls.signals.percent.slice(0, 2).join(", ")} ko'rsatilgan — o'z fermangiz raqamlariga qo'llab hisoblang.`);
  }
  if (cls.signals?.hasMoney) {
    risk.push(`Matnda ${cls.signals.money.slice(0, 2).join(", ")} uchraydi: bu umumiy dastur summasi bo'lishi mumkin, sizga tegishli ulushni aniqlashtiring.`);
  }
  if (primary === "ozuqa" && cows) {
    action.push(`Taxminiy hisob: ${cows} bosh uchun kunlik ozuqa sarfini yozib, yangi narxda oylik xarajatni qayta chiqaring.`);
  }
  if (primary === "sogish" && cows && cows < 50) {
    risk.push("Kichik podada to'liq avtomatlashtirish o'zini uzoq qoplashi mumkin — hisob-kitob qiling.");
  }

  const note = SEASON_NOTE[new Date(now).getMonth() + 1];
  if (note && !benefit.includes(note)) action.push(note);

  return {
    benefit: [...new Set(benefit)].slice(0, 3),
    risk: [...new Set(risk)].slice(0, 3),
    action: [...new Set(action)].slice(0, 3),
  };
}

export function buildActions(items, max = 5) {
  const out = [];
  for (const it of items) {
    for (const a of it.impact?.action || []) {
      if (out.length >= max) break;
      if (!out.some((x) => x.text === a)) out.push({ text: a, sourceTitle: it.title, category: it.primary });
    }
  }
  return out;
}
