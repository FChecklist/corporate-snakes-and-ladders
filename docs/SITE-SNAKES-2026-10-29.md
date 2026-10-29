# Corporate Snakes and Ladders: the website in the Corporate Games look (2026-10-29)

Branch `site/snakes-cloud-2026-10-29`, cut from `boss/docs-2026-10-29` (the live commit `d2a3ebd` plus the boss documents). Not merged, not deployed, no Cloudflare, Resend or Razorpay action, no secret, no change of `version.json` or the release notes.

Owner order: every public page of the game looks and feels like https://housie.corporatetambola.com (warm paper, Inter and Fraunces, the studio-blue header, the hero question, "What you can count on", "How a game day feels", the footer, the buttons, the search and share tags, the phone icons). Header menu: exactly six items, in this order: **How it works | Free demo game | Guide | Brochure | Refer & earn | Log in**.

## In plain words

- Every public page now takes the Corporate Games brand kit and the games bar, copied unchanged and pinned by SHA-256 tests.
- The header has the six items on all 28 website pages; a test fails if a word, the order or an address changes.
- New: a "How it works" page, a printable Brochure and Guide each with a PDF, and a branded 404, offline and sign-in page.
- The organizer console got only the visual shell (colours, fonts, top bar, status chips). Its scripts, steps, options and routes are untouched.
- Payments say "IT Services by Rajat Agarwal, through Razorpay" in every page footer, the brochure, the guide, the pay pages, every e-mail footer and the invoice.

## What the owner needs to know (gaps and choices)

