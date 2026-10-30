import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "pause", tests: ["packages/beacon/test/t30-regress-pause.test.ts"], mutations: [
  { note: "a pause may be signed with no lead time", file: "packages/beacon/src/control.ts", from: "if (lead < cfg.leadRounds) return `pause needs", to: "if (lead < 0) return `pause needs" },
  { note: "a pause no longer moves later turns", file: "packages/beacon/src/control.ts", from: "for (const i of s.intervals) if (a >= i.start) a += i.end - i.start;", to: "for (const i of s.intervals) if (a >= i.start) a += 0;" },
  { note: "an open-ended pause lasts for ever", file: "packages/beacon/src/control.ts", from: "c.until ?? c.start + maxPause", to: "c.until ?? c.start + 1e9" },
  { note: "a second pause while paused is accepted", file: "packages/beacon/src/control.ts", from: 'return "already paused";', to: 'return null;' },
  { note: "a stop needs no lead", file: "packages/beacon/src/control.ts", from: "return lead >= cfg.leadRounds ? null : `stop needs", to: "return lead >= -1e9 ? null : `stop needs" },
  { note: "a timed pause may be any length", file: "packages/beacon/src/control.ts", from: "m.untilRound - m.atBeaconRound > MAX_TIMED_PAUSE_ROUNDS)) return \"bad pause end\"", to: "m.untilRound - m.atBeaconRound > 1e12)) return \"bad pause end\"" },
  { note: "signatures are not checked", file: "packages/beacon/src/control.ts", from: "if (await verifyControlSig(cfg.pubKey, raw)) bySeq.set(raw.seq, raw); else forged++;", to: "bySeq.set(raw.seq, raw);" },
  { note: "a message for another game is accepted", file: "packages/beacon/src/control.ts", from: "|| raw.engagementId !== engagementId) { forged++; continue; }", to: ") { forged++; continue; }" },
  { note: "the signed text no longer covers the end round", file: "packages/beacon/src/control.ts", from: "export function canonicalBytes(m: UnsignedControl): Uint8Array {", to: "export function canonicalBytes(m: UnsignedControl): Uint8Array { m = { ...m, untilRound: undefined };" },
  { note: "messages are applied in arrival order, not seq order", file: "packages/beacon/src/control.ts", from: "for (const m of [...log].sort((a, b) => a.seq - b.seq)) {", to: "for (const m of [...log]) {" },
] });
