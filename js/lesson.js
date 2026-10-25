// Full-screen lesson flow: the five steps of a day, grammar practice and mistake review.
import { h, icon, html, inline, mascot, toast, plural, copyText } from './ui.js';
import { D, courseIndex } from './data.js';
import { S, save, stepDone, recordTopic, today } from './store.js';
import { say, sequence, stop } from './audio.js';
import { wordCard, phraseCard, customCard, cardById, tappable, playBtn, speedChip, posName, lessonWordsText, storyText } from './cards.js';
import { renderExercise, feedback } from './exercises.js';
import { addCard, gradeCard, dueCards, dueMistakes, addMistake, reviewMistake, activeMistakes, sm2, GRADES } from './srs.js';
import { pretty } from './check.js';

export const STEPS = [
  { key: 'review', title: 'Повторение', min: 10 },
  { key: 'words', title: 'Новые слова и фразы', min: 15 },
  { key: 'grammar', title: 'Грамматика', min: 15 },
  { key: 'text', title: 'Reading', min: 10 },
  { key: 'writing', title: 'Writing', min: 5 },
];
export const stepTitle = (day, key) => key === 'text' ? (day.text.kind === 'listening' ? 'Listening' : 'Reading') : STEPS.find(s => s.key === key).title;

let refresher = () => {};
export function setRefresher(fn) { refresher = fn; }

/* ---------- overlay ---------- */
function openLesson(title) {
  const bar = h('i');
  const counter = h('span.label');
  const body = h('div.body');
  const foot = h('div.foot');
  const closeBtn = h('button.icon-btn', { 'aria-label': 'Закрыть', html: icon('close') });
  const top = h('div.top', closeBtn, h('div.bar', bar), counter);
  const el = h('div.lesson', h('div.wrap', top, body, foot));
  document.body.append(el);
  const L = {
    el, body, foot,
    show(...kids) { stop(); body.replaceChildren(h('div.screen', kids)); body.scrollTop = 0; },
    append(node) { body.querySelector('.screen')?.append(node); requestAnimationFrame(() => node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })); },
    buttons(...btns) { foot.replaceChildren(...btns.filter(Boolean)); },
    progress(frac, label = '') { bar.style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%'; counter.textContent = label; },
    close() { stop(); el.remove(); refresher(); },
  };
  closeBtn.onclick = () => L.close();
  return L;
}

const btn = (label, onclick, cls = '') => h('button.btn', { class: cls, onclick }, label);

/* ---------- exercise runner ---------- */
function saveAnswer(kind, dayId, task, answer, model, ref) {
  const d = D.byId[dayId];
  S.answers.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(), week: d ? d.week : null, day: d ? d.day : null, dayId,
    kind, task, answer, model, review: '', done: false, ref,
  });
  save();
}

/**
 * mode: 'day' | 'practice' (wrong -> «Мои ошибки») | 'mistakes' (re-asking mistakes) | 'vocab' (no mistakes kept)
 */
function runExercises(L, list, { mode = 'day', dayId, label = '', onFinish, lastLabel = 'Результат' }) {
  let i = 0, correct = 0;
  const results = [];
  function next() {
    if (i >= list.length) return onFinish(correct, list.length, results);
    const ex = list[i];
    L.progress(i / list.length, `${label}${i + 1}/${list.length}`);
    let answered = false;
    const w = renderExercise(ex, r => {
      if (answered) return; answered = true;
      if (r.ok) correct++;
      results.push({ ex, ...r });
      if (ex.topic) recordTopic(ex.topic, r.ok);
      const exDay = (D.ex[ex.id] && D.ex[ex.id].day) || dayId;
      if (mode === 'mistakes') reviewMistake(ex.id, r.ok);
      else if (!r.ok && mode !== 'vocab' && !ex.noMistake && ex.id) addMistake(ex, exDay);
      if (ex.t === 'tr') saveAnswer('translation', exDay, `Переведи на английский: «${ex.ru}»`, r.user, pretty(ex.a[0], '.'), ex.id);
      if (ex.onResult) ex.onResult(r.ok);
      L.append(feedback(ex, r));
      i++;
      L.buttons(btn(i >= list.length ? lastLabel : 'Дальше', next));
    });
    L.show(w.el);
    if (w.needsButton) {
      const b = btn('Проверить', () => w.submit());
      b.disabled = true;
      w.onReady = () => { b.disabled = !w.ready(); };
      L.buttons(b);
      w.focus && w.focus();
    } else L.buttons();
    w.autoplay && w.autoplay();
  }
  next();
}

