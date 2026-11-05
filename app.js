// Burgut — kunlik yordamchi: so'zlar, xarjatlar, rejalar va haftalik yangiliklar.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const OFFSET = 5 * 3600 * 1000; // Toshkent (UTC+5)
const DAY = 86400000;

const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];

const CATEGORIES = [
  { id: "ovqat", label: "Ovqat va ichimlik", icon: "🍽️" },
  { id: "transport", label: "Transport va taksi", icon: "🚌" },
  { id: "oqish", label: "Kontrakt va kurslar", icon: "🎓" },
  { id: "kitob", label: "Kitob va kanselyariya", icon: "📚" },
  { id: "turar-joy", label: "Ijara va yotoqxona", icon: "🏠" },
  { id: "aloqa", label: "Internet va telefon", icon: "📱" },
  { id: "kommunal", label: "Kommunal to'lovlar", icon: "💡" },
  { id: "salomatlik", label: "Dori va salomatlik", icon: "💊" },
  { id: "kiyim", label: "Kiyim va poyabzal", icon: "👕" },
  { id: "gigiyena", label: "Gigiyena va shaxsiy parvarish", icon: "🧴" },
  { id: "dam-olish", label: "Dam olish va sport", icon: "🎬" },
  { id: "obuna", label: "Ilova va xizmat obunalari", icon: "💻" },
  { id: "boshqa", label: "Boshqa", icon: "📦" },
];

// Old records keep their original meaning; these are not offered for new entries.
const LEGACY_EXPENSE_CATEGORIES = [
  { id: "ozuqa", label: "Ozuqa", icon: "🌾" },
  { id: "veterinariya", label: "Veterinariya", icon: "💉" },
  { id: "ish-haqi", label: "Ish haqi", icon: "👷" },
  { id: "yoqilgi", label: "Yoqilg'i", icon: "⛽" },
  { id: "texnika", label: "Texnika", icon: "🔧" },
  { id: "xojalik", label: "Xo'jalik", icon: "🏠" },
  { id: "boshqa", label: "Boshqa", icon: "📦" },
];

const CAT_MAP = Object.fromEntries([...LEGACY_EXPENSE_CATEGORIES, ...CATEGORIES].map((c) => [c.id, c]));

const NEWS_TABS = [
  { id: "weekly", label: "Haftalik", icon: "📡" },
  { id: "world", label: "Jahon", icon: "🌍" },
  { id: "football", label: "Futbol", icon: "⚽" },
  { id: "settings", label: "Sozlama", icon: "⚙️" },
];

const NEWS_ICON = {
  biznes: '💼', boshqaruv: '🎯', ilm: '🔬', muhim: '🌐',
  subsidiya: "💰", qoida: "📜", ozuqa: "🌾", sogish: "🥛",
  raqamli: "📡", sogliq: "💉", bozor: "📈", jahon: "🌍",
};

const NEWS_LABEL = {
  biznes: 'Biznes', boshqaruv: 'Boshqaruv', ilm: 'Ilm-fan', muhim: 'Muhim voqealar',
  subsidiya: "Subsidiya", qoida: "Qoida", ozuqa: "Ozuqa", sogish: "Uskuna",
  raqamli: "Raqamli", sogliq: "Sog'liq", bozor: "Bozor", jahon: "Amaliyot",
};

const cachedWeekly = readCache("burgut.weekly", null);
const cachedFootball = readCache("burgut.football", null);

const state = {
  tab: "today",
  config: readCache("burgut.config", { farm: { name: "Aobod fermasi", cows: 30, region: "Qashqadaryo" } }),
  plans: readCache("burgut.plans", []),
  planWeekOffset: 0,
  planSelectedDate: null,
  planDraft: null,
  expenses: readCache("burgut.expenses", []),
  expenseCurrency: readCache('burgut.currency', 'TRY'),
  personal: readCache('burgut.personal', {cards:{},budgets:{},stats:{}}),
  personalError: null,
  cloud: { configured: false, connected: false, error: null, userId: null },
  studyBusy: false,
  wordCurrentKey: null,
  wordSessionDone: 0,
  vocab: readCache("burgut.vocab", {}),
  errors: { plans: null, expenses: null, vocab: null, config: null },
  loaded: false,
  newsView: "weekly",
  weekly: cachedWeekly?.data || null,
  football: cachedFootball?.data || null,
  newsLoading: { weekly: false, football: false },
  newsError: { weekly: null, football: null },
  todo: readCache("burgut.todo", {}),
  clubFilter: "all",
  worldCat: "all",
  wordMode: "list",
  wordLang: "all",
  wordQuery: "",
  wordQuizIndex: 0,
  wordQuizRevealed: false,
  wordQuizDirection: null,
  wordQuizOptions: [],
  wordQuizFeedback: null,
  pronunciation: readCache("burgut.pronunciation", {}),
  wordStats: readCache("burgut.wordStats", { attempts: 0, correct: 0, hard: 0, lastDay: "", streak: 0 }),
};

if (!Array.isArray(state.plans)) state.plans = [];
if (!Array.isArray(state.expenses)) state.expenses = [];
if (!['TRY', 'USD', 'UZS'].includes(state.expenseCurrency)) state.expenseCurrency = 'TRY';
if (!state.todo || typeof state.todo !== "object" || Array.isArray(state.todo)) state.todo = {};
if (!state.vocab || typeof state.vocab !== "object" || Array.isArray(state.vocab)) state.vocab = {};
else state.vocab = normalizeVocab(state.vocab);

// ——————————————— Yordamchilar ———————————————

function readCache(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* to'la xotira */ }
}

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function toast(message, ms = 2600) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), ms);
}

