// All user data lives in one localStorage key; export/import moves it as a single JSON file.

const KEY = 'mtg.v1';
const DEFAULT = () => ({
  v: 1,
  settings: { theme: 'auto', accent: 'gb', rate: 1, autoplay: true },
  days: {},        // dayId -> { steps: {review, words, grammar, text, writing}: iso, done: iso, score: {grammar: [c, t], text: [c, t]} }
  cards: {},       // cardId -> SM-2 state
  custom: {},      // lemma -> { en, ru, ipa, rt, pos, from }  (words added from texts)
  stats: {},       // topic -> { a: attempts, c: correct }
  mistakes: {},    // exerciseId -> { day, n, reps, ef, ivl, due, fixed, last }
  answers: [],     // free answers: writing + translations
  tests: {},       // 'w1' -> { score, total, date }
  activity: {},    // 'YYYY-MM-DD' -> steps finished that day
  stories: {},     // story id -> date read (Тексты tab)
  started: null,
});

export let S = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(DEFAULT(), JSON.parse(raw));
  } catch (e) { /* private mode or corrupted data: start clean */ }
  return DEFAULT();
}

function merge(base, data) {
  for (const k of Object.keys(base)) {
    if (data[k] === undefined) continue;
    base[k] = (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) ? { ...base[k], ...data[k] } : data[k];
  }
  return base;
}

let t;
export function save(now = false) {
  clearTimeout(t);
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('save failed', e); } };
  if (now) write(); else t = setTimeout(write, 150);
}
window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });

export function today(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return today(new Date(y, m - 1, d + n));
}

export function markActivity() {
  const k = today();
  S.activity[k] = (S.activity[k] || 0) + 1;
  if (!S.started) S.started = k;
  save();
}

export function dayState(id) {
  return S.days[id] || (S.days[id] = { steps: {}, score: {} });
}

export function stepDone(dayId, step, score) {
  const d = dayState(dayId);
  const first = !d.steps[step];
  d.steps[step] = d.steps[step] || new Date().toISOString();
  if (score) d.score[step] = score;
  if (first) markActivity();
  if (['review', 'words', 'grammar', 'text', 'writing'].every(s => d.steps[s]) && !d.done) d.done = new Date().toISOString();
  save();
}

export function recordTopic(topic, ok) {
  if (!topic) return;
  const s = S.stats[topic] || (S.stats[topic] = { a: 0, c: 0 });
  s.a++; if (ok) s.c++;
  save();
}

export function streak() {
  let n = 0, d = today();
  if (!S.activity[d]) d = addDays(d, -1); // today not started yet: the streak is still alive
  while (S.activity[d]) { n++; d = addDays(d, -1); }
  return n;
}
export function bestStreak() {
  const days = Object.keys(S.activity).sort();
  let best = 0, cur = 0, prev = null;
  for (const d of days) { cur = prev && addDays(prev, 1) === d ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
  return best;
}

export function exportJSON() {
  return JSON.stringify({ app: 'mind-the-gap', exported: new Date().toISOString(), data: S }, null, 1);
}
export function importJSON(text) {
  const obj = JSON.parse(text);
  const data = obj && obj.app === 'mind-the-gap' ? obj.data : obj;
  if (!data || typeof data !== 'object' || !data.settings) throw new Error('Это не резервная копия Mind the Gap');
  S = merge(DEFAULT(), data);
  save(true);
}
export function resetAll() {
  const keep = S.settings;
  S = DEFAULT(); S.settings = keep; save(true);
}
