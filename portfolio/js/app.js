import { h } from './util.js';
import { state, loadAll, enabledLangs, pickInitialLang, setLang, t } from './i18n.js';
import { pages, pageTitle, notFound, cvHref } from './views.js';

const $ = (s) => document.querySelector(s);
let lastKey = null;

/* ---------- theme ---------- */
function applyTheme(mode) { document.documentElement.dataset.theme = mode; }
function currentTheme() { return document.documentElement.dataset.theme || 'light'; }
function storedTheme() { try { return localStorage.getItem('theme'); } catch (_) { return null; } }
function initTheme() {
  if (!document.documentElement.dataset.theme) {
    applyTheme(storedTheme() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!storedTheme()) { applyTheme(e.matches ? 'dark' : 'light'); renderChrome(); }
  });
}

/* ---------- routing ---------- */
function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const codes = enabledLangs().map((l) => l.code);
  if (!codes.includes(parts[0])) return { redirect: `#/${pickInitialLang()}/${parts.join('/')}`.replace(/\/$/, '/') };
  return { lang: parts[0], route: parts[1] || '', param: parts[2] || null };
}

function renderChrome(routeName = '') {
  const header = $('#site-header');
  const nav = state.site.nav;
  const link = (r) => h('a', { href: `#/${state.lang}/${r}`, 'aria-current': r === routeName ? 'page' : null }, t('nav.' + r));
  const themeBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-pressed': String(currentTheme() === 'dark'), 'aria-label': t('theme.toggle'), onclick: () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next); try { localStorage.setItem('theme', next); } catch (_) { /* ignore */ }
    renderChrome(routeName);
  } }, h('span', { 'aria-hidden': 'true' }, currentTheme() === 'dark' ? '☾' : '☀'), h('span', { class: 'sr-only' }, currentTheme() === 'dark' ? t('theme.dark') : t('theme.light')));
  const langs = enabledLangs();
  const rest = location.hash.replace(/^#\/[^/]*\/?/, '');
  const langBox = langs.length > 1 ? h('div', { class: 'langs', role: 'group', 'aria-label': t('lang.label') },
    langs.map((l) => h('a', { href: `#/${l.code}/${rest}`, lang: l.code, 'aria-current': l.code === state.lang ? 'true' : null, 'aria-label': l.label, onclick: () => { try { localStorage.setItem('lang', l.code); } catch (_) { /* ignore */ } } }, l.short))) : null;
  const toggle = h('button', { type: 'button', class: 'icon-btn menu-btn', 'aria-expanded': 'false', 'aria-controls': 'main-nav', onclick: (e) => {
    const open = $('#main-nav').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  } }, h('span', { 'aria-hidden': 'true' }, '☰'), h('span', { class: 'sr-only' }, t('nav.menu')));
  header.replaceChildren(h('div', { class: 'bar' },
    h('a', { class: 'brand', href: `#/${state.lang}/` }, h('span', { class: 'mark mark-word', 'aria-hidden': 'true' }, 'Rid1'), h('span', null, state.site.name)),
    h('nav', { id: 'main-nav', 'aria-label': t('nav.main') }, nav.map(link)),
    h('div', { class: 'tools' }, langBox, themeBtn, toggle)));
  $('#skip').textContent = t('nav.skip');
  const f = $('#site-footer');
  f.replaceChildren(h('div', { class: 'bar' },
    h('p', null, t('footer.text', { year: new Date().getFullYear(), date: state.site.updated })),
    h('p', null, t('footer.figures')),
    h('p', null, h('a', { href: '#top', onclick: (e) => { e.preventDefault(); window.scrollTo(0, 0); } }, t('footer.top')))));
}

function setMeta(title, desc) {
  document.title = title === t('meta.siteTitle') ? title : `${title} — ${state.site.name}`;
  const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.setAttribute('content', val); };
  set('meta[name="description"]', desc);
  set('meta[property="og:title"]', document.title);
  set('meta[property="og:description"]', desc);
  set('meta[property="og:locale"]', state.lang === 'fr' ? 'fr_FR' : state.lang === 'bn' ? 'bn_BD' : 'en_GB');
}

function enhanceMotion(main) {
  const targets = main.querySelectorAll('.block, .project-card, .publication, .hero, .home-focus');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const observer = new IntersectionObserver((items, obs) => {
    items.forEach((item) => {
      if (item.isIntersecting) { item.target.classList.add('is-visible'); obs.unobserve(item.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -35px 0px' });
  targets.forEach((el) => { el.classList.add('reveal'); observer.observe(el); });
}

function render() {
  const p = parseHash();
  if (p.redirect) { location.replace(p.redirect); return; }
  setLang(p.lang);
  const view = pages[p.route];
  const node = view ? view(p.param) : notFound();
  renderChrome(view ? p.route : '');
  const main = $('#main');
  main.replaceChildren(node);
  enhanceMotion(main);
  setMeta(view ? pageTitle(p.route, p.param) : t('page.notFound'), t('meta.description'));
  const key = `${p.route}/${p.param || ''}`;
  if (key !== lastKey) {
    window.scrollTo(0, 0);
    if (lastKey !== null) (main.querySelector('#page-title') || main).focus({ preventScroll: true });
  }
  lastKey = key;
}

async function boot() {
  initTheme();
  try {
    await loadAll();
    window.addEventListener('hashchange', render);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { const n = $('#main-nav'); if (n?.classList.contains('open')) { n.classList.remove('open'); $('.menu-btn')?.setAttribute('aria-expanded', 'false'); $('.menu-btn')?.focus(); } }
    });
    document.addEventListener('click', (e) => { if (e.target.closest('#main-nav a')) { $('#main-nav')?.classList.remove('open'); $('.menu-btn')?.setAttribute('aria-expanded', 'false'); } });
    render();
  } catch (err) {
    console.error(err);
    $('#main').replaceChildren(h('p', { class: 'error', role: 'alert' }, 'The site content could not be loaded. Please reload. / Le contenu du site n’a pas pu être chargé. Veuillez recharger la page.'));
  }
}
boot();
export { cvHref };
