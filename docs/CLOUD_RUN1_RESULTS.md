# Cloud run 1 results (raw, no interpretation)

- Date: 2026-10-30
- Branch tested: release/snakes-1.4.0
- SHA: 5060c4ccfdbc5ce2d20ba615643b4487d56e7dc9 (35f6071 is an ancestor)
- Bun: 1.4.4 (38afee6c8)

## Steps
| Step | Command | Exit code |
|---|---|---|
| install | bun install | 0 |
| build | bun run build:control | 0 |
| build | bun run build:report | 0 |
| build | bun run build:zgame | 0 |
| build | bun run pages:build | 0 |
| typecheck | bun run typecheck | 2 |
| cleanup | git checkout -- . (rewrote apps/web/public/control.js, reportgen.js, zgame.js); bun.lock is tracked, not untracked, so it was kept | 0 |

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
| apps/edge | 1372 | 4 | none shown | 1376 tests across 79 files | results/apps_edge.log |
| apps/web | 134 | 3 | none shown | 137 tests across 24 files | results/apps_web.log |

No Bun crash (panic/segfault/Internal assertion) in any log; no split reruns.

## Failures (7). Alone = rerun of the file alone on release; Base = same file at d2a3ebd (1.3.0)
| # | File | Test | Release rerun alone | Base d2a3ebd |
|---|---|---|---|---|
| 1 | apps/edge/test/branding.test.ts | pages: one title pattern, icons, manifest, theme colour > the PWA manifest and the build ship the brand | same (fails again) | pass (31/31) |
| 2 | apps/edge/test/verify.test.ts | the owner's three test sign-ins > demo1/2/3@xyz.in sign in with 123456, no e-mail is sent, the same account comes back each time, and a wrong code or another address is refused | same (fails again) | pass (19/19) |
| 3 | apps/edge/test/verify.test.ts | the owner's three test sign-ins > the test sign-ins are limited per network per day, record no Terms consent, never send mail, and keep only their latest six keys | same (fails again) | pass (19/19) |
| 4 | apps/edge/test/usecases.test.ts | A. organizer: getting in > UC-5 invalid emails are refused everywhere | same (fails again) | pass (55/55) |
| 5 | apps/web/test/seo.test.ts | each indexable page > quick loading: fonts are self-hosted and swap in, the two main fonts are preloaded, scripts do not block the page, nothing third-party is loaded on the home page | same (fails again) | pass (24/24) |
| 6 | apps/web/test/pwa.test.ts | installable app (PWA) > manifest is installable: name, standalone, start url, 192 and 512 icons, one maskable | same (fails again) | pass (6/6) |
| 7 | apps/web/test/pwa.test.ts | installable app (PWA) > the game pages (every file the phone screen loads) are all in the saved set | same (fails again) | pass (6/6) |

### 1. apps/edge/test/branding.test.ts
Test: pages: one title pattern, icons, manifest, theme colour > the PWA manifest and the build ship the brand
```
error: expect(received).toBe(expected)

Expected: "Corporate Snakes and Ladders"
Received: "Snakes and Ladders"

      at <anonymous> (apps/edge/test/branding.test.ts:106:147)
```

### 2. apps/edge/test/verify.test.ts
Test: the owner's three test sign-ins > demo1/2/3@xyz.in sign in with 123456, no e-mail is sent, the same account comes back each time, and a wrong code or another address is refused
```
error: Received value must be a string: undefined
      at <anonymous> (apps/edge/test/verify.test.ts:188:113)
```

### 3. apps/edge/test/verify.test.ts
Test: the owner's three test sign-ins > the test sign-ins are limited per network per day, record no Terms consent, never send mail, and keep only their latest six keys
```
error: expect(received).toBe(expected)

Expected: 200
Received: 400

      at <anonymous> (apps/edge/test/verify.test.ts:198:64)
```

### 4. apps/edge/test/usecases.test.ts
Test: A. organizer: getting in > UC-5 invalid emails are refused everywhere
```
error: expect(received).toBe(expected)

Expected: 400
Received: 200

      at <anonymous> (apps/edge/test/usecases.test.ts:89:68)
```

### 5. apps/web/test/seo.test.ts
Test: each indexable page > quick loading: fonts are self-hosted and swap in, the two main fonts are preloaded, scripts do not block the page, nothing third-party is loaded on the home page
```
TypeError: null is not an object (evaluating 'f.match(/font-display: swap/g).length')
      at <anonymous> (apps/web/test/seo.test.ts:74:41)
```

### 6. apps/web/test/pwa.test.ts
Test: installable app (PWA) > manifest is installable: name, standalone, start url, 192 and 512 icons, one maskable
```
error: expect(received).toBe(expected)

Expected: "/z.html"
Received: "/"

      at <anonymous> (apps/web/test/pwa.test.ts:15:32)
```

### 7. apps/web/test/pwa.test.ts
Test: installable app (PWA) > the game pages (every file the phone screen loads) are all in the saved set
```
error: expect(received).toContain(expected)

Expected to contain: "/screenrules.js"
Received: [
  "/offline.html", "/offline.js", "/z.html", "/zc.html", "/big.html", "/z.js", "/rights.js", "/zc.js",
  "/big.js", "/zgame.js", "/consent.js", "/blackbox.js", "/guide.js", "/control.js", "/audio.js",
  "/common.js", "/app.css", "/z.css", "/big.css", "/fonts.css", "/pwa.js", "/autoupdate.js", "/keep.js",
```

Raw alone-rerun output: results/rerun_alone.log. Raw base output: results/base_rerun.log.

## Not run
- tools/browser-tests, tools/errorlog, apps/cron: no *.test.ts files.
- `bun run sim`, `bun run sim:ui`: not in the task list.
- Root `bun test` script (packages apps tools/control-worker) not run; folders were run one at a time.
