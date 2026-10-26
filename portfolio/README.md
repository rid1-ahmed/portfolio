# Ridwan Ahmed — engineering portfolio

A static website: plain HTML, CSS and JavaScript modules. **No build step, no npm dependencies, no backend, no database.**
Every page is drawn from JSON files in `content/`, so you edit content, never layout code.

Why not React/Vite? The site is content-driven and static; a framework would add a build chain and dependencies without adding features
you need, and the build tools could not be installed in the environment this was produced in. The data model and separation of content and
presentation are the same as a React/TypeScript version would use.

## Run locally
```
node tools/serve.mjs 8080      # then open http://localhost:8080/
# or: python3 -m http.server 8080
```
Opening `index.html` by double-click does **not** work (browsers block loading the JSON files from `file://`).

## Check your changes
```
node tools/validate-content.mjs
```
It checks: unique project ids, valid categories/types/status, missing images or files, missing alt text, broken `related` links,
missing text in any enabled language, and UI-string parity between languages. Fix every `ERROR` before publishing.

## Folder map
```
index.html              page shell (do not put content here)
css/styles.css          design system: colours are variables at the top (light + dark)
js/                     app.js (router, theme, language), views.js (page templates), i18n.js, util.js
content/site.json       languages, navigation, categories, project types, CV paths, contact
content/data/*.json     profile, projects, publications, experience, education, skills, engagement, art, languages, certificates
content/locales/*.json  interface strings (buttons, labels) per language
assets/images/          project and research images (webp)
assets/documents/cv/    downloadable CV
tools/                  validator, preview server, browser test
docs/                   PROJECT_INVENTORY.md, PORTFOLIO_CONTEXT.md, MISSING_INFO.md
```

## How translated text works
Any text that differs by language is an object: `{ "en": "…", "fr": "…" }`. Plain strings (names, tool names, DOIs) are shared.
Lists are per-language arrays: `{ "en": ["a","b"], "fr": ["a","b"] }`.
If a language is **enabled** but a field lacks its text, the validator fails, and the page shows the English text with a visible
"not yet translated" marker, so an incomplete translation is never passed off as finished.

## Common tasks

### Replace my CV
Put the new PDF in `assets/documents/cv/` (e.g. `Ridwan_AHMED_CV_fr.pdf`) and set the path in `content/site.json` → `cv`:
`"en": "assets/documents/cv/Ridwan_AHMED_CV_en.pdf", "fr": "assets/documents/cv/Ridwan_AHMED_CV_fr.pdf"`.
While `fr` is `null`, French visitors get the English CV with a note. The current PDF contains a phone number; publish a copy without it if you prefer.

### Add a project (library) or an assignment (archive)
1. Open `content/data/projects.json` and copy the nearest existing entry.
2. Required fields only: `id` (lowercase-with-hyphens, never changes), `level` (`"project"` or `"coursework"`), `status` (`"published"`, `"draft"` hides it, `"archived"` hides it from lists), `title`, `summary`, plus `categories`.
3. Everything else is optional: `year`, `date`, `type`, `course`, `institution`, `supervisor`, `group`, `tools`, `tags`, `description`, `contribution`,
   `objectives`, `methodology`, `results`, `dataTables`, `limitations`, `learned`, `images`, `links`, `related`.
   An entry with only a summary shows as a plain card; once it has any detail field it automatically gets its own page.
4. Images: copy to `assets/images/projects/<id>/` (webp or jpg, ≤ 1500 px wide) and add `{ "src": "...", "alt": {…}, "caption": {…} }` to `images`.
5. Featured on the home page: set `"featured": true` and `"featuredOrder": 3`. Remove the flag to unfeature.
6. Promote an archive entry to a full project: change `"level": "coursework"` to `"project"` and add detail fields.
7. Run `node tools/validate-content.mjs`, then deploy.

A one-line assignment is just:
```json
{ "id": "fem-hw3", "level": "coursework", "status": "published", "categories": ["fem"], "tools": ["MATLAB"],
  "title": {"en": "…", "fr": "…"}, "summary": {"en": "…", "fr": "…"} }
```
New topic filter: add `{ "id": "...", "label": {"en": "…", "fr": "…"} }` to `categories` in `content/site.json`. Filters appear only for values that exist.

### Add a publication
Add an object to `content/data/publications.json` (copy the existing one). Keep author order exactly as printed. `projectId` links it to a project page.

