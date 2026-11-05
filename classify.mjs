// Yangilikni turkumlash, muhimlik bahosi va "nima o'zgardi" belgilarini ajratish.

import { normalize, hasTerm, countTerms, transliterateUz, isUzbekCyrillic, cleanText, sentences, truncate } from "./text.mjs";
import { classifyInterests } from './interests.mjs';

export const CATEGORIES = {
  biznes: { label: 'Biznes va iqtisod', short: 'Biznes', icon: '💼', weight: 1 },
  boshqaruv: { label: 'Biznes boshqaruv', short: 'Boshqaruv', icon: '🎯', weight: 1 },
  ilm: { label: 'Ilm-fan va tadqiqot', short: 'Ilm-fan', icon: '🔬', weight: 1 },
  muhim: { label: 'Muhim voqealar', short: 'Muhim', icon: '🌐', weight: 1 },
  subsidiya: { label: "Subsidiya va moliya", short: "Subsidiya", icon: "💰", weight: 1.35 },
  qoida: { label: "Qonun va qoidalar", short: "Qoida", icon: "📜", weight: 1.3 },
  ozuqa: { label: "Ozuqa va yem", short: "Ozuqa", icon: "🌾", weight: 1.15 },
  sogish: { label: "Sog'ish uskunasi", short: "Uskuna", icon: "🥛", weight: 1.12 },
  raqamli: { label: "Raqamlashtirish", short: "Raqamli", icon: "📡", weight: 1.08 },
  sogliq: { label: "Chorva sog'lig'i", short: "Sog'liq", icon: "💉", weight: 1.1 },
  bozor: { label: "Sut bozori va narx", short: "Bozor", icon: "📈", weight: 1.0 },
  jahon: { label: "Jahon chorvachiligi", short: "Jahon", icon: "🌍", weight: 0.9 },
};

// O'zbekcha o'zaklar (qo'shimchalar hasTerm orqali hisobga olinadi).
const K = {
  animal: [
    "sut", "sigir", "buzoq", "g'unajin", "xonajin", "novvos", "qoramol",
    "chorva", "chorvachilik", "poda", "yaylov", "naslchilik", "zootexnik",
    "sog'ish", "sog'uv", "sut zavodi", "sut mahsulot", "mollar", "mol bozor",
    "veterinariya", "go'sht",
    // ruscha
    "молок", "молочн", "скот", "животновод", "коров", "телят", "стадо", "мяс",
    "птиц", "фермер", "поголов",
  ],
  feed: [
    "yem", "yemxona", "em-xashak", "ozuqa", "ratsion", "silos", "senaj", "pichan",
    "beda", "makkajo'xori", "arpa", "bug'doy", "kunjara", "shrot", "premiks",
    "vitamin", "mineral", "protein", "to'yimli", "ozuqaviy", "xashak", "g'alla",
    // ruscha
    "корм", "сено", "силос", "комбикорм", "рацион", "зерно", "жмых", "шрот", "премикс",
  ],
  equipment: [
    "sog'ish", "sog'uv", "apparat", "uskuna", "jihoz", "sut tank", "sovutish",
    "muzlatgich", "separator", "nasos", "avtomatik sog'ish", "sog'ish robot",
    "generator",
    // ruscha
    "доен", "доильн", "оборудован", "робот", "танк", "охлажден",
  ],
  digital: [
    "raqamli", "elektron", "datchik", "sensor", "birka", "chip", "identifikatsiya",
    "monitoring", "avtomatlashtirish", "sun'iy yo'ldosh",
    // ruscha
    "цифров", "бирк", "чип", "идентификац", "отслеживан", "электрон", "мониторинг", "автоматизац",
  ],
  subsidy: [
    "subsidiya", "subsidiy", "grant", "imtiyoz", "kompensatsiya", "kredit",
    "lizing", "moliyalashtirish", "byudjet", "to'lov", "soliq", "bojxona",
    "qo'llab-quvvatlash", "qoplash", "ariza", "investitsiya", "sarmoya",
    // ruscha
    "субсиди", "кредит", "льготн", "грант", "компенсац", "лизинг", "дотац",
    "инвест", "модернизац", "финансир",
  ],
  regulation: [
    "qaror", "farmon", "qonun", "nizom", "tartib", "litsenziya", "sertifikat",
    "ruxsatnoma", "nazorat", "jarima", "javobgarlik", "standart", "reglament",
    "karantin", "cheklov", "taqiq", "o'zgartirish", "kuchga kirish", "majburiy",
    // ruscha
    "постановлен", "закон", "указ", "правил", "лиценз", "сертификат", "штраф",
    "запрет", "требован", "налог", "таможн",
  ],
  health: [
    "emlash", "vaksina", "kasallik", "mastit", "brutsellyoz", "leykoz",
    "yashur", "kuydirgi", "parazit", "davolash", "antibiotik", "somatik",
    "hujayra", "epidemiya", "gormon",
    // ruscha
    "вакцин", "прививк", "болезн", "мастит", "ветеринар", "паразит", "антибиотик",
  ],
  market: [
    "narx", "bozor", "eksport", "import", "tannarx", "xarid", "sotuv",
    "savdo", "inflyatsiya", "so'm", "dollar", "talab", "taklif",
    // ruscha
    "цена", "рынок", "экспорт", "импорт", "удой", "себестоим", "спрос", "предложен",
    "переработ", "производств",
  ],
};

