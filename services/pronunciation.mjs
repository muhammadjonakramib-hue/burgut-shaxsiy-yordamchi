import {selectPronunciation} from '../public/pronunciation-core.mjs';
const cache = new Map();

function validWord(value) {
  return /^[a-zA-Z][a-zA-Z' -]{1,60}$/.test(String(value || "").trim());
}

export async function getPronunciation(word) {
  const value = String(word || "").trim().toLowerCase();
  if (!validWord(value)) {
    const error = new Error("So‘z noto‘g‘ri");
    error.status = 400;
    throw error;
  }
  if (cache.has(value)) return cache.get(value);

  try {
    const response = await fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(value), {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const entries = await response.json();
    const result = selectPronunciation(entries, value);
    if(result.audio || result.phonetic){
      if(cache.size>=1000)cache.delete(cache.keys().next().value);
      cache.set(value, result);
    }
    return result;
  } catch {
    return null;
  }
}
