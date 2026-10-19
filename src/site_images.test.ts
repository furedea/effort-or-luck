import { readFileSync } from "node:fs";

const PNG_SIGNATURE = "89504e470d0a1a0a";

// A PNG starts with its signature and then the IHDR chunk, which holds the width and height.
function pngSize(publicFile: string) {
  const bytes = readFileSync(new URL(`../public/${publicFile}`, import.meta.url));
  expect(bytes.subarray(0, 8).toString("hex")).toBe(PNG_SIGNATURE);
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("provides a 1200 by 630 pixel social preview image", () => {
  expect(pngSize("og_image.png")).toEqual({ width: 1200, height: 630 });
});

test("provides square search and device icons at recommended sizes", () => {
  expect(pngSize("favicon.png")).toEqual({ width: 512, height: 512 });
  expect(pngSize("apple_touch_icon.png")).toEqual({ width: 180, height: 180 });
});
