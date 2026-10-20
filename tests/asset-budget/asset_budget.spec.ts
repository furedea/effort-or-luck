import { expect, test, type Browser, type CDPSession, type Page } from "@playwright/test";

import { LINKS } from "../../src/links";
import { pickDifficulty } from "../game_driver";
import { builtRoutes } from "../site_routes";
import {
  findAssetBudgetViolations,
  summarizeAssets,
  type AssetBudget,
  type AssetUsage,
  type NetworkAsset,
} from "./asset_budget";

// Preliminary limits, to be replaced by measured sizes plus a margin.
const PAGE_BUDGET: AssetBudget = {
  total: { size: 5_000_000, count: 200 },
  script: { size: 1_000_000, count: 20 },
  image: { size: 100_000, count: 5 },
  font: { size: 3_000_000, count: 150 },
};

const GAME_SCREEN = "game screen";

for (const route of builtRoutes()) {
  test(`${route} remains within its asset budget`, async ({ browser, baseURL }) => {
    const usage = await measureAssets(browser, baseURL!, async (page) => {
      await page.goto(route, { waitUntil: "networkidle" });
    });

    expectWithinBudget(route, usage, PAGE_BUDGET);
  });
}

test(`the ${GAME_SCREEN} remains within its asset budget`, async ({ browser, baseURL }) => {
  const usage = await measureAssets(browser, baseURL!, async (page) => {
    await page.goto(LINKS.game, { waitUntil: "networkidle" });
    await pickDifficulty(page);
    // The year's first week brings text, and so font subsets, the title screen has none of.
    await page.locator(".event .next").click();
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
  });

  expectWithinBudget(GAME_SCREEN, usage, PAGE_BUDGET);
});

async function measureAssets(
  browser: Browser,
  baseURL: string,
  visit: (page: Page) => Promise<void>,
): Promise<AssetUsage> {
  const context = await browser.newContext({ baseURL, serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    const assets = observeNetworkAssets(session);

    await session.send("Network.enable");
    await visit(page);

    return summarizeAssets(assets.values());
  } finally {
    await context.close();
  }
}

function observeNetworkAssets(session: CDPSession): Map<string, NetworkAsset> {
  const assets = new Map<string, NetworkAsset>();
  session.on("Network.requestWillBeSent", ({ requestId, type }) => {
    assets.set(requestId, { size: 0, type: type ?? "Other" });
  });
  session.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    const asset = assets.get(requestId);
    if (asset !== undefined) asset.size = encodedDataLength;
  });
  session.on("Network.loadingFailed", ({ requestId }) => assets.delete(requestId));
  return assets;
}

function expectWithinBudget(name: string, usage: AssetUsage, budget: AssetBudget): void {
  printUsage(name, usage);
  expect(findAssetBudgetViolations(usage, budget), "asset budget violations").toEqual([]);
}

function printUsage(name: string, usage: AssetUsage): void {
  console.table({
    name,
    transferKb: Math.round(usage.total.size / 1_024),
    requests: usage.total.count,
    scriptKb: Math.round(usage.script.size / 1_024),
    imageKb: Math.round(usage.image.size / 1_024),
    fontKb: Math.round(usage.font.size / 1_024),
  });
}
