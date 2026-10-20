import { expect, test, type Browser, type CDPSession, type Page } from "@playwright/test";

import { LINKS } from "../../src/links";
import { pickDifficulty } from "../game_driver";
import { builtRoutes } from "../site_routes";
import {
  findAssetBudgetViolations,
  findBrokenAssets,
  summarizeAssets,
  type AssetBudget,
  type AssetUsage,
  type NetworkAsset,
} from "./asset_budget";

// Measured transfers in CI plus about 15%. Fonts dominate: each page loads only the BIZ UD
// subsets its text needs, and the game screen needs the most. The React island is the scripts.
const PAGE_BUDGET: AssetBudget = {
  total: { size: 900_000, count: 45 },
  script: { size: 105_000, count: 6 },
  image: { size: 20_000, count: 2 },
  font: { size: 650_000, count: 43 },
};

const GAME_SCREEN_BUDGET: AssetBudget = {
  total: { size: 1_550_000, count: 85 },
  script: { size: 105_000, count: 6 },
  image: { size: 20_000, count: 2 },
  font: { size: 1_200_000, count: 76 },
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

  expectWithinBudget(GAME_SCREEN, usage, GAME_SCREEN_BUDGET);
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

    expect(findBrokenAssets(assets.values()), "assets that did not load").toEqual([]);
    return summarizeAssets(assets.values());
  } finally {
    await context.close();
  }
}

function observeNetworkAssets(session: CDPSession): Map<string, NetworkAsset> {
  const assets = new Map<string, NetworkAsset>();
  session.on("Network.requestWillBeSent", ({ requestId, request, type }) => {
    assets.set(requestId, { url: request.url, size: 0, type: type ?? "Other" });
  });
  session.on("Network.responseReceived", ({ requestId, response }) => {
    const asset = assets.get(requestId);
    if (asset !== undefined) asset.status = response.status;
  });
  session.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    const asset = assets.get(requestId);
    if (asset !== undefined) asset.size = encodedDataLength;
  });
  session.on("Network.loadingFailed", ({ requestId, errorText, canceled }) => {
    // A request the page itself abandoned, such as on navigation, neither loads nor breaks.
    if (canceled === true) {
      assets.delete(requestId);
      return;
    }
    const asset = assets.get(requestId);
    if (asset !== undefined) asset.failure = errorText;
  });
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
    scripts: usage.script.count,
    imageKb: Math.round(usage.image.size / 1_024),
    images: usage.image.count,
    fontKb: Math.round(usage.font.size / 1_024),
    fonts: usage.font.count,
  });
}
