import {
  findAssetBudgetViolations,
  findBrokenAssets,
  recordNetworkEvent,
  summarizeAssets,
  type AssetUsage,
  type NetworkAsset,
  type NetworkEvent,
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

describe("network events", () => {
  const request: NetworkEvent = {
    kind: "request",
    requestId: "1",
    url: "/font.woff2",
    type: "Font",
  };

  test("keep an HTTP error that Chromium then reports as a canceled load", () => {
    const assets = record([
      request,
      { kind: "response", requestId: "1", status: 404 },
      { kind: "failed", requestId: "1", errorText: "net::ERR_ABORTED", canceled: true },
    ]);

    expect(findBrokenAssets(assets.values())).toEqual(["/font.woff2 answered 404"]);
  });

  test("drop a canceled load whose response was fine", () => {
    const assets = record([
      request,
      { kind: "response", requestId: "1", status: 200 },
      { kind: "failed", requestId: "1", errorText: "net::ERR_ABORTED", canceled: true },
    ]);

    expect([...assets.values()]).toEqual([]);
  });

  test("report a canceled load that never got a response", () => {
    const assets = record([
      request,
      { kind: "failed", requestId: "1", errorText: "net::ERR_ABORTED", canceled: true },
    ]);

    expect(findBrokenAssets(assets.values())).toEqual(["/font.woff2 failed: net::ERR_ABORTED"]);
  });

  test("count a finished load at its transfer size", () => {
    const assets = record([
      request,
      { kind: "response", requestId: "1", status: 200 },
      { kind: "finished", requestId: "1", size: 300 },
    ]);

    expect(summarizeAssets(assets.values()).font).toEqual({ size: 300, count: 1 });
  });
});

function record(events: NetworkEvent[]): Map<string, NetworkAsset> {
  const assets = new Map<string, NetworkAsset>();
  for (const event of events) recordNetworkEvent(assets, event);
  return assets;
}

function assetUsage(): AssetUsage {
  return {
    total: { size: 100, count: 1 },
    script: { size: 100, count: 1 },
    image: { size: 100, count: 1 },
    font: { size: 100, count: 1 },
  };
}
