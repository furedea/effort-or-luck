import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { headersFor, parseHeaderRules, resolveAsset } from "./worker_assets.ts";

describe("_headers rules", () => {
  const rules = parseHeaderRules(
    [
      "# comment",
      "/game/*",
      "  Content-Security-Policy: default-src 'self'; script-src 'self'",
      "  X-Frame-Options: DENY",
      "",
      "/other/",
      "  X-Other: yes",
    ].join("\n"),
  );

  test("apply a splat rule's headers to every path under it", () => {
    expect(headersFor(rules, "/game/_astro/app.js")).toEqual({
      "Content-Security-Policy": "default-src 'self'; script-src 'self'",
      "X-Frame-Options": "DENY",
    });
  });

  test("apply an exact rule only to its own path", () => {
    expect(headersFor(rules, "/other/")).toEqual({ "X-Other": "yes" });
    expect(headersFor(rules, "/other/page/")).toEqual({});
  });
});

describe("asset resolution", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "worker-assets-"));
    for (const file of [
      "game/index.html",
      "game/404.html",
      "game/sources/index.html",
      "game/a.js",
    ]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), file);
    }
  });

  afterAll(() => {
    rmSync(root, { recursive: true });
  });

  test("serves a directory's index.html at its trailing-slash path", () => {
    expect(resolveAsset(root, "/game/sources/")).toEqual({
      kind: "file",
      status: 200,
      path: join(root, "game/sources/index.html"),
    });
  });

  test("serves a file at its own path", () => {
    expect(resolveAsset(root, "/game/a.js")).toEqual({
      kind: "file",
      status: 200,
      path: join(root, "game/a.js"),
    });
  });

  test("redirects a directory path without its trailing slash", () => {
    expect(resolveAsset(root, "/game/sources")).toEqual({
      kind: "redirect",
      location: "/game/sources/",
    });
  });

  test("answers an unknown path with the nearest 404.html up its tree", () => {
    expect(resolveAsset(root, "/game/missing/page/")).toEqual({
      kind: "file",
      status: 404,
      path: join(root, "game/404.html"),
    });
  });

  test("never serves a file outside the root", () => {
    expect(resolveAsset(root, "/../../etc/passwd")).toEqual({ kind: "notFound" });
  });
});