async function api(path, options = {}) {
  if(path.startsWith('/api/expenses'))return BurgutCloud.expensesApi(path,options);
  if(path==='/api/vocab')return BurgutCloud.vocabApi(options);
  if(path==='/api/personal/backup'){
    const snapshot=await BurgutCloud.pull();if(!snapshot)throw Error('Zaxira uchun internet ulanishi kerak');
    return {format:'burgut-personal',version:1,exportedAt:new Date().toISOString(),data:{reviews:snapshot.reviews.map(r=>({id:r.id,key:r.word_key,rating:r.rating,at:r.reviewed_at})),budgets:state.personal.budgets,plans:state.plans,records:await BurgutCloud.records()}};
  }
  if(path==='/api/personal/restore'){
    const backup=JSON.parse(options.body||'{}');
    if(backup.format!=='burgut-personal'||!Array.isArray(backup.data?.reviews))throw Error('Zaxira formati noto‘g‘ri');
    for(const review of backup.data.reviews)await BurgutCloud.pushReview(review);
    for(const [key,budget] of Object.entries(backup.data.budgets||{})){const [month,currency]=key.split('|');await BurgutCloud.pushBudget(month,currency,budget);}
    for(const r of backup.data.records||[])await BurgutCloud.saveRecord(r.kind,r.id,r.data,r.deleted);
    for(const p of backup.data.plans||[])await BurgutCloud.plansApi('/api/plans',jsonBody(p));
    await syncCloud();return state.personal;
  }
  if(path.startsWith('/api/plans') && window.BurgutCloud){
    const cloud=await BurgutCloud.ready();
    if(cloud.configured)return BurgutCloud.plansApi(path,options);
  }
  const res = await fetch(path, { cache: "no-store", ...options });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const jsonBody = (data, method = "POST") => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

// ——————————————— Sana va pul ———————————————

function shiftedNow() {
  return new Date(Date.now() + OFFSET);
}

function todayKey() {
  return shiftedNow().toISOString().slice(0, 10);
}

function yesterdayKey() {
  const [y, m, d] = todayKey().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

function dayNumber() {
  return Math.floor((Date.now() + OFFSET) / DAY);
}

function dateLabel(key) {
  const [y, m, d] = String(key).split("-");
  return `${d}.${m}.${y}`;
}

function weekdayName(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  if (!y || !m || !d) return "";
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function monthKey() {
  return todayKey().slice(0, 7);
}

function daysFromToday(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  const now = shiftedNow();
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.UTC(y, m - 1, d) - base) / DAY);
}

function countdownLabel(key) {
  const n = daysFromToday(key);
  if (n === 0) return "bugun";
  if (n === 1) return "ertaga";
  if (n > 1) return `${n} kundan keyin`;
  if (n === -1) return "kecha";
  return `${-n} kun o'tdi`;
}

function money(value) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function compactMoney(value) {
  const n = Math.round(Number(value) || 0);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(".0", "")} mlrd`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")} mln`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} ming`;
  return money(value);
}

function greeting() {
  const hour = shiftedNow().getUTCHours();
  if (hour < 6) return "Xayrli tun";
  if (hour < 12) return "Xayrli tong";
  if (hour < 18) return "Xayrli kun";
  return "Xayrli kech";
}

// ——————————————— So'zlar ———————————————

const BANK = window.BURGUT_WORDS || { tr: [], en: [] };

function pickDaily(bank, count, day, salt) {
  if (!Array.isArray(bank) || !bank.length) return [];
  const n = Math.min(count, bank.length);
  const start = ((day * count) + salt) % bank.length;
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(bank[(start + i) % bank.length]);
  return out;
}

function dailyWords() {
  const day = dayNumber();
  return {
    tr: pickDaily(BANK.tr, 5, day, 3),
    en: pickDaily(BANK.en, 10, day, 17),
  };
}

function wordKey(lang, word) {
  return `${lang}|${word}`;
}

function normalizeVocab(learned) {
  const out = {};
  for (const [key, value] of Object.entries(learned || {})) {
    const parts = String(key).split("|");
    // Eski format: YYYY-MM-DD|lang|word → lang|word
    const next = parts.length === 3 ? `${parts[1]}|${parts[2]}` : key;
    if (!out[next] || String(value) > String(out[next])) out[next] = value;
  }
  return out;
}

function isLearned(lang, word) {
  return Boolean(state.vocab[wordKey(lang, word)]);
}

function allDailyWords() {
  const sets = dailyWords();
  return [
    ...sets.tr.map((item) => ({ ...item, lang: "tr" })),
    ...sets.en.map((item) => ({ ...item, lang: "en" })),
  ];
}

function pendingReviews() {
  const pending = readCache('burgut.reviewQueue', []);
  return Array.isArray(pending) ? pending : [];
}

function wordQuizItems() {
  const query = state.wordQuery.trim().toLocaleLowerCase();
  const cards = state.personal?.cards || {};
  const pending = new Set([...pendingReviews(),...(window.BurgutCloud?.pending() || [])].map(r=>r.key));
  const all = ['tr','en'].flatMap(lang=>(BANK[lang] || []).map(item=>({...item,lang})));
  const due = all.filter(item => cards[`${item.lang}|${item.w}`] && Date.parse(cards[`${item.lang}|${item.w}`].dueAt) <= Date.now())
    .sort((a,b)=>Date.parse(cards[`${a.lang}|${a.w}`].dueAt)-Date.parse(cards[`${b.lang}|${b.w}`].dueAt));
  const fresh = allDailyWords().filter(item=>!cards[`${item.lang}|${item.w}`]);
  // Bir dona eski, hali to'liq mustahkamlanmagan so'zni ba'zan aralashtiramiz.
  // Asosiy navbat baribir due va bugungi yangi so'zlardan tuziladi.
  const reinforcement = all.filter(item => {
    const card = cards[`${item.lang}|${item.w}`];
    return card && card.lastRating !== 'correct' && Date.parse(card.dueAt) > Date.now();
  });
  const random = reinforcement.length ? [reinforcement[Math.floor(Math.random() * reinforcement.length)]] : [];
  return [...new Map([...due,...fresh,...random].map(item=>[`${item.lang}|${item.w}`,item])).values()].filter((item) => {
    if(pending.has(`${item.lang}|${item.w}`)) return false;
    if (state.wordLang !== "all" && item.lang !== state.wordLang) return false;
    if (!query) return true;
    return `${item.w} ${item.t} ${item.ex}`.toLocaleLowerCase().includes(query);
  });
}

function applyPersonal(data) {
  if(!data || !data.cards || !data.budgets || !data.stats) throw new Error('Serverdagi so‘zlar modulini ham yangilang');
  state.personal = data;
  writeCache('burgut.personal', data);
  state.personalError = null;
}

function cloudStatusMarkup() {
  const cloud = state.cloud || {};
  const label = cloud.error ? esc(cloud.error) : cloud.connected ? 'Bulut bilan aloqa bor' : 'Bulutni sozlash kerak';
  return '<div class="card"><h3>Qurilmalarim</h3><p role="status">'+label+'</p><p class="hint">Yuborilishi kutilmoqda: '+(cloud.pending||0)+'</p><div class="row-actions"><button class="btn ghost" data-cloud-action="setup">Bulut sozlamasi</button><button class="btn ghost" data-cloud-action="create">Telefonni ulash kodi</button><button class="btn ghost" data-cloud-action="claim">Kodni kiritish</button><button class="btn ghost" data-cloud-action="sync">Sinxronlash</button></div><p class="hint">Asosiy qurilmada kod yarating, yangi qurilmada kiriting. Kod 10 daqiqada tugaydi va bir marta ishlaydi.</p></div>';
}

function mergeCloudSnapshot(snapshot) {
  if (!snapshot) return;
  const cards = { ...(state.personal?.cards || {}) };
  for (const remote of snapshot.cards || []) {
    const key = remote.word_key;
    if (!key) continue;
    const local = cards[key];
    const remoteAt = Date.parse(remote.last_reviewed_at || remote.updated_at || 0);
    const localAt = Date.parse(local?.lastReviewedAt || 0);
    if (!local || remoteAt >= localAt) {
      cards[key] = {
        reviewLevel: Number(remote.review_level) || 0,
        intervalDays: Number(remote.interval_days) || 0,
        dueAt: remote.due_at,
        lastReviewedAt: remote.last_reviewed_at,
        lastRating: remote.last_rating,
        attempts: Number(remote.attempts) || 0,
        lapses: Number(remote.lapses) || 0,
      };
    }
  }
  const budgets = { ...(state.personal?.budgets || {}) };
  for (const remote of snapshot.budgets || []) {
    const month = String(remote.month || "").slice(0, 7);
    const budgetKey = month + '|' + remote.currency;
    if (month && remote.currency && (!budgets[budgetKey] || Date.parse(remote.updated_at) >= Date.parse(budgets[budgetKey].updatedAt || 0))) budgets[budgetKey] = {
      limit: Number(remote.spending_limit) || 0,
      income: Number(remote.income) || 0,
      updatedAt: remote.updated_at,
    };
  }
  state.personal = { ...state.personal, cards, budgets };
  if (snapshot.reviews) {
    const days = new Set(snapshot.reviews.map(r => new Date(Date.parse(r.reviewed_at)+OFFSET).toISOString().slice(0,10)));
    let cursor = days.has(todayKey()) ? todayKey() : yesterdayKey(), streak = 0;
    while(days.has(cursor)){streak++;cursor=new Date(Date.parse(cursor+'T00:00:00Z')-DAY).toISOString().slice(0,10);}
    state.personal.stats = {attempts:snapshot.reviews.length,correct:snapshot.reviews.filter(r=>r.rating==='correct').length,today:snapshot.reviews.filter(r=>new Date(Date.parse(r.reviewed_at)+OFFSET).toISOString().slice(0,10)===todayKey()).length,streak};
    for (const [key,card] of Object.entries(cards)) {
      if(card.lastRating==='correct')state.vocab[key]=card.lastReviewedAt;
      else delete state.vocab[key];
    }
    writeCache('burgut.vocab',state.vocab);
  }
  writeCache("burgut.personal", state.personal);
}

async function syncCloud() {
  if (!window.BurgutCloud) return;
  state.cloud = await window.BurgutCloud.ready();
  if (state.cloud.connected) {
    try { mergeCloudSnapshot(await window.BurgutCloud.pull()); }
    catch (error) { state.cloud = { ...window.BurgutCloud.status(), error: error.message }; }
    try {
      const plans=await window.BurgutCloud.plansApi('/api/plans');
      state.plans=plans.items;writeCache('burgut.plans',state.plans);state.errors.plans=null;
    } catch(error){state.errors.plans=error.message;}
    try {
      const data=await BurgutCloud.records();
      state.expenses=data.filter(r=>r.kind==='expense'&&!r.deleted).map(r=>({...r.data,id:r.id}));
      writeCache('burgut.expenses',state.expenses);state.errors.expenses=null;
      for(const r of data)if(r.kind==='vocab'||r.kind==='todo'){
        const target=r.kind==='vocab'?state.vocab:state.todo;
        if(r.deleted)delete target[r.id];else target[r.id]=r.data.value;
      }
      writeCache('burgut.vocab',state.vocab);writeCache('burgut.todo',state.todo);
    }catch(error){state.errors.expenses=error.message;state.cloud.error=error.message;}
  }
  state.cloud = {...window.BurgutCloud.status(),error:state.cloud.error || window.BurgutCloud.status().error};
}

let studySync = null;
async function syncStudy() {
  if(studySync) return studySync;
  studySync = (async()=>{
    try {
      if (window.BurgutCloud) {
        state.cloud = await window.BurgutCloud.ready();
        if (state.cloud.configured) {
          for (const review of pendingReviews()) {
            await window.BurgutCloud.pushReview(review,state.personal?.cards?.[review.key]);
            localStorage.setItem('burgut.reviewQueue',JSON.stringify(pendingReviews().filter(r=>r.id!==review.id)));
          }
          await syncCloud();
          return;
        }
      }
      let pending=pendingReviews();
      while(pending.length) {
        const review=pending[0];
        applyPersonal(await api('/api/study/review',{...jsonBody(review),signal:AbortSignal.timeout(10000)}));
        // Keep Cursor's persistent checkmarks consistent with the review result.
        // Retry is safe: review IDs are deduplicated and learned is an absolute value.
        const vocab = await api('/api/vocab',{...jsonBody({keys:[review.key],learned:review.rating==='correct'},'PATCH'),signal:AbortSignal.timeout(10000)});
        state.vocab = normalizeVocab(vocab.learned);
        writeCache('burgut.vocab',state.vocab);
        if (window.BurgutCloud) {
          try {
            await window.BurgutCloud.pushReview(review, state.personal?.cards?.[review.key]);
            state.cloud = window.BurgutCloud.status();
          } catch (error) {
            state.cloud = { ...window.BurgutCloud.status(), error: error.message };
          }
        }
        const remaining=pendingReviews().filter(r=>r.id!==review.id);
        localStorage.setItem('burgut.reviewQueue',JSON.stringify(remaining));
        pending=remaining;
      }
      applyPersonal(await api('/api/personal',{signal:AbortSignal.timeout(10000)}));
    } catch(e) {state.personalError=e.message;}
    finally {studySync=null;}
  })();
  return studySync;
}

function nextReviewLabel(key,rating) {
  const card=state.personal?.cards?.[key];
  if(rating==='wrong') return '1 daqiqada';
  if(rating==='hard') return '1 kunda';
  const intervals = [1, 3, 7, 15, 30, 60, 90, 180, 365];
  const level = Number(card?.reviewLevel) || 0;
  return `${intervals[Math.min(intervals.length - 1, level)]} kunda`;
}

function saveWordStats() {
  writeCache("burgut.wordStats", state.wordStats);
}

function recordWordAnswer(result) {
  const stats = state.wordStats || { attempts: 0, correct: 0, hard: 0, lastDay: "", streak: 0 };
  stats.attempts += 1;
  if (result === "correct") stats.correct += 1;
  if (result === "hard") stats.hard += 1;
  const today = todayKey();
  if (stats.lastDay !== today) {
    stats.streak = stats.lastDay === yesterdayKey() ? (Number(stats.streak) || 0) + 1 : 1;
    stats.lastDay = today;
  }
  state.wordStats = stats;
  saveWordStats();
}

function learnedCount(lang) {
  return dailyWords()[lang].filter((item) => isLearned(lang, item.w)).length;
}

function progressBar(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return `<div class="progress" aria-label="${done}/${total}"><i style="width:${pct}%"></i></div>`;
}

const pronunciationRequests = new Map();
function pronunciationFor(word) {
  return state.pronunciation?.[String(word).toLowerCase()] || {};
}

async function loadPronunciation(word) {
  const key = String(word).trim().toLowerCase();
  if (!key || pronunciationRequests.has(key)) return pronunciationRequests.get(key);
  const task = fetch(`/api/pronunciation?word=${encodeURIComponent(key)}`, { cache: "no-store" })
    .then((res) => res.ok ? res.json() : null)
    .then((data) => {
      if (data && (data.audio || data.phonetic)) {
        state.pronunciation[key] = { phonetic: data.phonetic || "", audio: data.audio || "" };
        writeCache("burgut.pronunciation", state.pronunciation);
        if (state.tab === "words") renderCurrent();
      }
      return state.pronunciation[key] || null;
    })
    .catch(() => null);
  pronunciationRequests.set(key, task);
  return task;
}

function pronunciationMarkup(item) {
  if (item.lang !== "en") return "";
  const p = pronunciationFor(item.w);
  return `<span class="word-pronunciation" data-pronunciation-for="${esc(item.w)}">${p.phonetic ? esc(p.phonetic) : "Talaffuzni yuklash"}</span>`;
}

function wordRow(lang, item) {
  const learned = isLearned(lang, item.w);
  return `<li class="word${learned ? " done" : ""}">
    <button class="word-tick" data-word-toggle data-lang="${lang}" data-word="${esc(item.w)}" aria-label="${learned ? "O'rganilmagan deb belgilash" : "O'rganildi deb belgilash"}">✓</button>
    <div class="word-body">
      <div class="word-line">
        <b>${esc(item.w)}</b>
        <span>${esc(item.t)}</span>
        ${item.lvl ? `<i class="word-lvl">${esc(item.lvl)}</i>` : ""}
      </div>
      ${pronunciationMarkup({ ...item, lang })}
      <p class="word-ex">${esc(item.ex)}</p>
    </div>
    ${lang === 'en' ? `<button class="word-spk" data-speak="${esc(item.w)}" data-lang="en" aria-label="Inglizcha talaffuz">🔊</button>` : ''}
  </li>`;
}

function wordSection(lang, title, subtitle, items) {
  if (!items.length) return "";
  const done = items.filter((item) => isLearned(lang, item.w)).length;
  const allDone = done === items.length;
  return `<div class="card">
    <div class="card-head">
      <div>
        <h3><span class="lang-tag ${lang}">${lang === "tr" ? "TR" : "EN"}</span> ${title}</h3>
        <p class="muted small">${subtitle}</p>
      </div>
      <span class="counter">${done}/${items.length}</span>
    </div>
    ${progressBar(done, items.length)}
    <ul class="word-list">${items.map((item) => wordRow(lang, item)).join("")}</ul>
    <div class="row-actions">
      <button class="btn ghost small" data-word-all data-lang="${lang}" data-learn="${allDone ? "0" : "1"}">
        ${allDone ? "Belgini tozalash" : "Hammasini belgilash"}
      </button>
    </div>
  </div>`;
}

function renderWordQuiz(items) {
  if (!items.length) {
    state.wordCurrentKey=null;
    state.wordQuizFeedback=null;
    const next = Object.values(state.personal?.cards || {}).map(c=>Date.parse(c.dueAt)).filter(t=>t>Date.now()).sort((a,b)=>a-b)[0];
    return `<div class="card empty"><div class="em">✓</div><h3>Bugungi navbat tugadi</h3><p>${state.wordSessionDone} ta javob berildi. ${next ? `Keyingi takrorlash: ${esc(new Date(next).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'}))} (Toshkent).` : 'Ertaga yangi so‘zlar avtomatik keladi.'}</p><button class="btn ghost" data-study-sync>Navbatni tekshirish</button></div>`;
  }
  const item = items.find(w=>`${w.lang}|${w.w}`===state.wordCurrentKey) || items[0];
  const key = `${item.lang}|${item.w}`;
  if(state.wordCurrentKey!==key) {
    state.wordQuizRevealed=false;
    state.wordQuizDirection = Math.random() < 0.5 ? "w2t" : "t2w";
    state.wordQuizOptions = quizOptions(item);
    state.wordQuizFeedback = null;
  }
  state.wordCurrentKey=key;
  const direction = state.wordQuizDirection || "w2t";
  const prompt = direction === "w2t" ? item.w : item.t;
  const correct = direction === "w2t" ? item.t : item.w;
  const pronunciation = item.lang === "en" ? pronunciationFor(item.w) : {};
  const card = state.personal?.cards?.[key];
  const feedback = state.wordQuizFeedback;
  const progress = `${items.length} ta navbatda`;
  const optionHtml = state.wordQuizOptions.map((option) => {
    const selected = feedback?.selected === option;
    const right = feedback && option === feedback.correct;
    const cls = feedback ? (right ? "right" : selected ? "wrong" : "muted-option") : "";
    return `<button class="quiz-option ${cls}" data-word-option="${esc(option)}" ${feedback ? "disabled" : ""}>${esc(option)}</button>`;
  }).join("");
  const feedbackHtml = feedback ? `<div class="quiz-feedback ${feedback.ok ? "is-right" : "is-wrong"}">${feedback.ok ? "✅ To‘g‘ri!" : `❌ To‘g‘ri javob: ${esc(feedback.correct)}`}</div>
    <div class="quiz-actions"><button class="quiz-answer ${feedback.ok ? "good" : "bad"}" data-word-answer="${feedback.ok ? "correct" : "wrong"}" ${state.studyBusy ? "disabled" : ""}>Davom etish<small>${feedback.ok ? nextReviewLabel(key,"correct") : nextReviewLabel(key,"wrong")}</small></button><button class="quiz-answer hard" data-word-answer="hard" ${state.studyBusy ? "disabled" : ""}>Qiyin edi<small>1 kunda</small></button></div>` : "";
  return `<div class="card quiz-card">
    <div class="quiz-top"><span class="lang-tag ${item.lang}">${item.lang === "tr" ? "TR" : "EN"}</span><span class="counter">${progress}</span></div>
    <p class="muted small">${card ? "Takrorlash vaqti keldi" : "Bugungi yangi so‘z"} · ${direction === "w2t" ? "so‘z → tarjima" : "tarjima → so‘z"}</p>
    <div class="quiz-prompt"><span>${direction === "w2t" ? "So‘z" : "Tarjima"}</span><b>${esc(prompt)}</b>${pronunciation.phonetic ? `<small>${esc(pronunciation.phonetic)}</small>` : ""}</div>
    <div class="quiz-tools">${item.lang === 'en' && (direction === 'w2t' || feedback) ? `<button data-speak="${esc(item.w)}" data-lang="en" aria-label="Talaffuzni eshitish">🔊 Eshitish</button>` : ''}<button class="quiz-reveal" data-word-reveal type="button">Javobni ko‘rsatish</button></div>
    <div class="quiz-options">${optionHtml}</div>
    ${state.wordQuizRevealed && !feedback ? `<div class="quiz-example"><b>${esc(correct)}</b><br>${esc(item.ex)}</div><div class="quiz-actions">${[['wrong','bad','Bilmayman'],['hard','hard','Qiyin'],['correct','good','Bilaman']].map(([rating,cls,label])=>`<button class="quiz-answer ${cls}" data-word-answer="${rating}" ${state.studyBusy?'disabled':''}>${label}<small>${nextReviewLabel(key,rating)}</small></button>`).join('')}</div>` : feedbackHtml}
  </div>`;
}

function shuffleOptions(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function quizOptions(item) {
  const direction = state.wordQuizDirection || "w2t";
  const answer = direction === "w2t" ? "t" : "w";
  const sameLevel = (BANK[item.lang] || []).filter((candidate) => candidate.lvl === item.lvl && candidate.w !== item.w);
  const others = (BANK[item.lang] || []).filter((candidate) => candidate.w !== item.w);
  const pool = [...shuffleOptions(sameLevel), ...shuffleOptions(others)];
  const values = [];
  for (const candidate of pool) {
    const value = candidate[answer];
    if (value && value !== item[answer] && !values.includes(value)) values.push(value);
    if (values.length === 3) break;
  }
  const correct = item[answer];
  const shuffled = shuffleOptions([correct, ...values]);
  return [...new Set(shuffled)].slice(0, 4);
}

function chooseQuizOption(value) {
  if (state.studyBusy || !state.wordCurrentKey || state.wordQuizFeedback) return;
  const [lang, ...wordParts] = state.wordCurrentKey.split("|");
  const word = wordParts.join("|");
  const item = (BANK[lang] || []).find((candidate) => candidate.w === word);
  if (!item) return;
  const correct = state.wordQuizDirection === "t2w" ? item.w : item.t;
  state.wordQuizRevealed = true;
  state.wordQuizFeedback = { selected: value, correct, ok: value === correct };
  renderCurrent();
}

function renderWords() {
  const sets = dailyWords();
  const trDone = sets.tr.filter((w) => isLearned("tr", w.w)).length;
  const enDone = sets.en.filter((w) => isLearned("en", w.w)).length;
  const done = trDone + enDone;
  const total = sets.tr.length + sets.en.length;

  const filtered = wordQuizItems();
  const stats = state.personal?.stats || {};
  const accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;
  let html = `<div class="hero hero-soft">
    <div class="hero-date">${esc(dateLabel(todayKey()))} · ${esc(weekdayName(todayKey()))}</div>
    <h2>Kunlik so'zlar</h2>
    <p class="hero-sub">So'zlarni ko'ring, eshiting va test orqali uzoq muddatga yodlang.</p>
    <div class="hero-progress">
      <div class="progress"><i style="width:${total ? Math.round((done / total) * 100) : 0}%"></i></div>
      <span>${done}/${total} o'rganildi</span>
    </div>
  </div>`;

  if (state.errors.vocab) {
    html += `<div class="card warn-card">⚠️ Belgilar serverga saqlanmadi (${esc(state.errors.vocab)}). Hozircha shu qurilmada ko'rinadi.</div>`;
  }

  html += `<div class="word-dashboard"><div><b>${stats.attempts || 0}</b><span>test urinish</span></div><div><b>${accuracy}%</b><span>to'g'ri javob</span></div><div><b>${stats.streak || 0}</b><span>kunlik streak</span></div></div>
    <div class="word-toolbar"><div class="mode-switch"><button class="${state.wordMode === "list" ? "active" : ""}" data-word-mode="list">Ro'yxat</button><button class="${state.wordMode === "quiz" ? "active" : ""}" data-word-mode="quiz">Test</button></div><input class="word-search" data-word-search value="${esc(state.wordQuery)}" placeholder="So'z qidirish..." aria-label="So'z qidirish"><div class="word-filters"><button class="${state.wordLang === "all" ? "active" : ""}" data-word-lang="all">Barchasi</button><button class="${state.wordLang === "tr" ? "active" : ""}" data-word-lang="tr">TR</button><button class="${state.wordLang === "en" ? "active" : ""}" data-word-lang="en">EN</button></div></div>`;

  if (!sets.tr.length || !sets.en.length) {
    html += `<div class="card empty">
      <div class="em">📚</div>
      <h3>So'zlar banki yuklanmadi</h3>
      <p>words.js faylini tekshiring va sahifani yangilang.</p>
    </div>`;
    $("#view-words").innerHTML = html;
    return;
  }

  if (state.wordMode === "quiz") {
    html += renderWordQuiz(filtered);
  } else {
    const trItems = state.wordLang === "en" ? [] : sets.tr.filter((item) => !state.wordQuery || `${item.w} ${item.t} ${item.ex}`.toLocaleLowerCase().includes(state.wordQuery.toLocaleLowerCase()));
    const enItems = state.wordLang === "tr" ? [] : sets.en.filter((item) => !state.wordQuery || `${item.w} ${item.t} ${item.ex}`.toLocaleLowerCase().includes(state.wordQuery.toLocaleLowerCase()));
    html += wordSection("tr", "Turkcha", "B2 daraja · 5 ta so'z", trItems);
    html += wordSection("en", "Inglizcha", "A2–B1 daraja · 10 ta so'z", enItems);
  }
  const dueCount=Object.values(state.personal?.cards || {}).filter(c=>Date.parse(c.dueAt)<=Date.now()).length;
  html += `<div class="card study-status"><h3>${dueCount} ta so‘zning takrorlash vaqti keldi</h3><p class="hint">Bilmayman → 1 daqiqa. Qiyin → 1 kun. Bilaman → 1, 3, 8, 20… kun. Oldingi kunlardagi so‘zlar ham navbatga qaytadi.</p><button class="btn ghost" data-word-mode="quiz">Takrorlashni boshlash</button><p class="hint" role="status">${pendingReviews().length ? `${pendingReviews().length} ta javob shu qurilmada saqlangan, serverga yuborilishi kutilmoqda.` : 'Javoblar lokal serverda saqlanadi.'}</p>${state.personalError?`<p class="hint">${esc(state.personalError)}</p>`:''}<button class="btn ghost small" data-study-sync>Sinxronlash</button></div>`;
  html += `<p class="footer-note">✓ belgisi kun almashganda ham saqlanadi. Takrorlash jadvali Testdagi javobingizga ko‘ra o‘zgaradi.</p>`;
  html += cloudStatusMarkup();
  $("#view-words").innerHTML = html;
}

