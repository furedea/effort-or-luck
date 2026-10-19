import { readFileSync } from "node:fs";

// Workers assets answer an unmatched path with the nearest 404.html up the directory tree.
const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("the Worker answers unknown paths with the site's 404 page", () => {
  expect(wrangler).toMatch(/"not_found_handling": "404-page"/);
});
