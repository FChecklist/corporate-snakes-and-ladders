import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "erase-log-consent", tests: ["apps/edge/test/t30-regress-erase-log-consent.test.ts"], mutations: [
  { note: "guests' data is kept 30 hours instead of 20", file: "apps/edge/src/lifecycle.ts", from: "PURGE_AFTER_MS = 20 * 3_600_000", to: "PURGE_AFTER_MS = 30 * 3_600_000" },
  { note: "the report link outlives the data", file: "apps/edge/src/lifecycle.ts", from: "REPORT_LINK_MS = 19 * 3_600_000", to: "REPORT_LINK_MS = 21 * 3_600_000" },
  { note: "the 365 days become 364", file: "apps/edge/src/lifecycle.ts", from: "const t = endMs + 365 * DAY;", to: "const t = endMs + 364 * DAY;" },
  { note: "the deletion is not on an IST midnight", file: "apps/edge/src/lifecycle.ts", from: "return (istDay + 1) * DAY - IST; };", to: "return (istDay + 1) * DAY - IST + 3_600_000; };" },
  { note: "the erase leaves the participants", file: "apps/edge/src/lifecycle.ts", from: 'env.DB.prepare("DELETE FROM participant WHERE eid=?").bind(eid), ', to: "" },
  { note: "the erase leaves the seats", file: "apps/edge/src/lifecycle.ts", from: 'env.DB.prepare("DELETE FROM seat WHERE eid=?").bind(eid), ', to: "" },
  { note: "the erase leaves the guests' consent ticks", file: "apps/edge/src/lifecycle.ts", from: "env.DB.prepare(\"DELETE FROM consent_log WHERE kind='K4' AND ref=?\").bind(eid), ", to: "" },
  { note: "the end of 365 days never deletes the game", file: "apps/edge/src/worker.ts", from: "endMs != null ? now >= fullDeleteAt(endMs)", to: "endMs != null ? now >= fullDeleteAt(endMs) + 4000 * 86_400_000" },
  { note: "the game record loses its count when the guests are gone", file: "apps/edge/src/gamerecord.ts", from: "joined: Math.max(num(joined) ?? 0, before.joined ?? 0)", to: "joined: num(joined) ?? 0" },
  { note: "an acceptance of an old Terms version still counts", file: "apps/edge/src/consent.ts", from: 'SELECT 1 AS x FROM consent_log WHERE kind=? AND subject=? AND version=?").bind(kind, subject, TERMS_VERSION).first()', to: 'SELECT 1 AS x FROM consent_log WHERE kind=? AND subject=?").bind(kind, subject).first()' },
  { note: "the same acceptance is stored twice", file: "apps/edge/src/consent.ts", from: "if (had) return;", to: "" },
  { note: "erasing a game's guests also erases the organizers' ticks for it", file: "apps/edge/src/consent.ts", from: "DELETE FROM consent_log WHERE ref=? AND kind='K4'", to: "DELETE FROM consent_log WHERE ref=?" },
  { note: "any TERMS_VERSION text is accepted", file: "apps/edge/src/consent.ts", from: "c.v !== TERMS_VERSION", to: "false" },
] });
