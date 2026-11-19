# Cloud Run 3 Results - release/snakes-1.4.0

Head: `f09167d84b8826f54086f3021a82e0e3b828172c`. Base for comparison: `d2a3ebd275d9edf4bbc063de2e46100f01784dde`. Raw test run, no interpretation.

## Steps

| Step | Command | Exit |
|---|---|---|
| 1 | bun install | 0 |
| 2 | bun run build:control | 0 |
| 2 | bun run build:report | 0 |
| 2 | bun run build:zgame | 0 |
| 2 | bun run pages:build | 0 |
| 3 | bun run typecheck | 2 |
| 4 | bun test --isolate packages/beacon | 0 |
| 4 | bun test --isolate packages/billing | 0 |
| 4 | bun test --isolate packages/shared | 0 |
| 4 | bun test --isolate tools/control-worker | 0 |
| 4 | bun test --isolate tools/sim2 | 0 |
| 4 | bun test --isolate apps/edge | 1 |
| 4 | bun test --isolate apps/web | 1 |

Builds rewrote apps/web/public/control.js, reportgen.js, zgame.js; restored with `git checkout -- .`. Bun did not crash; no splitting into groups was needed.

## Typecheck

Lines containing `error TS`: **68**

First 20:

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

## Counts

Copied from the last summary lines of each log. No skip line appears in any log.

| Folder | pass | fail | skip | files | log |
|---|---|---|---|---|---|
| packages/beacon | 115 | 0 | no skip line | 10 | results/packages-beacon.log |
| packages/billing | 26 | 0 | no skip line | 1 | results/packages-billing.log |
| packages/shared | 10 | 0 | no skip line | 1 | results/packages-shared.log |
| tools/control-worker | 1 | 0 | no skip line | 1 | results/tools-control-worker.log |
| tools/sim2 | 4 | 0 | no skip line | 1 | results/tools-sim2.log |
| apps/edge | 1372 | 4 | no skip line | 79 | results/apps-edge.log |
| apps/web | 135 | 2 | no skip line | 24 | results/apps-web.log |

## Failures

### apps/edge/test/shred.test.ts

- Test: participant crypto-shredding > a participant's personal part is stored apart, sealed under the engagement's own key, never in audit_log
- Error (first 8 lines):

```
error: expect(received).not.toContain(expected)

Expected to not contain: "Asha"
Received: "[[{\"id\":1,\"chain\":\"anon\",\"seq\":1,\"eid\":null,\"org\":null,\"at_ms\":1790848800000,\"actor\":\"participant\",\"event\":\"create\",\"target\":null,\"corr\":\"0ca4bff9-7b3c-47d8-b2c5-40a3bd253e72\",\"status\":200,\"country\":null,\"asn\":null,\"ai_vendor\":null,\"key_id\":null,\"pro

      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/shred.test.ts:47:80)
(fail) participant crypto-shredding > a participant's personal part is stored apart, sealed under the engagement's own key, never in audit_log [40.23ms]

```

- Rerun alone: PASSED on rerun (exit 0; 10 pass 0 fail) - DIFFERENT
- Base d2a3ebd (same file): 10 pass 0 fail (exit 0)

### apps/edge/test/verify.test.ts

- Test: the owner's three test sign-ins > demo1/2/3@xyz.in sign in with 123456, no e-mail is sent, the same account comes back each time, and a wrong code or another address is refused
- Error (first 8 lines):

```
error: Received value must be a string: undefined
      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/verify.test.ts:188:113)
(fail) the owner's three test sign-ins > demo1/2/3@xyz.in sign in with 123456, no e-mail is sent, the same account comes back each time, and a wrong code or another address is refused [22.82ms]
193 |     expect(rowsOf("SELECT COUNT(*) c FROM organizer_email")[0].c).toBe(3);
194 |     expect((await call("POST", "/api/auth/verify", { email: "demo4@xyz.in", code: "123456" })).status).toBe(400);
195 |   });
196 |   test("the test sign-ins are limited per network per day, record no Terms consent, never send mail, and keep only their latest six keys", async () => {
197 |     const em = "demo2@xyz.in"; const fire = () => call("POST", "/api/auth/verify", { email: em, code: "123456" });
```