const RU = [
  "субсиди", "фермер", "молочн", "скот", "корм", "доен", "животновод",
  "ветеринар", "агро", "субсидия", "кредит", "постановлен", "закон", "налог",
  "субсидирова", "поголов", "удой", "сено", "силос",
];

const NEGATIVE = [
  "futbol", "saylov", "jinoyat", "avtohalokat",
  "ob-havo", "kino", "musiqa", "turizm", "imtihon",
  "kripto", "kosmos", "sutka",
];

// Inglizcha (jahon manbalari uchun).
const EN = {
  animal: [
    "dairy", "cow", "cows", "cattle", "herd", "heifer", "heifers", "calf", "calves",
    "milk", "milking", "livestock", "dairy farm", "dairy farmer", "dairy herd",
  ],
  feed: [
    "feed", "feeding", "forage", "silage", "hay", "ration", "tmr", "alfalfa",
    "feed additive", "nutrition", "pasture", "grazing", "byproduct", "soybean meal",
    "corn silage", "grain",
  ],
  equipment: [
    "milking", "parlour", "parlor", "robot", "robotic", "cooling",
    "bulk tank", "cluster", "teat", "hoof", "lameness", "collar", "activity monitor",
    "ventilation", "manure", "sensor",
  ],
  health: [
    "mastitis", "fertility", "reproduction", "vaccine", "vaccination", "disease",
    "parasite", "bluetongue", "bvd", "ibr", "johnes", "antibiotic", "somatic cell",
    "udder", "lameness", "mortality", "virus", "infection", "outbreak",
    "pregnancy", "pregnant", "breeding", "calving",
  ],
  market: [
    "price", "market", "milk price", "export", "import", "tariff", "demand",
    "supply", "cost", "margin", "processor", "co-op", "coop", "contract",
    "milk yield", "production", "productivity",
    "sale", "sold", "selling", "auction", "dispersal",
  ],
  exclude: [
    "poultry", "chicken", "egg", "pig", "pork", "swine", "shrimp", "fish",
    "orchard", "vineyard", "pollination", "avocado", "blueberry", "spraying robot",
    "hoeing robot", "chainsaw", "crop protection", "soil moisture",
    "wheat yield", "barley yield",
  ],
};

