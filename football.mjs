// Futbol: ESPN ochiq API (kalitsiz) — natijalar, keyingi o'yin, klub yangiliklari.

import { fmtDate, cleanText, truncate } from "./text.mjs";

export const CLUBS = [
  {
    id: "360",
    league: "eng.1",
    leagueName: "Angliya Premyer-ligasi",
    name: "Manchester United",
    short: "Man Utd",
    emoji: "🔴",
    match: ["manchester united", "man utd", "man united", "mufc", "old trafford"],
  },
  {
    id: "83",
    league: "esp.1",
    leagueName: "Ispaniya La Liga",
    name: "Barcelona",
    short: "Barselona",
    emoji: "🔵",
    match: ["barcelona", "barca", "barça", "blaugrana", "camp nou"],
  },
  {
    id: "160",
    league: "fra.1",
    leagueName: "Fransiya Liga 1",
    name: "Paris Saint-Germain",
    short: "PSJ",
    emoji: "🔵",
    match: ["paris saint-germain", "paris saint germain", "psg", "parc des princes"],
  },
];

const API = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const NEXT_WINDOW_DAYS = 12;

async function getJson(url, { retries = 1 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; FermaXabarchi/1.0)", Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function ymd(date) {
  const t = new Date(date.getTime() + 5 * 3600 * 1000);
  return `${t.getUTCFullYear()}${String(t.getUTCMonth() + 1).padStart(2, "0")}${String(t.getUTCDate()).padStart(2, "0")}`;
}

function side(comp, which) {
  const c = (comp.competitors || []).find((x) => x.homeAway === which);
  if (!c) return null;
  return {
    id: String(c.team?.id || ""),
    team: c.team?.displayName || "",
    score: typeof c.score === "object" ? (c.score?.displayValue ?? c.score?.value ?? "") : (c.score ?? ""),
    logo: c.team?.logo || c.team?.logos?.[0]?.href || "",
  };
}

export function parseEvent(ev, clubId, now) {
  const comp = ev.competitions?.[0];
  if (!comp) return null;
  const home = side(comp, "home");
  const away = side(comp, "away");
  if (!home || !away) return null;

  const inEvent = (comp.competitors || []).find((c) => String(c.team?.id) === String(clubId));
  if (!inEvent) return null;
  const clubSide = inEvent.homeAway || "home";

  const date = ev.date;
  const status = comp.status?.type || ev.status?.type || {};
  const statusState = status.state || "";
  const completed =
    status.completed === true || statusState === "post";

  const mine = clubSide === "home" ? home : away;
  const opp = clubSide === "home" ? away : home;

  let result = "";
  if (completed) {
    const a = Number(mine.score), b = Number(opp.score);
    if (mine.score !== "" && opp.score !== "" && Number.isFinite(a) && Number.isFinite(b)) result = a > b ? "W" : a < b ? "L" : "D";
  }

  return {
    id: ev.id,
    date,
    dateLabel: fmtDate(date, { time: true }),
    name: ev.name,
    completed,
    state: statusState,
    detail: status.shortDetail || status.description || "",
    home,
    away,
    clubSide,
    isHome: clubSide === "home",
    opponent: opp.team,
    opponentLogo: opp.logo,
    clubScore: mine.score,
    opponentScore: opp.score,
    result,
    venue: comp.venue?.fullName || "",
  };
}

export function summarize(events, clubId, now) {
  const parsed = events.map((e) => parseEvent(e, clubId, now)).filter(Boolean);
  const past = parsed.filter((e) => e.completed).sort((a, b) => new Date(b.date) - new Date(a.date));
  const future = parsed.filter((e) => !e.completed && new Date(e.date) > now).sort((a, b) => new Date(a.date) - new Date(b.date));
  return {
    last: past[0] || null,
    recent: past.slice(0, 10),
    live: parsed.filter((e) => e.state === "in"),
    next: future[0] || null,
    form: past.slice(0, 5).map((e) => e.result).filter(Boolean).reverse(),
    played: past.length,
  };
}

