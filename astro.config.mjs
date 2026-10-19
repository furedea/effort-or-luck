import react from "@astrojs/react";
import { defineConfig } from "astro/config";

import { BASE_PATH } from "./src/links.ts";

// Served at furedea.com/effort-or-luck/ by a Worker whose static assets mirror the URL paths, so
// the pages build into a directory named after the base.
export default defineConfig({
  site: "https://furedea.com",
  base: BASE_PATH,
  trailingSlash: "always",
  outDir: `./dist${BASE_PATH}`,
  integrations: [react()],
});
