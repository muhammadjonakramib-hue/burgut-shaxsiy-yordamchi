export function selectPronunciation(entries,word){
 const phonetics=(Array.isArray(entries)?entries:[]).filter(e=>e.word?.toLowerCase()===word.toLowerCase()).flatMap(e=>e.phonetics||[]);
 const uk=phonetics.find(p=>typeof p.audio==='string'&&/^https:\/\/api\.dictionaryapi\.dev\/media\/pronunciations\/en\//.test(p.audio)&&/-uk\.mp3(?:\?|$)/i.test(p.audio));
 const generic=(Array.isArray(entries)?entries:[]).find(e=>e.word?.toLowerCase()===word.toLowerCase())?.phonetic;
 return {word,phonetic:uk?.text||phonetics.find(p=>p.text&&!p.audio)?.text||generic||'',audio:uk?.audio||'',accent:uk?.text?'en-GB':'unspecified',source:uk?.sourceUrl||'https://dictionaryapi.dev/',license:uk?.license||null};
}