function resultScreen(L, c, t, title, text) {
  const pct = t ? Math.round(c / t * 100) : 100;
  L.progress(1, '');
  L.show(
    h('div.empty', h('div.art', { html: mascot(pct >= 70 ? 'party' : 'think') }),
      h('div.label', title),
      h('div.bignum.mt8', `${c}/${t}`),
      h('p.muted.mt8', text || (pct >= 85 ? 'Отлично!' : pct >= 70 ? 'Хорошо. Ошибки вернутся на повторение.' : 'Ошибки сохранены в «Мои ошибки» и вернутся в повторение.'))),
  );
}

/* ---------- day steps ---------- */
export function openDay(dayId, stepKey) {
  const day = D.byId[dayId];
  const L = openLesson();
  const run = { review: stepReview, words: stepWords, grammar: stepGrammar, text: stepText, writing: stepWriting }[stepKey];
  run(L, day, () => afterStep(L, day, stepKey));
}

function afterStep(L, day, key) {
  const st = S.days[day.id] || { steps: {} };
  const nextKey = STEPS.map(s => s.key).find(k => !st.steps[k]);
  if (!nextKey) return dayComplete(L, day);
  L.progress(1, '');
  L.show(h('div.empty', h('div.art', { html: mascot('wave') }),
    h('div.label', 'Шаг готов'),
    h('div.h2.mt8', stepTitle(day, key)),
    h('p.muted.mt8', `Дальше: ${stepTitle(day, nextKey)}`)));
  L.buttons(btn(`Продолжить: ${stepTitle(day, nextKey)}`, () => {
    const run = { review: stepReview, words: stepWords, grammar: stepGrammar, text: stepText, writing: stepWriting }[nextKey];
    run(L, day, () => afterStep(L, day, nextKey));
  }), h('button.link.center', { onclick: () => L.close() }, 'К плану дня'));
}

function dayComplete(L, day) {
  const st = S.days[day.id];
  const g = st.score.grammar, t = st.score.text;
  L.progress(1, '');
  L.show(h('div.empty', h('div.art', { html: mascot('party') }),
    h('div.label', `Неделя ${day.week} · день ${day.day}`),
    h('div.h-display.mt8', 'День пройден'),
    h('p.muted.mt16', `+${day.words.length} слов и ${day.phrases.length} фраз в повторении.`),
    g ? h('p.muted', `Грамматика: ${g[0]}/${g[1]}${t ? ` · ${day.text.kind === 'listening' ? 'Listening' : 'Reading'}: ${t[0]}/${t[1]}` : ''}`) : null));
  L.buttons(btn('Готово', () => L.close()));
}

/* 1. Review: due cards (SM-2) + due mistakes */
function stepReview(L, day, done) {
  const cards = dueCards().slice(0, 40);
  const mist = dueMistakes().filter(id => D.ex[id]).slice(0, 15);
  if (!cards.length && !mist.length) {
    L.progress(1, '');
    L.show(h('div.empty', h('div.art', { html: mascot('sleep') }),
      h('div.h2', 'Повторять пока нечего'),
      h('p.muted.mt8', 'Слова из уроков приходят на повторение на следующий день, а ошибки — сразу. Сегодня этот шаг засчитан.')));
    L.buttons(btn('Дальше', () => { stepDone(day.id, 'review'); done(); }));
    return;
  }
  reviewSession(L, cards, mist, () => { stepDone(day.id, 'review'); done(); });
}