async function nextQuiz(result) {
  if(state.studyBusy||!state.wordQuizRevealed||!state.wordCurrentKey)return;
  state.studyBusy=true;
  try {
    const pending=pendingReviews();
    const id=globalThis.crypto?.randomUUID?.() || `r_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    pending.push({id,key:state.wordCurrentKey,rating:result,at:new Date().toISOString()});
    localStorage.setItem('burgut.reviewQueue',JSON.stringify(pending));
    state.wordSessionDone++;
    state.wordCurrentKey=null;
    state.wordQuizRevealed=false;
    state.wordQuizFeedback=null;
    state.wordQuizDirection=null;
    state.wordQuizOptions=[];
    renderCurrent();
    await syncStudy();
  } catch(e) {toast('Javob saqlanmadi: '+e.message);}
  finally {state.studyBusy=false;renderCurrent();}
}

async function toggleWord(lang, word) {
  const key = wordKey(lang, word);
  const was = Boolean(state.vocab[key]);
  if (was) delete state.vocab[key];
  else state.vocab[key] = new Date().toISOString();
  writeCache("burgut.vocab", state.vocab);
  renderCurrent();
  updateBadges();

  try {
    const data = await api("/api/vocab", jsonBody({ keys: [key], learned: !was }, "PATCH"));
    if (data.learned && typeof data.learned === "object") {
      state.vocab = normalizeVocab(data.learned);
      writeCache("burgut.vocab", state.vocab);
    }
    state.errors.vocab = null;
  } catch (err) {
    if (was) state.vocab[key] = new Date().toISOString();
    else delete state.vocab[key];
    writeCache("burgut.vocab", state.vocab);
    state.errors.vocab = err.message;
    toast(`Saqlanmadi: ${err.message}`);
  }
  renderCurrent();
  updateBadges();
}

async function markAllWords(lang, learned) {
  const items = dailyWords()[lang];
  if (!items.length) return;
  const snapshot = { ...state.vocab };
  for (const item of items) {
    const key = wordKey(lang, item.w);
    if (learned) state.vocab[key] = new Date().toISOString();
    else delete state.vocab[key];
  }
  writeCache("burgut.vocab", state.vocab);
  renderCurrent();
  updateBadges();

  try {
    const keys = items.map((item) => wordKey(lang, item.w));
    const data = await api("/api/vocab", jsonBody({ keys, learned }, "PATCH"));
    if (data.learned && typeof data.learned === "object") {
      state.vocab = normalizeVocab(data.learned);
      writeCache("burgut.vocab", state.vocab);
    }
    state.errors.vocab = null;
    toast(learned ? "Hammasi o'rganildi ✅" : "Belgilar tozalandi");
  } catch (err) {
    state.vocab = snapshot;
    writeCache("burgut.vocab", state.vocab);
    state.errors.vocab = err.message;
    toast(`Saqlanmadi: ${err.message}`);
  }
  renderCurrent();
  updateBadges();
}

let activeWordAudio = null;
let speechRequest = 0;
async function speakWord(text, lang) {
  if (lang !== 'en') return;
  const request = ++speechRequest;
  activeWordAudio?.pause();
  window.speechSynthesis?.cancel();
  if (lang === "en") {
    const cached = pronunciationFor(text);
    const pronunciation = cached.audio ? cached : await loadPronunciation(text);
    if (request !== speechRequest) return;
    if (pronunciation?.audio) {
      try {
        const audio = new Audio(pronunciation.audio);
        activeWordAudio = audio;
        audio.volume = 1;
        audio.preload = "auto";
        await audio.play();
        return;
      } catch { /* audio ruxsati bo'lmasa pastdagi fallback ishlaydi */ }
    }
  }
  if (!("speechSynthesis" in window)) {
    toast("Bu qurilmada ovoz qo'llab-quvvatlanmaydi");
    return;
  }
  const voices = window.speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang));
  if (!voices.length) {
    toast('Inglizcha audio yuklanmadi. Internetni tekshirib qayta bosing.', 5000);
    pronunciationRequests.delete(String(text).trim().toLowerCase());
    return;
  }
  const utter = new SpeechSynthesisUtterance(text);
  utter.voice = voices.find(v => /en-US/i.test(v.lang)) || voices[0];
  utter.volume = 1;
  utter.lang = lang === "tr" ? "tr-TR" : "en-US";
  utter.rate = lang === "tr" ? 0.84 : 0.8;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

// ——————————————— Xarjatlar ———————————————

function sumAmounts(items) {
  return currencyExpenses(items).reduce((sum, item) => sum + Math.round((Number(item.amount) || 0) * 100), 0) / 100;
}

function currencyLabel(currency = state.expenseCurrency) {
  return { TRY: 'TL', USD: 'USD', UZS: "so'm (eski)" }[currency] || currency;
}

function currencyExpenses(items = state.expenses) {
  return items.filter(item => (item.currency || 'UZS') === state.expenseCurrency);
}

function todayExpenses() {
  const key = todayKey();
  return state.expenses.filter((item) => item.date === key);
}

function monthExpenses() {
  const key = monthKey();
  return state.expenses.filter((item) => String(item.date || "").startsWith(key));
}

function categoryTotals(items) {
  const map = new Map();
  for (const item of currencyExpenses(items)) {
    const id = CAT_MAP[item.category] ? item.category : "boshqa";
    map.set(id, (map.get(id) || 0) + Math.round((Number(item.amount) || 0) * 100));
  }
  return [...map.entries()]
    .map(([id, total]) => ({ ...CAT_MAP[id], total: total / 100 }))
    .sort((a, b) => b.total - a.total);
}

function expenseRow(item) {
  const cat = CAT_MAP[item.category] || CAT_MAP.boshqa;
  return `<li class="expense">
    <span class="exp-icon">${cat.icon}</span>
    <div class="exp-body">
      <b>${esc(cat.label)}</b>
      ${item.note ? `<span>${esc(item.note)}</span>` : ""}
    </div>
    <div class="exp-right">
      <b>${money(item.amount)}</b>
      <span>${currencyLabel(item.currency || 'UZS')}</span>
    </div>
    <button class="exp-del" data-exp-del="${esc(item.id)}" aria-label="O'chirish">✕</button>
  </li>`;
}

function expenseHistory() {
  const sorted = currencyExpenses().sort((a, b) => {
    const da = String(a.date || "");
    const db = String(b.date || "");
    if (da !== db) return da < db ? 1 : -1;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });

  const groups = new Map();
  for (const item of sorted) {
    const key = String(item.date || "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  let html = "";
  for (const [key, items] of groups) {
    const dayTotal = sumAmounts(items);
    const label = key === todayKey()
      ? "Bugun"
      : key === yesterdayKey()
        ? "Kecha"
        : `${dateLabel(key)} · ${weekdayName(key)}`;
    html += `<div class="exp-group">
      <div class="exp-group-head">
        <span>${esc(label)}</span>
        <b>${money(dayTotal)} ${currencyLabel()}</b>
      </div>
      <ul class="expense-list">${items.map(expenseRow).join("")}</ul>
    </div>`;
  }
  return html;
}

function budgetPanel() {
  if(state.expenseCurrency==='UZS')return '';
  const budget=state.personal?.budgets?.[`${monthKey()}|${state.expenseCurrency}`];
  const spent=sumAmounts(monthExpenses());
  const left=budget ? (Math.round(budget.limit*100)-Math.round(spent*100))/100 : 0;
  return `<div class="card budget-card"><div class="card-head"><h3>Oylik budjet · ${esc(monthKey())}</h3><span class="counter">${currencyLabel()}</span></div>
    ${budget?`<div class="mini-stats"><div><b>${money(left)} ${currencyLabel()}</b><span>${left<0?'Limitdan oshdi':'Budjetdan qoldi'}</span></div><div><b>${money(budget.income-spent)} ${currencyLabel()}</b><span>Kirimdan qolgan pul</span></div></div><p class="hint">Sarflandi: ${money(spent)} / ${money(budget.limit)} ${currencyLabel()}. Kirim jami: ${money(budget.income)} ${currencyLabel()}.</p>${progressBar(Math.min(spent,budget.limit),budget.limit)}`:'<p class="hint">Bu oy uchun sarflash limitini va jami kirimni kiriting.</p>'}
    <form id="budget-form" class="expense-form"><div class="form-row"><label class="field"><span>Oylik sarflash limiti</span><input name="limit" type="number" min="0" max="1000000000000" step="0.01" required value="${budget?.limit ?? ''}" placeholder="8000"></label><label class="field"><span>Shu oy jami kelgan pul</span><input name="income" type="number" min="0" max="1000000000000" step="0.01" required value="${budget?.income ?? ''}" placeholder="10000"></label></div><button class="btn" type="submit">Budjetni saqlash</button></form><p class="hint">Kirim — stipendiya, oila yordami va boshqa tushumlarning jami. Bu yerga yangi jami summani yozing.</p>${state.personalError?`<p role="status" class="hint">${esc(state.personalError)}</p>`:''}</div>`;
}

async function submitBudget(form) {
  const button=form.querySelector('button');button.disabled=true;
  try {
    const budgetPayload = { month: monthKey(), currency: state.expenseCurrency, limit: Number(form.elements.limit.value), income: Number(form.elements.income.value) };
    if(window.BurgutCloud){
      state.cloud=await window.BurgutCloud.ready();
      if(state.cloud.configured){
        await window.BurgutCloud.pushBudget(budgetPayload.month,budgetPayload.currency,{limit:budgetPayload.limit,income:budgetPayload.income});
        state.personal.budgets[budgetPayload.month+'|'+budgetPayload.currency]={limit:budgetPayload.limit,income:budgetPayload.income,updatedAt:new Date().toISOString()};
        writeCache('burgut.personal',state.personal);state.cloud=window.BurgutCloud.status();
        toast(state.cloud.pending?'Budjet qurilmada saqlandi, yuborish kutilmoqda':'Budjet bulutda saqlandi');renderExpenses();return;
      }
    }
    applyPersonal(await api('/api/budget',jsonBody(budgetPayload,'PUT')));
    if (window.BurgutCloud) {
      try {
        await window.BurgutCloud.pushBudget(budgetPayload.month, budgetPayload.currency, { limit: budgetPayload.limit, income: budgetPayload.income });
        state.cloud = window.BurgutCloud.status();
      } catch (error) {
        state.cloud = { ...window.BurgutCloud.status(), error: error.message };
      }
    }
    toast('Budjet saqlandi');renderExpenses();
  } catch(e){toast('Budjet saqlanmadi: '+e.message);}
  finally{button.disabled=false;}
}

async function exportStudyBackup() {
  await syncStudy();
  if(pendingReviews().length){toast('Avval kutilayotgan javoblarni serverga sinxronlang');return;}
  try {
    const data=await api('/api/personal/backup');
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`burgut-sozlar-budjet-${todayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){toast('Zaxira olinmadi: '+e.message);}
}

async function importStudyBackup(file) {
  if(!file)return;
  if(file.size>20*1024*1024){toast('Fayl hajmi 20 MB dan katta');return;}
  try {
    const backup=JSON.parse(await file.text());
    if(backup.format!=='burgut-personal'||backup.version!==1||!Array.isArray(backup.data?.reviews)||!backup.data?.budgets)throw new Error('Burgut zaxira faylini tanlang');
    const reviews=backup.data.reviews;
    const budgetEntries=Object.entries(backup.data.budgets);
    const count=Math.max(1,Math.ceil(reviews.length/100),Math.ceil(budgetEntries.length/100));
    for(let i=0;i<count;i++){
      const data={reviews:reviews.slice(i*100,(i+1)*100),budgets:Object.fromEntries(budgetEntries.slice(i*100,(i+1)*100))};
      if(i===0){data.records=backup.data.records||[];data.plans=backup.data.plans||[];}
      applyPersonal(await api('/api/personal/restore',jsonBody({format:'burgut-personal',version:1,data})));
    }
    toast('Zaxira yozuvlari birlashtirildi. Sinxronlash holatini tekshiring.');renderCurrent();
  }catch(e){toast('Tiklash to‘xtadi: '+e.message+'. Oldin tiklangan qismlar saqlangan.',6000);}
}

function renderExpenses() {
  const today = todayExpenses();
  const month = monthExpenses();
  const todayTotal = sumAmounts(today);
  const monthTotal = sumAmounts(month);
  const allTotal = sumAmounts(state.expenses);
  const tops = categoryTotals(month);

  let html = `<div class="page-head">
    <div>
      <h2>Xarjatlar</h2>
      <p class="muted">Pul qayerga ketayotganini bir joyda ko'ring.</p>
    </div>
    <span class="chip">${esc(dateLabel(todayKey()))}</span>
  </div>`;

  html += `<label class="field"><span>Hisob-kitob valyutasi</span><select id="expense-currency">${['TRY', 'USD', ...(state.expenses.some(i => !i.currency || i.currency === 'UZS') ? ['UZS'] : [])].map(c => `<option value="${c}" ${state.expenseCurrency === c ? 'selected' : ''}>${currencyLabel(c)}</option>`).join('')}</select></label><p class="hint">Har bir valyuta alohida hisoblanadi. Avtomatik konvertatsiya qilinmaydi.</p>`;
  html += `<div class="money-stats">
    <div class="money-tile"><span>Bugun</span><b>${money(todayTotal)}</b><i>${currencyLabel()}</i></div>
    <div class="money-tile"><span>Shu oy</span><b>${money(monthTotal)}</b><i>${currencyLabel()}</i></div>
    <div class="money-tile"><span>Jami</span><b>${money(allTotal)}</b><i>${currencyLabel()}</i></div>
  </div>`;

  if (state.errors.expenses) {
    html += `<div class="card warn-card">⚠️ Xarjatlar serverdan yuklanmadi (${esc(state.errors.expenses)}). Oxirgi nusxa ko'rsatilgan.</div>`;
  }

  html += '<p class="card hint">Xarajatlar va budjet Supabase bilan sinxronlanadi. Internet uzilganda yozuvlar qurilmada navbatda saqlanadi.</p>';
  html += budgetPanel();

  const options = CATEGORIES.map((cat) => `<option value="${cat.id}">${cat.icon} ${cat.label}</option>`).join("");
  html += `<div class="card">
    <div class="card-head">
      <h3>➕ Yangi xarjat</h3>
      <span class="muted small">TL yoki USD</span>
    </div>
    <form id="expense-form" class="expense-form" autocomplete="off">
      <label class="amount-wrap">
        <input id="exp-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" maxlength="16" aria-label="Summa">
      </label>
      <label class="field"><span>Xarajat valyutasi</span><select id="exp-currency"><option value="TRY">TL — Turk lirasi</option><option value="USD" ${state.expenseCurrency === 'USD' ? 'selected' : ''}>USD — Dollar</option></select></label>
      <div class="form-row">
        <label class="field"><span>Kategoriya</span><select id="exp-category">${options}</select></label>
        <label class="field"><span>Sana</span><input id="exp-date" type="date" value="${todayKey()}"></label>
      </div>
      <label class="field"><span>Izoh (ixtiyoriy)</span><input id="exp-note" type="text" maxlength="300" placeholder="Masalan: tushlik yoki avtobus"></label>
      <button class="btn" type="submit" id="exp-add">+ Xarjat qo'shish</button>
    </form>
  </div>`;

  if (tops.length) {
    const max = tops[0].total || 1;
    html += `<div class="card">
      <div class="card-head">
        <h3>Shu oy kategoriya bo'yicha</h3>
        <span class="muted small">${money(monthTotal)} ${currencyLabel()}</span>
      </div>
      <div class="cat-bars">
        ${tops.map((cat) => `<div class="cat-row">
          <div class="cat-top">
            <span>${cat.icon} ${esc(cat.label)}</span>
            <b>${money(cat.total)}</b>
          </div>
          <div class="cat-bar"><i style="width:${Math.max(4, Math.round((cat.total / max) * 100))}%"></i></div>
        </div>`).join("")}
      </div>
    </div>`;
  }

  if (!currencyExpenses().length) {
    html += `<div class="card empty">
      <div class="em">💸</div>
      <h3>${currencyLabel()}da hali xarajat yozilmagan</h3>
      <p>Birinchi xarjatni qo'shsangiz, oy va kategoriya bo'yicha hisob avtomatik chiqadi.</p>
    </div>`;
  } else {
    html += `<div class="section-title">So'nggi xarjatlar · ${currencyLabel()} <span>${currencyExpenses().length} ta</span></div>`;
    html += expenseHistory();
  }

  $("#view-expenses").innerHTML = html;
}

async function addExpense(form) {
  const amountRaw = $("#exp-amount", form).value.trim().replace(/\s/g, '').replace(',', '.');
  const amount = Number(amountRaw);
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountRaw) || !Number.isFinite(amount) || amount <= 0) {
    $("#exp-amount", form).focus();
    toast("Musbat summa kiriting, masalan 12.50 yoki 12,50");
    return;
  }
  const payload = {
    amount,
    currency: $('#exp-currency', form).value,
    category: $("#exp-category", form).value,
    date: $("#exp-date", form).value || todayKey(),
    note: $("#exp-note", form).value.trim(),
  };
  const btn = $("#exp-add", form);
  btn.disabled = true;
  try {
    const data = await api("/api/expenses", jsonBody(payload));
    state.expenses.push(data.item);
    state.expenseCurrency = payload.currency;
    writeCache('burgut.currency', state.expenseCurrency);
    writeCache("burgut.expenses", state.expenses);
    state.errors.expenses = null;
    $("#exp-amount", form).value = "";
    $("#exp-note", form).value = "";
    $("#exp-date", form).value = todayKey();
    toast("Xarjat qo'shildi ✅");
    renderExpenses();
    if (state.tab === "today") renderToday();
    $("#exp-amount", form).focus();
  } catch (err) {
    toast(`Saqlanmadi: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

async function removeExpense(id) {
  const idx = state.expenses.findIndex((item) => item.id === id);
  if (idx === -1) return;
  if (!confirm("Bu xarjatni o'chirasizmi?")) return;

  const [removed] = state.expenses.splice(idx, 1);
  writeCache("burgut.expenses", state.expenses);
  if (state.tab === "expenses") renderExpenses();
  if (state.tab === "today") renderToday();

  try {
    await api(`/api/expenses?id=${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify(removed) });
    toast("Xarjat o'chirildi");
  } catch (err) {
    state.expenses.splice(idx, 0, removed);
    writeCache("burgut.expenses", state.expenses);
    if (state.tab === "expenses") renderExpenses();
    if (state.tab === "today") renderToday();
    toast(`O'chirilmadi: ${err.message}`);
  }
}

