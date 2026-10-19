# ADR-0003: Serve the game at furedea.com/effort-or-luck/ from a Worker of static assets

- Status: Accepted
- Date: 2026-10-19
- Amends: ADR-0002 (hosting only; the site stays static)

In the context of publishing the game as a section of furedea.com, whose own repository deploys a static site with Cloudflare Pages and has no way to serve other projects under its paths, facing the need to keep the two repositories deploying independently, we decided for a Cloudflare Worker with static assets only, routed to `furedea.com/effort-or-luck*` and deployed by Workers Builds from this repository, with the Astro base set to `/effort-or-luck/` and the pages built into `dist/effort-or-luck/` so asset paths match URL paths, and against copying the build into furedea.com's output, a separate Pages project behind a proxying Worker, and a subdomain, to achieve a sub-path URL without touching furedea.com's build and with this game's own security headers and self-hosted fonts, accepting that the build places `_headers` at the assets root by a copy step and that every in-game link must go through one base constant.