function reviewSession(L, cardIds, mistakeIds, finish) {
  const queue = cardIds.map(id => ({ kind: 'card', id })).concat(mistakeIds.map(id => ({ kind: 'mistake', id })));
  const total = queue.length;
  let n = 0, again = new Set();
  function next() {
    if (!queue.length) {
      resultScreen(L, n, n, 'Повторение', `Повторено: ${n}. Следующие повторы — по расписанию SM-2.`);
      L.buttons(btn('Дальше', finish));
      return;
    }
    const it = queue.shift();
    L.progress(n / total, `${Math.min(n + 1, total)}/${total}`);
    if (it.kind === 'mistake') {
      const ex = D.ex[it.id].ex;
      runExercises(L, [ex], { mode: 'mistakes', label: 'ошибка · ', lastLabel: 'Дальше', onFinish: () => { n++; next(); } });
      return;
    }
    const c = cardById(it.id), st = S.cards[it.id];
    if (!c || !st) { n++; return next(); }
    const en = c.data.en, ru = c.data.ru;
    const reverse = st.reps >= 2; // older cards: recall the English yourself
    const front = h('div.flash',
      h('div.label', reverse ? 'Вспомни по-английски' : 'Вспомни перевод'),
      reverse ? h('div.hintru', ru) : h('div.big', en),
      reverse ? null : playBtn(en));
    L.show(front);
    if (!reverse && S.settings.autoplay) say(en);
    L.buttons(btn('Показать ответ', () => {
      const card = c.kind === 'w' ? wordCard(c.data) : c.kind === 'p' ? phraseCard(c.data) : customCard(c.data);
      L.show(card);
      if (reverse && S.settings.autoplay) say(en);
      const grades = h('div.grades', GRADES.map(g => {
        const preview = sm2({ ...st }, g.q).ivl;
        return h('button', { onclick: () => {
          gradeCard(it.id, g.q);
          if (g.q < 3 && !again.has(it.id)) { again.add(it.id); queue.push(it); }
          else n++;
          next();
        } }, g.label, h('small', `${preview} д`));
      }));
      L.buttons(grades);
    }));
  }
  next();
}

/* 2. New words: 15 cards, 5 phrases, confusables, quick check */
function stepWords(L, day, done) {
  const items = [...day.words.map(w => ({ k: 'w', d: w })), ...day.phrases.map(p => ({ k: 'p', d: p }))];
  let i = 0;
  const total = items.length + 2;
  function card() {
    if (i >= items.length) return confusable();
    const it = items[i];
    L.progress(i / total, it.k === 'w' ? `слово ${i + 1}/${day.words.length}` : `фраза ${i - day.words.length + 1}/${day.phrases.length}`);
    L.show(it.k === 'w' ? wordCard(it.d) : phraseCard(it.d));
    if (S.settings.autoplay) say(it.d.en);
    L.buttons(h('div.row', i > 0 ? h('button.btn.ghost', { style: 'width:auto;padding:0 20px', onclick: () => { i--; card(); }, 'aria-label': 'Назад', html: icon('back') }) : null,
      btn(i === items.length - 1 ? 'Похожие слова' : 'Дальше', () => { i++; card(); })));
  }
  function confusable() {
    const c = day.confusable;
    L.progress(items.length / total, 'похожие слова');
    L.show(
      h('div.label', 'Похожие слова'),
      h('div.h2.mt8', c.title),
      h('div.list.mt16', c.items.map(it => h('div', { style: 'padding:16px 0' },
        h('div.row', h('div.grow', h('span.h3', it.en), ' ', h('span.ipa', `/${it.ipa}/`), ' ', h('span.rt', `[${it.rt}]`)), playBtn(it.en, { cls: 'sm' })),
        h('div.mt8', { style: 'font-weight:700' }, it.ru),
        h('div.row.mt8', { style: 'align-items:flex-start' }, h('div.grow', tappable(it.ex[0], 'div'), h('div.small.muted', it.ex[1])), playBtn(it.ex[0], { cls: 'sm' }))))),
      h('div.note.mt16', { class: '', style: 'padding:12px 16px;border-left:2px solid var(--accent);background:var(--accent-soft);border-radius:0 8px 8px 0', html: inline(c.rule) }),
    );
    L.buttons(btn('Проверить себя', () => runExercises(L, c.quiz, { dayId: day.id, label: 'похожие · ', onFinish: quick })));
  }
  function quick() {
    // add everything to the deck; the quick check makes forgotten ones due today
    day.words.forEach(w => addCard(w.id, 'w'));
    day.phrases.forEach(p => addCard(p.id, 'p'));
    const pool = day.words.slice().sort(() => Math.random() - .5).slice(0, 6).map(w => ({ k: 'w', d: w, dir: 'en' }))
      .concat(day.phrases.slice().sort(() => Math.random() - .5).slice(0, 3).map(p => ({ k: 'p', d: p, dir: 'ru' })));
    const list = pool.map(({ d, dir }) => {
      const same = (dir === 'en' ? day.words : day.phrases).filter(x => x.id !== d.id).sort(() => Math.random() - .5).slice(0, 3);
      const opts = [d, ...same].sort(() => Math.random() - .5);
      return {
        t: 'mc', id: d.id + '-q', topic: 'vocab', noMistake: true,
        q: dir === 'en' ? d.en : d.ru,
        opts: opts.map(o => dir === 'en' ? o.ru.split(';')[0] : o.en),
        a: opts.indexOf(d),
        ex: `${d.en} — ${d.ru}`,
        onResult: ok => { if (!ok) { S.cards[d.id].due = today(); save(); } },
      };
    });
    runExercises(L, list, { mode: 'vocab', dayId: day.id, label: 'слова · ', onFinish: (c, t) => {
      resultScreen(L, c, t, 'Проверка слов', c === t ? 'Все слова узнаны. Первое повторение — завтра.' : 'Слова с ошибками придут на повторение уже сегодня.');
      L.buttons(btn('Дальше', () => { stepDone(day.id, 'words'); done(); }),
        h('button.link.center', { onclick: async () => toast((await copyText(lessonWordsText(day))) ? 'Слова урока скопированы' : 'Не удалось скопировать') }, 'Скопировать слова урока'));
    } });
  }
  card();
}

