// Haftalik sharh va jahon yangiliklarini yig'ish.

import { SOURCES, KIND_LABEL } from "./sources.mjs";
import { fetchFeed } from "./rss.mjs";
import { classify, whatChanged, whyImportant, extractLegalMeta, RELEVANCE_THRESHOLD, CATEGORIES } from "./classify.mjs";
import { buildImpact, buildActions } from "./impact.mjs";
import { balancedItems } from './interests.mjs';
import { resolveGoogleNews } from "./gnews.mjs";
import { normalize, transliterateUz, isUzbekCyrillic, cleanText, truncate, fmtDate, daysAgo } from "./text.mjs";

const MAX_WORKERS = 8;

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

function tidyTitle(t, publisher = "") {
  let s = transliterateUz(cleanText(t || "")).replace(/\s+/g, " ").trim();
  if (publisher) {
    const esc = publisher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`\\s*[-–—|]\\s*${esc}\\s*$`, "i"), "").trim();
  }
  return s;
}

/** Google News tavsifi oxirida nashr nomini qoldiradi — uni olib tashlaymiz. */
function stripPublisherTail(text, publisher = "") {
  let s = cleanText(text || "");
  if (!publisher || publisher.length < 3 || s.length < publisher.length + 12) return s;
  const esc = publisher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return s.replace(new RegExp(`\\s*(?:[-–—|]\\s*)?${esc}\\s*$`, "i"), "").trim();
}

