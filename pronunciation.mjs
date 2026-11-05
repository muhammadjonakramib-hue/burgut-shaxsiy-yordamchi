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
    const phonetics = (Array.isArray(entries) ? entries : [])
      .flatMap((entry) => Array.isArray(entry.phonetics) ? entry.phonetics : []);
    const result = {
      word: value,
      phonetic: entries?.[0]?.phonetic || phonetics.find((item) => item.text)?.text || "",
      audio: phonetics.find((item) => item.audio)?.audio || "",
    };
    cache.set(value, result);
    return result;
  } catch {
    return null;
  }
}
