// Exercise widgets. Each returns { el, ready(), check() } or calls onAnswer itself for tap-to-answer types.
import { h, inline, esc, icon } from './ui.js';
import { matches, closest, pretty, norm } from './check.js';
import { say } from './audio.js';
import { tappable, playBtn } from './cards.js';

const KIND = {
  mc: 'Выбери вариант', tf: 'Верно или нет?', gap: 'Вставь слово', ord: 'Собери предложение',
  tr: 'Переведи на английский', err: 'Найди ошибку: нажми на неверное слово', dict: 'Диктант: послушай и напиши',
};

function qHTML(q) {
  return esc(q).replace(/_{3,}/g, '<span class="gap-line">&nbsp;</span>');
}

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

/**
 * ex: exercise object; onAnswer({ok, user, right}) is called once.
 * Returns { el, needsButton, ready(), submit() }.
 */
export function renderExercise(ex, onAnswer) {
  const fn = { mc, tf, gap, ord, tr, err, dict }[ex.t];
  return fn(ex, onAnswer);
}

function wrap(ex, ...kids) {
  return h('div.screen', h('div.label.ex-kind', KIND[ex.t]), ...kids);
}

function mc(ex, onAnswer) {
  let done = false;
  const opts = ex.opts.map((o, i) => h('button.opt', { onclick: () => pick(i) }, o));
  function pick(i) {
    if (done) return; done = true;
    const ok = i === ex.a;
    opts.forEach((b, j) => b.classList.add(j === ex.a ? 'ok' : j === i ? 'bad' : 'dim'));
    onAnswer({ ok, user: ex.opts[i], right: ex.opts[ex.a] });
  }
  return { el: wrap(ex, h('div.ex-q', { html: qHTML(ex.q) }), h('div.opts', opts)), needsButton: false };
}

function tf(ex, onAnswer) {
  let done = false;
  const labels = [['Верно', true], ['Неверно', false]];
  const opts = labels.map(([l, v]) => h('button.opt', { onclick: () => pick(v) }, l));
  function pick(v) {
    if (done) return; done = true;
    const ok = v === ex.a;
    opts.forEach((b, j) => b.classList.add(labels[j][1] === ex.a ? 'ok' : labels[j][1] === v ? 'bad' : 'dim'));
    onAnswer({ ok, user: v ? 'Верно' : 'Неверно', right: ex.a ? 'Верно' : 'Неверно' });
  }
  return { el: wrap(ex, h('div.ex-q', ex.q), h('div.opts', opts)), needsButton: false };
}

const inputAttrs = { autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done' };

function gap(ex, onAnswer) {
  let q = ex.q, hint = null;
  const m = q.match(/\(([^)]*)\)\s*$/);
  if (m) { hint = m[1]; q = q.slice(0, m.index).trim(); }
  const [before, after = ''] = q.split(/_{3,}/);
  const input = h('input.inline-in', { ...inputAttrs, type: 'text', 'aria-label': 'Ответ' });
  const sizer = () => { input.style.width = Math.max(120, (input.value.length + 2) * 11) + 'px'; };
  input.addEventListener('input', () => { sizer(); api.onReady && api.onReady(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && api.ready()) api.submit(); });
  sizer();
  const api = {
    el: wrap(ex, h('div.ex-q', before, input, after), hint ? h('div.hintchip', `( ${hint} )`) : null),
    needsButton: true,
    ready: () => input.value.trim().length > 0,
    submit() {
      input.blur(); input.disabled = true;
      const ok = matches(input.value, ex.a);
      onAnswer({ ok, user: input.value.trim(), right: ex.a[0] });
    },
    focus: () => setTimeout(() => input.focus({ preventScroll: true }), 250),
  };
  return api;
}

function splitWords(s) {
  return s.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean);
}

function ord(ex, onAnswer) {
  const words = splitWords(ex.a);
  let order = shuffle(words.map((w, i) => i));
  for (let k = 0; k < 5 && order.every((v, i) => v === i); k++) order = shuffle(order);
  const picked = [];
  const ans = h('div.ord-ans');
  const bankBtns = order.map(i => h('button.tok', { onclick: () => add(i) }, words[i]));
  const bank = h('div.ord-bank', bankBtns);
  let locked = false;
  function paint() {
    ans.replaceChildren(...picked.map((i, k) => h('button.tok', { onclick: () => remove(k) }, words[i])));
    bankBtns.forEach((b, k) => b.classList.toggle('used', picked.includes(order[k])));
    api.onReady && api.onReady();
  }
  function add(i) { if (locked || picked.includes(i)) return; picked.push(i); paint(); }
  function remove(k) { if (locked) return; picked.splice(k, 1); paint(); }
  const api = {
    el: wrap(ex, h('div.ex-ru', ex.ru), ans, bank),
    needsButton: true,
    ready: () => picked.length === words.length,
    submit() {
      locked = true;
      const user = picked.map(i => words[i]).join(' ');
      const ok = [ex.a, ...(ex.alts || [])].some(a => norm(a) === norm(user));
      onAnswer({ ok, user, right: ex.a, say: ex.a });
    },
  };
  return api;
}

function tr(ex, onAnswer) {
  const ta = h('textarea.field.mt24', { ...inputAttrs, rows: 3, placeholder: 'Напиши по-английски', 'aria-label': 'Перевод' });
  ta.addEventListener('input', () => api.onReady && api.onReady());
  const api = {
    el: wrap(ex, h('div.ex-ru', ex.ru), ta),
    needsButton: true,
    ready: () => ta.value.trim().length > 1,
    submit() {
      ta.disabled = true;
      const ok = matches(ta.value, ex.a);
      onAnswer({ ok, user: ta.value.trim(), right: ok ? pretty(ex.a[0], '.') : closest(ta.value, ex.a) + '.' });
    },
  };
  return api;
}

function err(ex, onAnswer) {
  const toks = [];
  ex.s.replace(/\[([^\]]+)\]|([^\s\[\]]+)/g, (_, bad, ok) => {
    if (bad) bad.split(/\s+/).forEach(w => toks.push({ w, bad: true }));
    else toks.push({ w: ok, bad: false });
    return '';
  });
  let done = false;
  const btns = toks.map((t, i) => h('button.tok', { onclick: () => pick(i) }, t.w));
  function pick(i) {
    if (done) return; done = true;
    const ok = toks[i].bad;
    btns.forEach((b, j) => { if (toks[j].bad) b.classList.add(ok ? 'ok' : 'bad'); });
    if (!ok) btns[i].style.opacity = '.4';
    onAnswer({ ok, user: toks[i].w, right: ex.fix, say: ex.fix });
  }
  return { el: wrap(ex, h('div.err-s', btns)), needsButton: false };
}

function dict(ex, onAnswer) {
  const big = h('button.play.big', { 'aria-label': 'Слушать', html: icon('play') });
  const slow = h('button.chip', { html: icon('turtle') + '0.75×' });
  big.onclick = () => say(ex.say, { btn: big });
  slow.onclick = () => say(ex.say, { rate: 0.75, btn: big });
  const input = h('input.field.mt24', { ...inputAttrs, type: 'text', placeholder: 'Что ты услышал(а)?', 'aria-label': 'Диктант' });
  input.addEventListener('input', () => api.onReady && api.onReady());
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && api.ready()) api.submit(); });
  const api = {
    el: wrap(ex, h('div.row.mt16', { style: 'justify-content:center;gap:16px' }, big, slow), input),
    needsButton: true,
    ready: () => input.value.trim().length > 1,
    submit() {
      input.disabled = true; input.blur();
      const ok = matches(input.value, ex.a);
      onAnswer({ ok, user: input.value.trim(), right: ex.say, say: ex.say });
    },
    autoplay: () => say(ex.say, { btn: big }),
  };
  return api;
}

/** Feedback panel shown under an answered exercise. */
export function feedback(ex, r) {
  const showRight = !r.ok && r.right && !['mc', 'tf'].includes(ex.t);
  return h('div.fb.mt24', { class: r.ok ? 'ok' : 'bad' },
    h('div.ttl', r.ok ? 'Верно' : 'Не совсем'),
    showRight ? h('div.right', h('span.muted', 'Правильно: '), r.say ? tappable(r.right) : r.right) : null,
    ex.ex ? h('div', { html: inline(ex.ex) }) : null,
    r.say ? h('div.row.mt8', playBtn(r.say, { cls: 'sm' }), h('span.small.muted', 'Послушать правильный вариант')) : null,
  );
}
