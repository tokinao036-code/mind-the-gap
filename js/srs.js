// SM-2 spaced repetition (SuperMemo 2): quality 0..5, ease factor >= 1.3.
import { S, save, today, addDays } from './store.js';

export const GRADES = [
  { q: 1, label: 'Не помню' },
  { q: 3, label: 'С трудом' },
  { q: 4, label: 'Помню' },
  { q: 5, label: 'Легко' },
];

export function sm2(c, q) {
  c.ef = c.ef ?? 2.5; c.reps = c.reps ?? 0; c.ivl = c.ivl ?? 0;
  if (q < 3) {
    c.reps = 0; c.ivl = 1; c.lapses = (c.lapses || 0) + 1;
  } else {
    c.ivl = c.reps === 0 ? 1 : c.reps === 1 ? 6 : Math.round(c.ivl * c.ef);
    c.reps++;
  }
  c.ef = Math.max(1.3, c.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  c.due = addDays(today(), c.ivl);
  c.last = today();
  return c;
}

/** New cards from a finished words step: first review tomorrow. */
export function addCard(id, type) {
  if (S.cards[id]) return;
  S.cards[id] = { type, ef: 2.5, reps: 0, ivl: 0, due: addDays(today(), 1), added: today() };
  save();
}

export function gradeCard(id, q) { sm2(S.cards[id], q); save(); }

export function dueCards() {
  const t = today();
  return Object.entries(S.cards).filter(([, c]) => c.due <= t).sort((a, b) => a[1].due.localeCompare(b[1].due)).map(([id]) => id);
}

/* ---------- mistakes: every wrong answer comes back through the review step ---------- */
export function addMistake(ex, dayId) {
  const m = S.mistakes[ex.id] || (S.mistakes[ex.id] = { day: dayId, n: 0, reps: 0, ef: 2.5, ivl: 0 });
  m.n++; m.fixed = false; m.reps = 0; m.ivl = 0; m.due = today(); m.last = today();
  save();
}
export function reviewMistake(id, ok) {
  const m = S.mistakes[id]; if (!m) return;
  sm2(m, ok ? 4 : 1);
  if (ok && m.reps >= 2) m.fixed = true; // twice right on separate reviews -> fixed
  save();
}
export function dueMistakes() {
  const t = today();
  return Object.entries(S.mistakes).filter(([, m]) => !m.fixed && (m.due || t) <= t).map(([id]) => id);
}
export function activeMistakes() {
  return Object.entries(S.mistakes).filter(([, m]) => !m.fixed).map(([id]) => id);
}
