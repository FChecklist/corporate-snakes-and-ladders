// An AI assistant cannot pay (owner rule, 25 Nov 2026). One message, one list of payment addresses, one check: every payment route uses them, so the answer is the same everywhere.
// Who may pay stays as it was: the organizer and a co-organizer (a Co-host of one game keeps what the code gives them today). An AI key never pays, and neither does a
// co-organizer's key when it is used through an AI work link (x-cb-link): a work link is an AI's way in, whoever's key it carries.

/** The one plain answer (HTTP 403) to an AI that tries to pay, make a pay link or use credit. It says who can pay, where, and what to tell the organizer. */
export const AI_CANNOT_PAY = "An AI assistant cannot pay. Only the organizer or a co-organizer can pay, with Pay now in the console. Please tell the organizer that the game is ready to pay.";
/** The answer (HTTP 403) to an AI that asks for something that is for the organizer to do in the console, other than paying. */
export const AI_CANNOT_DO = "An AI assistant cannot do this. The organizer does it in the console. Please tell the organizer what needs doing and where.";

/**
 * Every payment address, whatever the method: the checkout, the two payment tests, the end of a payment, the checkout of a pay link, the credit list, making a pay link and
 * paying with credit. (Owner rules 1.1 make the first four answer 410 `pay-in-console` for everybody; an AI key is refused before that.)
 */
export const PAY_PATH = /^\/api\/(?:checkout|payments\/(?:test|paytest|verify)|paylink\/[0-9a-f]{48}\/checkout|org\/credit|z\/[A-Za-z0-9_-]{4,40}\/(?:paylink|pay-with-credit))$/;

/** True for an AI key (kind "ai") and for a co-organizer's key (kind "host") used through an AI work link. */
export const isAiCaller = (kind: string | null | undefined, viaLink: boolean | undefined): boolean => kind === "ai" || (kind === "host" && viaLink === true);

export const aiCannotPay = (): Response => new Response(JSON.stringify({ error: AI_CANNOT_PAY, code: "ai-cannot-pay" }), { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } });
