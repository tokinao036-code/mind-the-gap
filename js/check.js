// Answer checking: normalisation, "[a/b]" pattern expansion, closest-answer hints.

const CONTR = [
  [/\bcan't\b/g, 'cannot'], [/\bcan not\b/g, 'cannot'], [/\bwon't\b/g, 'will not'], [/\bshan't\b/g, 'shall not'],
  [/\b([a-z]+)n't\b/g, '$1 not'], [/\bi'm\b/g, 'i am'], [/\b(you|we|they)'re\b/g, '$1 are'],
  [/\b(i|you|we|they)'ve\b/g, '$1 have'], [/\b([a-z]+)'ll\b/g, '$1 will'],
  [/\b(he|she|it|that|what|there|here|who|where|how)'s\b/g, '$1 is'], [/\blet's\b/g, 'let us'],
];

export function norm(s) {
  let t = String(s || '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[“”«»]/g, '"');
  for (const [re, to] of CONTR) t = t.replace(re, to);
  t = t.replace(/[.,!?;:"()\[\]—–\-…]/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
}

/** "i [woke/got] up[ early/]" -> all variants (alternatives may be empty = optional). */
export function expand(pattern, limit = 400) {
  let out = [''];
  const re = /\[([^\]]*)\]/g;
  let last = 0, m;
  while ((m = re.exec(pattern))) {
    const lit = pattern.slice(last, m.index);
    const alts = m[1].split('/');
    const next = [];
    for (const o of out) for (const a of alts) { if (next.length < limit) next.push(o + lit + a); }
    out = next; last = re.lastIndex;
  }
  return out.map(o => o + pattern.slice(last));
}

export function variants(answers) {
  return answers.flatMap(a => expand(a));
}

export function matches(input, answers) {
  const n = norm(input);
  if (!n) return false;
  return variants(answers).some(v => norm(v) === n);
}

export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Closest accepted answer, pretty-printed for feedback. */
export function closest(input, answers) {
  const n = norm(input);
  let best = null, bd = Infinity;
  for (const v of variants(answers)) {
    const d = lev(n, norm(v));
    if (d < bd) { bd = d; best = v; }
  }
  return pretty(best || answers[0]);
}

/** First variant of a pattern, capitalised: "i didn't go" -> "I didn't go." */
export function pretty(s, end = '') {
  let t = expand(s)[0].replace(/\s+/g, ' ').trim();
  t = t.replace(/\bi\b/g, 'I').replace(/\bi'(m|ll|ve|d)\b/g, "I'$1");
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (end && !/[.!?]$/.test(t)) t += end;
  return t;
}
