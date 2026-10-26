// Content validator — no dependencies. Run: node tools/validate-content.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

const site = read('content/site.json');
const codes = site.languages.map((l) => l.code);
const enabled = site.languages.filter((l) => l.enabled).map((l) => l.code);
const names = ['profile', 'projects', 'publications', 'experience', 'education', 'skills', 'engagement', 'art', 'languages', 'certificates'];
const data = {};
for (const n of names) { try { data[n] = read(`content/data/${n}.json`); } catch (e) { err(`content/data/${n}.json: ${e.message}`); } }

const isLoc = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length && Object.keys(v).every((k) => codes.includes(k));
const filled = (x) => x != null && x !== '' && !(Array.isArray(x) && !x.length);

// 1. every localised value must be complete in every enabled language; report coverage of others
const coverage = Object.fromEntries(codes.map((c) => [c, { have: 0, total: 0 }]));
function walk(v, where) {
  if (isLoc(v)) {
    for (const c of codes) { coverage[c].total++; if (filled(v[c])) coverage[c].have++; }
    for (const c of enabled) if (!filled(v[c])) err(`${where}: missing "${c}" text`);
    return;
  }
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
}
for (const n of names) walk(data[n], n);
walk(site.categories, 'site.categories'); walk(site.projectTypes, 'site.projectTypes');

// 2. project rules
const projects = data.projects || [];
const ids = new Set();
const catIds = new Set(site.categories.map((c) => c.id));
const typeIds = new Set(site.projectTypes.map((c) => c.id));
for (const p of projects) {
  const w = `project "${p.id}"`;
  if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) err(`${w}: id must be lowercase letters, digits and hyphens`);
  if (ids.has(p.id)) err(`${w}: duplicate id`); ids.add(p.id);
  if (!['project', 'coursework'].includes(p.level)) err(`${w}: level must be "project" or "coursework"`);
  if (!['published', 'draft', 'archived'].includes(p.status)) err(`${w}: status must be published, draft or archived`);
  if (!filled(p.title)) err(`${w}: title required`);
  if (!filled(p.summary)) err(`${w}: summary required`);
  if (p.type && !typeIds.has(p.type)) err(`${w}: unknown type "${p.type}"`);
  for (const c of p.categories || []) if (!catIds.has(c)) err(`${w}: unknown category "${c}"`);
  if (p.featured && p.level !== 'project') warn(`${w}: featured but not a library project`);
}
for (const p of projects) {
  for (const r of p.related || []) if (!ids.has(r)) err(`project "${p.id}": related id "${r}" does not exist`);
  for (const im of p.images || []) {
    if (!fs.existsSync(path.join(root, im.src))) err(`project "${p.id}": image not found: ${im.src}`);
    if (!filled(im.alt)) err(`project "${p.id}": image without alt text: ${im.src}`);
  }
  for (const l of p.links || []) if (l.file && !fs.existsSync(path.join(root, l.file))) err(`project "${p.id}": file not found: ${l.file}`);
}
for (const g of data.skills || []) for (const it of g.items) for (const e of it.evidence || []) if (!ids.has(e)) err(`skill evidence id "${e}" does not exist`);
for (const pub of data.publications || []) if (pub.projectId && !ids.has(pub.projectId)) err(`publication "${pub.id}": projectId not found`);

// 3. CV files
for (const [lang, f] of Object.entries(site.cv)) if (f && !fs.existsSync(path.join(root, f))) err(`CV file for "${lang}" not found: ${f}`);
if (!site.cv.en) err('English CV missing');

