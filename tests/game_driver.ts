import type { Locator, Page } from "@playwright/test";

import { DIFFICULTY_LABELS } from "../src/copy/screen";
import { LINKS } from "../src/links";

const MAX_ACTIONS = 2_000;
/**
 * What moves the year on, mirroring the unit tests' play-through: a stopping notice, the first
 * option the player can afford, the timetable an option books, or otherwise the next week.
 */
const NEXT_ACTION = [
  ".event .next",
  ".event .opt:not([disabled])",
  ".rest-confirm",
  ".actions .step",
].join(", ");

/** The 37-hour timetable the unit tests use, which some options' hours do not fit. */
const FULL_TIMETABLE = ["研究・ゼミ", "友達と遊ぶ", "ゆっくり休む", "SNS・動画"];
const MAX_TILE_CLICKS_PER_TAB = 20;

/** Opens the game and picks normal difficulty, stopping at the opening notice. */
export async function startGame(page: Page): Promise<void> {
  await page.goto(LINKS.game);
  await pickDifficulty(page);
}

/** Starts the year from the title screen already open. */
export async function pickDifficulty(page: Page): Promise<void> {
  // A click on the server-rendered button before React hydrates it does nothing.
  await page.locator("astro-island:not([ssr])").first().waitFor({ state: "attached" });
  await page.getByRole("button", { name: DIFFICULTY_LABELS.normal }).click();
  await page.locator(".event").waitFor();
}

/** Plays the started year to the reveal. */
export async function playToReveal(page: Page): Promise<void> {
  await playUntil(page, page.locator(".reveal"));
}

/** Plays the started year until `target` shows. */
export async function playUntil(page: Page, target: Locator): Promise<void> {
  for (let actions = 0; actions < MAX_ACTIONS; actions += 1) {
    if (await target.isVisible()) return;
    await page.locator(NEXT_ACTION).first().click();
  }
  throw new Error(`${target.toString()} did not show within ${MAX_ACTIONS} actions`);
}

type SharingWindow = typeof window & { sharedUrl?: string | undefined };

/** From the opening notice, fills the first week's timetable until it runs over its hours. */
export async function overfillTimetable(page: Page): Promise<void> {
  await page.locator(".event .next").click();
  const over = page.locator(".time-over");
  const unpicked = page.locator('.tiles.active .activity[aria-pressed="false"]:not([disabled])');
  for (const tab of await page.locator(".tab").all()) {
    await tab.click();
    for (let clicks = 0; clicks < MAX_TILE_CLICKS_PER_TAB; clicks += 1) {
      if (await over.isVisible()) return;
      if ((await unpicked.count()) === 0) break;
      await unpicked.first().click();
    }
  }
  if (!(await over.isVisible())) throw new Error("The timetable never ran over its hours");
}

/**
 * From the opening notice, sets the 37-hour timetable and plays to the first option whose hours
 * do not fit it, then takes it, which opens the timetable for its booking.
 */
export async function openBookingTimetable(page: Page): Promise<void> {
  await page.locator(".event .next").click();
  for (const name of FULL_TIMETABLE) await pickTile(page, name);
  const options = page.locator(".event .opt:not([disabled])");
  const doesNotFit = options.filter({
    has: page.locator(".room-head", { hasText: /たりない$/ }),
  });
  for (let actions = 0; actions < MAX_ACTIONS; actions += 1) {
    if (await page.locator(".rest-status").isVisible()) return;
    if (await doesNotFit.first().isVisible()) await doesNotFit.first().click();
    else if ((await options.count()) > 0) await options.last().click();
    else await page.locator(".event .next, .actions .step").first().click();
  }
  throw new Error(`No booking timetable opened within ${MAX_ACTIONS} actions`);
}

/** Picks the timetable tile named `name`, switching tabs until its group shows. */
async function pickTile(page: Page, name: string): Promise<void> {
  const tile = page.locator(".tiles.active .activity").filter({
    has: page.locator(".activity-name").getByText(name, { exact: true }),
  });
  for (const tab of [null, ...(await page.locator(".tab").all())]) {
    await tab?.click();
    if (await tile.isVisible()) {
      await tile.click();
      return;
    }
  }
  throw new Error(`No tile named ${name}`);
}

/** Replaces the system share sheet with a recorder, so the shared URL can be read back. */
export async function recordShares(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as SharingWindow).sharedUrl = data.url;
      },
    });
  });
}

export async function sharedUrl(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as SharingWindow).sharedUrl);
}
