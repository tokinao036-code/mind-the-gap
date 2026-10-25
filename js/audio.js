// Pre-recorded neural voices (edge-tts): audio/<gb|us>-<f|m>/<fnv32>.mp3. Falls back to the system voice.
import { S } from './store.js';

let known = new Set();
export async function loadIndex() {
  try { known = new Set(await (await fetch('data/audio.json')).json()); } catch (e) { known = new Set(); }
}
export const allFiles = () => [...known];

export function fnv(text) {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(text)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const clean = t => String(t).trim().replace(/\s+/g, ' ');
export function fileFor(text, v = 'f') { return `${S.settings.accent}-${v}/${fnv(clean(text))}.mp3`; }

const audio = new Audio();
audio.preload = 'auto';
audio.preservesPitch = true;
let token = 0, activeBtn = null;

function mark(btn) {
  if (activeBtn) activeBtn.classList.remove('playing');
  activeBtn = btn || null;
  if (activeBtn) activeBtn.classList.add('playing');
}

export function stop() {
  token++;
  audio.pause();
  try { speechSynthesis.cancel(); } catch (e) {}
  mark(null);
}

function playFile(src, rate, my) {
  return new Promise(res => {
    audio.src = src;
    audio.playbackRate = rate;
    const done = () => { audio.onended = audio.onerror = null; res(true); };
    audio.onended = done;
    audio.onerror = () => { audio.onended = audio.onerror = null; res(false); };
    audio.play().catch(() => res(false));
    const watch = setInterval(() => { if (my !== token) { clearInterval(watch); done(); } else if (audio.ended || (audio.paused && audio.currentTime > 0 && !audio.seeking)) { clearInterval(watch); done(); } }, 300);
  });
}

function speakSystem(text, rate, v) {
  return new Promise(res => {
    if (!('speechSynthesis' in window)) return res();
    const lang = S.settings.accent === 'us' ? 'en-US' : 'en-GB';
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = rate * 0.95;
    const voices = speechSynthesis.getVoices().filter(x => x.lang.replace('_', '-') === lang);
    const pref = v === 'm' ? ['Daniel', 'Arthur', 'Aaron', 'Fred'] : ['Serena', 'Kate', 'Samantha', 'Ava', 'Martha'];
    u.voice = voices.find(x => pref.some(p => x.name.includes(p))) || voices[0] || null;
    u.onend = u.onerror = () => res();
    speechSynthesis.speak(u);
  });
}

async function one(text, v, rate, my) {
  const f = fileFor(text, v);
  if (known.has(f)) {
    const ok = await playFile('audio/' + f, rate, my);
    if (ok || my !== token) return;
  }
  if (my === token) await speakSystem(clean(text), rate, v);
}

/** Speak one line. btn gets a "playing" state. */
export async function say(text, { v = 'f', rate = S.settings.rate, btn } = {}) {
  stop();
  const my = token;
  mark(btn);
  await one(text, v, rate, my);
  if (my === token) mark(null);
}

/** Speak lines one after another; onLine(i) highlights the current one. Returns false if interrupted. */
export async function sequence(lines, { rate = S.settings.rate, btn, onLine } = {}) {
  stop();
  const my = token;
  mark(btn);
  for (let i = 0; i < lines.length; i++) {
    if (my !== token) return false;
    onLine && onLine(i);
    await one(lines[i][0], lines[i][1] || 'f', rate, my);
    if (my === token) await new Promise(r => setTimeout(r, 350));
  }
  if (my === token) { mark(null); onLine && onLine(-1); }
  return my === token;
}
export const isPlaying = () => !!activeBtn;
