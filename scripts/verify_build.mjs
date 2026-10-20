import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const distDir = new URL("../dist/", import.meta.url).pathname;

const requiredPaths = [
  "_headers",
  "effort-or-luck/index.html",
  "effort-or-luck/share/index.html",
  "effort-or-luck/sources/index.html",
  "effort-or-luck/_astro",
  "effort-or-luck/favicon.svg",
];

const requiredContents = {
  _headers: ["/effort-or-luck/*", "Content-Security-Policy: ", "font-src 'self';"],
  "effort-or-luck/index.html": [
    "<title>努力か，運か</title>",
    'component-export="GameScreen"',
    'href="https://furedea.com/effort-or-luck/"',
    'href="/effort-or-luck/favicon.svg"',
    "/effort-or-luck/_astro/",
  ],
  "effort-or-luck/share/index.html": [
    'component-export="ShareScreen"',
    'href="https://furedea.com/effort-or-luck/share/"',
  ],
  "effort-or-luck/sources/index.html": [
    "数字の出典と仮定",
    'href="/effort-or-luck/"',
    'href="https://furedea.com/effort-or-luck/sources/"',
  ],
};

async function checkExists(relativePath) {
  try {
    await access(join(distDir, relativePath));
    return undefined;
  } catch {
    return `Missing ${relativePath}`;
  }
}

async function checkContents(relativePath, expectedContents) {
  let text;
  try {
    text = await readFile(join(distDir, relativePath), "utf8");
  } catch {
    return [];
  }
  return expectedContents
    .filter((expected) => !text.includes(expected))
    .map((expected) => `${relativePath} does not include ${expected}`);
}

const [existenceResults, contentResults] = await Promise.all([
  Promise.all(requiredPaths.map(checkExists)),
  Promise.all(
    Object.entries(requiredContents).map(([path, expected]) => checkContents(path, expected)),
  ),
]);

const failures = [
  ...existenceResults.filter((value) => value !== undefined),
  ...contentResults.flat(),
];

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Build output verified.");
