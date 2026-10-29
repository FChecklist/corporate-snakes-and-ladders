// A small, dependency-free PDF writer: A4 pages of text, simple tables and coloured bands, in the PDF standard fonts (no embedding, so a 10,000-row
// report stays a few hundred KB and builds in a few milliseconds). Text is Latin-1: letters outside it (for example Devanagari names) print as "?",
// which the report says in its notes. Pure functions only, so it runs in a Worker, in Bun and in a browser.
export type Rgb = [number, number, number];
export const NAVY: Rgb = [0.043, 0.239, 0.569], GOLD: Rgb = [0.788, 0.635, 0.29], INK: Rgb = [0.11, 0.14, 0.2], GREY: Rgb = [0.4, 0.43, 0.48], LIGHT: Rgb = [0.955, 0.945, 0.92], WHITE: Rgb = [1, 1, 1], RED: Rgb = [0.62, 0.12, 0.12];
type Font = "F1" | "F2" | "F3" | "F4"; // Helvetica, Helvetica-Bold, Courier, Courier-Bold
const BASE: Record<Font, string> = { F1: "Helvetica", F2: "Helvetica-Bold", F3: "Courier", F4: "Courier-Bold" };
const CHAR_W: Record<Font, number> = { F1: 0.49, F2: 0.55, F3: 0.6, F4: 0.6 }; // average glyph width in em, used for wrapping and alignment