/* 3. Grammar */
export function grammarBlocks(g) {
  return h('div.gb', g.blocks.map(b => {
    if (b.b === 'p') return h('p', { html: inline(b.text) });
    if (b.b === 'rule') return h('div.rule', h('h4', b.title), h('div', { html: inline(b.text) }));
    if (b.b === 'warn') return h('div.warn', { html: inline(b.text) });
    if (b.b === 'sub') return h('h3.gsub', b.text);
    if (b.b === 'ul') return h('ul.gul', b.items.map(x => h('li', { html: inline(x) })));
    if (b.b === 'why') return h('div.why', h('div.label', 'Почему так'), h('div.mt8', { html: inline(b.text) }));
    if (b.b === 'eg') return h('div.eg', h('div.grow', tappable(b.en, 'div.en2'), h('div.ru', b.ru)), playBtn(b.en, { cls: 'sm' }));
    if (b.b === 'table') return h('div.tblwrap', h('table.tbl',
      b.head ? h('thead', h('tr', b.head.map(x => h('th', x)))) : null,
      h('tbody', b.rows.map(r => h('tr', r.map(x => h('td', { class: /^✗/.test(x) ? 'wrong' : /^✓/.test(x) ? 'right' : '', html: inline(x) })))))));
    return null;
  }));
}

function stepGrammar(L, day, done) {
  const ex = day.grammar.exercises;
  L.progress(0, '');
  L.show(h('div.label', day.test ? `Неделя ${day.week} · проверка` : 'Грамматика'), h('div.h2.mt8', day.grammarTitle), h('div.mt16', grammarBlocks(day.grammar)));
  L.buttons(btn(day.test ? `Начать проверку · ${ex.length}` : `К упражнениям · ${ex.length}`, () => runExercises(L, ex, { dayId: day.id, onFinish: (c, t) => {
    if (day.test) { S.tests['w' + day.week] = { score: c, total: t, date: today() }; save(); }
    resultScreen(L, c, t, day.test ? `Проверка недели ${day.week}` : 'Грамматика');
    L.buttons(btn('Дальше', () => { stepDone(day.id, 'grammar', [c, t]); done(); }));
  } })));
}

