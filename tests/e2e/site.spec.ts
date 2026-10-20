import { expect, test, type Page } from "@playwright/test";

import { BACK_TO_GAME, SHARE, SOURCES_TITLE, TITLE } from "../../src/copy/screen";
import { LINKS } from "../../src/links";
import { playToReveal, recordShares, sharedUrl, startGame } from "../game_driver";
import { builtRoutes } from "../site_routes";

for (const route of builtRoutes()) {
  test(`${route} loads without script errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(route);

    expect(response?.ok()).toBe(true);
    await expect(page.locator("main")).toBeAttached();
    expect(errors).toEqual([]);
  });
}

test("the top page opens on the title screen", async ({ page }) => {
  await page.goto(LINKS.game);

  await expect(page).toHaveTitle(TITLE);
  await expect(page.getByRole("heading", { name: TITLE, level: 1 })).toBeVisible();
});

test("the sources page links back to the game", async ({ page }) => {
  await page.goto(LINKS.sources);

  await expect(page.getByRole("heading", { name: SOURCES_TITLE, level: 1 })).toBeVisible();
  await page.getByRole("link", { name: BACK_TO_GAME }).click();
  await expect(page).toHaveURL(new RegExp(`${LINKS.game}$`));
});

test("a played year's share link opens the same result", async ({ page }) => {
  await recordShares(page);
  await startGame(page);
  await playToReveal(page);
  const played = await revealedResult(page);

  await page.getByRole("button", { name: SHARE }).click();
  const url = await sharedUrl(page);
  expect(url).toMatch(new RegExp(`^${new URL(page.url()).origin}${LINKS.share}\\?`));
  await page.goto(url!);

  await expect(page.locator(".reveal")).toBeVisible();
  expect(await revealedResult(page)).toEqual(played);
});

/** What a reveal says about the year, leaving out whose year it is. */
async function revealedResult(page: Page) {
  const reveal = page.locator(".reveal");
  return {
    offers: (await reveal.locator(".reveal-head .you").innerText()).replace(/^.*?には，/, ""),
    profile: await reveal.locator(".profile").innerText(),
    summary: await reveal.locator(".reveal-summary").innerText(),
  };
}
