import {
  findAssetBudgetViolations,
  findBrokenAssets,
  summarizeAssets,
  type AssetUsage,
} from "./asset_budget";

test("summarizes tracked network assets for budget evaluation", () => {
  const summary = summarizeAssets([
    { url: "/script", size: 100, type: "Script" },
    { url: "/image", size: 200, type: "Image" },
    { url: "/font", size: 300, type: "Font" },
    { url: "/stylesheet", size: 400, type: "Stylesheet" },
  ]);

  expect(summary).toEqual({
    total: { size: 1_000, count: 4 },
    script: { size: 100, count: 1 },
    image: { size: 200, count: 1 },
    font: { size: 300, count: 1 },
  });
});

test("reports an asset transfer size above its budget", () => {
  const usage = assetUsage();
  usage.script.size = 101;

  expect(findAssetBudgetViolations(usage, assetUsage())).toEqual([
    { actual: 101, kind: "script", limit: 100, metric: "size" },
  ]);
});

test("reports an asset request count above its budget", () => {
  const usage = assetUsage();
  usage.font.count = 2;

  expect(findAssetBudgetViolations(usage, assetUsage())).toEqual([
    { actual: 2, kind: "font", limit: 1, metric: "count" },
  ]);
});

test("reports an asset that answered with an HTTP error, whatever it weighed", () => {
  const broken = findBrokenAssets([
    { url: "/font.woff2", size: 0, type: "Font", status: 404 },
    { url: "/script.js", size: 100, type: "Script", status: 200 },
  ]);

  expect(broken).toEqual(["/font.woff2 answered 404"]);
});

test("reports an asset whose request failed", () => {
  const broken = findBrokenAssets([
    { url: "/script.js", size: 0, type: "Script", failure: "net::ERR_BLOCKED_BY_CLIENT" },
  ]);

  expect(broken).toEqual(["/script.js failed: net::ERR_BLOCKED_BY_CLIENT"]);
});

function assetUsage(): AssetUsage {
  return {
    total: { size: 100, count: 1 },
    script: { size: 100, count: 1 },
    image: { size: 100, count: 1 },
    font: { size: 100, count: 1 },
  };
}