/* 4. Reading / Listening + dictation */
function stepText(L, day, done) {
  const t = day.text;
  const qs = [...t.questions, ...(t.dictation || [])];
  const toQuestions = () => runExercises(L, qs, { dayId: day.id, onFinish: (c, n) => {
    resultScreen(L, c, n, t.kind === 'listening' ? 'Listening' : 'Reading');
    L.buttons(btn('Дальше', () => { stepDone(day.id, 'text', [c, n]); done(); }));
  } });
  L.progress(0, '');
  const cover = day.img ? h('img.ph-img.mt16', { src: day.img, alt: '', referrerpolicy: 'no-referrer', onerror: e => e.target.remove() }) : null;
  if (t.kind === 'reading') {
    const paras = t.body.map(p => tappable(p, 'p.para'));
    const listen = h('button.play', { 'aria-label': 'Слушать текст', html: icon('play') });
    listen.onclick = () => sequence(t.body.map(p => [p, 'f']), { btn: listen, onLine: k => paras.forEach((p, j) => p.classList.toggle('cur', j === k)) });
    L.show(h('div.label', 'Reading'), h('div.h2.mt8', t.title), h('p.small.muted.mt8', t.intro), cover,
      h('div.row.mt16', listen, h('span.small.muted.grow', 'Послушать текст'), speedChip()),
      h('div.hr'), h('div', paras));
  } else {
    const lines = t.lines.map(([who, , line]) => h('div.line', h('span.who', who), tappable(line)));
    const transcript = h('div.mt16', { hidden: true }, lines);
    const big = h('button.play.big', { 'aria-label': 'Слушать', html: icon('play') });
    const status = h('div.label.mt16', `${t.lines.length} реплик`);
    big.onclick = () => sequence(t.lines.map(([, v, line]) => [line, v]), { btn: big, onLine: k => {
      lines.forEach((l, j) => l.classList.toggle('cur', j === k));
      status.textContent = k >= 0 ? `реплика ${k + 1} из ${t.lines.length}` : 'Послушай ещё раз, если нужно';
    } });
    const show = h('button.btn.ghost.mt24', { html: icon('eye') + 'Показать текст' });
    show.onclick = () => { transcript.hidden = !transcript.hidden; show.innerHTML = icon('eye') + (transcript.hidden ? 'Показать текст' : 'Скрыть текст'); };
    L.show(h('div.label', 'Listening'), h('div.h2.mt8', t.title), h('p.small.muted.mt8', t.intro), cover,
      h('div.center.mt32', h('div', { style: 'display:inline-block' }, big), status, h('div.mt16', speedChip())),
      show, transcript);
  }
  L.buttons(btn(`К вопросам · ${qs.length}`, toQuestions));
}