// ——————————————— Rejalar ———————————————

function sortPlans(list) {
  return [...list].sort((a, b) => {
    const da = a.date || "9999-99-99";
    const db = b.date || "9999-99-99";
    if (da !== db) return da < db ? -1 : 1;
    return String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
  });
}

function planItem(item) {
  const today = todayKey();
  const overdue = !item.done && item.date && item.date < today;
  const meta = [];
  if (item.date) {
    meta.push(`<span>📅 ${esc(dateLabel(item.date))}</span>`);
    meta.push(`<span class="cd">${esc(countdownLabel(item.date))}</span>`);
  } else {
    meta.push("<span>sanasi ko'rsatilmagan</span>");
  }
  if (item.time) meta.push(`<span>🕘 ${esc(item.time)}</span>`);

  return `<li class="plan${item.done ? " done" : ""}${overdue ? " overdue" : ""}">
    <button class="plan-tick" data-plan-toggle="${esc(item.id)}" aria-label="${item.done ? "Bajarilmagan deb belgilash" : "Bajarildi deb belgilash"}">✓</button>
    <div class="pbody">
      <div class="ptitle">${esc(item.title)}</div>
      <div class="pmeta">${meta.join("")}</div>
      ${item.note ? `<div class="pnote">${esc(item.note)}</div>` : ""}
    </div>
    <button class="plan-del" data-plan-del="${esc(item.id)}" aria-label="O'chirish">✕</button>
  </li>`;
}

function planSection(title, items) {
  return `<div class="section-title">${title} <span>${items.length} ta</span></div>
    <ul class="plan-list">${items.map(planItem).join("")}</ul>`;
}

