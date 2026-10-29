import { h, norm, copyText } from './util.js';
import { state, t, L, txt, fmtDate } from './i18n.js';

const D = () => state.data;
const href = (route) => `#/${state.lang}/${route}`;
const catLabel = (id) => txt(state.site.categories.find((c) => c.id === id)?.label) || id;
const typeLabel = (id) => (id ? t('ptype.' + id) : null);
export const cvHref = () => state.site.cv[state.lang] || state.site.cv.en;

/* ---------- localised text helpers ---------- */
function flag(node, missing) {
  if (missing) {
    node.classList.add('untranslated');
    node.setAttribute('lang', state.site.defaultLanguage);
    node.setAttribute('data-note', t('label.untranslated'));
  }
  return node;
}
function inline(v, tag = 'span', cls) {
  const { value, missing } = L(v);
  if (value == null) return null;
  return flag(h(tag, { class: cls }, Array.isArray(value) ? value.join(' ') : value), missing);
}
function paras(v) {
  const { value, missing } = L(v);
  if (value == null) return null;
  const arr = Array.isArray(value) ? value : [value];
  return h('div', { class: 'prose' }, arr.map((p) => flag(h('p', null, p), missing)));
}
function bullets(v) {
  const { value, missing } = L(v);
  if (value == null) return null;
  if (!Array.isArray(value)) return paras(v);
  return flag(h('ul', { class: 'prose list' }, value.map((x) => h('li', null, x))), missing);
}
const block = (titleKey, content, id) =>
  content ? h('section', { class: 'block', 'aria-labelledby': id }, h('h2', { id }, t(titleKey)), content) : null;

function chips(items, cls = '') {
  const list = (items || []).filter(Boolean);
  if (!list.length) return null;
  return h('ul', { class: 'chips ' + cls }, list.map((x) => h('li', null, txt(x))));
}

function pageHead(titleKey, introKey) {
  return h('header', { class: 'page-head' }, h('h1', { id: 'page-title', tabindex: '-1' }, t(titleKey)), introKey ? h('p', { class: 'lead' }, t(introKey)) : null);
}

/* ---------- decorative motif: quarter-annulus mesh ---------- */
function meshMotif() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 240 240');
  svg.setAttribute('class', 'mesh');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const r1 = 70, r2 = 220, nr = 7, nc = 14;
  const pt = (i, j) => { const r = r1 + ((r2 - r1) * i) / nr, a = (Math.PI / 2) * (j / nc); return [10 + r * Math.cos(a) * 0.98, 230 - r * Math.sin(a) * 0.98]; };
  let d = '';
  for (let i = 0; i <= nr; i++) { for (let j = 0; j <= nc; j++) { const [x, y] = pt(i, j); d += (j ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); } }
  for (let j = 0; j <= nc; j++) { for (let i = 0; i <= nr; i++) { const [x, y] = pt(i, j); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); } }
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

/* ---------- projects ---------- */
const visible = (p) => p.status === 'published';
const entries = (level) => D().projects.filter((p) => visible(p) && p.level === level);
const byId = (id) => D().projects.find((p) => p.id === id);
const detailKeys = ['description', 'objectives', 'methodology', 'results', 'limitations', 'learned', 'contribution', 'images', 'dataTables', 'links'];
const hasDetail = (p) => detailKeys.some((k) => p[k] && (!Array.isArray(p[k]) || p[k].length));
const route = (p) => `${p.level === 'coursework' ? 'coursework' : 'projects'}/${p.id}`;

function projectCard(p) {
  const title = inline(p.title, 'span');
  const meta = [typeLabel(p.type), p.year].filter(Boolean).join(' · ');
  return h('li', { class: 'card project-card' + (p.featured ? ' featured' : '') },
    p.thumb ? h('div', { class: 'thumb-wrap' }, h('img', { class: 'thumb', src: p.thumb, alt: txt(p.thumbAlt) || '', loading: 'lazy', decoding: 'async', onerror: (e) => e.target.closest('.thumb-wrap')?.remove() }), h('span', { class: 'thumb-index', 'aria-hidden': 'true' }, p.featured ? 'FEATURED' : 'PROJECT')) : null,
    h('div', { class: 'project-card-body' },
      meta ? h('p', { class: 'meta' }, meta) : null,
      h('h3', null, hasDetail(p) ? h('a', { href: href(route(p)) }, title, h('span', { class: 'card-arrow', 'aria-hidden': 'true' }, ' ↗')) : title),
      inline(p.summary, 'p', 'summary'),
      chips(p.tools, 'tools'),
      hasDetail(p) ? h('a', { class: 'card-open', href: href(route(p)) }, t('label.openProject'), h('span', { 'aria-hidden': 'true' }, ' →')) : null));
}

const filterState = { project: { q: '', cat: '', type: '', year: '', tool: '' }, coursework: { q: '', cat: '', type: '', year: '', tool: '' } };