/* 5. Writing */
function stepWriting(L, day, done) {
  const w = day.writing;
  const draftKey = 'mtg.draft.' + w.id;
  let draft = ''; try { draft = localStorage.getItem(draftKey) || ''; } catch (e) {}
  const ta = h('textarea.field.mt16', { rows: 7, placeholder: 'Пиши по-английски…', autocapitalize: 'sentences', spellcheck: 'false', 'aria-label': 'Твой текст' });
  ta.value = draft;
  const words = () => (ta.value.match(/[A-Za-z']+/g) || []).length;
  const count = h('div.tiny.muted.mt8');
  const b = btn('Сохранить ответ', () => submit());
  const upd = () => { count.textContent = `${words()} ${plural(words(), 'слово', 'слова', 'слов')}`; b.disabled = words() < 8; try { localStorage.setItem(draftKey, ta.value); } catch (e) {} };
  ta.addEventListener('input', upd);
  L.progress(0, '');
  L.show(h('div.label', 'Writing'), h('div.h3.mt8', w.task), h('p.small.muted.mt8', w.hint), ta, count);
  upd();
  L.buttons(b);
  function submit() {
    const text = ta.value.trim();
    saveAnswer('writing', day.id, w.task, text, w.model, w.id);
    try { localStorage.removeItem(draftKey); } catch (e) {}
    const checks = w.checks.map(c => {
      let n = 0;
      try { n = (text.match(new RegExp(c.re, 'gim')) || []).length; } catch (e) {}
      return { label: c.label, ok: n >= c.n };
    });
    const model = h('div.model', { hidden: true }, h('div.row', { style: 'align-items:flex-start' }, tappable(w.model, 'div.grow'), playBtn(w.model, { cls: 'sm' })));
    const mBtn = h('button.btn.ghost.mt16', { onclick: () => { model.hidden = !model.hidden; mBtn.textContent = model.hidden ? 'Показать образец' : 'Скрыть образец'; } }, 'Показать образец');
    L.progress(1, '');
    L.show(h('div.label', 'Ответ сохранён во вкладке «Ответы»'), h('div.h3.mt8', 'Самопроверка'),
      h('ul.checks', checks.map(c => h('li', { class: c.ok ? '' : 'miss' }, h('span.check', { class: c.ok ? 'on' : '', html: icon('check') }), c.label))),
      h('div.model.learn', { style: 'white-space:pre-wrap' }, text),
      mBtn, model,
      h('p.tiny.muted.mt16', 'Автопроверка смотрит только на нужные конструкции. Полный разбор можно вставить во вкладке «Ответы».'));
    L.buttons(btn('Готово', () => { stepDone(day.id, 'writing'); done(); }));
  }
}

/* ---------- from the Grammar tab ---------- */
export function openGrammar(dayId) {
  const day = D.byId[dayId];
  const L = openLesson();
  L.progress(0, '');
  L.show(h('div.label', `Неделя ${day.week} · день ${day.day}`), h('div.h2.mt8', day.grammarTitle), h('div.mt16', grammarBlocks(day.grammar)));
  L.buttons(btn(`Потренироваться · ${day.grammar.exercises.length}`, () => runExercises(L, day.grammar.exercises, { mode: 'practice', dayId, onFinish: (c, t) => {
    resultScreen(L, c, t, 'Тренировка');
    L.buttons(btn('Готово', () => L.close()));
  } })));
}

/* ---------- «Тексты»: dialogue / text with a line-by-line translation ---------- */
export function openStory(dayId, idx, L) {
  const day = D.byId[dayId];
  const st = day.stories[idx];
  L = L || openLesson();
  L.progress((idx + 1) / day.stories.length, `${idx + 1}/${day.stories.length}`);
  const isDlg = st.kind === 'dialogue';
  const rows = isDlg ? st.lines.map(([who, v, en, ru]) => ({ who, v, en, ru })) : st.paras.map(([en, ru]) => ({ who: '', v: 'f', en, ru }));
  const els = rows.map(r => h('div.sline', { class: isDlg ? 'dlg' : 'txt' },
    isDlg ? h('div.who', r.who) : null,
    h('div.grow',
      h('div.row', { style: 'align-items:flex-start' }, h('div.grow', storyText(r.en, day, 'div.en-line')), playBtn(r.en, { v: r.v, cls: 'sm' })),
      h('div.ru-line', r.ru))));
  const list = h('div.slist', { class: S.settings.storyTr === false ? 'no-tr' : '' }, els);
  const trBtn = h('button.chip', { class: S.settings.storyTr === false ? '' : 'on' }, 'Перевод');
  trBtn.onclick = () => {
    S.settings.storyTr = S.settings.storyTr === false; save();
    list.classList.toggle('no-tr', S.settings.storyTr === false); trBtn.classList.toggle('on', S.settings.storyTr !== false);
  };
  const all = h('button.play', { 'aria-label': 'Слушать всё', html: icon('play') });
  all.onclick = () => sequence(rows.map(r => [r.en, r.v]), { btn: all, onLine: k => els.forEach((e, j) => e.classList.toggle('cur', j === k)) });
  L.show(
    h('div.label', `${isDlg ? 'Диалог' : 'Текст'} · день ${courseIndex(day)} · ${day.title}`),
    h('div.h2.mt8', st.title),
    st.intro ? h('p.small.muted.mt8', st.intro) : null,
    h('div.row.mt16', all, h('span.small.muted.grow', 'Слушать всё'), speedChip(), trBtn),
    h('p.tiny.muted.mt8', { html: '<span class="lg nw">слова урока</span> · <span class="lg ow">слова прошлых уроков</span> · <span class="lg np">фразы урока</span> · нажми на любое слово' }),
    h('div.mt16', list));
  const last = idx >= day.stories.length - 1;
  L.buttons(btn(last ? 'Готово' : 'Следующий текст', () => {
    S.stories = S.stories || {};
    S.stories[st.id] = today(); save();
    if (last) L.close(); else openStory(dayId, idx + 1, L);
  }));
}

export function openMistakes() {
  const ids = activeMistakes().filter(id => D.ex[id]);
  if (!ids.length) { toast('Активных ошибок нет'); return; }
  const L = openLesson();
  runExercises(L, ids.map(id => D.ex[id].ex), { mode: 'mistakes', label: 'ошибки · ', onFinish: (c, t) => {
    resultScreen(L, c, t, 'Мои ошибки', 'Ошибка считается исправленной после двух верных ответов в разные дни.');
    L.buttons(btn('Готово', () => L.close()));
  } });
}

export function openReviewOnly() {
  const cards = dueCards().slice(0, 40), mist = dueMistakes().filter(id => D.ex[id]).slice(0, 15);
  if (!cards.length && !mist.length) { toast('На сегодня всё повторено'); return; }
  const L = openLesson();
  reviewSession(L, cards, mist, () => L.close());
}
