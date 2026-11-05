// Google News havolasini asl nashr sahifasiga aylantirish va matnini ajratish.

import { cleanText, decodeEntities } from "./text.mjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const cache = new Map();
let blockedUntil = 0;

/** news.google.com/rss/articles/... → nashr sahifasi havolasi. */
export async function resolveGoogleNews(url, { timeoutMs = 8000, retries = 1 } = {}) {
  if (!/news\.google\.com\/(rss\/)?articles\//.test(url)) return url;
  if (cache.has(url)) return cache.get(url);
  if (Date.now() < blockedUntil) return url;

  const id = url.match(/articles\/([^?]+)/)?.[1];
  if (!id) return url;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const page = await fetch(`https://news.google.com/articles/${id}`, {
        headers: { "User-Agent": UA, "Accept-Language": "ru,en;q=0.8" },
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (page.status === 429) {
        blockedUntil = Date.now() + 15 * 60 * 1000;
        throw new Error("429");
      }
      const html = await page.text();
      const sg = html.match(/data-n-a-sg="([^"]*)"/)?.[1];
      const ts = html.match(/data-n-a-ts="([^"]*)"/)?.[1];
      if (!sg || !ts) throw new Error("imzo topilmadi");

      const inner = `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],${JSON.stringify(id)},${ts},"${sg}"]`;
      const body = new URLSearchParams({
        "f.req": JSON.stringify([[["Fbv4je", inner, null, "generic"]]]),
      });

      const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": UA,
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await res.text();
      const m = text.match(/https?:\\?\/\\?\/[^"\\]+/);
      if (!m) throw new Error("havola topilmadi");
      const real = m[0].replace(/\\\//g, "/");
      if (!/^https?:\/\//.test(real) || real.includes("news.google.com")) throw new Error("havola noto'g'ri");
      cache.set(url, real);
      return real;
    } catch (err) {
      if (err?.message === "429") break;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 700));
    }
  }
  return url;
}

const JUNK = /(cookie|сайт использует|cookies|подпис|subscribe|sign up|newsletter|рассылак|реклам|advertisement|batafsil o'qish|read more|share this|barcha huquqlar|all rights reserved)/i;

/** HTML sahifadan o'qiladigan matn paragraflarini ajratadi. */
export function extractArticleText(html = "") {
  let s = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");

  const article = s.match(/<article\b[\s\S]*?<\/article>/i)?.[0];
  if (article && cleanText(article).length > 300) s = article;

  const paras = [];
  for (const m of s.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = cleanText(decodeEntities(m[1]));
    if (t.length < 55 || JUNK.test(t)) continue;
    const key = t.toLowerCase().slice(0, 60);
    if (paras.some((p) => p.toLowerCase().slice(0, 60) === key)) continue;
    paras.push(t);
    if (paras.join(" ").length > 1400) break;
  }
  return paras.join(" ").slice(0, 1400);
}

export async function fetchArticleText(url, { timeoutMs = 10000 } = {}) {
  if (!url || /news\.google\.com/.test(url)) return "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ru,en;q=0.8,uz;q=0.7" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return "";
    const type = res.headers.get("content-type") || "";
    if (!/html/i.test(type)) return "";
    return extractArticleText(await res.text());
  } catch {
    return "";
  }
}
