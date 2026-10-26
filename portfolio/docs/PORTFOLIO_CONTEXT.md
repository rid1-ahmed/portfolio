# PORTFOLIO_CONTEXT (updated 2026-10-23)

## Professional positioning
- Identify Ridwan as a **mechanical engineer** currently pursuing an **M2 in Structural Mechanics and Coupled Systems at CNAM Paris**. Do not describe him as already holding this M2 degree.
- Technical interests explicitly include structural mechanics, vibrations/structural dynamics, fluid–structure interaction (FSI), finite-element modelling, coupled/multiphysics systems, composite materials and aerospace applications. Interests must not be presented as proven project experience unless supported by a project.

## Decisions
- Static site, vanilla JS modules, JSON content, hash routing, no dependencies (no network in build environment; also simplest to maintain).
- Languages: EN, FR enabled; BN prepared (`enabled:false`), shown nowhere until complete.
- Featured: (1) JSCP composite paper, (2) Lamé annulus FEM project. Archive: trust-region, MATLAB roots, USMC72 homework, composite lab.
- Engagement section (`#/engagement`): six data-driven subsections from `engagement.json`; kinds (membership / participation / completion / recognition / leadership / winner) follow the certificate wording. Art & Sketchbook (`#/art`) is separate.
- No names of group partners anywhere on the site.
- Nav switches to the menu button below 1320 px (nine items).
- CV-only projects shown as summary cards (no invented detail).

## Done
- All 10 sections as 9 pages (Background = experience + education + languages; Recognition = awards + activities).
- Project library + coursework archive with search and filters (topic, type, year, tool); detail template; featured flag.
- Light/dark theme (OS default, stored choice), language switch keeping the current page, mobile menu, skip link, focus states.
- 13 original paper figures (webp, credited CC BY-NC 4.0), 6 FEM figures.
- Content validator; headless browser test on 2026-10-23: see tools/browser-test.mjs (149/149 passed on 2026-10-23 after the engagement/art sections and header fix) (EN+FR on all pages, detail pages, images, filters, theme, language switch, mobile overflow, CV/DOI/mailto links, console errors).

## Authorship
- Site wording: "Author of the paper" + CRediT roles; no position stated; author list in published order. No first/co-first claim (not in the paper).

## Not done / not verified
- Not deployed; needs your GitHub/Netlify account.
- Only Chromium tested; Firefox/Safari and real phones not tested.
- French text written by me, not proofread by a native speaker.
- Contrast checked by design (token choice), not with an audit tool.
- Bangla.

## Next actions
1. Resolve items in MISSING_INFO.md (CV vs certificate discrepancies, verify FEM displacement values in Patran).
2. Proofread French; confirm programme name.
3. Deploy; test the live URL.
4. Add the Bangla translation and font; enable.
5. Add M2 coursework as it arrives.
