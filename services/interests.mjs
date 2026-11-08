import { normalize, countTerms } from './text.mjs';

const TERMS = {
  biznes: ['biznes', 'tadbirkor', 'iqtisod', 'inflyatsiya', 'investitsiya', 'kompaniya', 'eksport', 'import', 'soliq', 'bank', 'business', 'economy', 'inflation', 'company', 'companies', 'investment', 'trade', 'tariff', 'supply chain', 'startup', 'entrepreneur', 'экономик', 'бизнес'],
  boshqaruv: ['boshqaruv', 'menejment', 'strategiya', 'marketing', 'xodim', 'unumdorlik', 'leadership', 'management', 'strategy', 'marketing', 'workforce', 'productivity', 'operations', 'управлен'],
  ilm: ['ilmiy', 'ilm-fan', 'olim', 'tadqiqot', 'kashfiyot', 'sun’iy intellekt', "sun'iy intellekt", 'research', 'scientist', 'discovery', 'science', 'artificial intelligence', 'quantum', 'space telescope', 'наук', 'исследован'],
  muhim: ['energiya', 'elektr', 'qurg’oqchilik', "qurg'oqchilik", 'iqlim', 'suv tanqisligi', 'zilzila', 'sulh', 'urush', 'energy', 'climate', 'drought', 'earthquake', 'ceasefire', 'war', 'sanctions', 'election', 'humanitarian', 'flood', 'энерги', 'засух'],
};

export function classifyInterests(item, source, now) {
  const title = normalize(item.title || '');
  const text = normalize(`${item.title || ''} ${item.description || ''}`);
  if (/(dijey|musiqa|kino|celebrity|football|futbol|dissertatsiya.*himoya|welcomes .*director|appointed .*director)/.test(title)) return null;
  const count = (value, words) => words.reduce((sum, term) => {
    const normalized = normalize(term);
    if (['elektr', 'war', 'olim'].includes(normalized)) return sum + Number(value.split(' ').includes(normalized));
    return sum + countTerms(value, [normalized]);
  }, 0);
  // General feeds require a subject match; dedicated feeds also get a small boost.
  const hits = Object.fromEntries(Object.entries(TERMS).map(([key, words]) => {
    const heading = count(title, words), body = count(text, words);
    return [key, heading || body >= 2 ? body + 2 * heading : 0];
  }));
  const categories = Object.keys(hits).filter((key) => hits[key] > 0);
  if (!categories.length) return null;
  const primary = categories.sort((a, b) => hits[b] - hits[a])[0];
  const age = (now - new Date(item.published)) / 86400000;
  return { relevant: true, primary, categories, score: Math.min(90, 32 + hits[primary] * 4 + (age <= 2 ? 12 : 0) + (source.topic === primary ? 4 : 0)), ageDays: age, signals: {}, reasons: [], lang: source.lang || (/[а-яА-Я]/.test(item.title) ? 'ru' : 'uz') };
}

export function topicGroup(item) {
  if (['biznes', 'boshqaruv'].includes(item.primary)) return 'biznes';
  if (['ilm', 'muhim'].includes(item.primary)) return item.primary;
  return 'chorva';
}

// Reserve space for each available interest, then fill by score with publisher diversity.
export function balancedItems(items, limit) {
  const selected = [];
  const add = (item) => { if (item && selected.length < limit && !selected.includes(item)) selected.push(item); };
  for (const group of ['chorva', 'biznes', 'ilm', 'muhim']) add(items.find((item) => topicGroup(item) === group));
  for (const group of ['chorva', 'biznes']) add(items.find((item) => topicGroup(item) === group && !selected.includes(item)));
  for (const item of items) {
    if (selected.filter((x) => x.sourceName === item.sourceName).length < 2) add(item);
  }
  for (const item of items) add(item);
  return selected;
}
