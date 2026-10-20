import { statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

// How the Cloudflare Worker in wrangler.jsonc serves dist/: its files at their paths with
// trailing slashes added, the nearest 404.html for anything unknown, and dist/_headers applied.

type HeaderRule = { pattern: RegExp; headers: [name: string, value: string][] };

export type Resolution =
  | { kind: "file"; status: 200 | 404; path: string }
  | { kind: "redirect"; location: string }
  | { kind: "notFound" };

export function parseHeaderRules(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: urlPattern(line.trim()), headers: [] });
      continue;
    }
    const separator = line.indexOf(":");
    rules.at(-1)?.headers.push([line.slice(0, separator).trim(), line.slice(separator + 1).trim()]);
  }
  return rules;
}

export function headersFor(rules: readonly HeaderRule[], pathname: string): Record<string, string> {
  return Object.fromEntries(
    rules.filter((rule) => rule.pattern.test(pathname)).flatMap((rule) => rule.headers),
  );
}

export function resolveAsset(root: string, pathname: string): Resolution {
  const target = within(root, pathname);
  if (target === null) return { kind: "notFound" };
  if (pathname.endsWith("/")) {
    const index = join(target, "index.html");
    if (isFile(index)) return { kind: "file", status: 200, path: index };
  } else {
    if (isFile(target)) return { kind: "file", status: 200, path: target };
    if (isFile(join(target, "index.html"))) return { kind: "redirect", location: `${pathname}/` };
  }
  const notFoundPage = nearestNotFoundPage(root, target);
  return notFoundPage === null
    ? { kind: "notFound" }
    : { kind: "file", status: 404, path: notFoundPage };
}

function urlPattern(path: string): RegExp {
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`);
}

/** The file path for `pathname` under `root`, or null if it would leave the root. */
function within(root: string, pathname: string): string | null {
  const target = resolve(root, `.${decodeURIComponent(pathname)}`);
  const fromRoot = relative(resolve(root), target);
  return fromRoot.startsWith("..") || fromRoot.startsWith(sep) ? null : target;
}

function nearestNotFoundPage(root: string, target: string): string | null {
  for (let directory = target; ; directory = dirname(directory)) {
    const page = join(directory, "404.html");
    if (isFile(page)) return page;
    if (resolve(directory) === resolve(root)) return null;
  }
}

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}
