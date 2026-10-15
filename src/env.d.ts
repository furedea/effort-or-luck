/// <reference types="astro/client" />

// Astro resolves .astro imports only through its language server; this lets plain TypeScript
// tooling (tsgolint, vitest typecheck) type them in tests.
declare module "*.astro" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";

  const component: AstroComponentFactory;
  export default component;
}