const UZ_MENTION = /узбекистан|ўзбекистон|o['‘’ʻ]zbekiston|uzbekistan|uzbek/i;

function itemId(link, title) {
  const s = String(link || title || "");
  let h1 = 2166136261;
  let h2 = 5381;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = ((h2 << 5) + h2 + c) | 0;
  }
  return `n${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

/**
 * @param {'uz'|'world'} region
 */
export async function collectRegion(region, { days = 8, limit = 8, threshold = RELEVANCE_THRESHOLD, farm = {}, now = new Date() } = {}) {
  const sources = SOURCES.filter((s) => s.region === region);
  const status = [];

  const results = await mapLimit(sources, MAX_WORKERS, async (source) => {
    try {
      const items = await fetchFeed(source, { timeoutMs: 8000, retries: 0 });
      status.push({ id: source.id, name: source.name, ok: true, count: items.length, error: null });
      return { source, items };
    } catch (err) {
      status.push({ id: source.id, name: source.name, ok: false, count: 0, error: String(err.message || err).slice(0, 120) });
      return { source, items: [] };
    }
  });

  const picked = [];
  let seen = 0;
  let relevant = 0;

  for (const { source, items } of results) {
    for (const raw of items) {
      seen++;
      if (!raw.link || !/^https?:/i.test(raw.link)) continue;
      try { new URL(raw.link); } catch { continue; }

      const published = raw.published || null;
      const age = published ? daysAgo(published, now) : 99;
      if (!Number.isFinite(age) || age < -0.02 || age > days) continue;

      const publisher = cleanText(raw.publisher || "");
      const title = tidyTitle(raw.title, publisher);
      const description = stripPublisherTail(raw.description, publisher);
      const displaySource = publisher && publisher.length < 46 ? publisher : source.name;
      const item = { ...raw, title, description };

      // Google News qidiruvlari butun dunyo xabarlarini ham qaytaradi.
      // O'zbekiston bo'limida faqat O'zbekistonga tegishli xabar qolsin.
      if (source.id.startsWith("gnews") && source.region === "uz" && !UZ_MENTION.test(`${title} ${description}`)) continue;

      const cls = classify(item, source, { now });
      if (!cls.relevant) continue;
      relevant++;
      if (cls.score < threshold) continue;

      const meta = source.id === "lex" ? extractLegalMeta(raw) : {};
      const changes = whatChanged(item, meta);
      const impact = buildImpact(cls, raw, farm, now);

      picked.push({
        id: itemId(raw.link, raw.title),
        title,
        originalTitle: transliterateUz(raw.title || ""),
        titleTransliterated: isUzbekCyrillic(raw.title || ""),
        link: raw.link,
        sourceId: source.id,
        sourceName: displaySource,
        feedName: source.name,
        sourceKind: source.kind,
        sourceKindLabel: KIND_LABEL[source.kind] || source.kind,
        sourceNote: source.note || "",
        lang: cls.lang,
        publishedAt: published ? new Date(published).toISOString() : null,
        publishedLabel: published ? fmtDate(published, { time: false }) : "sana ko'rsatilmagan",
        ageDays: Number.isFinite(age) ? Math.round(age * 10) / 10 : null,
        categories: cls.categories,
        primary: cls.primary,
        primaryLabel: CATEGORIES[cls.primary]?.label || "Chorvachilik",
        score: cls.score,
        official: source.kind === "official",
        whatChanged: changes,
        why: whyImportant(raw, cls, source),
        impact,
        meta,
        description: truncate(description, 700),
      });
    }
  }

  // RSS excerpts are sufficient; opening every article made refresh take minutes.

  // Takrorlarni olib tashlash: sarlavha o'xshashligi va havola bo'yicha.
  picked.sort((a, b) => b.score - a.score || (new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)));
  const unique = [];
  const keys = new Set();
  for (const it of picked) {
    const k = normalize(it.title).slice(0, 70);
    const canonical = new URL(it.link);
    canonical.hash = '';
    for (const key of [...canonical.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/.test(key)) canonical.searchParams.delete(key);
    const linkKey = canonical.href.replace(/\/$/, '');
    if (keys.has(k) || keys.has(linkKey)) continue;
    keys.add(k);
    keys.add(linkKey);
    unique.push(it);
  }

  const important = balancedItems(unique, limit);
  const nearMiss = unique.filter((item) => !important.includes(item)).slice(0, 3);

  // Google News qisqa havolalarini asl nashr sahifasiga aylantiramiz (faqat tanlanganlar).
  await mapLimit(important, 4, async (item) => {
    if (!item.sourceId?.startsWith("gnews") && !/news\.google\.com\/(rss\/)?articles\//.test(item.link || "")) return;
    try {
      const real = await resolveGoogleNews(item.link, { timeoutMs: 7000, retries: 0 });
      if (real && real !== item.link) item.link = real;
    } catch { /* eski havola qoladi */ }
  });

  const okSources = status.filter((s) => s.ok).length;

  const digest = {
    region,
    generatedAt: now.toISOString(),
    generatedLabel: fmtDate(now, { time: true }),
    windowStart: new Date(now.getTime() - days * 86400000).toISOString(),
    windowEnd: now.toISOString(),
    windowDays: days,
    threshold,
    stats: {
      sourcesChecked: sources.length,
      sourcesOk: okSources,
      sourcesFailed: sources.length - okSources,
      articlesSeen: seen,
      relevantFound: relevant,
      importantFound: important.length,
    },
    sources: status.sort((a, b) => a.name.localeCompare(b.name)),
    empty: important.length === 0,
    items: important,
    nearMiss,
    actions: buildActions(important),
  };

  digest.headline = makeHeadline(digest);
  return digest;
}

function makeHeadline(digest) {
  if (digest.empty) {
    return `Bu davrda muhim yangilik topilmadi (${digest.stats.sourcesOk} manba tekshirildi).`;
  }
  const n = digest.items.length;
  const cats = [...new Set(digest.items.map((i) => i.primaryLabel))].slice(0, 3);
  return `${n} ta muhim yangilik: ${cats.join(", ").toLowerCase()}.`;
}

export function digestToText(digest) {
  const lines = [];
  const tag = digest.region === "world" ? "🌍 Jahon yangiliklari" : "🐄 Haftalik sharh — O'zbekiston";
  lines.push(`${tag}`);
  lines.push(`📅 ${digest.generatedLabel} (Toshkent)`);
  lines.push("");
  if (digest.empty) {
    lines.push("ℹ️ Bu davrda muhim yangilik topilmadi.");
    lines.push(`Tekshirildi: ${digest.stats.sourcesOk}/${digest.stats.sourcesChecked} manba, ${digest.stats.articlesSeen} maqola.`);
  } else {
    lines.push(digest.headline);
    lines.push("");
    digest.items.forEach((it, i) => {
      lines.push(`${i + 1}. ${it.title}`);
      lines.push(`   ${it.primaryLabel} • ${it.sourceName} • ${it.publishedLabel}`);
      const w = it.whatChanged[0];
      if (w) lines.push(`   Nima o'zgardi: ${w}`);
      const b = it.impact?.benefit?.[0];
      const r = it.impact?.risk?.[0];
      if (b) lines.push(`   Foyda: ${b}`);
      if (r) lines.push(`   Xavf: ${r}`);
      lines.push(`   Manba: ${it.link}`);
      lines.push("");
    });
    if (digest.actions?.length) {
      lines.push("✅ Bu hafta qilish kerak:");
      digest.actions.forEach((a, i) => lines.push(`${i + 1}) ${a.text}`));
    }
  }
  lines.push("");
  lines.push("Tahlil qoidalar asosida avtomatik tayyorlandi. Yakuniy qaror uchun rasmiy manbani tekshiring.");
  return lines.join("\n");
}