function plansHtml() {
  const today = todayKey();
  const open = state.plans.filter((item) => !item.done);
  const overdue = sortPlans(open.filter((item) => item.date && item.date < today));
  const todays = sortPlans(open.filter((item) => item.date === today));
  const later = sortPlans(open.filter((item) => item.date && item.date > today));
  const someday = open.filter((item) => !item.date);
  const done = [...state.plans.filter((item) => item.done)]
    .sort((a, b) => String(b.doneAt || "").localeCompare(String(a.doneAt || "")));

  let html = "";
  if (state.errors.plans) {
    html += `<div class="card warn-card">⚠️ Rejalar serverdan yuklanmadi (${esc(state.errors.plans)}). Oxirgi nusxa ko'rsatilgan.</div>`;
  }
  if (!state.plans.length) {
    html += `<div class="card empty">
      <div class="em">🗓️</div>
      <h3>Hozircha reja yo'q</h3>
      <p>Yuqoridagi maydonga bugungi yoki kelasi kun rejasini yozing. Bajarilganda ✓ bilan belgilang.</p>
    </div>`;
  }
  if (overdue.length) html += planSection("⏰ Muddati o'tgan", overdue);
  if (todays.length) html += planSection("☀️ Bugun", todays);
  if (later.length) html += planSection("📅 Kelasi kunlar", later);
  if (someday.length) html += planSection("📌 Sanasi yo'q", someday);
  if (done.length) {
    html += `<details class="card done-box">
      <summary>✅ Bajarilgan (${done.length})</summary>
      <ul class="plan-list">${done.map(planItem).join("")}</ul>
    </details>`;
  }
  return html;
}

function weekDates(offset = 0) {
  const base = new Date(todayKey() + 'T00:00:00Z');
  base.setUTCDate(base.getUTCDate() - (base.getUTCDay() + 6) % 7 + offset * 7);
  return Array.from({length:7},(_,i)=>new Date(base.getTime()+i*DAY).toISOString().slice(0,10));
}

function weeklyPlanHtml() {
  const dates=weekDates(state.planWeekOffset);
  const weekly=state.plans.filter(p=>dates.includes(p.date));
  return `<div class="card week-heading"><div><h3>Haftalik rejam</h3><p class="hint">${dateLabel(dates[0])} — ${dateLabel(dates[6])} · ${weekly.filter(p=>p.done).length}/${weekly.length} bajarildi</p></div><div class="row-actions"><button class="btn ghost small" data-plan-week="-1" aria-label="Oldingi hafta">←</button><button class="btn ghost small" data-plan-week="today">Shu hafta</button><button class="btn ghost small" data-plan-week="1" aria-label="Keyingi hafta">→</button></div></div>
    <div class="week-grid">${dates.map(date=>{
      const plans=sortPlans(state.plans.filter(p=>p.date===date));
      return `<section class="week-day${date===todayKey()?' is-today':''}${date===state.planSelectedDate?' selected':''}" aria-label="${esc(weekdayName(date))}"><div class="week-day-head"><h3>${esc(weekdayName(date))}</h3><span>${dateLabel(date)}${date===todayKey()?' · Bugun':''}</span></div>${plans.length?`<ul class="plan-list">${plans.map(planItem).join('')}</ul>`:'<p class="hint">Hali reja yo‘q</p>'}<button class="btn ghost small" data-plan-day="${date}">+ Shu kunga reja</button></section>`;
    }).join('')}</div>`;
}

function navigatePlanWeek(button) {
  const form=$('#plan-form');
  if(form)state.planDraft={title:$('#plan-title',form).value,time:$('#plan-time',form).value,note:$('#plan-note',form).value};
  if(button.dataset.planDay)state.planSelectedDate=button.dataset.planDay;
  else {
    state.planWeekOffset=button.dataset.planWeek==='today'?0:state.planWeekOffset+Number(button.dataset.planWeek);
    state.planSelectedDate=state.planWeekOffset===0?todayKey():weekDates(state.planWeekOffset)[0];
  }
  renderPlans();
  if(button.dataset.planDay){$('#plan-title').focus();$('#plan-form').scrollIntoView({behavior:'smooth',block:'center'});}
}

function renderPlans() {
  const el = $("#view-plans");
  const openCount = state.plans.filter((item) => !item.done).length;
  const head = `<div class="page-head">
    <div>
      <h2>Rejalar</h2>
      <p class="muted">${!state.plans.length ? "Hozircha reja yo'q" : openCount ? `${openCount} ta bajarilmagan reja` : "Hammasi bajarilgan"}</p>
    </div>
    <span class="chip">${esc(dateLabel(todayKey()))}</span>
  </div>`;
  const form = `<div class="card plan-form-card">
    <div class="card-head">
      <h3>🗓️ Yangi reja</h3>
      <span class="muted small">Bugun: ${esc(dateLabel(todayKey()))}</span>
    </div>
    <form id="plan-form" class="plan-form" autocomplete="off">
      <input id="plan-title" type="text" maxlength="160" required aria-label="Reja nomi" value="${esc(state.planDraft?.title || '')}" placeholder="Masalan: darsga tayyorlanish, kutubxonaga borish">
      <div class="form-row">
        <label class="field"><span>Sana</span><input id="plan-date" type="date" value="${state.planSelectedDate || todayKey()}"></label>
        <label class="field"><span>Vaqt (ixtiyoriy)</span><input id="plan-time" type="time" value="${esc(state.planDraft?.time || '')}"></label>
      </div>
      <label class="field"><span>Izoh (ixtiyoriy)</span><input id="plan-note" type="text" maxlength="500" value="${esc(state.planDraft?.note || '')}" placeholder="Kim, qayerda, nima kerak"></label>
      <button class="btn" type="submit" id="plan-add">+ Rejaga qo'shish</button>
    </form>
  </div>`;

  el.innerHTML = head + (state.errors.plans?`<p class="card warn-card" role="status">Rejalar qurilmada saqlangan. Bulut: ${esc(state.errors.plans)}</p>`:'') + weeklyPlanHtml() + form + `<details class="card"><summary>Barcha rejalar va muddati o‘tganlar</summary><div id="plan-items">${plansHtml()}</div></details>`;
}

async function addPlan(form) {
  const title = $("#plan-title", form).value.trim();
  if (!title) {
    $("#plan-title", form).focus();
    return;
  }
  const payload = {
    title,
    date: $("#plan-date", form).value || "",
    time: $("#plan-time", form).value || "",
    note: $("#plan-note", form).value.trim(),
  };
  const btn = $("#plan-add", form);
  btn.disabled = true;
  try {
    const data = await api("/api/plans", jsonBody(payload));
    state.plans.push(data.item);
    writeCache("burgut.plans", state.plans);
    state.errors.plans = null;
    $("#plan-title", form).value = "";
    $("#plan-note", form).value = "";
    toast("Reja qo'shildi ✅");
    state.planDraft=null;
    renderPlans();
    updateBadges();
    if (state.tab === "today") renderToday();
    $("#plan-title", form).focus();
  } catch (err) {
    toast(`Saqlanmadi: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

async function togglePlan(id) {
  const item = state.plans.find((plan) => plan.id === id);
  if (!item) return;
  const prev = { done: item.done, doneAt: item.doneAt };
  item.done = !item.done;
  item.doneAt = item.done ? new Date().toISOString() : null;
  writeCache("burgut.plans", state.plans);
  renderCurrent();
  updateBadges();

  try {
    const data = await api("/api/plans", jsonBody({ id, done: item.done }, "PATCH"));
    if (data.item) Object.assign(item, data.item);
    writeCache("burgut.plans", state.plans);
    state.errors.plans = null;
  } catch (err) {
    Object.assign(item, prev);
    writeCache("burgut.plans", state.plans);
    state.errors.plans = err.message;
    toast(`Saqlanmadi: ${err.message}`);
  }
  renderCurrent();
  updateBadges();
}

async function removePlan(id) {
  const idx = state.plans.findIndex((item) => item.id === id);
  if (idx === -1) return;
  if (!confirm("Bu rejani o'chirasizmi?")) return;

  const [removed] = state.plans.splice(idx, 1);
  writeCache("burgut.plans", state.plans);
  renderCurrent();
  updateBadges();

  try {
    await api(`/api/plans?id=${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify(removed) });
    toast("Reja o'chirildi");
  } catch (err) {
    state.plans.splice(idx, 0, removed);
    writeCache("burgut.plans", state.plans);
    renderCurrent();
    updateBadges();
    toast(`O'chirilmadi: ${err.message}`);
  }
}

// ——————————————— Yangiliklar ———————————————

function newsSkeleton(n = 3) {
  const card = `<div class="card"><div class="skel title"></div><div class="skel line"></div><div class="skel line" style="width:62%"></div></div>`;
  return `<div class="card"><div class="skel title"></div><div class="skel line" style="width:40%"></div></div>` + card.repeat(n);
}

async function loadWeekly(force = false) {
  if (state.newsLoading.weekly) return;
  state.newsLoading.weekly = true;
  state.newsError.weekly = null;
  if (state.tab === "news") renderNews();

  try {
    const data = await api(`/api/weekly${force ? "?refresh=1" : ""}`);
    state.weekly = data;
    writeCache("burgut.weekly", { at: Date.now(), data });
    state.newsError.weekly = null;
  } catch (err) {
    state.newsError.weekly = err.message || "Ulanish xatosi";
    if (state.weekly) toast("Yangilanmadi — oxirgi nusxa ko'rsatilmoqda");
  } finally {
    state.newsLoading.weekly = false;
    if (state.tab === "news") renderNews();
    else if (state.tab === "today") renderToday();
  }
}

async function loadFootball(force = false) {
  if (state.newsLoading.football) return;
  state.newsLoading.football = true;
  state.newsError.football = null;
  if (state.tab === "news") renderNews();

  try {
    const data = await api(`/api/football${force ? "?refresh=1" : ""}`);
    state.football = data;
    writeCache("burgut.football", { at: Date.now(), data });
    state.newsError.football = null;
  } catch (err) {
    state.newsError.football = err.message || "Ulanish xatosi";
    if (state.football) toast("Futbol yangilanmadi — oxirgi nusxa");
  } finally {
    state.newsLoading.football = false;
    if (state.tab === "news") renderNews();
  }
}

function statList(items) {
  return `<div class="news-stats">${items.map((text) => `<span class="stat">${esc(text)}</span>`).join("")}</div>`;
}