/** Muhimlik belgilari: foiz, pul, sana, miqdor. */
export function detectSignals(text = "") {
  const t = cleanText(text);
  const out = { numbers: [], percent: [], money: [], dates: [], hasPercent: false, hasMoney: false, hasDate: false };
  const push = (arr, v) => { if (v && arr.length < 4 && !arr.includes(v)) arr.push(v); };
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:%|foiz|percent)/gi)) push(out.percent, m[0].replace(/\s+/g, " ").trim());
  for (const m of t.matchAll(/(\d[\d\s.,]*)\s*(so['‘’]m|млн|mln|million|ming|dollar|yevro|eur|usd|€|\$)\b/gi)) push(out.money, m[0].replace(/\s+/g, " ").trim());
  for (const m of t.matchAll(/[$€£]\s?\d[\d\s.,]*\s*(?:млн|mln|million|ming|mlrd|billion|k)?/gi)) push(out.money, m[0].replace(/\s+/g, " ").trim());
  for (const m of t.matchAll(/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b/g)) push(out.dates, m[0]);
  for (const m of t.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:млн|тыс|mln|ming)?\s*(?:bosh|tonna|litr|kg|gektar|kun|oy|yil|голов|тонн|литр|кг|га|гектар)\b/gi)) push(out.numbers, m[0]);
  for (const m of t.matchAll(/\b\d+\s*(?:yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentabr|oktabr|noyabr|dekabr)\w*/gi)) push(out.dates, m[0]);
  out.hasPercent = out.percent.length > 0;
  out.hasMoney = out.money.length > 0;
  out.hasDate = out.dates.length > 0;
  return out;
}

/** lex.uz qarorlari uchun raqam va sanalar. */
export function extractLegalMeta(item) {
  const text = transliterateUz(`${item.title || ""} ${item.description || ""}`);
  const meta = {};
  const num = text.match(/(\d+)\s*-\s*son/i) || text.match(/(?:PQ|PK|F|O'RQ|AQ|№)\s*[-–]?\s*(\d+)/i);
  if (num) meta.number = num[1];
  const adopted = text.match(/qabul qilingan sana[:\s]*([\d.\-/]+)/i);
  if (adopted) meta.adopted = adopted[1];
  const effective = text.match(/kuchga kirish sana[:\s]*([\d.\-/]+)/i);
  if (effective) meta.effective = effective[1];
  const type = text.match(/(Vazirlar Mahkamasining qarori|Prezident farmoni|Prezidentining qarori|Prezident qarori|Qonun)/i);
  if (type) meta.type = type[1];
  return meta;
}

function counts(norm) {
  const out = {};
  for (const key of Object.keys(K)) out[key] = countTerms(norm, K[key]);
  return out;
}

function mapUzCategories(h) {
  const cats = [];
  if (h.subsidy >= 1) cats.push("subsidiya");
  if (h.regulation >= 1) cats.push("qoida");
  if (h.feed >= 1) cats.push("ozuqa");
  if (h.equipment >= 1) cats.push("sogish");
  if (h.digital >= 1) cats.push("raqamli");
  if (h.health >= 1) cats.push("sogliq");
  if (h.market >= 1) cats.push("bozor");
  return [...new Set(cats)];
}

/** Turkumlarni uchrash soni bo'yicha tanlaydi (og'irlik bilan). */
function pickPrimary(hits, titleHits = {}) {
  const groups = {
    subsidiya: ["subsidiya", "subsidy"],
    qoida: ["qoida", "regulation"],
    ozuqa: ["ozuqa", "feed"],
    sogish: ["sogish", "equipment"],
    raqamli: ["raqamli", "digital"],
    sogliq: ["sogliq", "health"],
    bozor: ["bozor", "market"],
  };
  const sum = (obj, keys) => keys.reduce((n, k) => n + (obj[k] || 0), 0);

  let best = "jahon";
  let bestScore = -1;
  for (const [key, aliases] of Object.entries(groups)) {
    const n = sum(hits, aliases) + sum(titleHits, aliases) * 2;
    if (!n) continue;
    const s = n * (CATEGORIES[key]?.weight || 1);
    if (s > bestScore) { bestScore = s; best = key; }
  }
  return best;
}

function recency(age, score) {
  if (age <= 2) return score + 14;
  if (age <= 4) return score + 9;
  if (age <= 7) return score + 4;
  return score;
}

export const RELEVANCE_THRESHOLD = 32;

/** O'zbekiston manbalari uchun. */
function classifyUz(item, source, now) {
  const title = transliterateUz(item.title || "");
  const body = transliterateUz(item.description || "");
  const normTitle = normalize(title).replace(/sutka\w*/g, " ");
  const normBody = normalize(`${title} ${body}`).replace(/sutka\w*/g, " ");

  const t = counts(normTitle);
  const a = counts(normBody);
  const signals = detectSignals(`${title} ${body}`);
  const reasons = [];
  const age = item.published ? (now - new Date(item.published)) / 86400000 : 99;

  const animal = a.animal;
  const neg = countTerms(normTitle, NEGATIVE);

  let relevant;
  if (source.id === "lex") {
    // Huquqiy hujjat: aniq chorvachilikka oid bo'lishi shart.
    relevant = animal >= 1;
  } else {
    // Umumiy yangilik: hayvon mavzusi + kamida bitta amaliy belgi.
    const practical = a.feed + a.equipment + a.health + a.subsidy + a.regulation + a.market;
    relevant = animal >= 1 && (practical >= 1 || animal >= 2);
  }
  if (neg > 0) relevant = false;

  let score = 0;
  if (source.kind === "official") { score += 26; reasons.push("Rasmiy manba"); }
  if (source.region === "uz") score += 10;

  const titleHits = Object.values(t).reduce((x, y) => x + y, 0);
  score += Math.min(24, titleHits * 8);
  score += Math.min(12, Math.max(0, Object.values(a).reduce((x, y) => x + y, 0) - titleHits) * 2);

  if (signals.hasPercent) { score += 8; reasons.push("Aniq foiz bor"); }
  if (signals.hasMoney) { score += 7; reasons.push("Pul summasi bor"); }
  if (signals.hasDate) { score += 5; reasons.push("Muddat ko'rsatilgan"); }
  score = recency(age, score);

  const ruHits = countTerms(normalize(body), RU);
  if (/[а-яА-Я]/.test(body)) score += Math.min(10, ruHits * 3);

  // Chorvachilikka bevosita tegishli kuchli so'zlar
  if (["chorva", "chorvachilik", "yaylov", "sut", "sigir", "sog'ish", "naslchilik"].some((s) => hasTerm(normTitle, s))) score += 6;

  if (a.subsidy > 0) reasons.push("To'lov/subsidiya masalasi");
  if (a.regulation > 0) reasons.push("Qoida o'zgarishi");

  const cats = mapUzCategories(a);
  const primary = pickPrimary(a, t);

  return {
    relevant,
    categories: cats.length ? cats : [primary],
    primary,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    signals,
    ageDays: age,
    lang: isUzbekCyrillic(title) || /[а-яА-Я]/.test(title) ? "ru" : "uz",
  };
}

/** Jahon manbalari uchun (inglizcha). */
function classifyWorld(item, source, now) {
  const title = cleanText(item.title || "");
  const body = cleanText(item.description || "");
  const normTitle = normalize(title);
  const normBody = normalize(`${title} ${body}`);

  const sig = detectSignals(`${title} ${body}`);
  const age = item.published ? (now - new Date(item.published)) / 86400000 : 99;

  const animal = countTerms(normBody, EN.animal);
  const animalTitle = countTerms(normTitle, EN.animal);
  const excluded = countTerms(normTitle, EN.exclude);

  const relevant = animal >= 1 && excluded === 0;

  let score = 0;
  const reasons = [];
  if (source.kind === "industry") score += 8;
  if (source.region === "uz") score += 10;
  score += Math.min(20, animalTitle * 8);
  score += Math.min(10, Math.max(0, animal - animalTitle) * 3);

  const h = {
    feed: countTerms(normBody, EN.feed),
    equipment: countTerms(normBody, EN.equipment),
    health: countTerms(normBody, EN.health),
    market: countTerms(normBody, EN.market),
  };

  if (h.feed) { score += 8; reasons.push("Ozuqa mavzusi"); }
  if (h.equipment) { score += 8; reasons.push("Texnika/uskuna"); }
  if (h.health) { score += 8; reasons.push("Sog'liq mavzusi"); }
  if (h.market) { score += 5; reasons.push("Bozor/narx"); }
  if (sig.hasPercent) { score += 6; reasons.push("Aniq foiz bor"); }
  if (sig.hasMoney) { score += 5; reasons.push("Pul summasi bor"); }
  score = recency(age, score);

  const cats = [];
  if (h.feed) cats.push("ozuqa");
  if (h.equipment) cats.push("sogish");
  if (h.health) cats.push("sogliq");
  if (h.market) cats.push("bozor");
  if (!cats.length) cats.push("jahon");

  const primary = pickPrimary(h, {
    feed: countTerms(normTitle, EN.feed),
    equipment: countTerms(normTitle, EN.equipment),
    health: countTerms(normTitle, EN.health),
    market: countTerms(normTitle, EN.market),
  });

  return {
    relevant,
    categories: cats,
    primary,
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    signals: sig,
    ageDays: age,
    lang: "en",
  };
}

export function classify(item, source, { now = new Date() } = {}) {
  const livestock = source.region === 'world' || source.lang === 'en' ? classifyWorld(item, source, now) : classifyUz(item, source, now);
  if (livestock.relevant) return livestock;
  return classifyInterests(item, source, now) || livestock;
}

const CHANGE_RE = [
  /o'zgar/i, /kiritil/i, /joriy etil/i, /tasdiqla/i, /bekor qil/i, /oshiril/i,
  /kamaytiril/i, /yangi/i, /kuchga kir/i, /qabul qil/i, /ruxsat/i, /taqiq/i,
  /majburiy/i, /cheklan/i, /uzaytir/i, /qisqartir/i, /subsidiy/i, /narx/i,
  /banned/i, /approved/i, /launch/i, /new /i, /increase/i, /reduce/i, /require/i,
];

/** "Nima o'zgardi" — faqat maqoladagi aniq gaplardan. */
export function whatChanged(item, meta = {}) {
  const bullets = [];
  const add = (b) => {
    const k = normalize(b).slice(0, 34);
    if (!k) return;
    if (bullets.some((x) => {
      const xk = normalize(x).slice(0, 34);
      return xk === k || xk.includes(k) || k.includes(xk);
    })) return;
    bullets.push(b);
  };

  if (meta.number) add(`Hujjat raqami: ${meta.number}-son${meta.type ? ` (${meta.type})` : ""}`);
  if (meta.adopted) add(`Qabul qilingan sana: ${meta.adopted}`);
  if (meta.effective) add(`Kuchga kirish sanasi: ${meta.effective}`);

  const text = transliterateUz(cleanText(item.description || ""));
  const titleKey = normalize(item.title || "");
  const titleHead = titleKey.slice(0, 42);
  const sents = sentences(text).filter((s) => {
    if (s.length <= 25) return false;
    // Tavsif ko'pincha sarlavhaning takrori — uni "nima o'zgardi" deb ko'rsatmaymiz.
    if (titleHead && normalize(s).startsWith(titleHead)) return false;
    return true;
  });
  const changeSents = sents.filter((s) => CHANGE_RE.some((re) => re.test(s)));
  const chosen = (changeSents.length ? changeSents : sents).slice(0, 3);

  for (const s of chosen) {
    if (bullets.length >= 4) break;
    add(truncate(s, 230));
  }
  if (!bullets.length) {
    // Google News kabi lentlarda faqat sarlavha bo'ladi — undagi aniq raqamlarni ajratamiz.
    const sig = detectSignals(transliterateUz(item.title || ""));
    if (sig.money.length) add(`Sarlavhada ko'rsatilgan summa: ${sig.money.slice(0, 2).join(", ")}.`);
    if (sig.percent.length) add(`Sarlavhada ko'rsatilgan ko'rsatkich: ${sig.percent.slice(0, 2).join(", ")}.`);
    if (sig.numbers.length) add(`Sarlavhada ko'rsatilgan miqdor: ${sig.numbers.slice(0, 2).join(", ")}.`);
    add("Qisqa tavsif: tafsilotni manba havolasidan ochib tekshiring.");
  }
  return bullets.slice(0, 4);
}

export function whyImportant(item, cls, source) {
  const out = [];
  for (const category of ['biznes', 'boshqaruv', 'ilm', 'muhim']) {
    if (cls.categories.includes(category)) out.push(CATEGORIES[category].label);
  }
  if (source.kind === "official") out.push("Rasmiy hujjat");
  if (cls.categories.includes("subsidiya")) out.push("Pulga ta'sir qiladi");
  if (cls.categories.includes("qoida")) out.push("Talablar o'zgargan");
  if (cls.categories.includes("ozuqa")) out.push("Ozuqa tannarxi");
  if (cls.categories.includes("sogish")) out.push("Sog'ish jarayoni");
  if (cls.categories.includes("raqamli")) out.push("Raqamlashtirish");
  if (cls.categories.includes("sogliq")) out.push("Chorva sog'lig'i");
  if (cls.categories.includes("bozor")) out.push("Narx/bozor");
  if (cls.ageDays <= 2) out.push("Yangi");
  if (!out.length) out.push("Amaliy ahamiyat");
  return out.slice(0, 4);
}

export { K as KEYWORDS, EN as ENGLISH_KEYWORDS, isUzbekCyrillic };
