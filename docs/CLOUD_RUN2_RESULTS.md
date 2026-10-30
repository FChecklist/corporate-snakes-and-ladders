# Cloud run 2 results (raw, no interpretation)

- Date: 2026-10-30
- Branch tested: release/snakes-1.4.0
- SHA: 42e79bbc6e28962934611a202d7a0b5db1dfcb66
- Bun: 1.4.4 (38afee6c8)

## Steps
| Step | Command | Exit code |
|---|---|---|
| install | bun install | 0 |
| build | bun run build:control | 0 |
| build | bun run build:report | 0 |
| build | bun run build:zgame | 0 |
| build | bun run pages:build | 0 |
| cleanup | git checkout -- . (rewrote apps/web/public/control.js, reportgen.js, zgame.js); bun.lock kept | 0 |
| typecheck | bun run typecheck | 2 |
| test | bun test --isolate packages/beacon | 0 |
| test | bun test --isolate packages/billing | 0 |
| test | bun test --isolate packages/shared | 0 |
| test | bun test --isolate tools/control-worker | 0 |
| test | bun test --isolate tools/sim2 | 0 |
| test | bun test --isolate apps/edge | 1 |
| test | bun test --isolate apps/web | 1 |
| base install | bun install in ../base (d2a3ebd275d9edf4bbc063de2e46100f01784dde) | 0 |

## Typecheck
Lines containing `error TS`: 68 (log: results/typecheck.log). First 20:
```
apps/edge/test/demo-pass.test.ts(16,63): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/demo-pass.test.ts(25,69): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/demo-pass.test.ts(30,61): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/demo-pass.test.ts(31,67): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/demo-pass.test.ts(33,67): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/demo-pass.test.ts(38,177): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/demo-pass.test.ts(40,61): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/demo-pass.test.ts(41,55): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/email-clean.test.ts(14,86): error TS2367: This comparison appears to be unintentional because the types '"Rajat1@demo.com"' and '"rajat1@demo.com"' have no overlap.
apps/edge/test/join-gaps.test.ts(30,101): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/join-gaps.test.ts(31,121): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/join-gaps.test.ts(34,81): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/join-gaps.test.ts(36,91): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/join-gaps.test.ts(59,148): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/join-gaps.test.ts(60,75): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/join-gaps.test.ts(62,73): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/join-gaps.test.ts(94,80): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/join-gaps.test.ts(96,110): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/join-gaps.test.ts(110,62): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
apps/edge/test/join-gaps.test.ts(113,60): error TS2345: Argument of type '{ "x-organizer": string; } | { "x-organizer"?: undefined; }' is not assignable to parameter of type 'Record<string, string> | undefined'.
```

## Counts (last summary lines of each log; `bun test --isolate <folder>`)
| Folder | pass | fail | skip | Ran | log |
|---|---|---|---|---|---|
| packages/beacon | 115 | 0 | none shown | 115 tests across 10 files | results/packages_beacon.log |
| packages/billing | 26 | 0 | none shown | 26 tests across 1 file | results/packages_billing.log |
| packages/shared | 10 | 0 | none shown | 10 tests across 1 file | results/packages_shared.log |
| tools/control-worker | 1 | 0 | none shown | 1 test across 1 file | results/tools_control-worker.log |
| tools/sim2 | 4 | 0 | none shown | 4 tests across 1 file | results/tools_sim2.log |
| apps/edge | 1371 | 5 | none shown | 1376 tests across 79 files | results/apps_edge.log |
| apps/web | 128 | 4 (plus "1 error") | none shown | 132 tests across 24 files | results/apps_web.log |

No Bun crash (panic/segfault/Internal assertion) in any log; no split reruns.

## Failures (edge 5, web 4 incl. 1 file-level load error)
Alone = rerun of the file alone on release (logs in results/rerun/). Base = same file at d2a3ebd (logs in results/base/).

| # | File | Test | Release rerun alone | Base d2a3ebd |
|---|---|---|---|---|
| 1 | apps/edge/test/branding.test.ts | pages: one title pattern, icons, manifest, theme colour > the PWA manifest and the build ship the brand | same (30 pass, 1 fail) | pass (31/31) |
| 2 | apps/edge/test/data-map.test.ts | D2: the notice and the data map agree > the player page asks for exactly the fields the data map lists (a mobile number field exists only if it is listed) | same (7 pass, 1 fail) | pass (8/8) |
| 3 | apps/edge/test/verify.test.ts | the owner's three test sign-ins > demo1/2/3@xyz.in sign in with 123456, no e-mail is sent, the same account comes back each time, and a wrong code or another address is refused | same (17 pass, 2 fail) | pass (19/19) |
| 4 | apps/edge/test/verify.test.ts | the owner's three test sign-ins > the test sign-ins are limited per network per day, record no Terms consent, never send mail, and keep only their latest six keys | same (same run as #3) | pass (19/19) |
| 5 | apps/edge/test/usecases.test.ts | A. organizer: getting in > UC-5 invalid emails are refused everywhere | same (54 pass, 1 fail) | pass (55/55) |
| 6 | apps/web/test/seo.test.ts | each indexable page > quick loading: fonts are self-hosted and swap in, the two main fonts are preloaded, scripts do not block the page, nothing third-party is loaded on the home page | same (23 pass, 1 fail) | pass (24/24) |
| 7 | apps/web/test/storage-notice.test.ts | R9: the storage notice matches the code > every key the scripts keep on a device is listed in storage-registry.json | same (6 pass, 1 fail) | pass (7/7) |
| 8 | apps/web/test/no-internal-notes.test.ts | no internal notes in anything that is deployed > no file contains an internal note, a review or approval remark, a TODO, or the name of another legal entity | same (3 pass, 1 fail) | pass (4/4) |
| 9 | apps/web/test/pwa.test.ts | "Unhandled error between tests" at file load (no test name; 0 pass, 1 fail, 1 error) | same (0 pass, 1 fail, 1 error) | pass (6/6) |