function matches(p, f) {
  if (f.cat && !(p.categories || []).includes(f.cat)) return false;
  if (f.type && p.type !== f.type) return false;
  if (f.year && String(p.year) !== f.year) return false;
  if (f.tool && !(p.tools || []).includes(f.tool)) return false;
  if (f.q) {
    const hay = norm([txt(p.title), txt(p.summary), ...(p.tags || []), ...(p.tools || []), ...(p.categories || []).map(catLabel)].join(' '));
    return norm(f.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }
  return true;
}

function listPage(level, titleKey, introKey) {
  const all = entries(level).sort((a, b) => (b.year || 0) - (a.year || 0) || txt(a.title).localeCompare(txt(b.title)));
  const f = filterState[level];
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const cats = uniq(all.flatMap((p) => p.categories || []));
  const types = uniq(all.map((p) => p.type));
  const years = uniq(all.map((p) => p.year)).sort((a, b) => b - a);
  const tools = uniq(all.flatMap((p) => p.tools || [])).sort((a, b) => a.localeCompare(b));
  const list = h('ul', { class: 'cards', id: 'results' });
  const count = h('p', { class: 'count', role: 'status', 'aria-live': 'polite' });

  const select = (key, labelKey, opts) => {
    if (opts.length < 2) return null;
    const id = `f-${level}-${key}`;
    const sel = h('select', { id, onchange: (e) => { f[key] = e.target.value; update(); } },
      h('option', { value: '' }, t('filters.all')),
      opts.map(([v, label]) => h('option', { value: String(v), selected: String(v) === f[key] ? true : null }, label)));
    return h('div', { class: 'field' }, h('label', { for: id }, t(labelKey)), sel);
  };

  const search = h('div', { class: 'field grow' },
    h('label', { for: `f-${level}-q` }, t('filters.search')),
    h('input', { id: `f-${level}-q`, type: 'search', value: f.q, placeholder: t('filters.searchPlaceholder'), autocomplete: 'off', oninput: (e) => { f.q = e.target.value; update(); } }));

  const form = h('form', { class: 'filters', role: 'search', onsubmit: (e) => e.preventDefault() },
    search,
    select('cat', 'filters.category', cats.map((c) => [c, catLabel(c)])),
    select('type', 'filters.type', types.map((x) => [x, typeLabel(x)])),
    select('year', 'filters.year', years.map((y) => [y, y])),
    select('tool', 'filters.tool', tools.map((x) => [x, x])),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => { Object.keys(f).forEach((k) => { f[k] = ''; }); form.reset(); form.querySelectorAll('select').forEach((s) => { s.value = ''; }); form.querySelector('input').value = ''; update(); } }, t('filters.reset')));

  function update() {
    const shown = all.filter((p) => matches(p, f));
    list.replaceChildren(...shown.map(projectCard));
    count.textContent = shown.length ? t('filters.count', { n: shown.length }) : t('filters.empty');
    if (!shown.length) list.append(h('li', { class: 'empty' }, t('filters.empty')));
  }
  update();
  return h('div', null, pageHead(titleKey, introKey), form, count, list);
}

function figure(img) {
  const cap = inline(img.caption, 'span');
  const alt = txt(img.alt) || '';
  const fig = h('figure', { class: 'figure' },
    h('a', { href: img.src, target: '_blank', rel: 'noopener', 'aria-label': `${t('label.openFull')}: ${alt}` },
      h('img', { src: img.src, alt, loading: 'lazy', decoding: 'async', onerror: (e) => e.target.closest('figure')?.remove() })),
    (cap || img.credit) ? h('figcaption', null, cap, img.credit ? h('span', { class: 'credit' }, ' ', t('label.source'), ': ', img.credit) : null) : null);
  return fig;
}

function dataTable(tb) {
  const cell = (c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : txt(c));
  return h('div', { class: 'table-wrap', role: 'region', tabindex: '0', 'aria-label': txt(tb.caption) },
    h('table', null,
      h('caption', null, inline(tb.caption)),
      h('thead', null, h('tr', null, tb.head.map((c) => h('th', { scope: 'col' }, cell(c))))),
      h('tbody', null, tb.rows.map((r) => h('tr', null, r.map((c, i) => (i === 0 ? h('th', { scope: 'row' }, cell(c)) : h('td', null, cell(c)))))))));
}

function projectDetail(id, level) {
  const p = byId(id);
  if (!p || p.status === 'draft' || (level && p.level !== level)) return notFound();
  const back = p.level === 'coursework' ? ['coursework', 'label.backCoursework'] : ['projects', 'label.backProjects'];
  const meta = [];
  const add = (k, v) => { if (v) meta.push(h('div', null, h('dt', null, t(k)), h('dd', null, v))); };
  add('label.type', typeLabel(p.type));
  add('label.year', p.date ? p.date.replace('-', '/') : p.year);
  add('label.course', inline(p.course));
  add('label.institution', p.institution);
  add('label.supervisor', p.supervisor);
  if (p.group) add('label.group', t('label.groupOf', { n: p.group.size || 2 }));
  const cats = (p.categories || []).map(catLabel);

  const related = (p.related || []).map(byId).filter((r) => r && visible(r));
  const links = (p.links || []).map((l) => h('li', null, h('a', { href: l.url || l.file, target: l.url ? '_blank' : null, rel: l.url ? 'noopener' : null }, inline(l.label))));
  const tables = (p.dataTables || []).map(dataTable);

  return h('article', { class: 'detail' },
    h('p', { class: 'back' }, h('a', { href: href(back[0]) }, '← ', t(back[1]))),
    h('header', { class: 'page-head' },
      h('h1', { id: 'page-title', tabindex: '-1' }, inline(p.title)),
      inline(p.summary, 'p', 'lead')),
    meta.length ? h('dl', { class: 'facts' }, meta) : null,
    chips([...cats, ...(p.tags || [])], 'tags'),
    block('label.tools', chips(p.tools, 'tools'), 'b-tools'),
    block('label.summary', paras(p.description), 'b-desc'),
    block('label.contribution', paras(p.contribution), 'b-contrib'),
    block('label.objectives', paras(p.objectives), 'b-obj'),
    block('label.methodology', bullets(p.methodology), 'b-meth'),
    block('label.results', (p.results || tables.length) ? h('div', null, bullets(p.results), tables) : null, 'b-res'),
    block('label.limitations', bullets(p.limitations), 'b-lim'),
    block('label.learned', bullets(p.learned), 'b-learn'),
    (p.images && p.images.length) ? h('section', { class: 'block', 'aria-labelledby': 'b-fig' }, h('h2', { id: 'b-fig' }, t('label.figures')), h('div', { class: 'figures' }, p.images.map(figure))) : null,
    links.length ? block('label.links', h('ul', { class: 'prose list' }, links), 'b-links') : null,
    related.length ? block('label.related', h('ul', { class: 'prose list' }, related.map((r) => h('li', null, h('a', { href: href(route(r)) }, inline(r.title))))), 'b-rel') : null);
}

