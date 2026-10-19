import { readFileSync } from "node:fs";

// The Worker serves deploy/_headers with every page under the sub-path.
const headers = readFileSync(new URL("../deploy/_headers", import.meta.url), "utf8");

test("every page under the sub-path gets the security headers", () => {
  expect(headers).toMatch(/^\/effort-or-luck\/\*$/m);
  for (const name of [
    "Content-Security-Policy",
    "Permissions-Policy",
    "Referrer-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ]) {
    expect(headers).toContain(`  ${name}: `);
  }
});

test("the content security policy loads fonts and styles only from the site itself", () => {
  const csp = headers.match(/Content-Security-Policy: (.+)/)?.[1] ?? "";

  expect(csp).toContain("font-src 'self';");
  expect(csp).toContain("style-src 'self' 'unsafe-inline';");
  expect(csp).toContain("frame-ancestors 'none';");
  expect(csp).toContain("https://static.cloudflareinsights.com");
});
