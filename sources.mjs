// Manbalar ro'yxati. Har biri tekshirilgan (2026-10 holatiga ko'ra ishlaydi).

export const SOURCES = [
  { id: 'bbc_science', name: 'BBC Science', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', region: 'world', kind: 'news', lang: 'en', topic: 'ilm', note: 'Ilm-fan va atrof-muhit' },
  { id: 'bbc_business', name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', region: 'world', kind: 'news', lang: 'en', topic: 'biznes', note: 'Biznes, iqtisod va boshqaruv' },
  { id: 'bbc_world', name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', region: 'world', kind: 'news', lang: 'en', topic: 'muhim', note: 'Muhim xalqaro voqealar' },
  // ——— O'zbekiston: rasmiy hujjatlar va yangiliklar ———
  {
    id: "lex",
    name: "lex.uz",
    url: "https://lex.uz/rss",
    region: "uz",
    kind: "official",
    note: "Rasmiy qonun va qarorlar",
  },
  {
    id: "uza",
    name: "UzA",
    url: "https://uza.uz/uz/rss",
    region: "uz",
    kind: "official",
    note: "Milliy axborot agentligi",
  },
  {
    id: "gazeta",
    name: "Gazeta.uz",
    url: "https://www.gazeta.uz/oz/rss/",
    region: "uz",
    kind: "news",
    note: "Mustaqil yangiliklar",
  },
  {
    id: "daryo",
    name: "Daryo.uz",
    url: "https://daryo.uz/rss",
    region: "uz",
    kind: "news",
    note: "Kundalik yangiliklar",
  },
  {
    id: "podrobno",
    name: "Podrobno.uz",
    url: "https://podrobno.uz/rss/",
    region: "uz",
    kind: "news",
    note: "Iqtisod va jamiyat",
  },
  {
    id: "spot",
    name: "Spot.uz",
    url: "https://www.spot.uz/oz/rss/",
    region: "uz",
    kind: "news",
    note: "Biznes va iqtisod",
  },
  {
    id: "review",
    name: "Review.uz",
    url: "https://review.uz/rss",
    region: "uz",
    kind: "news",
    note: "Tahliliy nashr",
  },
  {
    id: "anhor",
    name: "Anhor.uz",
    url: "https://anhor.uz/feed/",
    region: "uz",
    kind: "news",
    note: "Kundalik yangiliklar",
  },
  {
    id: "uzdaily",
    name: "UzDaily.uz",
    url: "https://www.uzdaily.uz/rss",
    region: "uz",
    kind: "news",
    note: "Iqtisodiy yangiliklar",
  },

  // ——— O'zbekiston: Google News qidiruvlari (qo'shimcha qamrov) ———
  {
    id: "gnews_livestock",
    name: "Google News · chorvachilik",
    url: "https://news.google.com/rss/search?q=%D0%A3%D0%B7%D0%B1%D0%B5%D0%BA%D0%B8%D1%81%D1%82%D0%B0%D0%BD+%D0%B6%D0%B8%D0%B2%D0%BE%D1%82%D0%BD%D0%BE%D0%B2%D0%BE%D0%B4%D1%81%D1%82%D0%B2%D0%BE&hl=ru&gl=UZ&ceid=UZ:ru",
    region: "uz",
    kind: "news",
    note: "Rus tilidagi O'zbekiston xabarlari",
  },
  {
    id: "gnews_milk",
    name: "Google News · sut",
    url: "https://news.google.com/rss/search?q=%D0%A3%D0%B7%D0%B1%D0%B5%D0%BA%D0%B8%D1%81%D1%82%D0%B0%D0%BD+%D0%BC%D0%BE%D0%BB%D0%BE%D0%BA%D0%BE&hl=ru&gl=UZ&ceid=UZ:ru",
    region: "uz",
    kind: "news",
    note: "Rus tilidagi sut xabarlari",
  },
  {
    id: "gnews_subsidy",
    name: "Google News · subsidiya",
    url: "https://news.google.com/rss/search?q=%D0%A3%D0%B7%D0%B1%D0%B5%D0%BA%D0%B8%D1%81%D1%82%D0%B0%D0%BD+%D1%81%D1%83%D0%B1%D1%81%D0%B8%D0%B4%D0%B8%D1%8F+%D1%84%D0%B5%D1%80%D0%BC%D0%B5%D1%80&hl=ru&gl=UZ&ceid=UZ:ru",
    region: "uz",
    kind: "news",
    note: "Subsidiya bo'yicha qidiruv",
  },
  {
    id: "gnews_dairy_en",
    name: "Google News · dairy",
    url: "https://news.google.com/rss/search?q=Uzbekistan+dairy+livestock&hl=en-US&gl=US&ceid=US:en",
    region: "uz",
    kind: "news",
    lang: "en",
    note: "Ingliz tilidagi O'zbekiston xabarlari",
  },

  // ——— Jahon: sut, chorva, ozuqa, texnika ———
  {
    id: "feedstuffs",
    name: "Feedstuffs",
    url: "https://www.feedstuffs.com/rss.xml",
    region: "world",
    kind: "industry",
    note: "Ozuqa va chorva sanoati (AQSh)",
  },
  {
    id: "agriland",
    name: "Agriland.ie",
    url: "https://www.agriland.ie/feed/",
    region: "world",
    kind: "industry",
    note: "Sut chorvachiligi (Irlandiya)",
  },
  {
    id: "agrilanduk",
    name: "Agriland.co.uk",
    url: "https://www.agriland.co.uk/feed/",
    region: "world",
    kind: "industry",
    note: "Chorvachilik (Buyuk Britaniya)",
  },
  {
    id: "farmanddairy",
    name: "Farm and Dairy",
    url: "https://www.farmanddairy.com/feed/",
    region: "world",
    kind: "industry",
    note: "Ferma amaliyoti (AQSh)",
  },
  {
    id: "farminglife",
    name: "Farming Life",
    url: "https://www.farminglife.com/rss",
    region: "world",
    kind: "industry",
    note: "Chorvachilik yangiliklari",
  },
  {
    id: "futurefarming",
    name: "Future Farming",
    url: "https://www.futurefarming.com/feed/",
    region: "world",
    kind: "industry",
    note: "Texnika va raqamli fermerlik",
  },
  {
    id: "farmprogress",
    name: "Farm Progress",
    url: "https://www.farmprogress.com/rss.xml",
    region: "world",
    kind: "industry",
    note: "Ferma texnikasi va amaliyoti",
  },
  {
    id: "beefmag",
    name: "Beef Magazine",
    url: "https://www.beefmagazine.com/rss.xml",
    region: "world",
    kind: "industry",
    note: "Chorva bozori va sog'liq",
  },

  // ——— Futbol yangiliklari ———
  {
    id: "bbc_football",
    name: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    region: "football",
    kind: "news",
    note: "Futbol yangiliklari",
  },
  {
    id: "guardian_football",
    name: "The Guardian",
    url: "https://www.theguardian.com/football/rss",
    region: "football",
    kind: "news",
    note: "Futbol yangiliklari",
  },
  {
    id: "skysports",
    name: "Sky Sports",
    url: "https://www.skysports.com/rss/11095",
    region: "football",
    kind: "news",
    note: "Angliya Premyer-ligasi",
  },
];

export const SOURCE_BY_ID = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

export const KIND_LABEL = {
  official: "Rasmiy manba",
  news: "Yangiliklar",
  industry: "Soha nashri",
};

export function sourcesByRegion(region) {
  return SOURCES.filter((s) => s.region === region);
}