/* ---------- pages ---------- */
export function home() {
  const P = D().profile;
  const featured = D().projects.filter((p) => visible(p) && p.featured).sort((a, b) => (a.featuredOrder || 99) - (b.featuredOrder || 99));
  const pub = D().publications[0];
  const c = state.site.contact;
  const socials = (c.socials || []).filter((x) => x.url);
  const embedded = byId('desktop-wind-tunnel');
  const awards = D().engagement.filter((x) => x.status !== 'draft' && ['recognition', 'winner', 'leadership', 'runnerUp'].includes(x.kind)).slice(0, 4);
  const certs = D().certificates.slice(0, 3);
  const copy = (en, fr, bn) => ({ en, fr, bn });
  const label = (en, fr, bn) => inline(copy(en, fr, bn));
  const sectionHead = (eyebrow, title, en, fr, bn) => h('div', { class: 'section-heading-row home-section-head' },
    h('div', null, h('p', { class: 'kicker' }, eyebrow), h('h2', null, label(en, fr, bn))));
  const education = D().education;
  const latestExp = D().experience.slice(0, 2);
  const skillGroups = D().skills;
  const heroInterests = [
    ['Structural mechanics', 'Mécanique des structures', 'Structural mechanics'],
    ['Coupled systems', 'Systèmes couplés', 'Coupled systems'],
    ['Vibrations', 'Vibrations', 'Vibrations'],
    ['Fluid–structure interaction', 'Interaction fluide–structure', 'Fluid–structure interaction'],
    ['Materials science', 'Science des matériaux', 'Materials science'],
    ['Aerospace applications', 'Applications aérospatiales', 'Aerospace applications']
  ];
  return h('div', { class: 'home-page' },
    h('section', { class: 'hero hero-campus immersive-hero', id: 'intro', 'aria-labelledby': 'page-title' },
      h('img', { class: 'immersive-background', src: 'assets/images/cnam-original-building.jpg', alt: 'Original photograph of the CNAM Paris building and French flag', fetchpriority: 'high' }),
      h('div', { class: 'immersive-shade', 'aria-hidden': 'true' }),
      h('div', { class: 'immersive-content' },
        h('p', { class: 'immersive-kicker' }, label('ENGINEERING / RESEARCH / REAL-WORLD IMPACT', 'INGÉNIERIE / RECHERCHE / IMPACT CONCRET', 'ENGINEERING / RESEARCH / REAL-WORLD IMPACT')),
        h('h1', { id: 'page-title', tabindex: '-1' }, state.lang === 'bn' ? 'রিদওয়ান আহমদ' : ['Ridwan ', h('span', null, 'Ahmed')]),
        h('h2', { class: 'immersive-role' }, label('Mechanical Engineer. Researcher. Problem Solver.', 'Ingénieur mécanicien. Chercheur. Résolveur de problèmes.', 'Mechanical Engineer. Researcher. Problem Solver.')),
        h('p', { class: 'immersive-degree' }, label('M2 in Structural Mechanics and Coupled Systems at CNAM Paris', 'M2 Mécanique des structures et systèmes couplés au Cnam Paris', 'M2 in Structural Mechanics and Coupled Systems at CNAM Paris')),
        inline(P.intro, 'p', 'immersive-bio'),
        h('div', { class: 'actions immersive-actions' },
          h('a', { class: 'btn primary', href: href('projects') }, label('Explore my work →', 'Découvrir mes projets →', 'Explore my work →')),
          h('a', { class: 'btn hero-outline', href: href('about') }, label('Meet the engineer ↓', 'Découvrir mon parcours ↓', 'Meet the engineer ↓'))),
        h('div', { class: 'immersive-socials' },
          socials.filter(x => !/publication|research publication/i.test(typeof x.label === 'string' ? x.label : (x.label?.en || ''))).map((x) => h('a', { href: x.url, target: x.url.startsWith('http') ? '_blank' : null, rel: x.url.startsWith('http') ? 'noopener noreferrer' : null }, inline(x.label))),
          h('a', { href: pub?.doi || href('research'), target: pub?.doi ? '_blank' : null, rel: pub?.doi ? 'noopener noreferrer' : null }, label('Research publication', 'Publication scientifique', 'Research publication'))),
        h('p', { class: 'immersive-seeking-note' }, label('Seeking research-oriented internship opportunities to tackle real-world engineering challenges.', 'À la recherche d’opportunités de stage orientées recherche pour répondre à des défis d’ingénierie concrets.', 'বাস্তব প্রকৌশলগত চ্যালেঞ্জ মোকাবিলায় গবেষণামুখী ইন্টার্নশিপের সুযোগ খুঁজছি।'))),
      h('img', { class: 'immersive-portrait', src: 'assets/images/ridwan-cutout-clean-right.png', alt: 'Unretouched original portrait of Ridwan Ahmed', fetchpriority: 'high' }),
      h('aside', { class: 'immersive-interests', 'aria-label': t('home.interests') },
        h('p', null, label('AREAS OF INTEREST & RESEARCH DIRECTIONS', 'DOMAINES D’INTÉRÊT ET DE RECHERCHE', 'AREAS OF INTEREST & RESEARCH DIRECTIONS')),
        h('ul', null, heroInterests.map(x => h('li', null, label(...x))))),
      h('a', { class: 'immersive-scroll', href: '#home-focus', onclick: (e) => { e.preventDefault(); document.getElementById('home-focus')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } }, h('span', { class: 'immersive-scroll-text' }, label('Scroll', 'Défiler', 'Scroll')), h('span', { class: 'immersive-scroll-arrow', 'aria-hidden': 'true' }, '↓'))),
    h('section', { class: 'home-focus block', id: 'home-focus', 'aria-label': t('home.interests') },
      h('div', { class: 'focus-heading' }, h('p', { class: 'kicker' }, t('home.focusKicker')), h('h2', null, t('home.interests'))),
      h('div', { class: 'focus-items' }, (P.interests || []).map((x) => h('span', null, txt(x))))),
    h('section', { class: 'block home-project-section', 'aria-labelledby': 'h-feat' },
      h('div', { class: 'section-heading-row' }, h('div', null, h('p', { class: 'kicker' }, t('home.engineeringKicker')), h('h2', { id: 'h-feat' }, t('home.featured'))), h('a', { class: 'more', href: href('projects') }, t('home.allProjects'), ' →')),
      h('ul', { class: 'cards' }, featured.map(projectCard))),
    embedded ? h('section', { class: 'embedded-feature block' },
      h('div', { class: 'embedded-copy' }, h('p', { class: 'kicker' }, label('BEYOND THE DESKTOP', 'AU-DELÀ DE LA SIMULATION', 'কম্পিউটারের বাইরেও')),
        h('h2', null, inline(embedded.title)), inline(embedded.summary, 'p', 'lead'),
        h('p', null, label('A CAD and hands-on engineering project centred on the design and construction of a desktop-scale open-channel wind tunnel for aerodynamic testing and demonstration.', 'Un projet de conception assistée par ordinateur et d’ingénierie pratique consacré à la conception et à la construction d’une soufflerie de bureau à veine ouverte pour des essais et des démonstrations d’aérodynamique.', 'A CAD and hands-on engineering project centred on the design and construction of a desktop-scale open-channel wind tunnel for aerodynamic testing and demonstration.')),
        h('a', { class: 'text-link', href: href(route(embedded)) }, label('Explore the project', 'Découvrir le projet', 'প্রকল্পটি দেখুন'), ' ↗')),
      embedded.images?.[0] ? h('img', { class: 'embedded-image', src: embedded.images[0].src, alt: txt(embedded.images[0].alt) || '', loading: 'lazy' }) : null) : null,
    pub ? (() => {
      const rp = byId(pub.projectId);
      const img = rp?.images?.find((x) => x.src.includes('fig13-sem')) || rp?.images?.[0];
      return h('section', { class: 'research-spotlight block', 'aria-labelledby': 'h-research' },
        h('div', { class: 'spotlight-copy' },
          h('p', { class: 'kicker' }, t('nav.research')),
          h('h2', { id: 'h-research' }, inline(pub.title)),
          inline(pub.summary, 'p', 'summary'),
          h('p', { class: 'spotlight-meta' }, `${pub.journal} · ${pub.year} · DOI: ${pub.article}`),
          h('div', { class: 'actions' }, h('a', { class: 'btn primary', href: href('research') }, t('home.paper')), h('a', { class: 'btn ghost', href: pub.doi, target: '_blank', rel: 'noopener' }, 'DOI ↗'))),
        img ? h('figure', { class: 'spotlight-image' }, h('img', { src: img.src, alt: txt(img.alt) || '', loading: 'lazy', decoding: 'async' }), h('figcaption', null, inline(img.caption))) : null);
    })() : null,
    h('section', { class: 'block home-toolkit' },
      sectionHead(t('nav.skills'), null, 'Engineering toolkit', 'Boîte à outils technique', 'প্রকৌশল সরঞ্জাম'),
      h('div', { class: 'toolkit-grid' }, skillGroups.map((g) => h('article', { class: 'toolkit-card' },
        h('h3', null, inline(g.title)), h('ul', null, g.items.map((it) => h('li', null, inline(typeof it.name === 'string' ? copy(it.name, it.name, it.name) : it.name))))))),
      h('a', { class: 'text-link', href: href('skills') }, label('Full skills and evidence', 'Compétences et réalisations', 'সম্পূর্ণ দক্ষতা ও প্রমাণ'), ' ↗')),
    h('section', { class: 'block home-path' },
      sectionHead(t('nav.background'), null, 'Education & experience', 'Formation et expérience', 'শিক্ষা ও অভিজ্ঞতা'),
      h('div', { class: 'path-grid' },
        h('div', { class: 'path-column' }, h('p', { class: 'path-label' }, label('EDUCATION', 'FORMATION', 'শিক্ষা')),
          education.map((e) => h('article', { class: 'path-item' }, h('p', { class: 'when' }, inline(e.dateLabel)), h('h3', null, inline(e.degree)), h('p', { class: 'org' }, e.org, ' · ', inline(e.place)), e.note ? paras(e.note) : null))),
        h('div', { class: 'path-column' }, h('p', { class: 'path-label' }, label('SELECTED EXPERIENCE', 'EXPÉRIENCE SÉLECTIONNÉE', 'নির্বাচিত অভিজ্ঞতা')),
          latestExp.map((e) => h('article', { class: 'path-item' }, h('p', { class: 'when' }, inline(e.dateLabel)), h('h3', null, inline(e.role)), h('p', { class: 'org' }, e.org, e.place ? [' · ', inline(e.place)] : null), bullets(e.points))))),
      h('a', { class: 'text-link', href: href('background') }, label('Explore the full background', 'Voir le parcours complet', 'সম্পূর্ণ অভিজ্ঞতা দেখুন'), ' ↗')),
    awards.length ? h('section', { class: 'home-recognition block' },
      sectionHead(t('nav.engagement'), null, 'Recognition & contribution', 'Distinctions et contributions', 'স্বীকৃতি ও অবদান'),
      h('div', { class: 'recognition-grid' }, awards.map((a) => h('article', { class: 'recognition-item' }, h('span', { class: 'recognition-year' }, a.year || ''), h('h3', null, inline(a.title)), h('p', null, a.org)))) ,
      h('a', { class: 'text-link', href: href('engagement') }, label('More about my engagement', 'En savoir plus', 'আরও জানুন'), ' ↗')) : null,
    certs.length ? h('section', { class: 'block home-certificates' },
      sectionHead(t('nav.certificates'), null, 'Selected certificates', 'Quelques certificats', 'নির্বাচিত সনদ'),
      h('div', { class: 'home-cert-grid' }, certs.map((c) => h('article', { class: 'home-cert-card' },
        c.image ? h('img', { src: c.image, alt: txt(c.title), loading: 'lazy' }) : null,
        h('div', null, h('h3', null, inline(c.title)), h('p', null, c.org))))),
      h('a', { class: 'text-link', href: href('certificates') }, label('Browse certificates', 'Voir les certificats', 'সব সনদ দেখুন'), ' ↗')) : null,
    h('section', { class: 'home-internship block' },
      h('div', null, h('p', { class: 'kicker' }, label('NEXT CHAPTER', 'PROCHAINE ÉTAPE', 'পরবর্তী অধ্যায়')),
        h('h2', null, label('Open to an M2 internship', 'À la recherche d’un stage de M2', 'M2 ইন্টার্নশিপের জন্য আগ্রহী')),
        h('p', { class: 'lead' }, label('Interested in research and engineering teams working on structural mechanics, numerical modelling, simulation, materials and coupled systems.', 'Intéressé par les équipes de recherche et d’ingénierie travaillant sur la mécanique des structures, la modélisation numérique, la simulation, les matériaux et les systèmes couplés.', 'Structural mechanics, numerical modelling, simulation, materials ও coupled systems নিয়ে কাজ করা গবেষণা ও প্রকৌশল দলের সঙ্গে কাজ করতে আগ্রহী।'))),
      h('div', { class: 'internship-actions' }, h('a', { class: 'btn primary', href: href('contact') }, label('Get in touch', 'Me contacter', 'যোগাযোগ করুন')), h('a', { class: 'btn ghost', href: href('cv') }, t('home.cv')))),
    h('section', { class: 'block home-explore', 'aria-labelledby': 'h-explore' },
      h('div', { class: 'section-heading-row' }, h('div', null, h('p', { class: 'kicker' }, t('home.discoverKicker')), h('h2', { id: 'h-explore' }, t('home.explore')))),
      h('ul', { class: 'tiles' },
        [['research', 'home.exploreResearch', 'home.exploreResearchText'], ['projects', 'home.exploreProjects', 'home.exploreProjectsText'], ['coursework', 'home.exploreCoursework', 'home.exploreCourseworkText'], ['certificates', 'nav.certificates', 'home.exploreCertificatesText'], ['cv', 'nav.cv', 'home.exploreCvText']]
          .map(([r, a, b]) => h('li', null, h('a', { href: href(r), class: 'tile' }, h('strong', null, t(a)), h('span', null, t(b))))))));
}