### Experience, education, skills
Each has its own file in `content/data/`; add an object to the array. Order in the file is order on the page (newest first for experience).
Skills can list `evidence`: project ids that demonstrate the skill.

### Professional Development, Leadership & Scientific Engagement
Page `#/en/engagement`, data in `content/data/engagement.json`, subsection titles in `content/site.json` → `engagementGroups`.
Add an object to `engagement.json`:
```json
{ "id": "new-id", "group": "affiliations", "kind": "membership",
  "title": {"en": "…", "fr": "…"}, "org": "…", "dateLabel": {"en": "…", "fr": "…"}, "year": 2026,
  "description": {"en": "…", "fr": "…"}, "evidence": "certificate",
  "topics": [{"en": "…", "fr": "…"}], "related": {"projects": ["project-id"], "publications": ["jscp-2024"], "experience": ["bli-2021"]} }
```
- `group`: one of the ids in `engagementGroups` (research-service, space-engagement, affiliations, technical-development, leadership, competitions). A group with no entries is not shown. To add a subsection, add an object to `engagementGroups`.
- `kind` keeps the distinctions honest: `service`, `recognition`, `membership`, `completion`, `participation`, `leadership`, `winner`, `runnerUp`. Pick the one the document supports; a participation certificate is not a win.
- `evidence`: `certificate`, `letter`, `plaque` or `cv` (shown as "Source: …"). Use `cv` when only your CV states it.
- `related` and `topics` are optional; only link things that genuinely relate. `"status": "draft"` hides an entry.
- Certificates themselves are **not** published (they contain member, roll and verification numbers). Keep them out of `assets/`.

### Art & Sketchbook
Page `#/en/art`, data in `content/data/art.json` (separate from all technical sections). Copy the image to `assets/images/art/` (webp, ≤ 1400 px) and add `{ "id", "src", "alt": {"en","fr"} }` (optional `caption`) to `images`; change `series` for the page label.

### Edit translations / interface text
Interface words: `content/locales/en.json` and `fr.json` (same keys in each). Content text: inside the `{en, fr}` objects.

### Change contact details
`content/site.json` → `contact` (email, LinkedIn, paper DOI). There is deliberately no contact form: a form needs a service that actually delivers mail.

### Bengali language status
Also translate the `engagementGroups` and `art` text; the validator lists everything still missing.
1. Translate every key of `content/locales/en.json` into `content/locales/bn.json`.
2. Add a `"bn"` entry to every `{en, fr}` object in `content/data/*.json` and `content/site.json`.
3. Self-host a Bengali font (e.g. Noto Sans Bengali, woff2) in `assets/fonts/` and declare it with `@font-face` in `css/styles.css`; the font stack already lists Bengali fallbacks.
4. Run `node tools/validate-content.mjs` (the warning for `bn` shows how much remains), then set `"enabled": true` for `bn` in `content/site.json`.
5. Check line wrapping on phone and desktop. Bengali is enabled in the language selector. Some technical project descriptions remain in English pending a careful translation pass.

## Deploy
**GitHub Pages (free):** create a repository, upload the contents of this folder (the `.nojekyll` file included), then Settings → Pages → Deploy from branch → `main` / root.
The site appears at `https://<username>.github.io/<repository>/`. To update: commit the changed files.
**Netlify / Cloudflare Pages:** drag the folder in (or connect the repository); no build command, publish directory is the root.
Nothing has been deployed by me; publishing needs your account.

## Known limits
- Social-media link previews (LinkedIn, etc.) read only the static tags in `index.html`, so they show the English description and no image. A preview image can be added with an `og:image` tag once you choose one.
- Pages use hash routes (`#/en/projects`) so the site works on any static host without server rules.
- Figures from the published paper are used under its CC BY-NC 4.0 licence with attribution; this suits a non-commercial portfolio.


## Portfolio media and languages

The homepage uses the original CNAM Paris photograph supplied by Ridwan Ahmed as its hero image and the original portrait in the introduction section. Certificate previews are generated from the supplied evidence PDF; private verification codes, certificate IDs and membership numbers are omitted or redacted. English, French and Bengali navigation are enabled. Some detailed technical project descriptions currently remain in English in the Bengali view to preserve technical wording and should be fully translated in a final language-editing pass.
