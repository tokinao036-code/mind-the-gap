// DOM helpers, icons, sheets, toasts and the mascot.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** **bold**, *em*, `English` -> HTML (input is escaped first). */
export function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<span class="en">$1</span>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>');
}

/** h('div.card', {onclick}, child, 'text') */
export function h(tag, attrs, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (attrs != null && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function html(s) {
  const t = document.createElement('template');
  t.innerHTML = s.trim();
  return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
}

const P = {
  today: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/>',
  words: '<rect x="3.5" y="7" width="13" height="14" rx="2.5"/><path d="M8 3.5h10a2.5 2.5 0 0 1 2.5 2.5v11"/>',
  texts: '<path d="M3 5.5c3.2-1.2 6.2-.9 9 1.2v13c-2.8-2.1-5.8-2.4-9-1.2z"/><path d="M21 5.5c-3.2-1.2-6.2-.9-9 1.2v13c2.8-2.1 5.8-2.4 9-1.2z"/>',
  grammar: '<path d="M5 4.5h10.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10.5M9 8.5h5"/>',
  answers: '<path d="M4 20h4.5L19.5 9 15 4.5 4 15.5z"/><path d="M13 6.5l4.5 4.5"/>',
  progress: '<path d="M5.5 20v-7M12 20V5M18.5 20v-10M3 20h18"/>',
  settings: '<path d="M4 7.5h9M17 7.5h3M4 16.5h3M11 16.5h9"/><circle cx="15" cy="7.5" r="2.2"/><circle cx="9" cy="16.5" r="2.2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  turtle: '<path d="M4 15c0-4 3.5-7 8-7s8 3 8 7z"/><path d="M6 15v3M18 15v3M20 13h2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.2h-4.2"/>',
  down: '<path d="M12 4v12M6.5 11 12 16.5 17.5 11M5 20h14"/>',
  up: '<path d="M12 20V8M6.5 13 12 7.5 17.5 13M5 4h14"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  star: '<path d="M12 4l2.4 5.1 5.6.7-4.1 3.9 1 5.5L12 16.5l-4.9 2.7 1-5.5L4 9.8l5.6-.7z"/>',
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
export const ic = name => html(icon(name));

/* ---------- mascot: a speech-bubble character named Gap ---------- */
export function mascot(pose = 'wave') {
  const ink = 'var(--ink)', sw = 'stroke="var(--ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  const sleepy = pose === 'sleep';
  const look = { read: [2, 5], write: [3, 5], think: [1, -4], listen: [-2, 1] }[pose] || [2, 1];
  const eyes = sleepy
    ? `<path d="M42 46q6 4 12 0M64 46q6 4 12 0" ${sw}/>`
    : `<circle cx="48" cy="44" r="10" fill="#fff" ${sw}/><circle cx="70" cy="44" r="10" fill="#fff" ${sw}/>
       <circle cx="${48 + look[0]}" cy="${44 + look[1]}" r="4.2" fill="${ink}" style="fill:#15161B"/><circle cx="${70 + look[0]}" cy="${44 + look[1]}" r="4.2" style="fill:#15161B"/>`;
  const mouth = pose === 'party' ? `<path d="M50 60q9 12 18 0z" fill="#fff" ${sw}/>`
    : pose === 'think' ? `<path d="M54 64h10" ${sw}/>`
    : sleepy ? `<circle cx="59" cy="63" r="3" ${sw}/>`
    : `<path d="M52 62q7 6 14 0" ${sw}/>`;
  const arms = {
    wave: `<path d="M88 52l12-16" ${sw}/><circle cx="101" cy="33" r="4" fill="var(--bg)" ${sw}/><path d="M30 60l-10 10" ${sw}/>`,
    party: `<path d="M88 50l12-18M30 50l-12-18" ${sw}/>`,
    read: `<path d="M34 66l10 8M84 66l-10 8" ${sw}/>`,
    write: `<path d="M30 62l-10 8M88 60l10 6" ${sw}/><path d="M98 66l8-20 5 2-8 20-6 3z" fill="var(--bg)" ${sw}/>`,
    think: `<path d="M30 62l-10 8M88 58q10-4 6-14" ${sw}/>`,
    listen: `<path d="M30 62l-10 8M88 62l10 8" ${sw}/>`,
    sleep: `<path d="M30 64l-10 6M88 64l10 6" ${sw}/>`,
  }[pose] || '';
  const prop = {
    read: `<path d="M38 70l21 6 21-6v24l-21 6-21-6z" fill="var(--bg)" ${sw}/><path d="M59 76v24" ${sw}/>`,
    listen: `<path d="M30 46a29 29 0 0 1 58 0" fill="none" ${sw}/><rect x="24" y="42" width="10" height="16" rx="4" fill="var(--bg)" ${sw}/><rect x="84" y="42" width="10" height="16" rx="4" fill="var(--bg)" ${sw}/>`,
    sleep: `<text x="92" y="24" font-family="var(--f-display)" font-weight="700" font-size="16" fill="${ink}">z</text><text x="102" y="12" font-family="var(--f-display)" font-weight="700" font-size="11" fill="${ink}">z</text>`,
    think: `<text x="92" y="26" font-family="var(--f-display)" font-weight="700" font-size="20" fill="var(--accent)">?</text>`,
    party: `<circle cx="16" cy="18" r="3" fill="var(--accent)"/><circle cx="104" cy="16" r="3" fill="${ink}"/><path d="M22 34l6-4M96 30l6 3M60 6v6" ${sw}/>`,
  }[pose] || '';
  return `<svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
    <path d="M50 92v16M68 92v16M44 108h10M64 108h10" ${sw}/>
    ${arms}
    <path d="M30 32a18 18 0 0 1 18-18h22a18 18 0 0 1 18 18v38a18 18 0 0 1-18 18H52l-14 10 3-12a18 18 0 0 1-11-16z" fill="var(--accent)" ${sw}/>
    ${eyes}${mouth}${prop}
  </svg>`;
}

/* ---------- bottom sheet ---------- */
let sheetStack = [];
export function sheet(title, body, { onClose } = {}) {
  const bd = h('div.backdrop');
  const closeBtn = h('button.icon-btn', { 'aria-label': 'Закрыть', html: icon('close') });
  const content = h('div.sh-body', body);
  const sh = h('div.sheet', { role: 'dialog', 'aria-modal': 'true' }, h('div.grab'), h('div.sh-head', h('h3', title || ''), closeBtn), content);
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    sheetStack = sheetStack.filter(c => c !== close);
    sh.classList.add('closing'); bd.classList.add('closing');
    setTimeout(() => { sh.remove(); bd.remove(); onClose && onClose(); }, 180);
  };
  bd.onclick = close; closeBtn.onclick = close;
  // swipe down on the grab area closes
  let y0 = null;
  sh.addEventListener('touchstart', e => { if (content.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (y0 != null && e.touches[0].clientY - y0 > 90) { y0 = null; close(); } }, { passive: true });
  document.body.append(bd, sh);
  sheetStack.push(close);
  return { close, body: content, el: sh };
}
export function closeSheets() { [...sheetStack].forEach(c => c()); }

let toastT;
export function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = h('div.toast', msg);
  document.body.append(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 1800);
}

export function confirmSheet(title, text, okLabel = 'Да') {
  return new Promise(res => {
    let answered = false;
    const s = sheet(title, [
      h('p.muted', text),
      h('div.mt24', h('button.btn', { onclick: () => { answered = true; s.close(); res(true); } }, okLabel)),
      h('div.mt8', h('button.btn.ghost', { onclick: () => { answered = true; s.close(); res(false); } }, 'Отмена')),
    ], { onClose: () => { if (!answered) res(false); } });
  });
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = h('textarea', { style: 'position:fixed;opacity:0;top:0' }); ta.value = text;
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove(); return ok;
  }
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