export function about() {
  const P = D().profile;
  return h('div', null, pageHead('page.about'),
    h('div', { class: 'prose wide' }, inline(P.aboutShort, 'p', 'lead')),
    h('section', { class: 'block', 'aria-labelledby': 'a-long' }, h('h2', { id: 'a-long' }, t('page.aboutLong')), paras(P.aboutLong)),
    h('section', { class: 'block', 'aria-labelledby': 'a-int' }, h('h2', { id: 'a-int' }, t('home.interests')), chips(P.interests, 'big')));
}

function citation(pub) {
  return `${pub.authors.join(', ')} (${pub.year}). ${pub.title}. ${pub.journal}, ${pub.volume}, ${pub.article}. ${pub.doi}`;
}

export function research() {
  const pubs = D().publications;
  const items = pubs.map((pub) => {
    const proj = pub.projectId ? byId(pub.projectId) : null;
    const hl = proj ? (proj.images || []).filter((i) => i.highlight) : [];
    const copyBtn = h('button', { type: 'button', class: 'btn ghost small' }, t('pub.copyCitation'));
    copyBtn.addEventListener('click', async () => {
      if (await copyText(citation(pub))) { copyBtn.textContent = t('pub.copied'); setTimeout(() => { copyBtn.textContent = t('pub.copyCitation'); }, 2000); }
    });
    const authors = pub.authors.map((a, i) => [i ? ', ' : '', a === pub.me ? h('strong', null, a) : a]);
    return h('article', { class: 'publication' },
      h('h2', null, pub.title),
      h('p', { class: 'authors' }, authors),
      h('dl', { class: 'facts' },
        h('div', null, h('dt', null, t('pub.journal')), h('dd', null, `${pub.journal} (${pub.publisher}), ${pub.volume}, ${pub.article}, ${pub.year}`)),
        h('div', null, h('dt', null, t('pub.published')), h('dd', null, fmtDate(pub.online))),
        h('div', null, h('dt', null, t('pub.access')), h('dd', null, `Open access, ${pub.openAccess}`)),
        h('div', null, h('dt', null, t('pub.doi')), h('dd', null, h('a', { href: pub.doi, target: '_blank', rel: 'noopener' }, pub.doi.replace('https://doi.org/', ''))))),
      h('p', { class: 'note' }, t('pub.myRole'), ': ', inline(pub.myRole)),
      h('div', { class: 'actions' },
        h('a', { class: 'btn primary', href: pub.doi, target: '_blank', rel: 'noopener' }, t('pub.open')),
        proj ? h('a', { class: 'btn', href: href(route(proj)) }, t('pub.viewProject')) : null,
        copyBtn),
      h('h3', null, t('pub.summary')), paras(pub.summary),
      h('h3', null, t('pub.technical')), paras(pub.technical),
      chips(pub.keywords, 'tags'),
      hl.length ? h('div', { class: 'figures' }, hl.map(figure)) : null,
      hl.length ? h('p', { class: 'note' }, t('pub.figuresNote')) : null);
  });
  return h('div', null, pageHead('page.research'), items);
}

