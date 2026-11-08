// Bog'liqliksiz RSS 2.0 / Atom parseri. Buzilgan lentaga ham chidamli.

import { cleanText, decodeEntities } from "./text.mjs";

function tag(block, names) {
  for (const name of names) {
    const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
    const m = block.match(re);
    if (m) return m[1];
  }
  return "";
}

function attr(block, name, attrName) {
  const re = new RegExp(`<${name}\\b[^>]*\\b${attrName}\\s*=\\s*["']([^"']+)["'][^>]*>`, "i");
  const m = block.match(re);
  return m ? m[1] : "";
}

function unwrap(raw = "") {
  let s = String(raw).trim();
  const cdata = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) s = cdata[1];
  return decodeEntities(s).trim();
}

function parseDate(raw = "") {
  const s = unwrap(raw);
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // 2026-10-24 15:11:13 — timezone yo'q bo'lsa UTC deb emas, mahalliy deb o'qiymiz
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || "00"}`);
  return null;
}

function resolveLink(link, baseUrl) {
  if (!link) return "";
  try {
    return new URL(link, baseUrl).toString();
  } catch {
    return "";
  }
}

/** Lenta oxiridagi "The post ... appeared first on ..." kabi qo'shimchalarni olib tashlaydi. */
function cleanFeedJunk(text) {
  return String(text)
    .replace(/\s*The post .{0,160}? appeared first on .{0,80}?\.?\s*$/i, "")
    .replace(/\s*(Continue reading|Read more|Read the full story|Batafsil)[\s\S]{0,120}$/i, "")
    .replace(/\[\s*(…|\.\.\.)\s*\]\s*$/i, "…")
    .trim();
}

export function parseFeed(xml, source = {}) {
  const text = String(xml);
  const out = [];
  const isAtom = /<feed[\s>]/i.test(text) && !/<rss[\s>]/i.test(text);

  const blocks = isAtom
    ? [...text.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((m) => m[0])
    : [...text.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);

  for (const block of blocks) {
    const title = cleanText(unwrap(tag(block, ["title"])));
    if (!title) continue;

    let link = unwrap(tag(block, ["link"]));
    if (!link) link = attr(block, "link", "href");
    if (!link || /^#/.test(link)) link = unwrap(tag(block, ["guid"]));
    link = resolveLink(link, source.url || "");

    const description = cleanFeedJunk(
      cleanText(unwrap(tag(block, ["description", "summary", "content:encoded", "content"])))
    );

    const published = parseDate(tag(block, ["pubDate", "published", "updated", "dc:date"])) || null;

    const categories = [...block.matchAll(/<category\b[^>]*>([\s\S]*?)<\/category>/gi)]
      .map((m) => cleanText(unwrap(m[1])))
      .filter(Boolean)
      .slice(0, 6);

    const publisher = cleanText(unwrap(tag(block, ["source"])));

    out.push({ title, link, description, published, categories, publisher });
  }

  return out;
}

export async function fetchFeed(source, { timeoutMs = 15000, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(source.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml, application/json, */*",
          "Accept-Language": "uz,en;q=0.8,ru;q=0.6",
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml)) throw new Error("RSS emas");
      return parseFeed(xml, source);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 900));
    }
  }
  throw lastErr;
}
