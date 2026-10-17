# ADR-0002: Static Astro site with a React game screen on Cloudflare Pages

- Status: Accepted
- Date: 2026-10-15

In the context of a browser game whose outer pages (top, share, sources) are mostly text and whose game screen is a single stateful view, facing the need to publish cheaply with no server to run or secure, we decided for an Astro site built to static files with the game screen as a React island, hosted on Cloudflare Pages, and against a React-only single-page app, a server-rendered framework such as Next.js, and a Cloudflare Worker or other server runtime, to achieve outer pages that ship as plain HTML, a game screen that can hold rich client state, and a calculation core that stays plain TypeScript independent of both frameworks, accepting two UI technologies in one repository and that any feature needing a server, such as storing shared results, must be redesigned to work from the URL or the browser alone.
