// The one scanner behind the wording tests (owner rules of 25 Nov 2026): it reads the words a PERSON can read in a file and nothing else.
//  - a page (.html): the text between tags, plus the text of the attributes people read (title, alt, aria-label, placeholder, meta content); scripts, styles and comments are skipped;
//  - a script (.js): the quoted strings and template texts (template holes and code are skipped; tags inside a template are dropped but their readable attributes are kept);
//  - Worker source (.ts): the same for quoted strings, keeping only strings that read like a sentence (a space and a letter; SQL, paths and codes are skipped).
// A single lower-case word without a space ("host", "cohost", "ticket") is a code value, not a sentence, and is not read. A single word that starts with a capital ("Host", "Guests") is a label and is read.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "../../..");
export const rd = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
export const ls = (rel: string, ext: RegExp) => readdirSync(join(ROOT, rel)).filter((f) => ext.test(f)).sort().map((f) => `${rel}/${f}`);

export interface Piece { line: number; text: string }

const ATTRS = /\b(?:title|alt|aria-label|placeholder|content|value|label)="([^"]*)"/gi;
const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ");
const unent = (s: string) => s.replace(/&#x27;|&#39;|&apos;|&rsquo;|&lsquo;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&middot;/g, "·");
const attrsOf = (s: string) => [...s.matchAll(ATTRS)].map((m) => m[1]!).filter((v) => /\s/.test(v) && /[A-Za-z]/.test(v) && !/^https?:|^#|^\//.test(v));
const readable = (t: string) => /[A-Za-z]/.test(t) && (/\s/.test(t.trim()) || /^[A-Z][A-Za-z'-]*$/.test(t.trim()));

/** The words a person reads in a page. */
export function htmlText(src: string): Piece[] {
  const clean = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " ")).replace(/<script[\s\S]*?<\/script>/gi, (m) => m.replace(/[^\n]/g, " ")).replace(/<style[\s\S]*?<\/style>/gi, (m) => m.replace(/[^\n]/g, " "));
  const out: Piece[] = [];
  clean.split("\n").forEach((l, i) => { const t = unent([...attrsOf(l), stripTags(l)].join(" | ")).replace(/\s+/g, " ").trim(); if (t) out.push({ line: i + 1, text: t }); });
  return out;
}

/** The words a person reads in a script: the text inside quotes and templates. */
export function scriptText(src: string, onlySentences = false): Piece[] {
  const out: Piece[] = [];
  src.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const parts: string[] = [];
    const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g; let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const raw = m[1] ?? m[2] ?? m[3] ?? "";
      const withAttrs = raw.replace(/\$\{[^}]*\}/g, " ");
      const t = unent([...attrsOf(withAttrs), stripTags(withAttrs)].join(" ")).replace(/\\n/g, " ").replace(/\\(["'`])/g, "$1").replace(/\s+/g, " ").trim();
      if (!t || !readable(t)) continue;
      if (/^(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA|WITH)\b/i.test(t)) continue;
      if (onlySentences && !/\s/.test(t)) continue;
      parts.push(t);
    }
    if (parts.length) out.push({ line: i + 1, text: parts.join(" | ") });
  });
  return out;
}

export const textOf = (file: string, src: string): Piece[] => (file.endsWith(".html") ? htmlText(src) : file.endsWith(".txt") || file.endsWith(".md") ? src.split("\n").map((t, i) => ({ line: i + 1, text: t })).filter((p) => p.text.trim()) : scriptText(src, file.endsWith(".ts")));

export const EXACT_SENTENCE = "Copy this link and paste in your AI to work.";
export const hitsIn = (file: string, src: string, re: RegExp): string[] =>
  textOf(file, src).flatMap(({ line, text }) => [...text.replaceAll(EXACT_SENTENCE, " ").matchAll(re)].map((m) => `${file}:${line}: "${m[0]}" in ${text.trim().slice(0, 110)}`));