- Rerun alone: FAILED on rerun (exit 1; 17 pass 2 fail) - SAME
- Base d2a3ebd (same file): 19 pass 0 fail (exit 0)

### apps/edge/test/verify.test.ts

- Test: the owner's three test sign-ins > the test sign-ins are limited per network per day, record no Terms consent, never send mail, and keep only their latest six keys
- Error (first 8 lines):

```
error: expect(received).toBe(expected)

Expected: 200
Received: 400

      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/verify.test.ts:198:64)
(fail) the owner's three test sign-ins > the test sign-ins are limited per network per day, record no Terms consent, never send mail, and keep only their latest six keys [28.59ms]

```

- Rerun alone: FAILED on rerun (exit 1; 17 pass 2 fail) - SAME
- Base d2a3ebd (same file): 19 pass 0 fail (exit 0)

### apps/edge/test/usecases.test.ts

- Test: A. organizer: getting in > UC-5 invalid emails are refused everywhere
- Error (first 8 lines):

```
error: expect(received).toBe(expected)

Expected: 400
Received: 200

      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/usecases.test.ts:89:68)
(fail) A. organizer: getting in > UC-5 invalid emails are refused everywhere [29.68ms]

```

- Rerun alone: FAILED on rerun (exit 1; 54 pass 1 fail) - SAME
- Base d2a3ebd (same file): 55 pass 0 fail (exit 0)

### apps/web/test/seo.test.ts

- Test: each indexable page > quick loading: fonts are self-hosted and swap in, the two main fonts are preloaded, scripts do not block the page, nothing third-party is loaded on the home page
- Error (first 8 lines):

```
TypeError: null is not an object (evaluating 'f.match(/font-display: swap/g).length')
      at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/web/test/seo.test.ts:74:41)
(fail) each indexable page > quick loading: fonts are self-hosted and swap in, the two main fonts are preloaded, scripts do not block the page, nothing third-party is loaded on the home page [0.52ms]

apps/web/test/no-internal-notes.test.ts:
25 |   const files = DEPLOYED.flatMap((d) => { try { return walk(join(ROOT, d)); } catch { return []; } });
26 |   test("there are files to scan", () => { expect(files.length).toBeGreaterThan(20); });
27 |   test("no file contains an internal note, a review or approval remark, a TODO, or the name of another legal entity", () => {
```

- Rerun alone: FAILED on rerun (exit 1; 23 pass 1 fail) - SAME
- Base d2a3ebd (same file): 24 pass 0 fail (exit 0)

### apps/web/test/no-internal-notes.test.ts

- Test: no internal notes in anything that is deployed > no file contains an internal note, a review or approval remark, a TODO, or the name of another legal entity
- Error (first 8 lines):

```
error: expect(received).toEqual(expected)

- []
+ [
+   "apps/web/public/pack/zc-flow.css: todo ... 3e8; border-color: #1a7a46; } .zf-ready.todo { background: #fff8e1; } .zf-readylist { list-style: no",
+   "apps/web/public/pack/zc-flow.js: todo ... ", { class: "zf-ready " + (ok ? "ok" : "todo"), id: "zf-ready", "aria-labelledby": "zf-rdh" }, el("h",
+ ]

```

- Rerun alone: FAILED on rerun (exit 1; 3 pass 1 fail) - SAME
- Base d2a3ebd (same file): 4 pass 0 fail (exit 0)

## Not run

None. All 7 folders produced a summary line.

Result: NOT all green (typecheck count 68, typecheck exit 2, apps/edge 4 fail, apps/web 2 fail).
