import { expect, test } from "@playwright/test";

import { LINKS } from "../../src/links";
import { startGame } from "../game_driver";
import { builtRoutes } from "../site_routes";

// The test server applies dist/_headers as the Worker does, so these run under production policy.
const SECURITY_HEADERS = [
  "content-security-policy",
  "permissions-policy",
  "referrer-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
];

for (const route of builtRoutes()) {
  test(`${route} is served with the security headers`, async ({ request }) => {
    const response = await request.get(route);

    expect(Object.keys(response.headers())).toEqual(expect.arrayContaining(SECURITY_HEADERS));
  });
}

test("assets are served with the security headers too", async ({ request }) => {
  const response = await request.get(LINKS.favicon);

  expect(Object.keys(response.headers())).toEqual(expect.arrayContaining(SECURITY_HEADERS));
});

test("the game starts with nothing blocked by the content security policy", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  await startGame(page);

  await expect(page.locator(".event")).toBeVisible();
  expect(violations).toEqual([]);
});
