import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { BASE_PATH } from "../src/links";

const PAGE_DIRECTORY = join(import.meta.dirname, "..", `dist${BASE_PATH}`);

/** The URL paths of the pages in the current build. */
export function builtRoutes(): string[] {
  return discoverRoutes(PAGE_DIRECTORY, BASE_PATH);
}

/** The URL paths of the HTML pages built into `directory`, which is served at `basePath`. */
export function discoverRoutes(directory: string, basePath: string): string[] {
  return listHtmlFiles(directory)
    .map((file) => relative(directory, file).split(sep).join("/"))
    .map((file) => `${basePath}${file.replace(/index\.html$/, "")}`)
    .toSorted();
}

function listHtmlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listHtmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  });
}
