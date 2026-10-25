// Word / phrase cards, tappable texts and the tap-a-word popup.
import { h, icon, html, sheet, toast, inline, esc } from './ui.js';
import { D, lookup } from './data.js';
import { S, save } from './store.js';
import { say } from './audio.js';
import { addCard } from './srs.js';

const POS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', pron: 'pronoun', det: 'determiner', conj: 'conjunction', num: 'number', excl: 'exclamation', modal: 'modal verb', contr: 'short form', name: 'name' };
export const posName = p => POS[p] || p || '';
const GROUP = { phrasal: 'phrasal verb', soft: 'мягкая формулировка', work: 'рабочая фраза', forum: 'форум, переговоры', reaction: 'реакция', opinion: 'мнение', linker: 'связка', everyday: 'бытовая фраза' };

export function playBtn(text, opts = {}) {
  const b = h('button.play', { class: opts.cls || '', 'aria-label': 'Озвучить', html: icon('speaker') });
  b.onclick = e => { e.stopPropagation(); say(text, { v: opts.v || 'f', btn: b }); };
  return b;
}

export function speedChip(onChange) {
  const b = h('button.chip', { 'aria-label': 'Скорость озвучки' });
  const paint = () => { b.innerHTML = icon('turtle') + (S.settings.rate === 1 ? '1×' : '0.75×'); b.classList.toggle('on', S.settings.rate !== 1); };
  b.onclick = () => { S.settings.rate = S.settings.rate === 1 ? 0.75 : 1; save(); paint(); onChange && onChange(); };
  paint();
  return b;
}

