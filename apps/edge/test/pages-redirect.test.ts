import { describe, expect, test } from "bun:test";
import { redirectTarget } from "../src/pages-redirect";
import { onRequest } from "../../../pages/functions/_middleware";

const OLD = "https://corporate-snakes-and-ladders.pages.dev", NEW = "https://snakes.corporatetambola.com";
describe("the old pages.dev address", () => {
  test("a page request (GET or HEAD) goes to the same path and query on the new address", () => {
    expect(redirectTarget(new URL(OLD + "/"), "GET")).toBe(NEW + "/");
    expect(redirectTarget(new URL(OLD + "/terms.html?x=1#a"), "GET")).toBe(NEW + "/terms.html?x=1");
    expect(redirectTarget(new URL(OLD + "/z.html?e=GAME-1"), "HEAD")).toBe(NEW + "/z.html?e=GAME-1");
  });
  test("/api, /__, /version.json and /.well-known are never redirected, and nor is any POST", () => {
    for (const p of ["/api/pay/webhook", "/api/z/GAME-1/info", "/__x", "/version.json", "/.well-known/security.txt"]) expect(redirectTarget(new URL(OLD + p), "GET")).toBeNull();
    expect(redirectTarget(new URL(OLD + "/api/pay/webhook"), "POST")).toBeNull();
    expect(redirectTarget(new URL(OLD + "/terms.html"), "POST")).toBeNull();
  });
  test("the new address and other hosts are not redirected", () => {
    expect(redirectTarget(new URL(NEW + "/"), "GET")).toBeNull();
    expect(redirectTarget(new URL("https://abc123.corporate-snakes-and-ladders.pages.dev/"), "GET")).toBeNull();
  });
  test("the Pages middleware answers 301 for a page and passes an API POST on", async () => {
    const next = async () => new Response("passed on");
    const r = await onRequest({ request: new Request(OLD + "/about.html?a=b"), next }); expect(r.status).toBe(301); expect(r.headers.get("location")).toBe(NEW + "/about.html?a=b");
    const p = await onRequest({ request: new Request(OLD + "/api/pay/webhook", { method: "POST", body: "{}" }), next }); expect(await p.text()).toBe("passed on");
    const n = await onRequest({ request: new Request(NEW + "/about.html"), next }); expect(await n.text()).toBe("passed on");
  });
});
