// Course content (app/data/*.json, built from content/*.py by tools/build.py).

export const D = { course: null, lex: {}, tok: {}, days: [], byId: {}, cards: {}, ex: {} };

export async function loadData() {
  const get = async p => (await fetch(p)).json();
  const [course, gl] = await Promise.all([get('data/course.json'), get('data/glossary.json')]);
  D.course = course; D.lex = gl.lex; D.tok = gl.tok;
  const weeks = await Promise.all(course.open.map(n => get(`data/w${n}.json`)));
  for (const w of weeks) for (const d of w.days) {
    D.days.push(d); D.byId[d.id] = d;
    for (const x of d.words) D.cards[x.id] = { kind: 'w', day: d.id, data: x };
    for (const x of d.phrases) D.cards[x.id] = { kind: 'p', day: d.id, data: x };
    const reg = (e, src) => { D.ex[e.id] = { ex: e, day: d.id, src }; };
    d.grammar.exercises.forEach(e => reg(e, 'grammar'));
    d.confusable.quiz.forEach(e => reg(e, 'words'));
    d.text.questions.forEach(e => reg(e, 'text'));
    (d.text.dictation || []).forEach(e => reg(e, 'text'));
  }
}

export const totalDays = () => D.course.weeks.reduce((n, w) => n + (w.days || 6), 0);

/** Global index of a day in the whole course (1-based). */
export function courseIndex(day) {
  let n = 0;
  for (const w of D.course.weeks) { if (w.n === day.week) return n + day.day; n += w.days || 6; }
  return day.day;
}

/** Tapped token -> { entry, lemma, form } */
export function lookup(token) {
  const low = token.toLowerCase().replace(/’/g, "'");
  const lemma = D.tok[low] || low;
  const entry = D.lex[lemma] || D.lex[low];
  return { entry, lemma, form: lemma !== low ? low : null };
}