/** English text with every word tappable. */
const TOKEN = /[A-Za-zÀ-ÿ]+(?:['’][A-Za-zÀ-ÿ]+)*/g;
export function tappable(text, tag = 'span', classify) {
  const el = h(tag + '.learn');
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) el.append(text.slice(last, m.index));
    if (/[0-9]/.test(text[m.index - 1] || '')) { el.append(m[0]); last = m.index + m[0].length; continue; } // 1990s
    el.append(h('span.w', { 'data-w': m[0], class: classify ? classify(m[0]) : '' }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) el.append(text.slice(last));
  return el;
}

/**
 * A line of a «Тексты» story: words of this lesson in accent (nw), words of earlier lessons underlined (ow),
 * the lesson's phrases on a tinted background (np). Multi-word items are matched as whole spans.
 */
export function storyText(text, day, tag = 'div') {
  const idx = D.days.indexOf(day);
  const classify = tok => {
    const { entry } = lookup(tok);
    const c = entry && entry.card && D.cards[entry.card];
    if (!c) return '';
    const di = D.days.findIndex(d => d.id === c.day);
    return di === idx ? 'nw' : di >= 0 && di < idx ? 'ow' : '';
  };
  const marks = [];
  D.days.slice(0, idx + 1).forEach((d, i) => {
    for (const w of d.words) if (/[\s&-]/.test(w.en)) marks.push([w.en, i === idx ? 'nw' : 'ow']);
    if (i === idx) for (const p of d.phrases) marks.push([p.en.replace(/[.,!?…]+$/, ''), 'np']);
  });
  const low = text.toLowerCase();
  const ranges = [];
  for (const [s, cls] of marks) {
    const k = s.toLowerCase();
    if (k.length < 3) continue;
    for (let i = low.indexOf(k); i >= 0; i = low.indexOf(k, i + k.length)) {
      if (!ranges.some(r => i < r[1] && i + k.length > r[0])) ranges.push([i, i + k.length, cls]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const el = h(tag + '.learn');
  let pos = 0;
  for (const [a, b, cls] of ranges) {
    if (a > pos) el.append(tappable(text.slice(pos, a), 'span', classify));
    el.append(h('span.mk.' + cls, tappable(text.slice(a, b), 'span', classify)));
    pos = b;
  }
  if (pos < text.length) el.append(tappable(text.slice(pos), 'span', classify));
  return el;
}

export function installTapHandler() {
  document.addEventListener('click', e => {
    const w = e.target.closest('.w');
    if (!w) return;
    const sel = window.getSelection && String(window.getSelection());
    if (sel && sel.trim().length > 1) return; // the user is selecting text, not tapping
    w.classList.add('hl'); setTimeout(() => w.classList.remove('hl'), 400);
    wordPopup(w.dataset.w);
  });
}

function inReview(lemma, entry) {
  return (entry.card && S.cards[entry.card]) || S.cards['u:' + lemma];
}

export function wordPopup(token) {
  const { entry, lemma, form } = lookup(token);
  if (!entry) { toast('Слова нет в словаре'); return; }
  say(entry.en);
  const course = entry.card && D.cards[entry.card];
  const addBtn = h('button.btn', {});
  const paint = () => {
    const has = inReview(lemma, entry);
    addBtn.textContent = has ? 'Уже в повторении' : 'В мой словарь';
    addBtn.disabled = !!has;
  };
  addBtn.onclick = () => {
    if (course) addCard(entry.card, course.kind);
    else {
      S.custom[lemma] = { en: entry.en, ru: entry.ru, ipa: entry.ipa, rt: entry.rt, pos: entry.pos, added: new Date().toISOString() };
      addCard('u:' + lemma, 'u');
    }
    save(); paint(); toast('Добавлено в «Мой словарь»');
  };
  paint();
  const body = [
    form ? h('div.label', `${form} → форма слова ${entry.en}`) : null,
    h('div.wc.mt8',
      h('div.head', h('div.grow', h('div.word', entry.en), h('div.pos.mt8', posName(entry.pos))), playBtn(entry.en)),
      entry.ipa ? h('div.row.mt16', h('span.ipa', `/${entry.ipa}/`), h('span.rt', `[${entry.rt}]`)) : null,
      h('div.tr', entry.ru)),
    h('div.mt24', addBtn),
    course ? h('div.mt8', h('button.btn.ghost', { onclick: () => { s.close(); openCard(entry.card); } }, 'Полная карточка')) : null,
  ];
  const s = sheet('', body);
}

export function openCard(id) {
  const c = D.cards[id];
  if (!c) return;
  sheet(c.kind === 'w' ? 'Слово' : 'Фраза', c.kind === 'w' ? wordCard(c.data) : phraseCard(c.data));
}

export function wordCard(w) {
  const lvl = h('span.lvl', { class: w.lvl === 'A2' ? '' : 'b1' }, w.lvl);
  return h('div.wc',
    h('div.head',
      h('div.grow', h('div.word', w.en), h('div.row.mt8', h('span.pos', posName(w.pos)), lvl)),
      playBtn(w.en)),
    h('div.row.mt16', { style: 'flex-wrap:wrap' }, h('span.ipa', `/${w.ipa}/`), h('span.rt', `[${w.rt}]`)),
    h('div.tr', w.ru),
    w.forms ? h('div.forms', `${w.en} — ${w.forms.replace(', ', ' — ')}`) : null,
    h('section',
      h('div.row', { style: 'align-items:flex-start' }, h('div.grow', tappable(w.ex[0], 'div.exen'), h('div.exru', w.ex[1])), playBtn(w.ex[0], { cls: 'sm' }))),
    h('section', h('div.label', 'Коллокации'), h('ul', w.coll.map(c => h('li.col', c)))),
    w.fam && w.fam.length ? h('section', h('div.label', 'Семья слова'),
      h('div.fam', w.fam.map(f => [h('b.learn', f[0], h('span.pos', ' ' + f[1])), h('span.muted', f[2])]))) : null,
    w.note ? h('div.note', { html: inline(w.note) }) : null,
  );
}

export function phraseCard(p) {
  return h('div.wc',
    h('div.head', h('div.grow', h('div.word', { style: 'font-size:28px' }, p.en), h('div.row.mt8', h('span.pos', GROUP[p.group] || p.group))), playBtn(p.en)),
    h('div.row.mt16', { style: 'flex-wrap:wrap' }, h('span.ipa', `/${p.ipa}/`), h('span.rt', `[${p.rt}]`)),
    h('div.tr', p.ru),
    h('section',
      h('div.row', { style: 'align-items:flex-start' }, h('div.grow', tappable(p.ex[0], 'div.exen'), h('div.exru', p.ex[1])), playBtn(p.ex[0], { cls: 'sm' }))),
    p.note ? h('div.note', { html: inline(p.note) }) : null,
  );
}

/** Compact card for user-added words. */
export function customCard(u) {
  return h('div.wc',
    h('div.head', h('div.grow', h('div.word', u.en), h('div.pos.mt8', posName(u.pos))), playBtn(u.en)),
    u.ipa ? h('div.row.mt16', h('span.ipa', `/${u.ipa}/`), h('span.rt', `[${u.rt}]`)) : null,
    h('div.tr', u.ru));
}

export function cardById(id) {
  if (id.startsWith('u:')) { const u = S.custom[id.slice(2)]; return u && { kind: 'u', data: u }; }
  return D.cards[id];
}
/** One line per word, then per phrase: «слово - перевод - транскрипция на русском». */
export function lessonWordsText(day) {
  const line = x => `${x.en} - ${x.ru} - ${x.rt}`;
  return [...day.words, ...day.phrases].map(line).join('\n');
}

export const cardEn = c => c.data.en;
export const cardRu = c => c.data.ru;