function summaryCard(w) {
  const sources = w.stats?.sourcesOk ?? 0;
  const total = w.stats?.sources ?? 0;
  const articles = w.stats?.articles ?? 0;
  return `<div class="card summary">
    <div class="sum-top">
      <span class="chip">📡 Dushanba sharhi</span>
      <span class="sum-date">${esc(w.generatedLabel || "")}</span>
    </div>
    <h2>${esc(w.headline || "Haftalik sharh")}</h2>
    ${statList([
      `${sources}/${total} manba`,
      `${articles} maqola ko'rildi`,
      `${w.windowDays || 7} kunlik davr`,
    ])}
    <div class="news-actions">
      <button class="btn" data-news-act="copy">📋 Nusxasini olish</button>
      <button class="btn ghost" data-news-act="telegram">✈️ Telegramga yuborish</button>
    </div>
  </div>`;
}

function newsCard(item, { compact = false } = {}) {
  const icon = NEWS_ICON[item.primary] || "•";
  const benefit = (item.impact?.benefit || []).slice(0, compact ? 1 : 2);
  const risk = (item.impact?.risk || []).slice(0, compact ? 1 : 2);
  const actions = (item.impact?.action || []).slice(0, compact ? 1 : 2);
  const changes = (item.whatChanged || []).slice(0, compact ? 1 : 3);
  const why = Array.isArray(item.why) ? item.why : item.why ? [item.why] : [];

  return `<article class="card news" data-primary="${esc(item.primary || "")}">
    <div class="news-top">
      <span class="chip">${icon} ${esc(item.primaryLabel || NEWS_LABEL[item.primary] || "Yangilik")}</span>
      <span class="badge ${item.sourceKind === "official" ? "official" : item.sourceKind === "industry" ? "industry" : ""}">${esc(item.sourceKindLabel || "Manba")}</span>
      <span class="date">${esc(item.publishedLabel || "")}</span>
    </div>
    <h3><a href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.title)}</a></h3>
    ${why.length ? `<div class="news-why">${why.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}
    <div class="news-block">
      <h4>Nima o'zgardi</h4>
      <ul>${changes.map((text) => `<li>${esc(text)}</li>`).join("") || "<li>—</li>"}</ul>
    </div>
    <div class="impact-grid">
      <div class="impact good">
        <h4>✔ Ehtimoliy foyda / o'rganish</h4>
        <ul>${benefit.map((text) => `<li>${esc(text)}</li>`).join("") || "<li>—</li>"}</ul>
      </div>
      <div class="impact bad">
        <h4>⚠ E'tibor berish kerak</h4>
        <ul>${risk.map((text) => `<li>${esc(text)}</li>`).join("") || "<li>—</li>"}</ul>
      </div>
    </div>
    <div class="news-block act">
      <h4>→ Amal</h4>
      <ul>${actions.map((text) => `<li>${esc(text)}</li>`).join("") || "<li>—</li>"}</ul>
    </div>
    <div class="news-foot">
      <a class="src" href="${esc(item.link)}" target="_blank" rel="noopener">${esc(item.sourceName || "Manba")} ↗</a>
      ${item.sourceKind === "official" ? "" : `<span class="note">${esc(item.sourceNote || "")}</span>`}
      ${item.titleTransliterated ? `<span class="note">kirilldan lotinga o'girildi</span>` : ""}
      ${item.lang === "en" ? `<span class="note">manba ingliz tilida</span>` : ""}
      ${item.lang === "ru" && !item.titleTransliterated ? `<span class="note">manba rus tilida</span>` : ""}
    </div>
  </article>`;
}

function emptyNewsCard(title, where, data) {
  const near = (data?.nearMiss || []).filter((x) => x.score >= (data?.threshold ?? 0) - 8).slice(0, 3);
  const stats = data
    ? `${where} ${data.stats?.sourcesOk ?? 0} ta manba, ${data.stats?.articlesSeen ?? 0} ta maqola tekshirildi — chegaradan o'tadigan yangilik yo'q.`
    : where;
  return `<div class="card empty">
    <div class="em">✅</div>
    <h3>Muhim yangilik topilmadi</h3>
    <p>${esc(stats)}</p>
    ${near.length ? `<div class="near">
      <b>E'tiborga loyiq, lekin muhim emas:</b>
      ${near.map((n) => `<a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>`).join("")}
    </div>` : ""}
  </div>`;
}

function actionsCard(actions, weekKey) {
  return `<div class="card">
    <div class="news-block" style="margin-top:0">
      <h4>✅ Bu hafta qilish kerak</h4>
      <ul class="todo">
        ${actions.map((a) => {
          const done = state.todo[a.text] === weekKey;
          return `<li class="${done ? "done" : ""}">
            <label>
              <input type="checkbox" data-todo="${esc(a.text)}" ${done ? "checked" : ""}>
              <span>${esc(a.text)}</span>
            </label>
          </li>`;
        }).join("")}
      </ul>
    </div>
  </div>`;
}

function weeklyView() {
  const w = state.weekly;
  if (!w && state.newsLoading.weekly) return newsSkeleton(3);
  if (!w) {
    return `<div class="card empty">
      <div class="em">📡</div>
      <h3>Sharh yuklanmadi</h3>
      <p>${esc(state.newsError.weekly || "Server ishlamayapti. Terminalda node server.mjs ni ishga tushiring.")}</p>
      <button class="btn" data-news-act="retry-weekly">Qayta urinish</button>
    </div>`;
  }

  const weekKey = String(w.generatedAt || "").slice(0, 10);
  const uz = w.uz || { items: [] };
  const world = w.world || { items: [] };
  let html = summaryCard(w);

  if (w.stats?.sourcesFailed > 0) {
    html += `<div class="card warn-card">⚠️ ${w.stats.sourcesFailed} ta manba javob bermadi — qolgan manbalar tekshirildi.</div>`;
  }

  html += `<div class="section-title">🇺🇿 O'zbekiston <span>${uz.items?.length || 0} ta</span></div>`;
  if (uz.empty || !uz.items?.length) {
    html += emptyNewsCard("O'zbekiston", "O'zbekiston manbalarida", uz);
  } else {
    html += uz.items.map((item) => newsCard(item)).join("");
    if (uz.nearMiss?.length) {
      html += `<div class="card near-card">
        <h4>E'tiborga loyiq boshqa xabarlar</h4>
        <ul>${uz.nearMiss.map((n) => `<li><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a></li>`).join("")}</ul>
      </div>`;
    }
  }

  html += `<div class="section-title">🌍 Jahon amaliyoti <span>${world.items?.length || 0} ta</span></div>`;
  if (world.empty || !world.items?.length) {
    html += emptyNewsCard("Jahon", "Jahon manbalarida", world);
  } else {
    html += world.items.slice(0, 3).map((item) => newsCard(item, { compact: true })).join("");
    if (world.items.length > 3) {
      html += `<button class="btn ghost wide" data-news-tab="world">Jahon bo'limida davomi (${world.items.length - 3} ta) →</button>`;
    }
  }

  if (w.actions?.length) html += actionsCard(w.actions, weekKey);
  if (w.disclaimer) html += `<p class="disclaimer">${esc(w.disclaimer)}</p>`;
  html += `<p class="footer-note">Oxirgi yangilanish: ${esc(w.generatedLabel || "")} (Toshkent)</p>`;
  return html;
}

function worldView() {
  const w = state.weekly;
  if (!w && state.newsLoading.weekly) return newsSkeleton(3);
  if (!w) {
    return `<div class="card empty">
      <div class="em">🌍</div>
      <h3>Ma'lumot yo'q</h3>
      <p>Avval "Haftalik" bo'limini yangilang.</p>
      <button class="btn" data-news-act="retry-weekly">Yangilash</button>
    </div>`;
  }

  const d = w.world || { items: [] };
  const items = d.items || [];
  let html = `<div class="card summary">
    <div class="sum-top">
      <span class="chip">🌍 Jahon chorvachiligi</span>
      <span class="sum-date">${esc(d.generatedLabel || "")}</span>
    </div>
    <h2>${d.empty || !items.length ? "Bu davrda muhim yangilik topilmadi" : `${items.length} ta amaliy yangilik`}</h2>
    ${statList([
      `${d.stats?.sourcesOk ?? 0}/${d.stats?.sourcesChecked ?? 0} manba`,
      `${d.stats?.articlesSeen ?? 0} maqola`,
      `${d.windowDays || 7} kun`,
    ])}
    <p class="hint">Manbalar ingliz tilida; izoh va amaliy tavsiyalar o'zbekcha.</p>
  </div>`;

  const cats = [...new Set(items.flatMap((item) => item.categories || []))];
  if (cats.length > 1) {
    html += `<div class="chips" data-filter="world-cat">
      <button class="${state.worldCat === "all" ? "on" : ""}" data-cat="all">Barchasi</button>
      ${cats.map((cat) => `<button class="${state.worldCat === cat ? "on" : ""}" data-cat="${esc(cat)}">${NEWS_ICON[cat] || ""} ${esc(NEWS_LABEL[cat] || cat)}</button>`).join("")}
    </div>`;
  }

  if (!items.length) {
    html += emptyNewsCard("Jahon", "Jahon manbalarida", d);
  } else {
    html += items.map((item) => {
      const show = state.worldCat === "all" || (item.categories || []).includes(state.worldCat);
      return `<div class="news-wrap" data-cats="${esc((item.categories || []).join(" "))}"${show ? "" : " hidden"}>${newsCard(item)}</div>`;
    }).join("");
  }
  if (w.disclaimer) html += `<p class="disclaimer">${esc(w.disclaimer)}</p>`;
  return html;
}

function clubCard(club) {
  const resLabel = { W: "G'alaba", D: "Durang", L: "Mag'lubiyat" }[club.last?.result] || "";
  const recent = club.recent || [];
  const form = recent.slice(0, 5).reverse().map((m) => `<button class="${esc(m.result)}" data-match-club="${esc(club.id)}" data-match-id="${esc(m.id)}" aria-label="${esc(m.opponent)}: ${esc(m.clubScore)}–${esc(m.opponentScore)}, ${esc(m.dateLabel)}">${esc(m.result || "?")}</button>`).join("");
  const last = club.last ? `
    <div class="match">
      <span class="lbl">Oxirgi o'yin</span>
      <div class="score">${esc(club.last.clubScore)}<span>:</span>${esc(club.last.opponentScore)}
        ${club.last.result ? `<span class="res ${esc(club.last.result)}">${esc(resLabel)}</span>` : ""}
      </div>
      <div class="opp">${club.last.isHome ? "🏠" : "✈️"} ${esc(club.last.opponent)}</div>
      <div class="mdate">${esc(club.last.dateLabel)}</div>
    </div>` : `<div class="match"><span class="lbl">Oxirgi o'yin</span><div class="opp" style="margin-top:6px">Ma'lumot yo'q</div></div>`;

  const next = club.next ? `
    <div class="match">
      <span class="lbl">Keyingi o'yin</span>
      <div class="next-date">${esc(club.next.dateLabel)}</div>
      <div class="opp">${club.next.isHome ? "🏠" : "✈️"} ${esc(club.next.opponent)}</div>
      <div class="mdate">Toshkent vaqti</div>
    </div>` : `<div class="match"><span class="lbl">Keyingi o'yin</span><div class="opp" style="margin-top:6px">Jadvalda topilmadi</div></div>`;

  return `<div class="card">
    <div class="club-head">
      ${club.logo ? `<img class="club-logo" src="${esc(club.logo)}" alt="" loading="lazy" onerror="this.style.display='none'">` : `<div class="club-logo">${esc(club.emoji || "⚽")}</div>`}
      <div class="club-name">
        <h3>${esc(club.short)}</h3>
        <div class="sub">${esc(club.league)}</div>
      </div>
      <div class="form">${form}</div>
    </div>
    <div class="matches">${last}${next}</div>
    ${!club.ok ? `<p class="hint">Natijalar manbadan olinmadi. Qayta yangilang.</p>` : ""}
    ${club.warnings?.length ? `<p class="hint">Jadvalning bir qismi yangilanmadi. Ma'lumot to'liq bo'lmasligi mumkin.</p>` : ""}
    ${(club.live || []).map((m) => `<p class="hint">🔴 Hozir: ${esc(m.home.team)} ${esc(m.home.score)} : ${esc(m.away.score)} ${esc(m.away.team)} · ${esc(m.detail)}</p>`).join("")}
    ${recent.length ? `<p class="hint">W — g'alaba · D — durang · L — mag'lubiyat. Belgini bosing.</p><details class="match-history"><summary>Oxirgi ${recent.length} ta o'yin</summary>${recent.map((m) => `<button data-match-club="${esc(club.id)}" data-match-id="${esc(m.id)}"><span>${esc(m.dateLabel)} · ${m.isHome ? "Uyda" : "Safarda"}<br>${esc(m.opponent)}</span><b>${esc(m.clubScore)} : ${esc(m.opponentScore)}</b></button>`).join("")}</details>` : ""}
  </div>`;
}

function showMatch(clubId, matchId) {
  const club = state.football?.clubs?.find((c) => c.id === clubId);
  const match = club?.recent?.find((m) => String(m.id) === matchId);
  if (!match) return;
  const dialog = document.createElement("dialog");
  dialog.className = "match-dialog";
  dialog.innerHTML = `<form method="dialog"><button class="btn ghost" autofocus>Yopish ×</button></form><h3>${esc(match.home.team)} — ${esc(match.away.team)}</h3><p class="match-big-score">${esc(match.home.score)} : ${esc(match.away.score)}</p><p>${esc({W:"G'alaba", D:"Durang", L:"Mag'lubiyat"}[match.result] || "Yakunlangan")} · ${esc(club.short)}</p><p>${esc(match.dateLabel)} · Toshkent vaqti</p><p>${esc(match.venue || "")}</p><p>${esc(match.detail)}</p>`;
  document.body.append(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  dialog.showModal();
}

function footballView() {
  const f = state.football;
  if (!f && state.newsLoading.football) return newsSkeleton(3);
  if (!f) {
    return `<div class="card empty">
      <div class="em">⚽</div>
      <h3>Futbol yuklanmadi</h3>
      <p>${esc(state.newsError.football || "Server ishlamayapti.")}</p>
      <button class="btn" data-news-act="retry-football">Qayta urinish</button>
    </div>`;
  }

  const news = f.news || [];
  let html = `<div class="card summary">
    <div class="sum-top"><span class="chip">⚽ Sevimli klublar</span><span class="sum-date">${esc(f.generatedLabel || "")}</span></div>
    <h2>Man Utd · Barselona · PSJ</h2>
    <p class="hint">${state.newsLoading.football ? "Yangilanmoqda…" : "Bo'lim ochiq turganda har daqiqada tekshiriladi."}</p>
    <button class="btn ghost small" data-news-act="retry-football" ${state.newsLoading.football ? "disabled" : ""}>Natijalarni yangilash</button>
    ${state.newsError.football ? `<p role="status">Yangilanmadi: ${esc(state.newsError.football)}. Eski nusxa ko'rsatilmoqda.</p>` : ""}
    ${statList(["Natijalar", "Keyingi o'yin", "Yangiliklar"])}
  </div>`;

  html += (f.clubs || []).map(clubCard).join("");

  html += `<div class="section-title">📰 Klub yangiliklari <span>${news.length} ta</span></div>`;
  html += `<div class="chips" data-filter="club">
    <button class="${state.clubFilter === "all" ? "on" : ""}" data-club="all">Barchasi</button>
    ${(f.clubs || []).map((club) => `<button class="${state.clubFilter === club.id ? "on" : ""}" data-club="${esc(club.id)}">${esc(club.short)}</button>`).join("")}
  </div>`;

  if (!news.length) {
    html += `<div class="card empty"><div class="em">📰</div><h3>Yangilik topilmadi</h3><p>ESPN manbasida hozircha klubga oid yangilik yo'q.</p></div>`;
  } else {
    html += `<div class="card news-mini">${news.map((item) => {
      const show = state.clubFilter === "all" || item.clubId === state.clubFilter;
      return `<a href="${esc(item.link)}" target="_blank" rel="noopener" data-newsclub="${esc(item.clubId)}"${show ? "" : " hidden"}>
        <div class="t">${esc(item.title)}</div>
        <div class="m"><b>${esc(item.clubShort)}</b><span>${esc(item.publishedLabel)}</span><span>ESPN</span></div>
      </a>`;
    }).join("")}</div>`;
    const visible = state.clubFilter === "all" ? news.length : news.filter((item) => item.clubId === state.clubFilter).length;
    if (!visible) {
      html += `<div class="card empty small-empty">
        <div class="em">🔎</div>
        <h3>Bu klub uchun yangilik yo'q</h3>
        <p>Boshqa klubni tanlang yoki «Barchasi»ga qayting.</p>
      </div>`;
    }
  }

  if (f.note) html += `<p class="disclaimer">${esc(f.note)}</p>`;
  return html;
}

