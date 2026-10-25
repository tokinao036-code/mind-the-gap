// Tab screens: Today, Words, Grammar, Answers, Progress + the settings sheet.
import { h, icon, html, inline, mascot, sheet, toast, copyText, confirmSheet, plural, esc } from './ui.js';
import { D, courseIndex, totalDays } from './data.js';
import { S, save, streak, bestStreak, today, addDays, exportJSON, importJSON, resetAll } from './store.js';
import { STEPS, stepTitle, openDay, openGrammar, openMistakes, openReviewOnly, grammarBlocks, openStory } from './lesson.js';
import { openCard, tappable, playBtn, customCard, wordCard, lessonWordsText } from './cards.js';
import { dueCards, dueMistakes, activeMistakes } from './srs.js';
import { pretty } from './check.js';
import { allFiles } from './audio.js';

const ui = { day: null, wordsSeg: 'w', q: '', ansFilter: 'all' };

function currentDay() {
  if (ui.day && D.byId[ui.day]) return D.byId[ui.day];
  return D.days.find(d => !(S.days[d.id] && S.days[d.id].done)) || D.days[D.days.length - 1];
}
const fmtDate = iso => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`; };

/* ================= TODAY ================= */
export function renderToday() {
  const day = currentDay();
  const st = S.days[day.id] || { steps: {}, score: {} };
  const nextKey = STEPS.map(s => s.key).find(k => !st.steps[k]);
  const doneCount = STEPS.filter(s => st.steps[s.key]).length;
  const dueN = dueCards().length + dueMistakes().length;
  const pose = { review: 'wave', words: 'read', grammar: 'think', text: day.text.kind === 'listening' ? 'listen' : 'read', writing: 'write' }[nextKey] || 'party';

  const hero = h('div.hero',
    h('div',
      h('div.label', `Неделя ${day.week} · день ${courseIndex(day)} из ${totalDays()}`),
      h('div.h-display.mt8', day.title),
      h('div.muted.mt8', day.grammarTitle)),
    h('div.art', { html: mascot(pose) }));
  const cover = day.img ? h('img.ph-img.cover', { src: day.img, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: e => e.target.remove() }) : null;

  const stats = h('div.stats',
    h('div', h('div.v', streak()), h('div.k', plural(streak(), 'день подряд', 'дня подряд', 'дней подряд'))),
    h('div', h('div.v', Object.keys(S.cards).length), h('div.k', 'карточек в колоде')),
    h('div', h('div.v', `${doneCount}/5`), h('div.k', 'шагов дня')));

  const sub = {
    review: dueN ? `${dueN} на повторении · 10 мин` : 'Сегодня повторять нечего',
    words: `${day.words.length} слов · ${day.phrases.length} фраз · 15 мин`,
    grammar: `${day.grammar.exercises.length} ${day.test ? 'заданий проверки' : 'упражнений'} · 15 мин`,
    text: `«${day.text.title}» · 10 мин`,
    writing: '3–5 предложений · 5 мин',
  };
  const steps = h('div.list.mt16', STEPS.map((s, i) => {
    const on = !!st.steps[s.key];
    return h('button.item', { class: s.key === nextKey ? 'current' : '', onclick: () => openDay(day.id, s.key) },
      h('span.num', String(i + 1).padStart(2, '0')),
      h('div.grow', h('div.t', s.key === 'grammar' ? `Грамматика${day.test ? ': проверка недели' : ''}` : stepTitle(day, s.key)), h('div.s', sub[s.key])),
      h('span.check', { class: on ? 'on' : '', html: icon('check') }));
  }));

  let main;
  if (nextKey) main = h('button.btn.mt16', { onclick: () => openDay(day.id, nextKey) }, doneCount ? `Продолжить: ${stepTitle(day, nextKey)}` : 'Начать день');
  else {
    const nd = D.days[D.days.indexOf(day) + 1];
    main = nd ? h('button.btn.mt16', { onclick: () => { ui.day = nd.id; rerender(); } }, `К дню ${courseIndex(nd)}: ${nd.title}`)
      : h('button.btn.mt16', { onclick: openReviewOnly }, dueN ? `Повторить (${dueN})` : 'Неделя пройдена');
  }

  // every open week gets its own row of day buttons
  const strips = D.course.open.map(wn => h('div.mt24',
    h('div.label', `Неделя ${wn}: ${D.course.weeks[wn - 1].title}`),
    h('div.days.mt8', D.days.filter(d => d.week === wn).map(d => h('button', {
      class: [(S.days[d.id] && S.days[d.id].done) ? 'done' : '', d.id === day.id ? 'cur' : ''].join(' '),
      'aria-label': `Неделя ${wn}, день ${d.day}`, onclick: () => { ui.day = d.id; rerender(); },
    }, courseIndex(d))))));

  const extra = !nextKey || dueN === 0 ? null : null;
  return h('div.page', hero, cover, h('div', { class: cover ? 'mt16' : '' }, stats), main, steps,
    h('div.mt8', strips),
    dueN && st.steps.review ? h('button.btn.ghost.mt16', { onclick: openReviewOnly }, `Ещё повторение (${dueN})`) : extra);
}

/* ================= WORDS ================= */
export function renderWords() {
  const seg = h('div.seg', [['w', 'Слова'], ['p', 'Фразы'], ['c', 'Похожие'], ['u', 'Мой словарь']].map(([k, l]) =>
    h('button', { class: ui.wordsSeg === k ? 'on' : '', onclick: () => { ui.wordsSeg = k; rerender(); } }, l)));
  const search = h('input.field.mt16', { type: 'search', placeholder: 'Поиск по-английски или по-русски', value: ui.q, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
  const list = h('div.mt16');
  search.addEventListener('input', () => { ui.q = search.value; fill(); });
  const q = () => ui.q.trim().toLowerCase();
  const hit = (...xs) => !q() || xs.some(x => String(x || '').toLowerCase().includes(q()));
  const status = id => {
    const c = S.cards[id];
    if (!c) return h('span.tiny.muted', 'новое');
    if (c.ivl >= 21) return h('span.tiny', { style: 'color:var(--ok);font-weight:700' }, 'знаю');
    return h('span.tiny', { style: 'color:var(--accent);font-weight:700' }, 'учу');
  };
  const row = (id, en, ru) => h('button.item', { onclick: () => openCard(id) },
    h('div.grow', h('div.t', en), h('div.s', ru)), status(id));

  function fill() {
    const out = [];
    if (ui.wordsSeg === 'w') {
      const nW = D.days.reduce((n, d) => n + d.words.length, 0);
      out.push(h('p.small.muted', `${nW} из 720 слов курса открыто. Нажми на слово, чтобы открыть карточку.`));
      for (const d of D.days) {
        const items = d.words.filter(w => hit(w.en, w.ru));
        if (!items.length) continue;
        const copy = h('button.chip', { html: icon('copy') + 'Скопировать', 'aria-label': `Скопировать слова дня ${courseIndex(d)}`,
          onclick: async () => toast((await copyText(lessonWordsText(d))) ? `Скопировано: ${d.words.length + d.phrases.length}` : 'Не удалось скопировать') });
        out.push(h('div.row.mt24', h('div.label.grow', `День ${courseIndex(d)} · ${d.theme}`), copy), h('div.list.mt8', items.map(w => row(w.id, w.en, w.ru))));
      }
    } else if (ui.wordsSeg === 'p') {
      const all = D.days.flatMap(d => d.phrases);
      out.push(h('p.small.muted', `${all.length} из 240 фраз курса. По 3 фразовых глагола и 2 разговорные фразы в день.`));
      for (const [g, title] of Object.entries(D.course.phraseGroups)) {
        const items = all.filter(p => p.group === g && hit(p.en, p.ru));
        if (!items.length) continue;
        out.push(h('div.label.mt24', title), h('div.list.mt8', items.map(p => row(p.id, p.en, p.ru))));
      }
    } else if (ui.wordsSeg === 'c') {
      out.push(h('p.small.muted', 'Пары слов, которые легко перепутать по смыслу или написанию.'));
      out.push(h('div.list.mt16', D.days.filter(d => hit(d.confusable.title, ...d.confusable.items.map(i => i.ru))).map(d => {
        const c = d.confusable;
        return h('button.item', { onclick: () => confusableSheet(c) },
          h('div.grow', h('div.t', c.title), h('div.s', c.items.map(i => i.ru.split(/[;(]/)[0].trim()).join(' · '))),
          h('span.go', { html: icon('next') }));
      })));
    } else {
      const items = Object.entries(S.custom).filter(([, u]) => hit(u.en, u.ru)).sort((a, b) => (b[1].added || '').localeCompare(a[1].added || ''));
      if (!items.length && !q()) out.push(h('div.empty', h('div.art', { html: mascot('read') }), h('div.h3', 'Пока пусто'),
        h('p.muted.mt8', 'Нажми на любое слово в тексте и выбери «В мой словарь». Слово попадёт сюда и в повторение.')));
      else out.push(h('div.list', items.map(([lemma, u]) => h('div.item',
        h('button.grow', { style: 'text-align:left', onclick: () => sheet('Мой словарь', customCard(u)) }, h('div.t', u.en), h('div.s', u.ru)),
        h('button.icon-btn', { 'aria-label': 'Удалить', html: icon('trash'), onclick: async () => {
          if (!(await confirmSheet('Удалить слово?', `«${u.en}» исчезнет из словаря и повторения.`, 'Удалить'))) return;
          delete S.custom[lemma]; delete S.cards['u:' + lemma]; save(); fill();
        } })))));
    }
    list.replaceChildren(...out);
  }
  fill();
  return h('div.page', seg, ui.wordsSeg === 'c' ? null : search, list);
}

function confusableSheet(c) {
  sheet(c.title, [
    h('div.list', c.items.map(it => h('div', { style: 'padding:16px 0' },
      h('div.row', h('div.grow', h('span.h3', it.en), ' ', h('span.ipa', `/${it.ipa}/`), ' ', h('span.rt', `[${it.rt}]`)), playBtn(it.en, { cls: 'sm' })),
      h('div.mt8', { style: 'font-weight:700' }, it.ru),
      h('div.row.mt8', { style: 'align-items:flex-start' }, h('div.grow', tappable(it.ex[0], 'div'), h('div.small.muted', it.ex[1])), playBtn(it.ex[0], { cls: 'sm' }))))),
    h('div.wc', h('div.note', { html: inline(c.rule) })),
  ]);
}

/* ================= TEXTS ================= */
export function renderTexts() {
  const read = S.stories || {};
  const total = D.days.reduce((n, d) => n + d.stories.length, 0);
  const done = D.days.reduce((n, d) => n + d.stories.filter(s => read[s.id]).length, 0);
  const weeks = D.course.open.map(wn => h('div.mt24',
    h('div.label', `Неделя ${wn}: ${D.course.weeks[wn - 1].title}`),
    D.days.filter(d => d.week === wn).map(d => h('div.mt16',
      h('div.small', { style: 'font-weight:700' }, `День ${courseIndex(d)} · ${d.title}`),
      h('div.list.mt8', d.stories.map((s, i) => h('button.item', { onclick: () => openStory(d.id, i) },
        h('span.num', s.kind === 'dialogue' ? 'ДЛГ' : 'ТКСТ'),
        h('div.grow', h('div.t', s.title), h('div.s', s.kind === 'dialogue' ? `диалог · ${s.lines.length} ${plural(s.lines.length, 'реплика', 'реплики', 'реплик')}` : `текст · ${s.paras.length} ${plural(s.paras.length, 'абзац', 'абзаца', 'абзацев')}`)),
        h('span.check', { class: read[s.id] ? 'on' : '', html: icon('check') }))))))));
  return h('div.page',
    h('p.small.muted', `По два текста на каждый урок: живой диалог и связный текст с переводом. В них все слова урока и часть слов прошлых уроков. Прочитано: ${done} из ${total}.`),
    weeks);
}

/* ================= GRAMMAR ================= */
export function renderGrammar() {
  const act = activeMistakes().filter(id => D.ex[id]);
  const fixed = Object.values(S.mistakes).filter(m => m.fixed).length;
  const mist = h('div.card',
    h('div.row', h('div.grow', h('div.h3', 'Мои ошибки'), h('div.small.muted', act.length ? `${act.length} ${plural(act.length, 'задание ждёт', 'задания ждут', 'заданий ждут')} повтора · исправлено ${fixed}` : `Активных ошибок нет · исправлено ${fixed}`)),
      act.length ? h('span.pill-n', act.length) : null),
    act.length ? h('div.row.mt16', h('button.btn.sm', { onclick: openMistakes }, 'Повторить'), h('button.btn.sm.ghost', { onclick: () => mistakesSheet(act) }, 'Список')) : null);

  const weeks = D.course.weeks.map(w => {
    const open = D.course.open.includes(w.n);
    const days = D.days.filter(d => d.week === w.n);
    return h('div.mt32', { class: open ? '' : 'lock' },
      h('div.row', h('div.grow', h('div.label', w.n === 9 ? 'Финиш' : `Неделя ${w.n}`), h('div.h3.mt8', w.title)), open ? null : h('span.go', { html: icon('lock') })),
      h('div.small.muted.mt8', w.vocab),
      open
        ? h('div.list.mt16', days.map(d => {
            const ex = d.grammar.exercises, sc = S.days[d.id] && S.days[d.id].score.grammar;
            return h('button.item', { onclick: () => openGrammar(d.id) },
              h('span.num', String(d.day).padStart(2, '0')),
              h('div.grow', h('div.t', d.grammarTitle), h('div.s', sc ? `в уроке: ${sc[0]} из ${sc[1]}` : `${ex.length} упражнений`)),
              h('span.go', { html: icon('next') }));
          }))
        : h('div.list.mt16', w.grammar.map((g, i) => h('div.item', h('span.num', String(i + 1).padStart(2, '0')), h('div.grow.s', g)))),
      open ? null : h('p.tiny.muted.mt8', 'Откроется после твоей проверки предыдущих недель.'));
  });
  return h('div.page', mist, weeks);
}

function mistakesSheet(ids) {
  sheet('Мои ошибки', h('div.list', ids.map(id => {
    const { ex, day } = D.ex[id], m = S.mistakes[id], d = D.byId[day];
    const q = ex.t === 'tr' ? ex.ru : ex.t === 'ord' ? ex.ru : ex.t === 'err' ? ex.s.replace(/[\[\]]/g, '') : ex.t === 'dict' ? 'Диктант' : ex.q;
    const right = ex.t === 'mc' ? ex.opts[ex.a] : ex.t === 'tf' ? (ex.a ? 'Верно' : 'Неверно') : ex.t === 'err' ? ex.fix : ex.t === 'ord' ? ex.a : ex.t === 'tr' ? pretty(ex.a[0], '.') : ex.a[0];
    return h('div', { style: 'padding:16px 0' },
      h('div.label', `${D.course.topics[ex.topic] || ''} · день ${d ? courseIndex(d) : ''} · ошибок: ${m.n}`),
      h('div.mt8', { style: 'font-weight:700' }, q),
      h('div.mt8', h('span.muted', 'Правильно: '), h('span.en', right)),
      ex.ex ? h('div.small.muted.mt8', { html: inline(ex.ex) }) : null);
  })));
}

/* ================= ANSWERS ================= */
export function renderAnswers() {
  const all = S.answers;
  const open = all.filter(a => !a.done);
  const seg = h('div.seg',
    h('button', { class: ui.ansFilter === 'all' ? 'on' : '', onclick: () => { ui.ansFilter = 'all'; rerender(); } }, `Все · ${all.length}`),
    h('button', { class: ui.ansFilter === 'open' ? 'on' : '', onclick: () => { ui.ansFilter = 'open'; rerender(); } }, `Неразобранные · ${open.length}`));
  const fmt = a => `Задание: ${a.task}\nМой ответ: ${a.answer}`;
  const copyAll = h('button.btn.ghost.mt16', { html: icon('copy') + 'Скопировать все неразобранные', onclick: async () => {
    if (!open.length) return toast('Неразобранных ответов нет');
    const ok = await copyText(open.slice().reverse().map(fmt).join('\n\n'));
    toast(ok ? `Скопировано: ${open.length}` : 'Не удалось скопировать');
  } });
  const list = (ui.ansFilter === 'open' ? open : all);
  if (!all.length) return h('div.page', h('div.empty', h('div.art', { html: mascot('write') }), h('div.h3', 'Здесь будут твои ответы'),
    h('p.muted.mt8', 'Writing и переводы с русского сохраняются сюда автоматически. Их удобно копировать для разбора с преподавателем или ИИ.')));
  return h('div.page', seg, copyAll, h('div.mt16', list.map(a => answerRow(a, fmt))),
    !list.length ? h('p.muted.center.mt32', 'Всё разобрано.') : null);
}

function answerRow(a, fmt) {
  const tg = h('button.toggle', { class: a.done ? 'on' : '', html: `<span class="box">${icon('check')}</span>Разобрано` });
  tg.onclick = () => { a.done = !a.done; save(); tg.classList.toggle('on', a.done); };
  const ta = h('textarea.field', { placeholder: 'Разбор: вставь сюда комментарий или исправленный вариант', rows: 3, spellcheck: 'false' });
  ta.value = a.review || '';
  ta.addEventListener('input', () => { a.review = ta.value; save(); });
  const model = h('div.model.learn', { hidden: true }, a.model || '');
  const mBtn = a.model ? h('button.chip', { html: icon('eye') + 'Образец', onclick: () => { model.hidden = !model.hidden; mBtn.classList.toggle('on', !model.hidden); } }) : null;
  const cp = h('button.chip', { html: icon('copy') + 'Скопировать', onclick: async () => toast((await copyText(fmt(a))) ? 'Скопировано' : 'Не удалось скопировать') });
  return h('div.ans',
    h('div.meta', h('span.label.grow', `${fmtDate(a.date)} · нед. ${a.week} · день ${a.day} · ${a.kind === 'writing' ? 'Writing' : 'перевод'}`), tg),
    h('div.task', a.task),
    h('div.mine.learn', a.answer),
    h('div.row.mt8', cp, mBtn),
    model, ta);
}

/* ================= PROGRESS ================= */
export function renderProgress() {
  const cards = Object.entries(S.cards);
  const words = cards.filter(([id, c]) => c.type === 'w').length;
  const phrases = cards.filter(([, c]) => c.type === 'p').length;
  const longTerm = cards.filter(([, c]) => c.ivl >= 21).length;
  const daysDone = Object.values(S.days).filter(d => d.done).length;

  const cal = h('div.cal', Array.from({ length: 28 }, (_, i) => {
    const d = addDays(today(), i - 27);
    return h('i', { class: [S.activity[d] ? 'on' : '', d === today() ? 'today' : ''].join(' '), title: d });
  }));

  const topics = Object.entries(S.stats).filter(([t]) => D.course.topics[t]).map(([t, s]) => ({ t, ...s, p: Math.round(s.c / s.a * 100) })).sort((a, b) => a.p - b.p);
  const weak = topics.filter(x => x.a >= 3 && x.p < 70);
  const dayFor = topic => D.days.find(d => d.grammar.exercises.some(e => e.topic === topic));

  const tests = D.course.tests;
  return h('div.page',
    h('div.row', h('div.grow', h('div.label', 'Серия'), h('div.bignum.mt8', streak()), h('div.muted', `${plural(streak(), 'день', 'дня', 'дней')} подряд · рекорд ${bestStreak()}`)),
      h('div.art', { style: 'width:96px;height:96px', html: mascot(streak() ? 'party' : 'sleep') })),
    h('div.mt24', cal),
    h('div.stats.mt24',
      h('div', h('div.v', words), h('div.k', 'слов из 720')),
      h('div', h('div.v', phrases), h('div.k', 'фраз из 240')),
      h('div', h('div.v', daysDone), h('div.k', `дней из ${totalDays()}`))),
    h('p.small.muted.mt8', `В долгой памяти (интервал 3+ недели): ${longTerm}. Своих слов: ${Object.keys(S.custom).length}.`),

    h('div.label.mt32', 'Тесты'),
    h('div.list.mt8', tests.map(([k, l]) => {
      const t = S.tests[k];
      return h('div.item', h('div.grow', h('div.t', l), h('div.s', t ? `${fmtDate(t.date)} · ${Math.round(t.score / t.total * 100)}%` : 'ещё не пройден')), t ? h('span.h3', `${t.score}/${t.total}`) : null);
    })),

    h('div.label.mt32', 'Слабые темы'),
    weak.length ? h('div.list.mt8', weak.map(x => {
      const d = dayFor(x.t);
      return h('div.item', h('div.grow', h('div.t', D.course.topics[x.t]), h('div.s', `${x.p}% верно из ${x.a}`)),
        d ? h('button.btn.sm.quiet', { onclick: () => openGrammar(d.id) }, 'Повторить') : null);
    })) : h('p.small.muted.mt8', topics.length ? 'Пока нет: все темы выше 70%.' : 'Появятся после первых упражнений.'),

    topics.length ? h('div.label.mt32', 'Точность по темам') : null,
    topics.length ? h('div.bars.mt8', topics.map(x => h('div.b',
      h('div.row', h('span.grow.small', { style: 'font-weight:700' }, D.course.topics[x.t]), h('span.small.muted', `${x.p}% · ${x.a}`)),
      h('div.track', h('i', { class: x.p < 70 ? 'low' : '', style: `width:${x.p}%` }))))) : null,
    h('p.small.muted.mt24', `Мои ошибки: ${activeMistakes().length} активных, ${Object.values(S.mistakes).filter(m => m.fixed).length} исправлено.`),
  );
}

/* ================= SETTINGS ================= */
export function openSettings(applyTheme) {
  const seg = (opts, val, set) => h('div.seg', opts.map(([k, l]) => h('button', { class: val() === k ? 'on' : '', onclick: e => { set(k); save(); [...e.target.parentNode.children].forEach(b => b.classList.toggle('on', b === e.target)); } }, l)));
  const offline = h('button.btn.quiet', { html: icon('down') + 'Скачать озвучку для офлайна' });
  offline.onclick = () => warmAudio(offline);
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    try { importJSON(await f.text()); toast('Данные восстановлены'); setTimeout(() => location.reload(), 600); }
    catch (e) { toast(e.message || 'Не удалось прочитать файл'); }
  };
  const autoplay = h('button.toggle', { class: S.settings.autoplay ? 'on' : '', html: `<span class="box">${icon('check')}</span>Озвучивать карточки автоматически` });
  autoplay.onclick = () => { S.settings.autoplay = !S.settings.autoplay; save(); autoplay.classList.toggle('on', S.settings.autoplay); };

  sheet('Настройки', [
    h('div.label', 'Тема'),
    h('div.mt8', seg([['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']], () => S.settings.theme, v => { S.settings.theme = v; applyTheme(); })),
    h('div.label.mt24', 'Произношение'),
    h('div.mt8', seg([['gb', 'British · en-GB'], ['us', 'American · en-US']], () => S.settings.accent, v => { S.settings.accent = v; })),
    h('p.tiny.muted.mt8', 'Нейроголоса Microsoft: Sonia и Ryan (Великобритания), Ava и Andrew (США), через открытый проект edge-tts.'),
    h('div.label.mt24', 'Скорость озвучки'),
    h('div.mt8', seg([['0.75', '0.75×'], ['1', '1×']], () => String(S.settings.rate), v => { S.settings.rate = Number(v); })),
    h('div.mt16', autoplay),
    h('div.label.mt32', 'Офлайн'),
    h('p.small.muted.mt8', 'Приложение работает без интернета. Чтобы озвучка тоже была офлайн, скачай её один раз по Wi-Fi (около 40 МБ для выбранного акцента).'),
    h('div.mt8', offline),
    h('div.label.mt32', 'Резервная копия'),
    h('p.small.muted.mt8', 'Весь прогресс, слова, ошибки и ответы — одним файлом. Делай копию раз в неделю.'),
    h('div.mt8', h('button.btn.quiet', { html: icon('down') + 'Экспорт в файл', onclick: exportFile })),
    h('div.mt8', h('button.btn.quiet', { html: icon('up') + 'Импорт из файла', onclick: () => file.click() }), file),
    h('div.label.mt32', 'Установка на iPhone'),
    h('p.small.muted.mt8', 'Открой сайт в Safari → «Поделиться» → «На экран „Домой“». Приложение откроется во весь экран, без адресной строки.'),
    h('div.label.mt32', 'Сброс'),
    h('div.mt8', h('button.btn.ghost', { style: 'color:var(--bad)', onclick: async () => {
      if (await confirmSheet('Сбросить весь прогресс?', 'Удалятся дни, карточки, ошибки и ответы. Сначала сделай экспорт.', 'Сбросить')) { resetAll(); location.reload(); }
    } }, 'Сбросить прогресс')),
    h('p.tiny.muted.mt24.center', `Mind the Gap · уверенный B1 · открыто недель: ${D.course.open.length} из 8`),
    h('p.tiny.muted.mt8.center', 'Иллюстрации дней — с Pinterest, права принадлежат авторам. Маскот нарисован для приложения.'),
  ], { onClose: rerender });
}

async function exportFile() {
  const name = `mind-the-gap-${today()}.json`;
  const blob = new Blob([exportJSON()], { type: 'application/json' });
  const f = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function warmAudio(btn) {
  if (!('caches' in window)) return toast('Браузер не поддерживает офлайн-кэш');
  const files = allFiles().filter(f => f.startsWith(S.settings.accent + '-'));
  try {
    const ext = await caches.open('mtg-ext');
    await Promise.all(D.days.filter(d => d.img).map(d => ext.match(d.img).then(hit => hit || fetch(d.img, { mode: 'no-cors', referrerPolicy: 'no-referrer' }).then(r => ext.put(d.img, r))).catch(() => {})));
  } catch (e) {}
  const cache = await caches.open('mtg-audio');
  let done = 0, i = 0;
  btn.disabled = true;
  const worker = async () => {
    while (i < files.length) {
      const url = 'audio/' + files[i++];
      try { if (!(await cache.match(url))) { const r = await fetch(url); if (r.ok) await cache.put(url, r); } } catch (e) {}
      done++;
      if (done % 20 === 0 || done === files.length) btn.textContent = `Скачано ${done} из ${files.length}`;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  btn.disabled = false;
  btn.textContent = 'Озвучка сохранена для офлайна';
}

/* ---------- re-render hook (set by app.js) ---------- */
let rerender = () => {};
export function setRerender(fn) { rerender = fn; }
