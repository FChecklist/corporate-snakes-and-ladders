import { cleanEmail } from "./emailclean";
// Three sign-in addresses made for the owner's own testing: the 6-digit code is always 123456. They are ordinary organizer accounts and nothing else about them is special.
// WP-17: the fixed code is accepted ONLY while the service is in TEST mode (worker.ts asks isTestMode); in LIVE mode these are ordinary addresses and 123456 is refused.
// To switch this off, empty this list. The addresses belong to a real third-party domain, so NO mail of any kind is ever sent to them (pay.ts sendMail), the sign-in is counted
// against the daily write budget and a per-network limit (worker.ts), and the keys it makes are trimmed to the latest three.
export const TEST_LOGINS = new Set(["demo1@xyz.in", "demo2@xyz.in", "demo3@xyz.in"]);
export const TEST_LOGIN_CODE = "123456";
export const TEST_LOGINS_PER_IP_DAY = 30;
export const isTestLogin = (email: string): boolean => TEST_LOGINS.has(cleanEmail(String(email ?? "")));