function settingsView() {
  const w = state.weekly;
  const sources = w ? [...(w.uz?.sources || []), ...(w.world?.sources || [])] : [];
  const okCount = sources.filter((s) => s.ok).length;
  const farm = state.config?.farm || {};

  let html = `<div class="card"><h3>So‘zlar va budjet zaxirasi</h3><p class="hint">Takrorlash tarixi va oylik budjetlarni JSON faylga saqlang. Tiklash mavjud yozuvlarga yetishmaganlarini qo‘shadi. Rejalar va xarajat yozuvlari bu zaxiraga kirmaydi.</p><div class="news-actions"><button class="btn" data-study-backup>Yuklab olish</button><label class="btn ghost">Fayldan tiklash<input type="file" accept=".json,application/json" data-study-import hidden></label></div><p class="hint">Hozir ma’lumotlar shu kompyuterdagi serverda. Supabase ulanishi hali yo‘q.</p></div><div class="card">
    <div class="news-block" style="margin-top:0">
      <h4>Ferma profili</h4>
      <p class="hint"><b>${esc(farm.name || "Aobod fermasi")}</b> · ${esc(String(farm.cows || 30))} bosh · ${esc(farm.region || "Qashqadaryo")}</p>
      <p class="hint">O'zgartirish: loyiha papkasidagi <code>config.json</code> → <code>farm</code>.</p>
    </div>
  </div>`;

  html += `<div class="card">
    <div class="news-block" style="margin-top:0">
      <h4>Manbalar (${okCount}/${sources.length} ishlayapti)</h4>
      <ul class="src-list">
        ${sources.map((s) => `<li>
          <span class="dot ${s.ok ? "" : "bad"}"></span>
          <span class="src-name">${esc(s.name)}</span>
          <span class="count">${s.ok ? `${s.count} ta` : esc(s.error || "xato")}</span>
        </li>`).join("") || "<li>Ma'lumot yo'q — avval yangilang.</li>"}
      </ul>
    </div>
  </div>`;

  html += `<div class="card">
    <div class="news-block" style="margin-top:0">
      <h4>Telegramga ulash</h4>
      <p class="hint">
        1. Telegramda <b>@BotFather</b> orqali bot yarating va token oling.<br>
        2. Botga <b>/start</b> yozing, so'ng chat ID ni oling.<br>
        3. Loyiha papkasidagi <code>config.json</code> faylida <code>telegram.botToken</code> va <code>telegram.chatId</code> ni to'ldiring.<br>
        4. Serverni qayta ishga tushiring — sharhni qo'lda ham yuborish mumkin.
      </p>
      <div class="news-actions">
        <button class="btn ghost" data-news-act="telegram">✈️ Hozir sinab ko'rish</button>
      </div>
    </div>
  </div>`;

  html += `<div class="card">
    <div class="news-block" style="margin-top:0">
      <h4>Qanday ishlaydi</h4>
      <p class="hint">
        Ilova O'zbekiston manbalarini (lex.uz, UzA, Gazeta, Daryo va b.) hamda jahon
        sut/chorva nashrlarini tekshiradi. Subsidiya va qoidalar, ozuqa, sog'ish uskunalariga
        tegishli xabarlar tanlanadi; har biriga "nima o'zgardi", foyda, xavf va amal yoziladi.
        Muhim xabar bo'lmasa — shu aytiladi.
      </p>
      <p class="hint" style="margin-top:8px">
        Futbol: Man Utd, Barselona, PSJ natijalari va yangiliklari ESPN ochiq ma'lumotlaridan olinadi.
      </p>
    </div>
  </div>`;

  html += `<p class="footer-note">Burgut · ma'lumotlar ochiq RSS va ESPN API'dan</p>`;
  return html;
}

function renderNews() {
  const el = $("#view-news");
  const view = state.newsView;
  let body = "";
  if (view === "weekly") body = weeklyView();
  else if (view === "world") body = worldView();
  else if (view === "football") body = footballView();
  else body = settingsView();

  el.innerHTML = `<div class="page-head">
    <div>
      <h2>Yangiliklar</h2>
      <p class="muted">Chorvachilik, biznes boshqaruv, ilm-fan va muhim voqealar.</p>
    </div>
    <span class="chip">${esc(state.weekly?.generatedLabel || dateLabel(todayKey()))}</span>
  </div>
  <div class="news-tabs" role="tablist">
    ${NEWS_TABS.map((item) => `<button class="news-tab${item.id === view ? " on" : ""}" data-news-tab="${item.id}" role="tab">${item.icon} ${item.label}</button>`).join("")}
  </div>
  ${view !== 'football' && state.newsLoading.weekly ? '<p class="hint" role="status">Yangiliklar tekshirilmoqda…</p>' : ''}
  ${view !== 'football' && (state.weekly?.stale || state.newsError.weekly) ? `<div class="card warn-card" role="status">${esc(state.weekly?.refreshError || state.newsError.weekly)} <button class="btn ghost small" data-news-act="retry-weekly">Qayta urinish</button></div>` : ''}
  ${body}`;
}

function setNewsView(view) {
  if (!NEWS_TABS.some((item) => item.id === view)) return;
  state.newsView = view;
  renderNews();
  if (view === "football") loadFootball(false);
  if (view === 'world' || view === 'weekly') loadWeekly(false);
}

async function copyWeekly() {
  let text = "";
  try {
    const res = await fetch("/api/weekly.txt", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) throw new Error("clipboard");
    }
    toast("Sharh nusxalandi ✅");
  } catch {
    if (text) {
      showCopyFallback(text);
      toast("Matnni qo'lda nusxalang");
    } else {
      toast("Nusxalash imkonsiz — matnni belgilab oling");
    }
  }
}

function showCopyFallback(text) {
  const box = document.createElement("div");
  box.className = "copy-fallback";
  box.innerHTML = `<div class="copy-panel">
    <h3>Sharh matni</h3>
    <p class="muted small">Matnni belgilab nusxalang (Ctrl+C yoki uzoq bosib «Copy»).</p>
    <textarea readonly></textarea>
    <button class="btn" type="button">Yopish</button>
  </div>`;
  const area = box.querySelector("textarea");
  area.value = text;
  document.body.appendChild(box);
  area.focus();
  area.select();
  box.querySelector("button").addEventListener("click", () => box.remove());
}

async function sendTelegram() {
  const btn = $('[data-news-act="telegram"]');
  if (btn) btn.disabled = true;
  try {
    const data = await api("/api/telegram", jsonBody({}));
    toast(data.ok ? "Telegramga yuborildi ✅" : `Yuborilmadi: ${data.error}`);
  } catch (err) {
    toast(`Xato: ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}



function openPlansDue() {
  const today = todayKey();
  return sortPlans(state.plans.filter((item) => !item.done && item.date && item.date <= today));
}

function upcomingPlans() {
  const today = todayKey();
  return sortPlans(state.plans.filter((item) => !item.done && item.date && item.date > today));
}

function renderToday() {
  const today = todayKey();
  const sets = dailyWords();
  const totalWords = sets.tr.length + sets.en.length;
  const doneWords = sets.tr.filter((w) => isLearned("tr", w.w)).length
    + sets.en.filter((w) => isLearned("en", w.w)).length;
  const todayTotal = sumAmounts(todayExpenses());
  const monthTotal = sumAmounts(monthExpenses());
  const due = openPlansDue();
  const upcoming = upcomingPlans();
  const farm = state.config?.farm || {};
  const farmName = farm.name || "Aobod fermasi";
  const cows = Number(farm.cows) || 30;

  let html = `<div class="hero">
    <div class="hero-date">${esc(dateLabel(today))} · ${esc(weekdayName(today))}</div>
    <h2>${greeting()}</h2>
    <p class="hero-sub">Bugungi kichik qadamlar — ertangi katta natijalar.</p>
    <div class="hero-stats">
      <button class="hero-stat" data-act="tab" data-target="words">
        <b>${doneWords}/${totalWords}</b><span>so'z</span>
      </button>
      <button class="hero-stat" data-act="tab" data-target="expenses">
        <b>${money(todayTotal)} ${currencyLabel()}</b><span>bugun xarjat</span>
      </button>
      <button class="hero-stat" data-act="tab" data-target="plans">
        <b>${due.length}</b><span>bugun reja</span>
      </button>
    </div>
  </div>`;

  const anyError = state.errors.plans || state.errors.expenses || state.errors.vocab || state.errors.config;
  if (anyError) {
    html += `<div class="card warn-card">⚠️ Ba'zi ma'lumotlar serverdan olinmadi. Oxirgi saqlangan nusxa ko'rsatilgan.</div>`;
  }

  // So'zlar
  const preview = [
    ...sets.tr.slice(0, 2).map((item) => ({ lang: "tr", item })),
    ...sets.en.slice(0, 2).map((item) => ({ lang: "en", item })),
  ];
  html += `<div class="card">
    <div class="card-head">
      <div><h3>🗣️ Bugungi so'zlar</h3><p class="muted small">5 turkcha · 10 inglizcha</p></div>
      <span class="counter">${doneWords}/${totalWords}</span>
    </div>
    ${progressBar(doneWords, totalWords)}
    <ul class="mini-words">
      ${preview.map(({ lang, item }) => `<li>
        <span class="flag">${lang === "tr" ? "TR" : "EN"}</span>
        <b>${esc(item.w)}</b>
        <span>${esc(item.t)}</span>
      </li>`).join("")}
    </ul>
    <button class="btn ghost" data-act="tab" data-target="words">Barcha so'zlarni ko'rish →</button>
  </div>`;

  // Xarjat
  const tops = categoryTotals(monthExpenses());
  html += `<div class="card">
    <div class="card-head">
      <div><h3>💸 Xarjat</h3><p class="muted small">${tops[0] ? `Eng ko'p: ${esc(tops[0].label)}` : "Shu oy uchun yozuv yo'q"}</p></div>
      <button class="btn small" data-act="tab" data-target="expenses">+ Qo'shish</button>
    </div>
    <div class="mini-stats">
      <div><b>${money(todayTotal)} ${currencyLabel()}</b><span>bugun</span></div>
      <div><b>${money(monthTotal)} ${currencyLabel()}</b><span>shu oy</span></div>
    </div>
    ${tops.length ? `<div class="mini-cats">${tops.slice(0, 3).map((cat) => `<span>${cat.icon} ${esc(cat.label)} <b>${compactMoney(cat.total)}</b></span>`).join("")}</div>` : ""}
  </div>`;

  // Rejalar
  let plansBlock = "";
  if (due.length) {
    plansBlock = `<ul class="plan-list">${due.slice(0, 4).map(planItem).join("")}</ul>
      ${due.length > 4 ? `<p class="muted small">Yana ${due.length - 4} ta reja bor.</p>` : ""}`;
  } else if (upcoming.length) {
    const first = upcoming[0];
    plansBlock = `<p class="muted">Bugun reja yo'q. Keyingisi: <b>${esc(first.title)}</b> — ${esc(countdownLabel(first.date))}.</p>`;
  } else {
    plansBlock = `<p class="muted">Bugun uchun reja yo'q.</p>`;
  }
  html += `<div class="card">
    <div class="card-head">
      <div><h3>📌 Rejalar</h3><p class="muted small">${due.length ? `${due.length} ta bugun` : "Bugun bo'sh"}</p></div>
      <button class="btn small ghost" data-act="tab" data-target="plans">Rejalar →</button>
    </div>
    ${plansBlock}
  </div>`;

  // Yangiliklar
  const w = state.weekly;
  let newsBlock = "";
  if (w) {
    const uzCount = w.uz?.items?.length || 0;
    const worldCount = w.world?.items?.length || 0;
    const top = (w.uz?.items || []).slice(0, 2);
    newsBlock = `<p class="news-headline">${esc(w.headline || "")}</p>
      <div class="news-stats">
        <span class="stat">🇺🇿 ${uzCount} ta</span>
        <span class="stat">🌍 ${worldCount} ta</span>
        <span class="stat">${esc(w.generatedLabel || "")}</span>
      </div>
      ${top.length ? `<ul class="news-mini-list">${top.map((item) => `<li>${esc(item.title)}</li>`).join("")}</ul>` : ""}`;
  } else {
    newsBlock = `<p class="muted">Haftalik sharh hali yuklanmadi. Yangilash tugmasini bosing.</p>`;
  }
  html += `<div class="card">
    <div class="card-head">
      <div><h3>📡 Yangiliklar</h3><p class="muted small">Haftalik sharh va jahon amaliyoti</p></div>
      <button class="btn small ghost" data-act="tab" data-target="news" data-news-view="weekly">Barchasi →</button>
    </div>
    ${newsBlock}
  </div>`;

  html += `<p class="footer-note">Burgut · O'rganing. Rejalang. Oldinga yuring.</p>`;
  $("#view-today").innerHTML = html;
}
// ——————————————— Umumiy ko'rinish ———————————————

function renderCurrent() {
  if (state.tab === "today") renderToday();
  else if (state.tab === "words") renderWords();
  else if (state.tab === "expenses") renderExpenses();
  else if (state.tab === "plans") renderPlans();
  else if (state.tab === "news") renderNews();
  updateBadges();
}