1. **The free demo is not a 10-person game.** The live code has no customer demo game of 10 people: `zc.js` knows no `?demo=1`, and `/api/pass` needs an owner-issued pass. The branch `qa/snakes-cloud-2026-10-29` does not exist on origin yet (checked at the end of this work). So "Free demo game" and the hero button open **`/demo.html`**, the 70-second practice game (one player, three colleagues, nothing saved). That is the same "try it first" link the sign-in sheet already carries. The words on the pages say "free 70-second demo", never "10 people". A test fails if a page claims a 10-person demo while the code cannot give it. When the QA demo exists, change `DEMO` (and the hero words) in `tools/make-site-shell.mjs`, run `bun tools/make-site-shell.mjs`, and the six-item menu address follows.
2. **Trust list, item 7.** The kit's list says "A free Tambola or Bingo demo for 10 people". For this game it says "A free 70-second demo to try first." (true today).
3. **Log in** opens `/zc.html` (the console, which shows its own sign-in when nobody is signed in). On the home page the same link opens the sign-in sheet as before. The word never changes: when someone is signed in, "Signed in as ..." now sits in the tooltip and the screen-reader name, not in the label. Mail links to `/#login` still open the sheet.
4. **Console header.** The console takes the kit's console top bar (logo, CORPORATE over the name, "All games"), as the kit's `console-shell.html` shows, not the website menu. All other pages have the six items.
5. **Dark mode.** Words pages, the home page and the 404/offline pages follow light and dark (and the Dark/Light button). The pages that keep their older scripts and card styles (sign-in, payment, Help Desk, referral, report, console) are drawn light only (`light-only.js`); the game screens (play, big screen, practice game, brand-moment test) keep their own look, as the kit says.
6. **Legal text.** The Terms and the Legal position keep the defined legal term "closed-group Game" (it is a clause name). The word the owner banned is gone from every page, page script text, e-mail and AI text. The brand name in the Terms was corrected from "Snakes & Ladders" to "Snakes and Ladders".
7. **No brochure or guide PDF existed** for this game (Tambola's are made by a script). I added `tools/make-pdfs.mjs`: it prints `brochure.html` and `organizer-guide.html` with their print styles to `brochure.pdf` and `organizer-guide.pdf` (A4, 3 pages each, the badge and the CORPORATE line on top, the payee sentence inside). Run `bun run site:pdfs` after changing either page and commit the two files.
8. **Footer legal links** point to this site's own pages (Terms, Privacy notice, Refund policy, Sub-processors, Data processing terms, Rules, Legal position, Referral terms), not to Tambola's. The footer also keeps the "Test a payment (Rs 1)" link of the old footer.
9. **The old teal brand is gone:** `img/card.png`, the old logos, the old icons, `theme.js`, the old `fonts.css` (its two extra faces, Fraunces italic and IBM Plex Mono, moved to `fonts-game.css` for the game screens).

## What was done, file by file

| Part | Files |
|---|---|
| Brand kit (unchanged copies) | `tokens.css fonts.css components.css console.css brandkit.js theme-init.js`, `fonts/Inter-normal-400.woff2`, `fonts/Fraunces-normal-500-700.woff2`, `icon-192/512.png`, `icon-maskable-192/512.png`, `apple-touch-icon.png`, `favicon-32.png`, `favicon.ico`, `favicon.svg`, `og-card.png` (`python -I docs/boss/brand-kit/vendor.py snakes apps/web/public --console --no-manifest --apply`); `logo-mark.svg` = the kit badge, `logo.svg` = light lockup, `logo-512.png` |
| Games bar (unchanged copies) | `gamesbar.js gamesbar.css` |
| One page shell | `tools/make-site-shell.mjs` (writes head, header, footer and closing scripts of 28 pages; `bun run site:shell`; `--check` is a test), `tools/site-shell/sprite.html`, `gameday.html` (kit snippets), `tools/make-site-shell.d.mts` |
| Page extras on the kit tokens | `site.css` (rewritten: words pages, home page sections and sheets, app pages inside the kit header, printing), `light-only.js`, `partner.css` (colours now from the kit) |
| New pages | `how-it-works.html`, `brochure.pdf`, `organizer-guide.pdf`; rewritten `index.html`, `brochure.html`, `404.html`, `offline.html`; shell around all other pages |
| Home page | kit hero ("This week, which teams will you engage with Corporate Snakes and Ladders?"), "What you can count on", "How a game day feels" (three drawings), then Create your game, Play with, Why teams like it, Seven ways, How it works, FAQ, the AI assistant (lower on the page, not in the menu), Pricing |
| Search and share | canonical, og, twitter (share card `og-card.png` 1200x630), robots, `sitemap.xml` (the generator had drifted from the file: privacy and legal-position were missing, fixed), `llms.txt`, `how-it-works.html` added everywhere |
| PWA and cache | manifest colours (`#FFFAF2`, `#0B3D91`), icon `?v=3`, `zsw.js` version `cb-game-v29` -> `v30` (+ the kit files and `zc.css`), `?v=1/2/3` on every kit link, `_headers` and `pages/build.mjs` no-cache for css, js and the manifest |
| Console visual shell | `zc.html` (kit top bar, tokens, fonts, `console.css`), `zc.css` (teal constants -> the kit's variables), status chips on the console's own pills (`site.css`) |
| Payee | the one sentence `All payments are taken only by IT Services by Rajat Agarwal, through Razorpay.` (page footers, brochure, guide, pricing note, FAQ, e-mail footers) |
| E-mails and report | `apps/edge/src/brand.ts` (badge, small CORPORATE line, strapline, kit colours, payee sentence), `mails.ts` colours, `pdf.ts` `badge()` (vector badge), `report-layout.ts` (title band), `reportgen.js` rebuilt (`bun run build:report`) |
| Words | the banned word removed from pages, `site.js`, `zc.js`, e-mails, AI texts and the facts page; "close group" in the sheets and the facts |

## Tests

Baseline (before any change, `bun test --isolate` per folder): `packages/shared` 10, `packages/billing` 26, `packages/beacon` 113, `apps/web` 114, `tools/control-worker` 1, `apps/edge` 1346; all pass, nothing stale. `tools/sim2` (a long crowd simulation, `bun run sim`) was not run.

After (same commands, last run): `packages/shared` 10, `packages/billing` 26, `packages/beacon` 113, `apps/web` **267** (114 before; +153 new checks), `tools/control-worker` 1, `apps/edge` **1349** (1346 before; +3 new); 1766 pass, 0 fail. The new and changed test files are:

- **New** `apps/web/test/brand-kit.test.ts`: SHA-256 pins of every kit and games bar file, the logo, the icons, the share card, the two snippets; a second check against the canonical folders in `docs/boss` while they are in the repo; both PDFs open with pdf.js, carry CORPORATE over Snakes and Ladders and the payee sentence.
- **New** `apps/web/test/site-shell.test.ts` (141 checks): the shell is in step with its tool; the six menu words, order, addresses and classes on every website page and nothing else in the menu; the brand lockup, skip link first, games bar on public pages only; the hero question, trust list, game-day drawings; the free demo honesty rule; the banned word in pages and in page-script strings; the payee sentence and no other gateway; canonical, og, share card, robots and sitemap; every internal link resolves; no link to `console.corporatetambola.com`; `?v=` numbers; service worker version and files; no-cache headers; the console takes only the shell; no inline style, style tag or handler.
- **Rewritten for the new bar** `apps/web/test/gamesbar.test.ts`.
- **Changed because the old shell is gone** (each states the new fact): `seo.test.ts` (html tag, share card, structured data, fonts, no hero picture), `verify-ui.test.ts` (build no longer copies `img`), `helpdesk-pages.test.ts` (the kit header link size), `storage-notice.test.ts` is unchanged but `storage-registry.json` now lists `ct-theme` and `cg-theme` (the kit stores the colour and the light/dark choice on the device; the Privacy page text is regenerated), `apps/edge/test/terms.test.ts`, `consent.test.ts` (kit header and footer classes), `branding.test.ts` (theme colour, short name, and three new tests for the e-mail header and footer and the report PDF badge).
- **Plant and see red:** `tools/falsify-site.mjs` breaks one thing at a time (a menu word, an added item, a swapped pair, a dead link, one character in a kit file, a font byte, an icon, the logo, the share card, the bar, a PDF, the banned word, a console link, the canonical, the share card tag, the sitemap, the service worker version and file list, a `?v=`, the no-cache line, another gateway, the payee sentence, the CORPORATE line, the skip link, the bar on the play page, the missing `data-game`, a 10-person demo claim, the Log in word, the console top bar and script order, a storage key, a page out of step, the e-mail footer and header, the report badge), runs the matching test file, demands the right test to go red, and restores the file (hash-checked). Result of the last run: **all 42 plants went red and every file was restored** (`docs/SITE-SNAKES-FALSIFY.txt`).

## Screenshots and keyboard

`tools/browser-tests/site-shots.mjs` (Chromium, no network) loads the pages at 360, 390, 768, 1280 and 1920 wide in light and dark and checks: no sideways scroll, one header with the six words, no console error. All passed (14 pages x 2 modes x 5 widths). Tab from the top walks: Skip to the content, the games bar (home mark, six games), the brand, How it works, Free demo game, Guide, Brochure, Refer & earn, Log in (picture `docs/site-shots/tab-focus-menu.jpg`). A real signed-in console was opened on the local test server in the new shell (`console-signed-in-*.jpg`), and the two sheets (create your game, sign in) in light and dark.

Pictures in `docs/site-shots/`: the home page at the five widths in light and dark, sheets of the other pages at 390 and 1280 in light and dark, the console, the two sheets.

## Not done, and risks

- `tools/sim2` UI scenarios were not re-run (they need the whole stack). `s13-footer.mjs` was updated to the new footer; other scenarios may still look for old class names.
- The old static `site/` folder (the first "coming soon" site, never deployed) is untouched.
- `apps/web/public/robots.txt` disallows `*.css` and `*.js` for every crawler (an older owner rule against copying); this hides styles from search engines. Not changed.
- The kit's games bar pill shows "Snakes and Ladd..." cut at 360 px: that is the canonical bar; change it in the kit, not here.
- Not deployed: run `bun run pages:build` and look once on a preview address before going live (the build was run by the tests; `pages/public` is not committed).