const MAP: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", "₹": "Rs ", " ": " ", "→": "->", "•": "*", "\t": " " };
/** Text as the PDF will show it: Latin-1 only (other letters become "?"), no control characters. */
export const latin1 = (s: string) => Array.from(String(s)).map((c) => (MAP[c] ?? (c.charCodeAt(0) < 32 ? " " : c.charCodeAt(0) <= 255 ? c : "?"))).join("");
const esc = (s: string) => latin1(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const num = (n: number) => (Math.round(n * 100) / 100).toString();
const col = (c: Rgb) => `${num(c[0])} ${num(c[1])} ${num(c[2])}`;

export interface TextOpts { font?: Font; size?: number; color?: Rgb; x?: number; lead?: number; gap?: number }
export interface Column { head: string; width: number; align?: "l" | "r" }

export class PdfDoc {
  readonly W = 595.28; readonly H = 841.89; readonly M = 44;
  private pages: string[][] = [];
  private cur: string[] = [];
  y = 0;
  footer = "";
  constructor() { this.newPage(); }

  newPage() { if (this.cur.length) this.pages.push(this.cur); this.cur = []; this.y = this.H - this.M; }
  private need(h: number) { if (this.y - h < this.M + 22) this.newPage(); }
  get width() { return this.W - 2 * this.M; }

  /** A filled rectangle whose top-left corner is (x, top). */
  rect(x: number, top: number, w: number, h: number, c: Rgb) { this.cur.push(`${col(c)} rg ${num(x)} ${num(top - h)} ${num(w)} ${num(h)} re f`); }
  line(x1: number, y1: number, x2: number, y2: number, c: Rgb = GREY, w = 0.5) { this.cur.push(`${col(c)} RG ${num(w)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`); }
  private put(str: string, x: number, y: number, o: TextOpts) {
    const f = o.font ?? "F1", sz = o.size ?? 10;
    this.cur.push(`BT /${f} ${num(sz)} Tf ${col(o.color ?? INK)} rg ${num(x)} ${num(y)} Td (${esc(str)}) Tj ET`);
  }
  /** Characters of the given font and size that fit in `w` points. */
  fit(w: number, font: Font = "F1", size = 10) { return Math.max(8, Math.floor(w / (CHAR_W[font] * size))); }
  wrap(text: string, maxChars: number): string[] {
    const out: string[] = [];
    for (const para of latin1(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        if (word.length > maxChars) { if (line) { out.push(line); line = ""; } for (let i = 0; i < word.length; i += maxChars) out.push(word.slice(i, i + maxChars)); continue; }
        if (!line) line = word; else if (line.length + 1 + word.length <= maxChars) line += " " + word; else { out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  }
  /** One paragraph, wrapped to the page (or to `o.x` .. right margin). */
  para(text: string, o: TextOpts & { width?: number } = {}) {
    const font = o.font ?? "F1", size = o.size ?? 10, lead = o.lead ?? size * 1.35, x = o.x ?? this.M, w = o.width ?? this.W - this.M - x;
    for (const l of this.wrap(text, this.fit(w, font, size))) { this.need(lead); this.y -= lead; this.put(l, x, this.y + lead * 0.28, { ...o, font, size }); }
    this.y -= o.gap ?? 0;
  }
  /** One line of fixed-width text exactly as given (leading spaces kept, cut at the page edge): for the invite tree. */
  pre(text: string, o: { size?: number; lead?: number } = {}) {
    const size = o.size ?? 7.6, lead = o.lead ?? 10.2, max = this.fit(this.width, "F3", size);
    this.need(lead); this.y -= lead; this.put(latin1(text).slice(0, max), this.M, this.y + lead * 0.28, { font: "F3", size });
  }
  gap(h: number) { this.y -= h; }
  private img: { w: number; h: number; hex: string } | null = null;
  /** The organizer's logo (raw RGB pixels as hex), fitted inside a w x h white tile whose top-left corner is (x, top). One logo per file. */
  logo(px: { w: number; h: number; hex: string }, x: number, top: number, w: number, h: number) {
    if (!px || !px.w || !px.h || px.hex.length !== px.w * px.h * 6) return;
    this.img = px; const k = Math.min((w - 6) / px.w, (h - 6) / px.h), dw = px.w * k, dh = px.h * k;
    this.cur.push(`1 1 1 rg ${num(x)} ${num(top - h)} ${num(w)} ${num(h)} re f`);
    this.cur.push(`q ${num(dw)} 0 0 ${num(dh)} ${num(x + (w - dw) / 2)} ${num(top - h + (h - dh) / 2)} cm /Im1 Do Q`);
  }
  /** The Corporate Snakes and Ladders badge of the brand kit (logos/snakes.svg), drawn as vector shapes: a brown tile, a 5 x 5 board, a ladder and a snake. Top-left corner (x, top), `size` points square. */
  badge(x: number, top: number, size: number) {
    const k = size / 64, X = (v: number) => num(x + v * k), Y = (v: number) => num(top - v * k), hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
    const r = 14 * k, c = r * 0.5523, L = x, R = x + size, T = top, B = top - size; // the rounded tile
    this.cur.push(`${col(hex("#9C3D1E"))} rg ${num(L + r)} ${num(T)} m ${num(R - r)} ${num(T)} l ${num(R - r + c)} ${num(T)} ${num(R)} ${num(T - r + c)} ${num(R)} ${num(T - r)} c ${num(R)} ${num(B + r)} l ${num(R)} ${num(B + r - c)} ${num(R - r + c)} ${num(B)} ${num(R - r)} ${num(B)} c ${num(L + r)} ${num(B)} l ${num(L + r - c)} ${num(B)} ${num(L)} ${num(B + r - c)} ${num(L)} ${num(B + r)} c ${num(L)} ${num(T - r)} l ${num(L)} ${num(T - r + c)} ${num(L + r - c)} ${num(T)} ${num(L + r)} ${num(T)} c f`);
    const sq = ["#FFD43B", "#FF6B6B", "#4DABF7", "#69DB7C", "#FFFFFF", "#FF6B6B", "#4DABF7", "#69DB7C", "#FFFFFF", "#FFD43B", "#4DABF7", "#69DB7C", "#FFFFFF", "#FFD43B", "#FF6B6B", "#69DB7C", "#FFFFFF", "#FFD43B", "#FF6B6B", "#4DABF7", "#FFFFFF", "#FFD43B", "#FF6B6B", "#4DABF7", "#69DB7C"];
    sq.forEach((h, i) => this.cur.push(`${col(hex(h))} rg ${X(5 + (i % 5) * 10.8)} ${Y(5 + Math.floor(i / 5) * 10.8 + 10.8)} ${num(10.8 * k)} ${num(10.8 * k)} re f`));
    const stroke = (d: string, h: string, w: number, dash = "") => this.cur.push(`1 J 1 j ${col(hex(h))} RG ${num(w * k)} w ${dash ? `[${dash}] 0 d ` : "[] 0 d "}${d} S`);
    const seg = (x1: number, y1: number, x2: number, y2: number) => `${X(x1)} ${Y(y1)} m ${X(x2)} ${Y(y2)} l`;
    stroke(seg(9, 54, 20, 12) + " " + seg(17, 56, 28, 14), "#7A4A12", 2.4);
    for (const [a, b, c2, d] of [[11, 46.4, 19, 48.4], [13, 38.9, 21, 40.9], [14.9, 31.3, 22.9, 33.3], [16.9, 23.8, 24.9, 25.8], [18.9, 16.2, 26.9, 18.2]] as const) stroke(seg(a, b, c2, d), "#7A4A12", 1.8);
    const snake = `${X(47)} ${Y(13)} m ${X(58)} ${Y(19)} ${X(35)} ${Y(25)} ${X(44)} ${Y(34)} c ${X(53)} ${Y(43)} ${X(35)} ${Y(47)} ${X(45)} ${Y(55)} c`;
    stroke(snake, "#1B5E20", 6.6); stroke(snake, "#40C057", 4.6); stroke(snake, "#FFE066", 1.6, `${num(1.5 * k)} ${num(4 * k)}`);
    this.cur.push(`${col(hex("#40C057"))} rg ${X(40.5)} ${Y(15.5)} ${num(10 * k)} ${num(8 * k)} re f`, `${col(hex("#1B5E20"))} rg ${X(43)} ${Y(11.6)} ${num(1.6 * k)} ${num(1.6 * k)} re f ${X(46.6)} ${Y(11.6)} ${num(1.6 * k)} ${num(1.6 * k)} re f`);
  }
  h1(text: string) { this.need(40); this.gap(8); this.y -= 18; this.put(text, this.M, this.y, { font: "F2", size: 15, color: NAVY }); this.line(this.M, this.y - 5, this.W - this.M, this.y - 5, GOLD, 1.2); this.y -= 12; }
  h2(text: string) { this.need(28); this.gap(4); this.y -= 14; this.put(text, this.M, this.y, { font: "F2", size: 11, color: INK }); this.y -= 4; }
  /** A tinted box with a bold title and wrapped lines. */
  box(title: string, lines: string[], tint: Rgb = LIGHT, edge: Rgb = GOLD) {
    const size = 9, lead = 12, chars = this.fit(this.width - 20, "F1", size);
    const wrapped = lines.flatMap((l) => this.wrap(l, chars));
    const h = 14 + 16 + wrapped.length * lead + 6;
    this.need(Math.min(h, this.H - 2 * this.M - 30));
    const top = this.y; this.rect(this.M, top, this.width, h, tint); this.rect(this.M, top, 3, h, edge);
    this.put(title, this.M + 12, top - 18, { font: "F2", size: 10, color: NAVY });
    let yy = top - 18 - 6;
    for (const l of wrapped) { yy -= lead; if (yy < this.M + 22) { this.newPage(); yy = this.y - lead; } this.put(l, this.M + 12, yy, { size, color: INK }); }
    this.y = Math.min(top - h, yy) - 8;
  }
  /** A fixed-width table in Courier. Column widths are in characters; long cells are cut with ".." so every row stays one line. */
  table(cols: Column[], rows: string[][], o: { size?: number; zebra?: boolean } = {}) {
    const size = o.size ?? 7.6, lead = size * 1.55, cw = size * CHAR_W.F3;
    const cell = (s: string, c: Column) => { const t = latin1(s ?? ""); const v = t.length > c.width ? t.slice(0, Math.max(1, c.width - 2)) + ".." : t; return c.align === "r" ? v.padStart(c.width) : v.padEnd(c.width); };
    const total = cols.reduce((n, c) => n + c.width + 1, 0) * cw;
    const draw = (cells: string[], head: boolean, shade: boolean) => {
      this.need(lead + 2); this.y -= lead;
      if (head) this.rect(this.M, this.y + lead - 1.5, Math.min(total, this.width), lead, NAVY); else if (shade) this.rect(this.M, this.y + lead - 1.5, Math.min(total, this.width), lead, LIGHT);
      this.put(cols.map((c, i) => cell(cells[i] ?? "", c)).join(" "), this.M + 2, this.y + lead * 0.22, { font: head ? "F4" : "F3", size, color: head ? WHITE : INK });
    };
    const head = () => draw(cols.map((c) => c.head), true, false);
    this.need(lead * Math.min(rows.length + 1, 5) + 4); // keep a table's heading together with its first rows
    head();
    rows.forEach((r, i) => { if (this.y - lead - 2 < this.M + 22) { this.newPage(); head(); } draw(r, false, !!o.zebra && i % 2 === 1); });
    this.y -= 6;
  }

  /** The finished file. Page footers ("page n of N") are added here, when the page count is known. */
  build(): Uint8Array {
    const pages = [...this.pages, ...(this.cur.length ? [this.cur] : [])];
    const objs: string[] = [];
    const add = (s: string) => { objs.push(s); return objs.length; };
    const fonts = (["F1", "F2", "F3", "F4"] as Font[]).map((f) => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${BASE[f]} /Encoding /WinAnsiEncoding >>`));
    const imgId = this.img ? add(`<< /Type /XObject /Subtype /Image /Width ${this.img.w} /Height ${this.img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${this.img.hex.length + 1} >>
stream
${this.img.hex}>
endstream`) : 0;
    const pagesId = objs.length + 1 + pages.length * 2; // catalog and page tree come after the pages
    const pageIds: number[] = [];
    pages.forEach((content, i) => {
      const foot = `BT /F1 7.5 Tf ${col(GREY)} rg ${num(this.M)} 26 Td (${esc(this.footer)}) Tj ET BT /F1 7.5 Tf ${col(GREY)} rg ${num(this.W - this.M - 60)} 26 Td (${esc(`page ${i + 1} of ${pages.length}`)}) Tj ET`;
      const stream = content.join("\n") + "\n" + foot;
      const cid = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(this.W)} ${num(this.H)}] /Resources << /Font << ${fonts.map((id, k) => `/F${k + 1} ${id} 0 R`).join(" ")} >>${imgId ? ` /XObject << /Im1 ${imgId} 0 R >>` : ""} >> /Contents ${cid} 0 R >>`));
    });
    const tree = add(`<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pages.length} >>`);
    const cat = add(`<< /Type /Catalog /Pages ${tree} 0 R >>`);
    const info = add(`<< /Title (${esc("Corporate Snakes and Ladders engagement report")}) /Producer (Corporate Snakes and Ladders) >>`);
    if (tree !== pagesId) throw new Error("pdf object numbering");
    let out = "%PDF-1.4\n"; const offs: number[] = [];
    objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Uint8Array.from(out, (c) => c.charCodeAt(0) & 255); // everything written is ASCII (esc() has made the text Latin-1 safe)
  }
}