// 4. UI strings: same keys in enabled languages; every t('key') used in code exists in English
const ui = {};
for (const c of codes) { try { ui[c] = read(`content/locales/${c}.json`); } catch { ui[c] = {}; err(`locale ${c}.json missing`); } }
const base = Object.keys(ui[site.defaultLanguage]);
for (const c of enabled) {
  for (const k of base) if (!filled(ui[c][k])) err(`locale ${c}: missing key "${k}"`);
  for (const k of Object.keys(ui[c])) if (!(k in ui[site.defaultLanguage])) warn(`locale ${c}: extra key "${k}"`);
}
for (const c of codes.filter((x) => !enabled.includes(x))) {
  const have = base.filter((k) => filled(ui[c][k])).length;
  warn(`language "${c}" is disabled: UI ${have}/${base.length} keys, content ${coverage[c].have}/${coverage[c].total} fields translated`);
}
const used = new Set();
for (const f of fs.readdirSync(path.join(root, 'js'))) {
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) if (!m[1].endsWith('.')) used.add(m[1]); // keys ending in '.' are built dynamically and checked below
  for (const m of src.matchAll(/'((?:nav|ptype|kind|award)\.)'\s*\+/g)) { /* dynamic prefixes checked below */ }
}
for (const k of used) if (!(k in ui[site.defaultLanguage])) err(`UI key used in code but missing from en.json: ${k}`);
for (const r of site.nav) if (!(`nav.${r}` in ui.en)) err(`nav.${r} missing`);
for (const t of site.projectTypes) if (!(`ptype.${t.id}` in ui.en)) err(`ptype.${t.id} missing`);
const groupIds = new Set((site.engagementGroups || []).map((g) => g.id));
walk(site.engagementGroups, 'site.engagementGroups');
const expIds = new Set((data.experience || []).map((x) => x.id));
const pubIds = new Set((data.publications || []).map((x) => x.id));
const engIds = new Set();
for (const en of data.engagement || []) {
  const w = `engagement "${en.id}"`;
  if (engIds.has(en.id)) err(`${w}: duplicate id`); engIds.add(en.id);
  if (!groupIds.has(en.group)) err(`${w}: unknown group "${en.group}"`);
  if (!(`engagement.kind.${en.kind}` in ui.en)) err(`${w}: unknown kind "${en.kind}"`);
  if (en.evidence && !(`engagement.evidence.${en.evidence}` in ui.en)) err(`${w}: unknown evidence "${en.evidence}"`);
  if (!filled(en.title)) err(`${w}: title required`);
  for (const r of en.related?.projects || []) if (!ids.has(r)) err(`${w}: related project "${r}" not found`);
  for (const r of en.related?.publications || []) if (!pubIds.has(r)) err(`${w}: related publication "${r}" not found`);
  for (const r of en.related?.experience || []) if (!expIds.has(r)) err(`${w}: related experience "${r}" not found`);
}
for (const g of site.engagementGroups || []) if (!(data.engagement || []).some((x) => x.group === g.id)) warn(`engagement group "${g.id}" has no entries (it will not be shown)`);
for (const im of data.art?.images || []) {
  if (!fs.existsSync(path.join(root, im.src))) err(`art image not found: ${im.src}`);
  if (!filled(im.alt)) err(`art image without alt text: ${im.src}`);
}
for (const e of data.experience || []) if (!(`kind.${e.kind}` in ui.en)) err(`kind.${e.kind} missing`);

// 5. unused asset files (info only)
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)])); }
const refs = new Set([...projects.flatMap((p) => [...(p.images || []).map((i) => i.src), p.thumb].filter(Boolean)), ...(data.art?.images || []).map((i) => i.src), data.profile?.photo, data.profile?.heroImage, ...(data.certificates || []).map((c) => c.image)].filter(Boolean));
for (const f of files(path.join(root, 'assets/images'))) { const rel = path.relative(root, f).split(path.sep).join('/'); if (!refs.has(rel)) warn(`asset not referenced by site content: ${rel}`); }

console.log(`Checked ${projects.length} project entries, ${(data.engagement || []).length} engagement entries, ${(data.art?.images || []).length} drawings, ${enabled.length} enabled languages (${enabled.join(', ')}).`);
for (const w of warnings) console.log('  warning:', w);
for (const e of errors) console.log('  ERROR:', e);
console.log(errors.length ? `\n${errors.length} error(s).` : '\nContent valid.');
process.exit(errors.length ? 1 : 0);
