const ASSET_KINDS = ["total", "script", "image", "font"] as const;

type AssetKind = (typeof ASSET_KINDS)[number];

export type AssetUsage = Record<AssetKind, { count: number; size: number }>;

export type AssetBudget = AssetUsage;

type AssetBudgetViolation = {
  actual: number;
  kind: AssetKind;
  limit: number;
  metric: "count" | "size";
};

export type NetworkAsset = {
  url: string;
  size: number;
  type: string;
  /** The HTTP status, once a response arrived. */
  status?: number;
  /** Why the request failed, if it did. */
  failure?: string;
};

export function summarizeAssets(assets: Iterable<NetworkAsset>): AssetUsage {
  const usage = emptyAssetUsage();

  for (const asset of assets) {
    addAsset(usage.total, asset.size);
    const kind = trackedKind(asset.type);
    if (kind !== null) addAsset(usage[kind], asset.size);
  }

  return usage;
}

export function findAssetBudgetViolations(
  usage: AssetUsage,
  budget: AssetBudget,
): AssetBudgetViolation[] {
  return ASSET_KINDS.flatMap((kind) =>
    (["size", "count"] as const).flatMap((metric) =>
      usage[kind][metric] > budget[kind][metric]
        ? [{ actual: usage[kind][metric], kind, limit: budget[kind][metric], metric }]
        : [],
    ),
  );
}

/** What Chromium reports about one request, as the CDP Network domain does. */
export type NetworkEvent =
  | { kind: "request"; requestId: string; url: string; type: string }
  | { kind: "response"; requestId: string; status: number }
  | { kind: "finished"; requestId: string; size: number }
  | { kind: "failed"; requestId: string; errorText: string; canceled: boolean };

export function recordNetworkEvent(assets: Map<string, NetworkAsset>, event: NetworkEvent): void {
  if (event.kind === "request") {
    assets.set(event.requestId, { url: event.url, size: 0, type: event.type });
    return;
  }
  const asset = assets.get(event.requestId);
  if (asset === undefined) return;
  switch (event.kind) {
    case "response":
      asset.status = event.status;
      return;
    case "finished":
      asset.size = event.size;
      return;
    case "failed":
      // Chromium also reports an HTTP error as a canceled load, so only a cancel after a fine
      // response is the page abandoning a request it no longer needs.
      if (event.canceled && asset.status !== undefined && asset.status < 400) {
        assets.delete(event.requestId);
        return;
      }
      asset.failure = event.errorText;
  }
}

/** Assets that answered with an HTTP error or failed to load, which would weigh nothing. */
export function findBrokenAssets(assets: Iterable<NetworkAsset>): string[] {
  return [...assets].flatMap((asset) => {
    if (asset.status !== undefined && asset.status >= 400) {
      return [`${asset.url} answered ${asset.status}`];
    }
    if (asset.failure !== undefined) return [`${asset.url} failed: ${asset.failure}`];
    return [];
  });
}

function emptyAssetUsage(): AssetUsage {
  return {
    total: { size: 0, count: 0 },
    script: { size: 0, count: 0 },
    image: { size: 0, count: 0 },
    font: { size: 0, count: 0 },
  };
}

function addAsset(usage: { count: number; size: number }, size: number): void {
  usage.count += 1;
  usage.size += size;
}

function trackedKind(type: string): Exclude<AssetKind, "total"> | null {
  const kind = type.toLowerCase();
  return kind === "script" || kind === "image" || kind === "font" ? kind : null;
}