function updateBadges() {
  const wordBadge = $("#word-badge");
  if (wordBadge) {
    const sets = dailyWords();
    const total = sets.tr.length + sets.en.length;
    const done = sets.tr.filter((w) => isLearned("tr", w.w)).length
      + sets.en.filter((w) => isLearned("en", w.w)).length;
    const scheduled=state.personal?.cards || {};
    const pending=new Set(pendingReviews().map(r=>r.key));
    const ready=new Set(Object.entries(scheduled).filter(([key,card])=>Date.parse(card.dueAt)<=Date.now()&&!pending.has(key)).map(([key])=>key));
    for(const item of allDailyWords())if(!scheduled[`${item.lang}|${item.w}`]&&!pending.has(`${item.lang}|${item.w}`))ready.add(`${item.lang}|${item.w}`);
    const left = ready.size;
    wordBadge.textContent = String(left);
    wordBadge.hidden = left === 0 || total === 0;
  }

  const planBadge = $("#plan-badge");
  if (planBadge) {
    const open = state.plans.filter((item) => !item.done).length;
    planBadge.textContent = String(open);
    planBadge.hidden = open === 0;
  }
}

function applyFarm() {
  const farm = state.config?.farm || {};
  const name = farm.name || "Aobod fermasi";
  const el = $("#farm-name");
  if (el) el.textContent = name;
}

function switchTab(tab) {
  if (!["today", "words", "expenses", "plans", "news"].includes(tab)) return;
  state.tab = tab;
  $$(".tab").forEach((el) => el.classList.toggle("on", el.dataset.tab === tab));
  $$(".view").forEach((el) => el.classList.toggle("on", el.id === `view-${tab}`));
  if (location.hash !== `#${tab}`) history.replaceState(null, "", `#${tab}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderCurrent();

  if (tab === "news") {
    if (state.newsView !== 'football') loadWeekly(false);
    if (state.newsView === "football") loadFootball(false);
  }
}

async function loadAll() {
  const tasks = [
    api("/api/config").then((data) => {
      state.config = data;
      state.errors.config = null;
      writeCache("burgut.config", data);
      applyFarm();
    }),
    api("/api/plans").then((data) => {
      if (Array.isArray(data.items)) {
        state.plans = data.items;
        writeCache("burgut.plans", state.plans);
      }
      state.errors.plans = null;
    }),
    api("/api/expenses").then((data) => {
      if (Array.isArray(data.items)) {
        state.expenses = data.items;
        writeCache("burgut.expenses", state.expenses);
      }
      state.errors.expenses = null;
    }),
    api("/api/vocab").then((data) => {
      if (data.learned && typeof data.learned === "object") {
        state.vocab = normalizeVocab(data.learned);
        writeCache("burgut.vocab", state.vocab);
      }
      state.errors.vocab = null;
    }),
  ];

  const results = await Promise.allSettled(tasks);
  const keys = ["config", "plans", "expenses", "vocab"];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      state.errors[keys[i]] = result.reason?.message || "Ulanish xatosi";
    }
  });

  state.loaded = true;
  await syncStudy();
  await syncCloud();
  renderCurrent();
}

// ——————————————— Hodisalar ———————————————

async function handleCloudAction(action) {
  try {
    if(action==='setup'){
      const url=prompt('Supabase Project URL',window.BURGUT_CLOUD_CONFIG?.url || '');if(!url)return;
      const key=prompt('Supabase public anon kaliti (secret emas)');if(!key)return;
      state.cloud=await BurgutCloud.configure(url,key);
      if(state.cloud.error)throw Error(state.cloud.error);
    }
    if(action==='create'){
      const code=await BurgutCloud.createPair();
      prompt('Yangi qurilmaga shu kodni kiriting. Kod 10 daqiqa amal qiladi.',code);
    }
    if(action==='claim'){
      const code=prompt('Asosiy qurilmadagi ulash kodi');if(!code)return;
      mergeCloudSnapshot(await BurgutCloud.claimPair(code));
    }
    await syncStudy();await syncCloud();renderCurrent();
  }catch(e){toast(e.message,7000);}
}

document.addEventListener("click", (event) => {
  const weekButton=event.target.closest('[data-plan-week], [data-plan-day]');
  if(weekButton){navigatePlanWeek(weekButton);return;}
  const cloudAction=event.target.closest('[data-cloud-action]');
  if(cloudAction){handleCloudAction(cloudAction.dataset.cloudAction);return;}
  if(event.target.closest('[data-study-backup]')){exportStudyBackup();return;}
  if(event.target.closest('[data-study-sync]')){syncStudy().then(()=>renderCurrent());return;}
  const matchButton = event.target.closest("[data-match-id]");
  if (matchButton) { showMatch(matchButton.dataset.matchClub, matchButton.dataset.matchId); return; }
  const tabBtn = event.target.closest(".tab");
  if (tabBtn) {
    event.preventDefault();
    switchTab(tabBtn.dataset.tab);
    return;
  }

  const act = event.target.closest("[data-act]");
  if (act) {
    event.preventDefault();
    if (act.dataset.act === "tab") {
      if (act.dataset.newsView) state.newsView = act.dataset.newsView;
      switchTab(act.dataset.target);
    }
    return;
  }

  const newsTab = event.target.closest("[data-news-tab]");
  if (newsTab) {
    event.preventDefault();
    setNewsView(newsTab.dataset.newsTab);
    return;
  }

  const newsAct = event.target.closest("[data-news-act]");
  if (newsAct) {
    event.preventDefault();
    const kind = newsAct.dataset.newsAct;
    if (kind === "copy") copyWeekly();
    else if (kind === "telegram") sendTelegram();
    else if (kind === "retry-weekly") loadWeekly(true);
    else if (kind === "retry-football") loadFootball(true);
    return;
  }

  const catBtn = event.target.closest("[data-cat]");
  if (catBtn) {
    event.preventDefault();
    state.worldCat = catBtn.dataset.cat;
    renderNews();
    return;
  }

  const clubBtn = event.target.closest("[data-club]");
  if (clubBtn) {
    event.preventDefault();
    state.clubFilter = clubBtn.dataset.club;
    renderNews();
    return;
  }

  const wordTick = event.target.closest("[data-word-toggle]");
  if (wordTick) {
    event.preventDefault();
    toggleWord(wordTick.dataset.lang, wordTick.dataset.word);
    return;
  }

  const wordMode = event.target.closest("[data-word-mode]");
  if (wordMode) {
    event.preventDefault();
    state.wordMode = wordMode.dataset.wordMode;
    state.wordQuizIndex = 0;
    state.wordQuizRevealed = false;
    state.wordCurrentKey = null;
    state.wordQuizFeedback = null;
    renderCurrent();
    return;
  }

  const wordLang = event.target.closest("[data-word-lang]");
  if (wordLang) {
    event.preventDefault();
    state.wordLang = wordLang.dataset.wordLang;
    state.wordQuizIndex = 0;
    state.wordCurrentKey=null;
    state.wordQuizRevealed=false;
    state.wordQuizFeedback=null;
    renderCurrent();
    return;
  }

  const reveal = event.target.closest("[data-word-reveal]");
  if (reveal) {
    event.preventDefault();
    state.wordQuizRevealed = true;
    renderCurrent();
    return;
  }

  const answer = event.target.closest("[data-word-answer]");
  if (answer) {
    event.preventDefault();
    nextQuiz(answer.dataset.wordAnswer);
    return;
  }

  const option = event.target.closest("[data-word-option]");
  if (option) {
    event.preventDefault();
    chooseQuizOption(option.dataset.wordOption);
    return;
  }

  const speak = event.target.closest("[data-speak]");
  if (speak) {
    event.preventDefault();
    speakWord(speak.dataset.speak, speak.dataset.lang);
    return;
  }

  const wordAll = event.target.closest("[data-word-all]");
  if (wordAll) {
    event.preventDefault();
    markAllWords(wordAll.dataset.lang, wordAll.dataset.learn === "1");
    return;
  }

  const planTick = event.target.closest("[data-plan-toggle]");
  if (planTick) {
    event.preventDefault();
    togglePlan(planTick.dataset.planToggle);
    return;
  }

  const planDel = event.target.closest("[data-plan-del]");
  if (planDel) {
    event.preventDefault();
    removePlan(planDel.dataset.planDel);
    return;
  }

  const expDel = event.target.closest("[data-exp-del]");
  if (expDel) {
    event.preventDefault();
    removeExpense(expDel.dataset.expDel);
  }
});

document.addEventListener("input", (event) => {
  const search = event.target.closest("[data-word-search]");
  if (!search) return;
  state.wordQuery = search.value;
  state.wordCurrentKey=null;
  state.wordQuizRevealed=false;
  state.wordQuizIndex = 0;
  renderCurrent();
  const input = $("[data-word-search]");
  if (input) { input.focus(); input.setSelectionRange(state.wordQuery.length, state.wordQuery.length); }
});

document.addEventListener("submit", (event) => {
  if(event.target.id==='budget-form'){event.preventDefault();submitBudget(event.target);return;}
  if (event.target.id === "expense-form") {
    event.preventDefault();
    addExpense(event.target);
    return;
  }
  if (event.target.id === "plan-form") {
    event.preventDefault();
    addPlan(event.target);
  }
});

document.addEventListener("change", (event) => {
  if(event.target.matches('[data-study-import]')){importStudyBackup(event.target.files?.[0]);event.target.value='';return;}
  if (event.target.id === 'expense-currency') {
    state.expenseCurrency = event.target.value;
    writeCache('burgut.currency', state.expenseCurrency);
    renderExpenses();
    return;
  }
  const todo = event.target.closest("input[data-todo]");
  if (todo) {
    const text = todo.dataset.todo;
    const weekKey = String(state.weekly?.generatedAt || "").slice(0, 10);
    if (todo.checked) state.todo[text] = weekKey;
    else delete state.todo[text];
    writeCache("burgut.todo", state.todo);
    BurgutCloud.saveRecord('todo',text,{value:weekKey},!todo.checked).catch(error=>toast(error.message));
    todo.closest("li")?.classList.toggle("done", todo.checked);
  }
});

$("#btn-refresh").addEventListener("click", async () => {
  const icon = $("#btn-refresh");
  icon.classList.add("spin");
  try {
    if (state.tab === "news") {
      if (state.newsView === "football") {
        await loadFootball(true);
        toast(state.newsError.football ? `Yangilanmadi: ${state.newsError.football}` : "Yangilandi ✅");
      } else {
        await loadWeekly(true);
        if (state.newsError.weekly) toast(`Yangilanmadi: ${state.newsError.weekly}`);
        else if (state.weekly?.stale || state.weekly?.refreshError) toast(state.weekly.refreshError || "Qisman yangilandi");
        else toast("Yangilandi ✅");
      }
    } else {
      await loadAll();
      if (state.tab === "today") await loadWeekly(false);
      toast("Yangilandi ✅");
    }
  } finally {
    setTimeout(() => icon.classList.remove("spin"), 500);
  }
});

// ——————————————— Ishga tushirish ———————————————

(function init() {
  applyFarm();

  const NEWS_ALIAS = { weekly: "weekly", world: "world", football: "football", settings: "settings" };
  let hash = location.hash.replace("#", "");
  if (NEWS_ALIAS[hash]) {
    state.tab = "news";
    state.newsView = NEWS_ALIAS[hash];
    hash = "news";
    history.replaceState(null, "", "#news");
  }
  if (["today", "words", "expenses", "plans", "news"].includes(hash)) {
    state.tab = hash;
    $$(".tab").forEach((el) => el.classList.toggle("on", el.dataset.tab === hash));
    $$(".view").forEach((el) => el.classList.toggle("on", el.id === `view-${hash}`));
  }

  renderCurrent();
  loadAll();
  if (state.tab === "news" && state.newsView === "football") loadFootball(false);
  if (!state.weekly || state.tab === "news") loadWeekly(false);

  window.addEventListener("hashchange", () => {
    const raw = location.hash.replace("#", "");
    if (NEWS_ALIAS[raw]) {
      if (state.tab === "news") setNewsView(NEWS_ALIAS[raw]);
      else {
        state.newsView = NEWS_ALIAS[raw];
        switchTab("news");
      }
      return;
    }
    if (["today", "words", "expenses", "plans", "news"].includes(raw) && raw !== state.tab) switchTab(raw);
  });

  let currentDay = todayKey();
  const refreshPersonalView=()=>{
    if(state.studyBusy)return;
    syncStudy().then(()=>{
      if(['words','today'].includes(state.tab)&&!document.activeElement?.matches('input,textarea,select'))renderCurrent();
    });
  };
  window.addEventListener('online',refreshPersonalView);
  window.addEventListener('focus',refreshPersonalView);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.tab === "news" && state.newsView === "football") loadFootball(false);
    if (!document.hidden && state.tab === 'news' && state.newsView !== 'football') loadWeekly(false);
  });
  setInterval(() => {
    if(!document.hidden && state.tab==='words' && !state.studyBusy)syncStudy().then(()=>renderCurrent());
    if (!document.hidden && state.tab === "news" && state.newsView === "football") loadFootball(false);
    if (!document.hidden && state.tab === 'news' && state.newsView !== 'football' && Date.now() - new Date(state.weekly?.generatedAt || 0).getTime() >= 30 * 60 * 1000) loadWeekly(false);
    if (todayKey() !== currentDay) {
      currentDay = todayKey();
      renderCurrent();
      updateBadges();
    }
  }, 60_000);

  if ("serviceWorker" in navigator) {
    const host = location.hostname;
    const secure = location.protocol === "https:" || host === "localhost" || host === "127.0.0.1";
    if (secure) navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
