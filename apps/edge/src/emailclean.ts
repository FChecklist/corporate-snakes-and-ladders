/** EMAIL ID (owner rule, 30 Oct 2026): case-insensitive. NFKC (full-width ＠ becomes @), trim, inner spaces removed, lower case. Used ONLY for an Email ID criterion, never cleanEmpId. Snakes has no Email ID criterion yet; every future path must use this one function. */
export const cleanEmail = (raw: unknown): string => String(raw ?? "").normalize("NFKC").trim().replace(/[\s\u200B-\u200D\u2060\uFEFF\u0085\u2028\u2029]+/g, "").toLowerCase();

/** ACCOUNT / SIGN-IN / HOST EMAIL (owner rule): NFKC, trim, lower case, and an address with a space inside is REFUSED (returns ""), never repaired. Only a participant's Email ID (cleanEmail above) drops inner spaces. */
export const cleanAccountEmail = (raw: unknown): string => { const v = String(raw ?? "").normalize("NFKC").trim().toLowerCase(); return /[\s\u200B-\u200D\u2060\uFEFF\u0085\u2028\u2029]/.test(v) ? "" : v; };
