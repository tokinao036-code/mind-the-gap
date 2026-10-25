// Mind the Gap — app shell: tabs, header, theme, service worker.
import { h, icon, $, closeSheets } from './ui.js';
import { S } from './store.js';
import { loadData } from './data.js';
import { loadIndex } from './audio.js';
import { installTapHandler } from './cards.js';
import { setRefresher } from './lesson.js';
import { renderToday, renderWords, renderTexts, renderGrammar, renderAnswers, renderProgress, openSettings, setRerender } from './screens.js';

const TABS = [
  { key: 'today', label: 'Сегодня', title: 'Сегодня', render: renderToday },
  { key: 'words', label: 'Слова', title: 'Слова и фразы', render: renderWords },
  { key: 'texts', label: 'Тексты', title: 'Тексты с переводом', render: renderTexts },
  { key: 'grammar', label: 'Грамматика', title: 'Грамматика', render: renderGrammar },
  { key: 'answers', label: 'Ответы', title: 'Мои ответы', render: renderAnswers },
  { key: 'progress', label: 'Прогресс', title: 'Прогресс', render: renderProgress },
];
let tab = (location.hash.slice(1) in Object.fromEntries(TABS.map(t => [t.key, 1]))) ? location.hash.slice(1) : 'today';
const scrolls = {};

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0F1013' : '#F3EEE4';
}

function shell() {
  const title = h('h1');
  const settings = h('button.icon-btn', { 'aria-label': 'Настройки', html: icon('settings'), onclick: () => openSettings(applyTheme) });
  const top = h('header.top', title, settings);
  const main = h('main.scroll');
  const nav = h('nav.tabs', TABS.map(t => h('button', { 'data-k': t.key, 'aria-label': t.label, onclick: () => go(t.key) }, h('span', { html: icon(t.key) }), t.label)));
  main.addEventListener('scroll', () => top.classList.toggle('scrolled', main.scrollTop > 4), { passive: true });
  $('#app').replaceChildren(top, main, nav);
  return { title, main, nav, top };
}

let el;
function render(keepScroll = true) {
  const t = TABS.find(x => x.key === tab);
  el.title.textContent = t.title;
  el.nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === tab));
  const y = keepScroll ? el.main.scrollTop : (scrolls[tab] || 0);
  el.main.replaceChildren(t.render());
  el.main.scrollTop = y;
  el.top.classList.toggle('scrolled', el.main.scrollTop > 4);
}

function go(key) {
  if (key === tab) { el.main.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  scrolls[tab] = el.main.scrollTop;
  tab = key;
  history.replaceState(null, '', '#' + key);
  render(false);
}

async function boot() {
  // no pinch / double-tap zoom on iOS
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));

  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  try {
    await Promise.all([loadData(), loadIndex()]);
  } catch (e) {
    $('#app').innerHTML = '<div class="page"><p class="h3">Не удалось загрузить курс.</p><p class="muted mt8">Проверь подключение и открой приложение ещё раз.</p></div>';
    return;
  }
  el = shell();
  installTapHandler();
  setRefresher(() => render());
  setRerender(() => render());
  render(false);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !document.querySelector('.lesson,.sheet')) render(); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

window.addEventListener('popstate', closeSheets);
boot();
