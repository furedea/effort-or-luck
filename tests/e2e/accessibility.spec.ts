import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { DETAILS_TITLE, SHARE } from "../../src/copy/screen";
import { playToReveal, playUntil, recordShares, sharedUrl, startGame } from "../game_driver";
import { builtRoutes } from "../site_routes";

const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Text that is still fading in would be checked for contrast at partial opacity.
test.use({ contextOptions: { reducedMotion: "reduce" } });

for (const route of builtRoutes()) {
  test(`${route} has no automatically detectable WCAG A or AA violations`, async ({ page }) => {
    await page.goto(route);
    await expectNoWcagViolations(page);
  });
}

test.describe("game states have no automatically detectable WCAG A or AA violations", () => {
  test("the opening notice", async ({ page }) => {
    await startGame(page);
    await expectNoWcagViolations(page);
  });

  test("a week with the timetable", async ({ page }) => {
    await startGame(page);
    await playUntil(page, page.locator(".actions .step"));
    await expectNoWcagViolations(page);
  });

  test("a choice between options", async ({ page }) => {
    await startGame(page);
    await playUntil(page, page.locator(".event .opt").first());
    await expectNoWcagViolations(page);
  });

  test("the reveal with its breakdown open", async ({ page }) => {
    await startGame(page);
    await playToReveal(page);
    await page.getByText(DETAILS_TITLE).click();
    await expectNoWcagViolations(page);
  });

  test("a shared result", async ({ page }) => {
    await recordShares(page);
    await startGame(page);
    await playToReveal(page);
    await page.getByRole("button", { name: SHARE }).click();
    await page.goto((await sharedUrl(page))!);
    await page.locator(".reveal").waitFor();
    await expectNoWcagViolations(page);
  });
});

async function expectNoWcagViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
  expect(results.violations).toEqual([]);
}