export function digestToMarkdown(digest) {
  const t = digestToText(digest);
  return t.replace(/^(🐄.*|🌍.*)$/m, "*$1*");
}

// ————— Haftalik: O'zbekiston + jahon birga —————

export async function buildWeekly({ days = 7, farm = {}, now = new Date(), uzLimit = 8, worldLimit = 6 } = {}) {
  const [uz, world] = await Promise.all([
    collectRegion("uz", { days, limit: uzLimit, farm, now }),
    collectRegion("world", { days: Math.max(days, 10), limit: worldLimit, farm, now, threshold: 24 }),
  ]);

  const empty = uz.empty && world.empty;
  const parts = [];
  if (!uz.empty) parts.push(`${uz.items.length} ta O'zbekiston xabari`);
  if (!world.empty) parts.push(`${world.items.length} ta jahon amaliyoti`);

  return {
    kind: "weekly",
    version: 3,
    generatedAt: now.toISOString(),
    generatedLabel: fmtDate(now, { time: true }),
    windowDays: days,
    farm: { name: farm.name || "", cows: farm.cows || 0 },
    empty,
    headline: empty
      ? `Bu hafta muhim yangilik topilmadi — ${uz.stats.sourcesOk + world.stats.sourcesOk} manba tekshirildi.`
      : parts.join(", ") + ".",
    stats: {
      sources: uz.stats.sourcesChecked + world.stats.sourcesChecked,
      sourcesOk: uz.stats.sourcesOk + world.stats.sourcesOk,
      sourcesFailed: uz.stats.sourcesFailed + world.stats.sourcesFailed,
      articles: uz.stats.articlesSeen + world.stats.articlesSeen,
      important: uz.items.length + world.items.length,
    },
    uz,
    world,
    actions: dedupeActions([...uz.actions, ...world.actions]).slice(0, 5),
    disclaimer:
      "Xabar mazmuni RSS manbasidan olingan. Foyda, xavf va tavsiyalar mavzu bo'yicha umumiy o'rganish yo'nalishlari; ular maqola muallifining xulosasi emas. Manba matni asl tilida beriladi.",
  };
}

function dedupeActions(list) {
  const out = [];
  const seen = new Set();
  for (const a of list) {
    const k = a.text.toLowerCase().slice(0, 60);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

export function weeklyToText(w) {
  const lines = ["🐄 Dushanba sharhi", `📅 ${w.generatedLabel} (Toshkent)`, ""];

  if (w.empty) {
    lines.push("ℹ️ Bu hafta muhim yangilik topilmadi.");
    lines.push(`Tekshirildi: ${w.stats.sourcesOk}/${w.stats.sources} manba, ${w.stats.articles} maqola.`);
    lines.push("");
    lines.push(w.disclaimer);
    return lines.join("\n");
  }

  lines.push(`O'zbekiston: ${w.uz.empty ? "muhim yangilik yo'q" : w.uz.items.length + " ta"}`);
  if (!w.uz.empty) {
    for (const it of w.uz.items.slice(0, 5)) {
      const langNote = it.lang === "ru" ? " · manba rus tilida" : it.lang === "en" ? " · manba ingliz tilida" : "";
      lines.push("");
      lines.push(`▪️ ${it.title}`);
      lines.push(`   ${it.sourceName} • ${it.publishedLabel}${langNote}`);
      if (it.whatChanged[0]) lines.push(`   Nima o'zgardi: ${it.whatChanged[0]}`);
      if (it.impact.risk[0]) lines.push(`   Xavf: ${it.impact.risk[0]}`);
      lines.push(`   ${it.link}`);
    }
  }

  if (!w.world.empty) {
    lines.push("");
    lines.push(`🌍 Jahon: chorvachilik, biznes, ilm-fan va muhim voqealar — ${w.world.items.length} ta`);
    for (const it of w.world.items.slice(0, 4)) {
      lines.push(`▪️ ${it.title} — ${it.sourceName} (${it.publishedLabel})`);
    }
  }

  if (w.actions?.length) {
    lines.push("");
    lines.push("✅ Bu hafta qilish kerak:");
    w.actions.forEach((a, i) => lines.push(`${i + 1}) ${a.text}`));
  }

  lines.push("");
  lines.push(w.disclaimer);
  return lines.join("\n");
}
