// Language handling. Content lives in /content; this file only selects and falls back.
export const state = { site: null, lang: 'en', ui: {}, data: {} };

async function getJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

export async function loadAll() {
  state.site = await getJSON('content/site.json');
  const names = ['profile', 'projects', 'publications', 'experience', 'education', 'skills', 'engagement', 'art', 'languages', 'certificates'];
  const need = new Set([state.site.defaultLanguage, ...enabledLangs().map((l) => l.code)]);
  const [datas, locs] = await Promise.all([
    Promise.all(names.map((n) => getJSON(`content/data/${n}.json`))),
    Promise.all([...need].map((c) => getJSON(`content/locales/${c}.json`))),
  ]);
  names.forEach((n, i) => { state.data[n] = datas[i]; });
  [...need].forEach((c, i) => { state.ui[c] = locs[i]; });
}

export const enabledLangs = () => state.site.languages.filter((l) => l.enabled);
const allCodes = () => state.site.languages.map((l) => l.code);

export function pickInitialLang() {
  const ok = (c) => enabledLangs().some((l) => l.code === c);
  try { const s = localStorage.getItem('lang'); if (s && ok(s)) return s; } catch (_) { /* storage unavailable */ }
  for (const n of navigator.languages || [navigator.language || '']) {
    const c = String(n).slice(0, 2).toLowerCase();
    if (ok(c)) return c;
  }
  return state.site.defaultLanguage;
}

export function setLang(code) {
  state.lang = code;
  document.documentElement.lang = code;
  try { localStorage.setItem('lang', code); } catch (_) { /* ignore */ }
}

export function t(key, vars) {
  let s = state.ui[state.lang]?.[key];
  if (s == null) s = state.ui[state.site.defaultLanguage]?.[key];
  if (s == null) { console.warn('Missing UI key:', key); return key; }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

export function isLoc(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).length > 0 && Object.keys(v).every((k) => allCodes().includes(k));
}

const filled = (x) => x != null && x !== '' && !(Array.isArray(x) && x.length === 0);

// Returns { value, missing }. `missing` means the current language has no text and the
// default-language text is being shown instead (it is then flagged in the UI).
export function L(v) {
  if (v == null) return { value: null, missing: false };
  if (!isLoc(v)) return { value: v, missing: false };
  if (filled(v[state.lang])) return { value: v[state.lang], missing: false };
  const fb = v[state.site.defaultLanguage];
  return filled(fb) ? { value: fb, missing: true } : { value: null, missing: false };
}
export const txt = (v) => { const r = L(v).value; return Array.isArray(r) ? r.join(' ') : r; };

export function fmtDate(iso) {
  try {
    const loc = state.lang === 'bn' ? 'bn-BD' : state.lang;
    return new Intl.DateTimeFormat(loc, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
  } catch (_) { return iso; }
}
