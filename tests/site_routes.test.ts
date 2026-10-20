import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { discoverRoutes } from "./site_routes";

test("discovers the routes of generated HTML pages under the base path", () => {
  const directory = mkdtempSync(join(tmpdir(), "site-routes-"));

  try {
    writePage(directory, "index.html");
    writePage(directory, "sources/index.html");
    writePage(directory, "404.html");
    writeFileSync(join(directory, "favicon.svg"), "<svg />");

    expect(discoverRoutes(directory, "/game/")).toEqual([
      "/game/",
      "/game/404.html",
      "/game/sources/",
    ]);
  } finally {
    rmSync(directory, { recursive: true });
  }
});

function writePage(directory: string, relativePath: string): void {
  const path = join(directory, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "<!doctype html>");
}
