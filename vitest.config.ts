/// <reference types="vitest/config" />

import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}", "tests/**/*.test.ts"],
  },
});