export function skills() {
  const groups = D().skills.map((g) => h('section', { class: 'card group' },
    h('h2', null, g.id === 'cad' ? h('a', { href: href(route(byId('solidworks-models'))), class: 'text-link' }, inline(g.title)) : inline(g.title)),
    h('ul', { class: 'skill-list' }, g.items.map((it) => {
      const ev = (it.evidence || []).map(byId).filter((p) => p && visible(p));
      return h('li', null, inline(typeof it.name === 'string' ? { en: it.name, fr: it.name } : it.name, 'span', 'skill'),
        ev.length ? h('span', { class: 'seen' }, ' ', t('label.seenIn'), ' ', ev.map((p, i) => [i ? ', ' : '', h('a', { href: href(route(p)) }, inline(p.title))])) : null);
    }))));
  return h('div', null, pageHead('page.skills', 'page.skillsIntro'), h('div', { class: 'grid2' }, groups));
}

export function background() {
  const exp = D().experience.map((e) => h('li', { class: 'timeline-item' },
    h('p', { class: 'when' }, inline(typeof e.dateLabel === 'string' ? { en: e.dateLabel, fr: e.dateLabel } : e.dateLabel), ' · ', t('kind.' + e.kind)),
    h('h3', null, inline(e.role)),
    h('p', { class: 'org' }, e.org, e.place ? [' — ', inline(e.place)] : null),
    bullets(e.points)));
  const edu = D().education.map((e) => h('li', { class: 'timeline-item' },
    h('p', { class: 'when' }, inline(typeof e.dateLabel === 'string' ? { en: e.dateLabel, fr: e.dateLabel } : e.dateLabel)),
    h('h3', null, inline(e.degree)),
    h('p', { class: 'org' }, e.org, e.place ? [' — ', inline(e.place)] : null),
    e.note ? paras(e.note) : null));
  const langs = D().languages.map((l) => h('li', null, h('strong', null, inline(l.name)), ' — ', inline(l.level)));
  return h('div', null, pageHead('page.background'),
    block('page.experience', h('ol', { class: 'timeline' }, exp), 'bg-exp'),
    block('page.education', h('ol', { class: 'timeline' }, edu), 'bg-edu'),
    block('page.languages', h('ul', { class: 'prose list' }, langs), 'bg-lang'));
}

