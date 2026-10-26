// Headless browser smoke test. Needs Playwright + Chromium (dev-only; not required to run the site).
// Run: node tools/serve.mjs 8099 &  then  node tools/browser-test.mjs http://localhost:8099/
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/home/claude/.npm-global/lib/node_modules/playwright')); }
const base = process.argv[2] || 'http://localhost:8099/';
const shots = process.argv[3] || null;
const results = []; let failed = 0;
const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); if (!cond) failed++; };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`console ${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => problems.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });

const go = async (hash) => { await page.goto(base + hash); await page.waitForSelector('#page-title'); };
const routes = ['', 'about', 'projects', 'coursework', 'research', 'skills', 'background', 'certificates', 'engagement', 'art', 'cv', 'contact'];

for (const lang of ['en', 'fr', 'bn']) {
  for (const r of routes) {
    await go(`#/${lang}/${r}`);
    const h1 = (await page.textContent('#page-title')).trim();
    ok(`${lang}/${r || 'home'} renders h1`, h1.length > 1, h1);
    ok(`${lang}/${r || 'home'} html lang`, (await page.getAttribute('html', 'lang')) === lang);
    const untr = await page.locator('.untranslated').count();
    ok(`${lang}/${r || 'home'} no untranslated fallback`, untr === 0, untr ? `${untr} flagged` : '');
    const imgs = await page.$$eval('img', (els) => els.map((i) => ({ src: i.src, ok: i.complete && i.naturalWidth > 0 })));
    // wait for lazy ones by scrolling
    if (imgs.length) { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300); }
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {});
    const bad = await page.$$eval('img', (els) => els.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.src));
    ok(`${lang}/${r || 'home'} images load`, bad.length === 0, bad.join(', '));
  }
}

// every project/coursework detail page
const ids = await (await fetch(base + 'content/data/projects.json')).json();
for (const p of ids) {
  const route = p.level === 'coursework' ? 'coursework' : 'projects';
  const hasDetail = ['description','objectives','methodology','results','limitations','learned','contribution','images','dataTables','links'].some((k) => p[k] && (!Array.isArray(p[k]) || p[k].length));
  if (!hasDetail) continue;
  for (const lang of ['en', 'fr', 'bn']) {
    await go(`#/${lang}/${route}/${p.id}`);
    ok(`detail ${lang}/${p.id}`, (await page.textContent('#page-title')).length > 3 && (await page.locator('.untranslated').count()) === 0);
    if (p.images?.length) { await page.evaluate(async () => { for (const i of document.images) i.scrollIntoView(); window.scrollTo(0, document.body.scrollHeight); }); await page.waitForTimeout(400); }
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {});
    const bad = await page.$$eval('img', (els) => els.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.src));
    ok(`detail images ${lang}/${p.id}`, bad.length === 0, bad.join(', '));
  }
}

// engagement: six subsections, every entry labelled with its kind
await go('#/en/engagement');
ok('engagement has 6 subsections', (await page.locator('section[data-group]').count()) === 6);
const engCount = await page.locator('.eng-item').count();
const engData = await (await fetch(base + 'content/data/engagement.json')).json();
ok('engagement renders every entry from data', engCount === engData.length, `${engCount}/${engData.length}`);
ok('engagement title is the full section name', (await page.textContent('#page-title')).includes('Professional Development, Leadership'));
ok('IAENG shown as membership, hackathon as participation', (await page.textContent('main')).includes('Membership') && (await page.textContent('main')).includes('Participation'));
await go('#/fr/engagement');
ok('engagement French title', (await page.textContent('#page-title')).includes('Développement professionnel'));
await go('#/en/recognition');
ok('old #/recognition link still works', (await page.textContent('#page-title')).includes('Professional Development'));
// art
await go('#/en/art');
ok('art shows 7 drawings', (await page.locator('.figures.art figure').count()) === 7);
await go('#/en/certificates'); ok('certificate gallery shows 10 cards', (await page.locator('.certificate-card').count()) === 10);
await go('#/en/cv'); ok('CV page renders sections', (await page.locator('.cv-section').count()) >= 6);
// no partner names anywhere in published content or rendered pages
const all = (await Promise.all(['projects','publications','experience','education','skills','engagement','art','profile'].map(async (n) => JSON.stringify(await (await fetch(base + `content/data/${n}.json`)).json())))).join(' ');
const blocked = (process.env.BLOCKED_NAMES || '').split(',').filter(Boolean); // names that must never appear, e.g. BLOCKED_NAMES=First,Second
ok('no blocked names in content', blocked.every((n) => !all.toLowerCase().includes(n.toLowerCase())), blocked.length ? '' : 'no names configured');
// patran displacement table present
await go('#/en/projects/annular-cylinder-fem');
ok('FEM page shows displacement results table', (await page.textContent('main')).includes('Radial displacement u_r'));
// new media
await go('#/en/projects/solidworks-models'); ok('SolidWorks project has 3 renders', (await page.locator('.figure img').count()) === 3);
await go('#/en/projects/desktop-wind-tunnel'); ok('wind tunnel page has photo', (await page.locator('.figure img').count()) === 1);

