// One definition of how Corporate Snakes and Ladders presents itself in every e-mail: the same header (logo mark + wordmark) and the same footer (name, support address, legal link).
// Every e-mail the service sends goes through sendMail / sendReportMail (pay.ts), which adds this footer and wraps plain mails in this header, so a mail without the brand cannot go out.
// The name is always exactly "Corporate Snakes and Ladders". The look is the Corporate Games brand kit's (studio blue, marigold, warm paper); the badge is the kit's icon-192.png.

/** The version of the Terms in force (the date at the top of /terms.html). Stored with the organizer when they continue. */
export const TERMS_VERSION = "2026-10-15";

export const BRAND = {
  name: "Corporate Snakes and Ladders",
  tagline: "Online games for company events",
  support: "hello@corporatetambola.com", // the contact address the site's legal page publishes
  legalPath: "/legal.html",
  defaultOrigin: "https://snakes.corporatetambola.com",
  wine: "#0B3D91", gold: "#FFC93C", gold2: "#FFE08A", ivory: "#FFFAF2", line: "#EFDDBE", muted: "#4D4870", ink: "#1B1442",
  payee: "IT Services by Rajat Agarwal",
} as const;
/** The one sentence about who takes a payment: every e-mail that can mention money carries it in its footer. */
export const PAY_LINE = `All payments are taken only by ${BRAND.payee}, through Razorpay.`;

/** Every subject that leaves the service starts with the game tag, so one shared inbox can tell the games apart. Added in one place (sendMail / sendReportMail in pay.ts). */
export const MAIL_TAG = "[Snakes & Ladders] ";
export const taggedSubject = (s: string): string => (s.startsWith(MAIL_TAG) ? s : MAIL_TAG + s);
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const base = (origin?: string) => (origin || BRAND.defaultOrigin).replace(/\/+$/, "");

/** Plain-text footer, identical in every e-mail. */
export const footerText = (origin?: string) => `--\n${BRAND.name}\nQuestions? Write to ${BRAND.support}\n${PAY_LINE}\nRules, privacy and disclaimer: ${base(origin)}${BRAND.legalPath}`;
/** True when a text already ends with the brand footer. */
export const hasFooter = (text: string) => text.includes(`Write to ${BRAND.support}`) && text.includes(BRAND.legalPath);
export const withFooter = (text: string, origin?: string) => (hasFooter(text) ? text : `${text.replace(/\s+$/, "")}\n\n${footerText(origin)}\n`);

/** The header row of every HTML e-mail: the kit's badge, the small CORPORATE line and the proper name. `data-brand` lets tests find it. */
export function headerHtml(origin?: string): string {
  const o = base(origin);
  return `<tr data-brand="header"><td style="background:${BRAND.wine};border-radius:10px 10px 0 0;border-bottom:3px solid #E0B872;padding:12px 22px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="middle" style="padding-right:12px;"><img src="${o}/icon-192.png?v=3" width="44" height="44" alt="" style="display:block;border:0;border-radius:11px;"></td><td valign="middle"><div style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#E3ECFF;line-height:1.2;">Corporate</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:700;color:#FFFFFF;line-height:1.15;" aria-label="${BRAND.name}">Snakes and Ladders</div></td></tr></table></td></tr>`;
}
/** The footer row of every HTML e-mail: name, support address, legal link. */
export function footerHtml(origin?: string): string {
  const o = base(origin);
  return `<tr data-brand="footer"><td style="border-top:1px solid ${BRAND.line};background:${BRAND.ivory};border-radius:0 0 10px 10px;padding:14px 22px;font-size:12.5px;line-height:1.6;color:${BRAND.muted};"><b style="color:${BRAND.wine};">${BRAND.name}</b> &middot; ${BRAND.tagline}<br>Questions? Write to <a href="mailto:${BRAND.support}" style="color:${BRAND.wine};">${BRAND.support}</a><br>${PAY_LINE}<br><a href="${o}${BRAND.legalPath}" style="color:${BRAND.wine};">Rules, privacy and disclaimer</a></td></tr>`;
}

/** The full HTML page around some rows. */
export function pageHtml(title: string, rows: string, origin?: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#FFF0D6;font-family:Arial,Helvetica,sans-serif;color:#1c2433;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF0D6;"><tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;border:1px solid ${BRAND.line};">
${headerHtml(origin)}
${rows}
${footerHtml(origin)}
</table></td></tr></table></body></html>`;
}

/** A plain-text mail (reminders, "could not begin", invoice, report...) as branded HTML: paragraphs, web addresses made clickable. Never used for a mail that carries an AI link. */
export function plainToHtml(title: string, text: string, origin?: string): string {
  const link = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:${BRAND.wine};font-weight:700;">${u}</a>`);
  const body = text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;">${link(p).replace(/\n/g, "<br>")}</p>`).join("");
  return pageHtml(title, `<tr><td style="padding:22px 22px 8px;">${body}</td></tr>`, origin);
}