const ENG_KINDS = ['service', 'recognition', 'membership', 'completion', 'participation', 'leadership', 'winner', 'runnerUp'];
function engagementEntry(en) {
  const pubs = (en.related?.publications || []).map((id) => D().publications.find((x) => x.id === id)).filter(Boolean);
  const exps = (en.related?.experience || []).map((id) => D().experience.find((x) => x.id === id)).filter(Boolean);
  const projs = (en.related?.projects || []).map(byId).filter((p) => p && visible(p));
  const links = [
    ...pubs.map((p) => h('li', null, t('engagement.relatedPublication'), ': ', h('a', { href: href('research') }, p.journal))),
    ...exps.map((x) => h('li', null, t('engagement.relatedExperience'), ': ', h('a', { href: href('background') }, inline(x.role), ', ', x.org))),
    ...projs.map((p) => h('li', null, t('engagement.related'), ': ', h('a', { href: href(route(p)) }, inline(p.title)))),
  ];
  const dateLabel = inline(en.dateLabel);
  return h('li', { class: 'timeline-item eng-item' },
    h('p', { class: 'when' }, ENG_KINDS.includes(en.kind) ? t('engagement.kind.' + en.kind) : en.kind, dateLabel ? [' · ', dateLabel] : null),
    h('h3', null, inline(en.title)),
    en.org ? h('p', { class: 'org' }, inline(en.org)) : null,
    paras(en.description),
    chips(en.topics, 'tags'),
    links.length ? h('ul', { class: 'prose list small' }, links) : null,
    en.evidence ? h('p', { class: 'evidence' }, t('engagement.evidence'), ': ', t('engagement.evidence.' + en.evidence)) : null);
}

