import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { gzipSync } from "node:zlib";

import { headersFor, parseHeaderRules, resolveAsset } from "./worker_assets.ts";

// Serves dist/ for the browser tests the way the Worker serves furedea.com/effort-or-luck/.
// Usage: node tests/server/serve.ts [port]

const ROOT = join(import.meta.dirname, "..", "..", "dist");
const PORT = Number(process.argv[2] ?? 4321);
const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};
// Cloudflare compresses text on the way out; fonts and images are compressed already.
const COMPRESSIBLE = new Set([".css", ".html", ".js", ".json", ".svg", ".txt"]);

const rules = parseHeaderRules(readFileSync(join(ROOT, "_headers"), "utf8"));

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  const resolution = resolveAsset(ROOT, pathname);
  const headers = headersFor(rules, pathname);
  if (resolution.kind === "redirect") {
    response.writeHead(307, { ...headers, Location: resolution.location }).end();
    return;
  }
  if (resolution.kind === "notFound") {
    response.writeHead(404, headers).end();
    return;
  }
  const extension = extname(resolution.path);
  const body = readFileSync(resolution.path);
  const gzip =
    COMPRESSIBLE.has(extension) && /\bgzip\b/.test(request.headers["accept-encoding"] ?? "");
  response
    .writeHead(resolution.status, {
      ...headers,
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      ...(gzip ? { "Content-Encoding": "gzip" } : {}),
    })
    .end(gzip ? gzipSync(body) : body);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Serving dist/ at http://127.0.0.1:${PORT}/effort-or-luck/`);
});
