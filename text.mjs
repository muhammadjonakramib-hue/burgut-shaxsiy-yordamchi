// Matn bilan ishlash: HTML tozalash, kirill→lotin, qidiruv uchun normalizatsiya.

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", copy: "©", reg: "®",
  euro: "€", pound: "£", times: "×", middot: "·", bull: "•",
  ouml: "ö", Ouml: "Ö", uuml: "ü", Uuml: "Ü", auml: "ä", Auml: "Ä",
  oacute: "ó", eacute: "é", iacute: "í", aacute: "á", ntilde: "ñ",
};

export function decodeEntities(s = "") {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (m, name) => {
      const v = ENTITIES[name.toLowerCase()];
      return v === undefined ? m : v;
    });
}

function safeChar(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try { return String.fromCodePoint(code); } catch { return ""; }
}

export function stripHtml(s = "") {
  return decodeEntities(
    String(s)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div|li|h\d)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

export function cleanText(s = "") {
  return stripHtml(s).replace(/\s+/g, " ").trim();
}

const CYR_MAP = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g‘", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ў: "o‘", ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
};

const CYR_UPPER = Object.fromEntries(
  Object.entries(CYR_MAP).map(([k, v]) => [k.toUpperCase(), v ? v[0].toUpperCase() + v.slice(1) : v])
);

/** O'zbek kirill yozuvini lotinga o'giradi. Ruscha matn tegilmaydi. */
export function transliterateUz(text = "") {
  if (!/[ўқғҳЎҚҒҲ]/.test(text)) return text;
  return String(text)
    .split("")
    .map((ch) => CYR_MAP[ch] ?? CYR_UPPER[ch] ?? ch)
    .join("")
    .replace(/Ў/g, "O‘").replace(/ў/g, "o‘");
}

export function isCyrillic(text = "") {
  const cyr = (String(text).match(/[а-яА-ЯёЁўқғҳЎҚҒҲ]/g) || []).length;
  const lat = (String(text).match(/[a-zA-Z]/g) || []).length;
  return cyr > lat;
}

export function isUzbekCyrillic(text = "") {
  return /[ўқғҳЎҚҒҲ]/.test(text);
}

/** Qidiruv/taqqoslash uchun: kichik harf, apostroflar bir xil, tinish belgilari bo'shliq. */
export function normalize(text = "") {
  return transliterateUz(String(text))
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/ё/g, "e")
    .replace(/[^a-z0-9'а-яёўқғҳ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** So'z boshi bo'yicha qidirish (o'zbek qo'shimchalariga mos). */
export function hasTerm(normText, term) {
  if (!term) return false;
  const t = term.toLowerCase().replace(/[‘’ʻʼ]/g, "'");
  let from = 0;
  while (true) {
    const i = normText.indexOf(t, from);
    if (i === -1) return false;
    const before = i === 0 ? " " : normText[i - 1];
    if (!/[a-z'а-яёўқғҳ0-9]/.test(before)) return true;
    from = i + 1;
  }
}

export function countTerms(normText, terms) {
  let n = 0;
  for (const t of terms) if (hasTerm(normText, t)) n++;
  return n;
}

export function sentences(text = "") {
  const protectedText = cleanText(text)
    .replace(/\b(Co|Ltd|Inc|No|Mr|Mrs|Ms|Dr|Prof|St|vs|approx|Dept|Fig|etc|e\.g|i\.e)\./gi, "$1<DOT>")
    .replace(/\b([A-Z])\./g, "$1<DOT>");

  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-ZА-ЯЎҚҒҲ0-9«“"])/)
    .map((s) => s.replace(/<DOT>/g, ".").trim())
    .filter(Boolean);
}

export function truncate(s = "", max = 220) {
  const t = String(s).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:\-–—]$/, "") + "…";
}

export function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Toshkent vaqti (UTC+5) bo'yicha sana. */
export function tashkentDate(date = new Date()) {
  const d = new Date(date);
  return new Date(d.getTime() + 5 * 3600 * 1000);
}

export function fmtDate(date, opts = {}) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const t = tashkentDate(d);
  const day = String(t.getUTCDate()).padStart(2, "0");
  const month = String(t.getUTCMonth() + 1).padStart(2, "0");
  const year = t.getUTCFullYear();
  if (opts.time) {
    const hh = String(t.getUTCHours()).padStart(2, "0");
    const mm = String(t.getUTCMinutes()).padStart(2, "0");
    return `${day}.${month}.${year} ${hh}:${mm}`;
  }
  return `${day}.${month}.${year}`;
}

export function daysAgo(date, now = new Date()) {
  if (!date) return Infinity;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return Infinity;
  return (now.getTime() - d.getTime()) / 86400000;
}