// header stays on one row on wide screens
const wide = await browser.newContext({ viewport: { width: 1440, height: 800 } });
const wp = await wide.newPage();
await wp.goto(base + '#/fr/'); await wp.waitForSelector('#page-title');
ok('header is a single row at 1440px (FR)', (await wp.evaluate(() => document.querySelector('.site-header').offsetHeight)) < 80);

// language switch keeps the page
await go('#/en/projects/jscp-al-mmc');
await page.click('.langs a[lang="fr"]');
await page.waitForFunction(() => location.hash.startsWith('#/fr/projects/jscp-al-mmc'));
ok('language switch preserves route', page.url().includes('#/fr/projects/jscp-al-mmc'));
ok('language switch changes text', (await page.textContent('#page-title')).includes('Composite à matrice'));
ok('language switch changes nav', (await page.textContent('#main-nav')).includes('Recherche'));
ok('only enabled languages offered', (await page.locator('.langs a').count()) === 3);

// theme toggle
await go('#/en/');
const t0 = await page.getAttribute('html', 'data-theme');
await page.click('button[aria-label*="theme"]');
const t1 = await page.getAttribute('html', 'data-theme');
ok('theme toggles', t0 !== t1, `${t0} -> ${t1}`);
await page.reload(); await page.waitForSelector('#page-title');
ok('theme persists after reload', (await page.getAttribute('html', 'data-theme')) === t1);
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
ok('dark/light background applied', bg !== 'rgba(0, 0, 0, 0)', bg);
if (shots) await page.screenshot({ path: `${shots}/home-${t1}.png`, fullPage: true });

// filters and search
await go('#/en/projects');
const total = await page.locator('#results .card').count();
await page.fill('#f-project-q', 'patran');
ok('search narrows results', (await page.locator('#results .card').count()) === 1, `${total} -> 1`);
await page.fill('#f-project-q', 'zzzz-nomatch');
ok('empty state shown', (await page.locator('#results .empty').count()) === 1);
await page.click('button:has-text("Reset filters")');
ok('reset restores list', (await page.locator('#results .card').count()) === total);
await page.selectOption('#f-project-cat', 'materials-composites');
ok('category filter works', (await page.locator('#results .card').count()) === 1);
await go('#/en/coursework');
await page.selectOption('#f-coursework-tool', 'MATLAB');
ok('coursework tool filter', (await page.locator('#results .card').count()) === 2, String(await page.locator('#results .card').count()));

// links
await go('#/en/contact');
const mail = await page.getAttribute('a[href^="mailto:"]', 'href');
ok('mailto link', mail === 'mailto:ridwan.ahmed.auditeur@lecnam.net');
const cv = await page.getAttribute('a[download]', 'href');
const r = await fetch(base + cv);
ok('CV link resolves to a PDF', r.ok && (r.headers.get('content-type') || '').includes('pdf'), cv);
await go('#/fr/contact');
ok('FR contact shows English-only CV note', (await page.textContent('main')).includes('qu’en anglais'));
await go('#/en/research');
ok('DOI link', (await page.getAttribute('.publication a[href*="doi.org"]', 'href')).includes('10.1016/j.rineng.2024.101990'));

// unknown route
await go('#/en/nope');
ok('404 view', (await page.textContent('#page-title')).includes('not found'));
// missing language prefix redirects
await page.goto(base + '#/projects'); await page.waitForSelector('#page-title');
ok('hash without language redirects', /#\/(en|fr|bn)\/projects/.test(page.url()));

// mobile
const m = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true });
const mp = await m.newPage();
await mp.goto(base + '#/en/'); await mp.waitForSelector('#page-title');
const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok('mobile home has no horizontal overflow', overflow <= 1, `${overflow}px`);
ok('mobile nav hidden by default', !(await mp.locator('#main-nav').isVisible()));
await mp.click('.menu-btn');
ok('mobile menu opens', await mp.locator('#main-nav').isVisible());
await mp.click('#main-nav a[href$="/research"]');
await mp.waitForSelector('.publication');
ok('mobile menu navigates and closes', !(await mp.locator('#main-nav').isVisible()));
for (const route of ['projects/jscp-al-mmc', 'projects/annular-cylinder-fem', 'research', 'background', 'engagement', 'art']) {
  await mp.goto(base + `#/fr/${route}`); await mp.waitForSelector('#page-title'); await mp.waitForTimeout(200);
  const o = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`mobile fr/${route} no horizontal overflow`, o <= 1, `${o}px`);
}
if (shots) { await mp.goto(base + '#/en/'); await mp.waitForTimeout(300); await mp.screenshot({ path: `${shots}/mobile-home.png` }); }

ok('no console errors / failed requests', problems.length === 0, problems.slice(0, 5).join(' | '));
console.log(results.join('\n'));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
await browser.close();
process.exit(failed ? 1 : 0);
