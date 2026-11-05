// Burgut cloud adapter. Config server runtime env'dan keladi; key faylga yozilmaydi.
(() => {
  const SESSION_KEY = "burgut.supabase.session";
  const state = { configured: false, connected: false, error: null, userId: null };
  let configPromise = null;

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  }
  function saveSession(session) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* offline storage unavailable */ }
  }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
  }
  async function config() {
    if (!configPromise) {
      configPromise = fetch("/api/supabase-config", { cache: "no-store" })
        .then((res) => res.ok ? res.json() : { configured: false })
        .catch(() => ({ configured: false }));
    }
    const value = await configPromise;
    state.configured = Boolean(value.configured && value.url && value.anonKey);
    return value;
  }
  async function authSession(cfg) {
    const current = readSession();
    if (current?.access_token && current?.user?.id) {
      state.connected = true; state.userId = current.user.id; return current;
    }
    const response = await fetch(cfg.url.replace(/\/$/, "") + "/auth/v1/signup", {
      method: "POST",
      headers: { apikey: cfg.anonKey, "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token || !data.user?.id) {
      throw new Error(data.msg || data.error_description || data.message || "Supabase anonymous auth yoqilmagan");
    }
    saveSession(data);
    state.connected = true; state.userId = data.user.id;
    return data;
  }
  async function request(path, options = {}) {
    const cfg = await config();
    if (!state.configured) throw new Error("Supabase runtime sozlanmagan");
    const session = await authSession(cfg);
    const headers = { apikey: cfg.anonKey, Authorization: "Bearer " + session.access_token, ...options.headers };
    const response = await fetch(cfg.url.replace(/\/$/, "") + path, { ...options, headers });
    if (response.status === 401) { clearSession(); state.connected = false; }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || "Supabase so‘rovi bajarilmadi");
    return data;
  }
  function jsonOptions(method, body, extra = {}) {
    return { method, headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal", ...extra }, body: JSON.stringify(body) };
  }
  async function ready() {
    try { await config(); if (state.configured) await authSession(await config()); }
    catch (error) { state.error = error.message; state.connected = false; }
    return { ...state };
  }
  async function pushReview(review, card) {
    await ready();
    if (!state.connected) throw new Error(state.error || "Supabase ulanmagan");
    const parts = String(review.key).split("|");
    const lang = parts.shift();
    const word = parts.join("|");
    await request("/rest/v1/vocab_reviews", jsonOptions("POST", [{ id: review.id, user_id: state.userId, word_key: review.key, lang, word, rating: review.rating, reviewed_at: new Date().toISOString() }]));
    if (card) await request("/rest/v1/vocab_cards?on_conflict=user_id,word_key", jsonOptions("POST", [{ user_id: state.userId, word_key: review.key, lang, word, due_at: card.dueAt, interval_days: card.intervalDays, review_level: card.reviewLevel || 0, last_rating: card.lastRating, attempts: card.attempts, lapses: card.lapses, last_reviewed_at: card.lastReviewedAt }]));
  }
  async function pull() {
    await ready();
    if (!state.connected) return null;
    const cards = await request("/rest/v1/vocab_cards?select=word_key,lang,word,due_at,interval_days,review_level,last_rating,attempts,lapses,last_reviewed_at");
    const budgets = await request("/rest/v1/budgets?select=month,currency,spending_limit,income,updated_at");
    return { cards: Array.isArray(cards) ? cards : [], budgets: Array.isArray(budgets) ? budgets : [] };
  }
  async function pushBudget(month, currency, budget) {
    await ready();
    if (!state.connected) throw new Error(state.error || "Supabase ulanmagan");
    await request("/rest/v1/budgets?on_conflict=user_id,month,currency", jsonOptions("POST", [{ user_id: state.userId, month: month + "-01", currency, spending_limit: budget.limit, income: budget.income, updated_at: new Date().toISOString() }]));
  }
  window.BurgutCloud = { ready, pull, pushReview, pushBudget, status: () => ({ ...state }) };
})();