export function engagement() {
  const items = D().engagement.filter((x) => x.status !== 'draft');
  const sections = state.site.engagementGroups.map((g) => {
    const list = items.filter((x) => x.group === g.id).sort((a, b) => (b.year || 0) - (a.year || 0));
    if (!list.length) return null;
    return h('section', { class: 'block', 'aria-labelledby': `eng-${g.id}`, 'data-group': g.id },
      h('h2', { id: `eng-${g.id}` }, inline(g.title)),
      g.intro ? inline(g.intro, 'p', 'note') : null,
      h('ol', { class: 'timeline' }, list.map(engagementEntry)));
  });
  return h('div', null, pageHead('page.engagement', 'page.engagementIntro'), sections);
}

export function art() {
  const A = D().art;
  return h('div', null, pageHead('page.art', 'page.artIntro'),
    h('p', { class: 'note' }, inline(A.series), ' · ', t('page.artNote')),
    h('div', { class: 'figures art' }, A.images.map(figure)));
}

export function certificates() {
  const items = D().certificates || [];
  return h('div', null, pageHead('page.certificates', 'page.certificatesIntro'),
    h('p', { class: 'note' }, t('certificates.disclaimer')),
    h('div', { class: 'certificate-grid' }, items.map((item) =>
      h('article', { class: 'certificate-card card' },
        h('a', { class: 'certificate-image-link', href: item.image, target: '_blank', rel: 'noopener', 'aria-label': `${t('certificates.open')}: ${txt(item.title)}` },
          h('img', { src: item.image, alt: txt(item.title), loading: 'lazy', decoding: 'async' })),
        h('div', { class: 'certificate-copy' },
          h('p', { class: 'meta' }, item.kind, item.date ? ` · ${item.date}` : ''),
          h('h2', null, inline(item.title)),
          h('p', { class: 'org' }, item.org),
          inline(item.description, 'p', 'summary'),
          h('a', { class: 'more', href: item.image, target: '_blank', rel: 'noopener' }, t('certificates.open'), ' ↗'))))));
}

export function cv() {
  const label = (en, fr, bn) => inline({ en, fr, bn });
  const P = D().profile, E = D().education, X = D().experience, S = D().skills, pubs = D().publications;
  const featured = D().projects.filter((p) => visible(p) && p.featured).slice(0, 4);
  const c = state.site.contact;
  const cvSections = (title, children, id) => h('section', { class: 'cv-section', 'aria-labelledby': id }, h('h2', { id }, title), children);
  return h('article', { class: 'cv-page' },
    h('header', { class: 'cv-header' },
      h('div', null, h('p', { class: 'kicker' }, t('home.kicker')), h('h1', { id: 'page-title', tabindex: '-1' }, state.lang === 'bn' ? 'রিদওয়ান আহমদ' : P.name), inline(P.headline, 'p', 'cv-headline'),
        h('p', { class: 'cv-contact-line' }, `${txt(P.location)} · ${c.email} · `, h('a', { href: c.linkedin, target: '_blank', rel: 'noopener' }, 'LinkedIn'))),
      h('div', { class: 'cv-actions no-print' }, h('a', { class: 'btn primary', href: cvHref(), download: '' }, t('cv.download')), h('button', { class: 'btn ghost', type: 'button', onclick: () => window.print() }, t('cv.print')))),
    cvSections(t('cv.profile'), inline(P.aboutShort, 'p', 'cv-summary'), 'cv-profile'),
    cvSections(t('cv.education'), h('div', { class: 'cv-list' }, E.map((e) => h('div', { class: 'cv-entry' }, h('h3', null, inline(e.degree)), h('p', { class: 'org' }, e.org, ' · ', inline(e.place)), h('p', { class: 'when' }, inline(e.dateLabel)), e.note ? paras(e.note) : null))), 'cv-education'),
    cvSections(t('cv.publications'), h('ul', { class: 'prose list' }, pubs.map((p) => h('li', null, `${p.title}. ${p.journal}, ${p.year}. `, h('a', { href: p.doi, target: '_blank', rel: 'noopener' }, 'DOI')))), 'cv-publications'),
    cvSections(t('cv.experience'), h('div', { class: 'cv-list' }, X.map((e) => h('div', { class: 'cv-entry' }, h('h3', null, inline(e.role)), h('p', { class: 'org' }, e.org, ' · ', inline(e.place)), h('p', { class: 'when' }, inline(e.dateLabel)), bullets(e.points)))), 'cv-experience'),
    cvSections(t('cv.skills'), h('div', { class: 'cv-skills' }, S.map((g) => h('p', null, h('strong', null, inline(g.title)), ': ', g.items.map((it, i) => [i ? ', ' : '', inline(typeof it.name === 'string' ? { en: it.name, fr: it.name, bn: it.name } : it.name)])))), 'cv-skills'),
    cvSections(t('cv.projects'), h('ul', { class: 'prose list' }, featured.map((p) => h('li', null, inline(p.title), ' — ', inline(p.summary)))), 'cv-projects'),
    cvSections(label('Leadership, Awards & Extracurricular Activities', 'Responsabilités, distinctions et activités extrascolaires', 'Leadership, Awards & Extracurricular Activities'), h('ul', { class: 'prose list' }, [
      'President, BAUST Cultural Society (5th Committee)',
      'Prefect, BN MPC',
      'NASA Space Apps Collective Cohort (2023) — selected among 30 global Space Leaders',
      'Winner, GPH Ispat Esho Robot Banai Idea Contest; participant in the 72-hour hackathon',
      'Runner-up, BAUST intra-university instrumental cultural contest',
      'Delegate (Iran), Economic and Financial Committee, Bangladesh Model United Nations 2016',
      'Participant, SustainX Global Case Study Competition 2021',
      'Member, International Association of Engineers (IAENG)',
      'Peer reviewer, Results in Engineering (Elsevier)',
      'Microsoft Engineering Virtual Experience Program; VR game development workshop (Unity)'
    ].map(x => h('li', null, x))), 'cv-extracurricular'),
    cvSections(label('Academic References', 'Références académiques', 'Academic References'), h('ul', { class: 'prose list cv-references' },
      h('li', null, h('strong', null, 'Lucie Rouleau'), ' — Maître de conférences – HDR, LMSSC, Cnam Paris · ', h('a', { href:'mailto:lucie.rouleau@lecnam.net' }, 'lucie.rouleau@lecnam.net')),
      h('li', null, h('strong', null, 'Jean-François Deü'), ' — Professor, LMSSC, Cnam Paris · ', h('a', { href:'mailto:jean-francois.deu@cnam.fr' }, 'jean-francois.deu@cnam.fr'))), 'cv-references'),
    cvSections(t('cv.languages'), h('ul', { class: 'prose list cv-language-list' }, D().languages.map((l) => h('li', null, h('strong', null, inline(l.name)), ' — ', inline(l.level)))), 'cv-languages'),
    h('p', { class: 'cv-cert-link no-print' }, h('a', { class: 'btn', href: href('certificates') }, t('cv.openCertificates'))));
}

