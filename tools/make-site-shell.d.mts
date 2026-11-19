// Types for tools/make-site-shell.mjs (used by tools/make-trust.ts and the tests).
export interface ShellPage { f: string; path: string; title: string; desc: string; kind: "site" | "landing" | "app" | "console"; index: boolean; bar: boolean; cur?: number; [k: string]: unknown }
export const PAGES: ShellPage[];
export const MENU: [string, string, string][];
export const V: Record<string, number>;
export const ORIGIN: string, NAME: string, STRAPLINE: string, PAYEE: string, PAY_LINE: string, THEME_COLOR: string;
export const DEMO: { href: string; label: string };
export function apply(p: ShellPage, html: string): string;
export function run(check: boolean): string[];
