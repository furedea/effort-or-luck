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

/** Opens the game and picks normal difficulty, stopping at the opening notice. */
export async function startGame(page: Page): Promise<void> {
  await page.goto(LINKS.game);
  await pickDifficulty(page);
}

/** Starts the year from the title screen already open. */
export async function pickDifficulty(page: Page): Promise<void> {
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