export function contact() {
  const c = state.site.contact;
  const P = D().profile;
  const copy = h('button', { type: 'button', class: 'btn ghost' }, t('contact.copy'));
  copy.addEventListener('click', async () => { if (await copyText(c.email)) { copy.textContent = t('contact.copied'); setTimeout(() => { copy.textContent = t('contact.copy'); }, 2000); } });
  const cvNote = state.site.cv[state.lang] ? null : (state.lang !== state.site.defaultLanguage ? h('p', { class: 'note' }, t('contact.cvLangNote')) : null);
  return h('div', null, pageHead('page.contact', 'contact.intro'),
    h('dl', { class: 'facts contact' },
      h('div', null, h('dt', null, t('contact.email')), h('dd', null, h('a', { href: `mailto:${c.email}` }, c.email), ' ', copy)),
      h('div', null, h('dt', null, t('contact.linkedin')), h('dd', null, h('a', { href: c.linkedin, target: '_blank', rel: 'noopener' }, c.linkedin.replace('https://www.', '')))),
      h('div', null, h('dt', null, t('contact.location')), h('dd', null, inline(P.location)))),
    (c.socials || []).length ? h('section', { class: 'block', 'aria-labelledby': 'c-links' }, h('h2', { id: 'c-links' }, t('contact.links')), h('div', { class: 'social-row' }, c.socials.filter((x) => x.url).map((x) => h('a', { href: x.url, target: x.url.startsWith('http') ? '_blank' : null, rel: x.url.startsWith('http') ? 'noopener' : null }, inline(x.label))))) : null,
    h('section', { class: 'block', 'aria-labelledby': 'c-cv' }, h('h2', { id: 'c-cv' }, t('contact.cv')),
      h('p', null, h('a', { class: 'btn primary', href: cvHref(), download: '' }, t('contact.cvDownload'))), cvNote),
    h('p', { class: 'note' }, t('contact.formNote')));
}

export function notFound() {
  return h('div', null, pageHead('page.notFound'), h('p', null, t('page.notFoundText')), h('p', null, h('a', { class: 'btn', href: href('') }, t('nav.home'))));
}

export const pages = {
  '': () => home(),
  about: () => about(),
  projects: (param) => (param ? projectDetail(param, 'project') : listPage('project', 'page.projects', 'page.projectsIntro')),
  coursework: (param) => (param ? projectDetail(param, 'coursework') : listPage('coursework', 'page.coursework', 'page.courseworkIntro')),
  research: () => research(),
  skills: () => skills(),
  background: () => background(),
  engagement: () => engagement(),
  certificates: () => certificates(),
  cv: () => cv(),
  recognition: () => engagement(),
  art: () => art(),
  contact: () => contact(),
};

export function pageTitle(r, param) {
  if (param) { const p = byId(param); if (p && p.status !== 'draft') return txt(p.title); }
  return r ? (r === 'recognition' ? t('page.engagement') : t('page.' + r)) : t('meta.siteTitle');
}