async function leagueWindow(league, now) {
  const days = Array.from({ length: NEXT_WINDOW_DAYS + 7 }, (_, i) => new Date(now.getTime() + (i - 7) * 86400000));
  const results = await Promise.allSettled(days.map(async (date) => {
    const data = await getJson(`${API}/${league}/scoreboard?dates=${ymd(date)}`);
    return data.events || [];
  }));
  const ok = results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
  if (!ok.length && results.some((r) => r.status === "rejected")) {
    throw new Error("Jadval yuklanmadi");
  }
  return ok;
}

function clubFromArticle(article) {
  const text = `${article.headline || ""} ${article.description || ""}`.toLowerCase();
  let best = null;
  let bestPos = Infinity;
  for (const club of CLUBS) {
    for (const m of club.match) {
      const pos = text.indexOf(m);
      if (pos !== -1 && pos < bestPos) {
        best = club;
        bestPos = pos;
      }
    }
  }
  return best;
}

export async function getFootball({ now = new Date() } = {}) {
  const errors = [];

  // 1) Har klub uchun o'tgan o'yinlar + keyingi o'yinlar
  const clubResults = await Promise.all(
    CLUBS.map(async (club) => {
      try {
        const sources = await Promise.allSettled([
          getJson(`${API}/${club.league}/teams/${club.id}/schedule`),
          leagueWindow(club.league, now),
        ]);
        if (sources.every((s) => s.status === "rejected")) throw sources[0].reason;
        const warnings = sources.filter((s) => s.status === "rejected").map((s) => String(s.reason?.message || s.reason));
        const all = [...(sources[0].value?.events || []), ...(sources[1].value || [])];
        const byId = new Map();
        for (const e of all) byId.set(String(e.id), e);
        const m = summarize([...byId.values()], club.id, now);

        // O'yindan klub logotipini olish
        const logo = [...byId.values()]
          .map((e) => (e.competitions?.[0]?.competitors || []).find((c) => String(c.team?.id) === String(club.id)))
          .map((c) => c?.team?.logo || c?.team?.logos?.[0]?.href || "")
          .find(Boolean) || "";

        return { id: club.id, name: club.name, short: club.short, emoji: club.emoji, league: club.leagueName, logo, ...m, warnings, ok: true };
      } catch (err) {
        errors.push({ club: club.short, error: String(err.message || err) });
        return { id: club.id, name: club.name, short: club.short, emoji: club.emoji, league: club.leagueName, logo: "", ok: false, last: null, next: null, form: [] };
      }
    })
  );

  // 2) Liga yangiliklari, klubga bog'lash
  const leagues = [...new Set(CLUBS.map((c) => c.league))];
  const news = [];
  await Promise.all(
    leagues.map(async (lg) => {
      try {
        const data = await getJson(`${API}/${lg}/news`);
        for (const a of (data.articles || []).slice(0, 30)) {
          const club = clubFromArticle(a);
          if (!club) continue;
          const link = a.links?.web?.href || a.links?.mobile?.href || "";
          if (!link) continue;
          news.push({
            id: a.id || link,
            clubId: club.id,
            clubShort: club.short,
            title: cleanText(a.headline || ""),
            summary: truncate(cleanText(a.description || ""), 180),
            link,
            publishedAt: a.published || null,
            publishedLabel: a.published ? fmtDate(a.published) : "",
            image: a.images?.[0]?.url || "",
          });
        }
      } catch (err) {
        errors.push({ league: lg, error: String(err.message || err) });
      }
    })
  );

  const seen = new Set();
  const uniqueNews = news
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .filter((n) => {
      const k = n.title.toLowerCase().slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 12);

  return {
    generatedAt: now.toISOString(),
    generatedLabel: fmtDate(now, { time: true }),
    clubs: clubResults,
    news: uniqueNews,
    errors,
    note: "Natijalar va o'yin jadvali ESPN ochiq ma'lumotlaridan olinadi. Vaqtlar Toshkent bo'yicha.",
  };
}