### 1. apps/edge/test/branding.test.ts
Test: pages: one title pattern, icons, manifest, theme colour > the PWA manifest and the build ship the brand
```
SyntaxError: JSON Parse error: Unexpected token '.'
      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/branding.test.ts:106:20)
```
(source line 106: `const m = JSON.parse(read("apps/web/public/manifest.webmanifest")); ...`)

### 2. apps/edge/test/data-map.test.ts
Test: D2: the notice and the data map agree > the player page asks for exactly the fields the data map lists (a mobile number field exists only if it is listed)
```
error: expect(received).toBe(expected)

Expected: false
Received: true

      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/data-map.test.ts:61:63)
```
(source line 61: `expect(/type="email"|id="email"|name="email"/.test(code)).toBe(false);`)

### 3. apps/edge/test/verify.test.ts
Test: the owner's three test sign-ins > demo1/2/3@xyz.in sign in with 123456, no e-mail is sent, the same account comes back each time, and a wrong code or another address is refused
```
error: Received value must be a string: undefined
      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/verify.test.ts:188:113)
```
(source line 188: `... expect(a.token).toMatch(/^cbk_/);`)

### 4. apps/edge/test/verify.test.ts
Test: the owner's three test sign-ins > the test sign-ins are limited per network per day, record no Terms consent, never send mail, and keep only their latest six keys
```
error: expect(received).toBe(expected)

Expected: 200
Received: 400

      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/verify.test.ts:198:64)
```

### 5. apps/edge/test/usecases.test.ts
Test: A. organizer: getting in > UC-5 invalid emails are refused everywhere
```
error: expect(received).toBe(expected)

Expected: 400
Received: 200

      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/usecases.test.ts:89:68)
```
(source line 89: `expect((await call("POST", "/api/start", { email })).status).toBe(400);`)

### 6. apps/web/test/seo.test.ts
Test: each indexable page > quick loading: fonts are self-hosted and swap in, the two main fonts are preloaded, scripts do not block the page, nothing third-party is loaded on the home page
```
TypeError: null is not an object (evaluating 'f.match(/font-display: swap/g).length')
      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/web/test/seo.test.ts:74:41)
```

### 7. apps/web/test/storage-notice.test.ts
Test: R9: the storage notice matches the code > every key the scripts keep on a device is listed in storage-registry.json
```
error: expect(received).toEqual(expected)

- []
+ [
+   "theme-init.js: localStorage ct-theme",
+   "theme-init.js: localStorage cg-theme",
+ ]
```
(then `- Expected  - 1`, `+ Received  + 4`, at storage-notice.test.ts:21:21)

### 8. apps/web/test/no-internal-notes.test.ts
Test: no internal notes in anything that is deployed > no file contains an internal note, a review or approval remark, a TODO, or the name of another legal entity
```
error: expect(received).toEqual(expected)

- []
+ [
+   "apps/web/public/pack/zc-flow.css: todo ... 3e8; border-color: #1a7a46; } .zf-ready.todo { background: #fff8e1; } .zf-readylist { list-style: no",
+   "apps/web/public/pack/zc-flow.js: todo ... ", { class: "zf-ready " + (ok ? "ok" : "todo"), id: "zf-ready", "aria-labelledby": "zf-rdh" }, el("h",
+ ]
```
(then `- Expected  - 1`, `+ Received  + 4`, at no-internal-notes.test.ts:30:17)

### 9. apps/web/test/pwa.test.ts
Test: none named; "Unhandled error between tests" at file load
```
SyntaxError: JSON Parse error: Unexpected token '.'
      at /home/user/corporate-snakes-and-ladders/apps/web/test/pwa.test.ts:8:23
```
(source line 8: `const manifest = JSON.parse(readFileSync(join(PUB, "manifest.webmanifest"), "utf8"));`)

## Comparison with run 1 (docs/CLOUD_RUN1_RESULTS.md on cloud/snakes-run1-results-2026-10-30)
- Typecheck: 68 in run 1, 68 in run 2.
- apps/edge: run 1 1372 pass / 4 fail; run 2 1371 pass / 5 fail.
- apps/web: run 1 134 pass / 3 fail (137 tests); run 2 128 pass / 4 fail + 1 error (132 tests).
- Other folders: same counts as run 1 (beacon 115/0, billing 26/0, shared 10/0, control-worker 1/0, sim2 4/0).
- Same failing tests as run 1 (still failing): branding "PWA manifest and the build ship the brand"; verify (both); usecases UC-5; seo "quick loading".
- In run 1 and not listed in run 2: pwa.test.ts "manifest is installable: name, standalone, start url, 192 and 512 icons, one maskable" and "the game pages (every file the phone screen loads) are all in the saved set". In run 2 pwa.test.ts fails at file load with no tests registered.
- New in run 2 (not in run 1): data-map.test.ts D2 test; storage-notice.test.ts R9 test; no-internal-notes.test.ts "no file contains an internal note..."; pwa.test.ts file-load error.

## Not run
None. All 7 folders produced summary lines.

Raw logs: results/*.log, results/rerun/*.log (release, file alone), results/base/*.log (d2a3ebd).
