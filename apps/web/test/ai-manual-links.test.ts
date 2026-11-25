// The public AI manual (/ai-manual) must be easy to find: from the home page footer, from the page where the organizer gets the AI link, and from the sitemap and llms.txt.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PUB = join(import.meta.dir, "..", "public");
const rd = (f: string) => readFileSync(join(PUB, f), "utf8");

describe("the AI manual can be found", () => {
  test("the home page footer links to it", () => {
    expect(rd("index.html")).toContain('<a href="/ai-manual">AI manual</a>');
  });
  test("the page where the organizer gets the AI link links to it, and the exact sentence beside the link is unchanged", () => {
    const js = rd("ai-link.js");
    expect(js).toContain('<a href="/ai-manual">Read the AI manual</a>');
    expect(js).toContain("Copy this link and paste in your AI to work.");
  });
  test("the sitemap and llms.txt name it", () => {
    expect(rd("sitemap.xml")).toContain("/ai-manual</loc>");
    expect(rd("llms.txt")).toContain("/ai-manual");
  });
});
