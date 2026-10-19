import { getContainerRenderer } from "@astrojs/react/container-renderer";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { loadRenderers } from "astro:container";

import { SOURCES } from "./data/statistics";
import IndexPage from "./pages/index.astro";
import SourcesPage from "./pages/sources.astro";

test("top page hosts the game screen as an island hydrated on load", async () => {
  const renderers = await loadRenderers([getContainerRenderer()]);
  const container = await AstroContainer.create({ renderers });

  const html = await container.renderToString(IndexPage);

  expect(html).toMatch(/<astro-island[^>]*component-export="GameScreen"[^>]*client="load"/);
});

test("sources page credits every source and states that pass rates are assumptions", async () => {
  const container = await AstroContainer.create();

  const html = await container.renderToString(SourcesPage);

  for (const source of Object.values(SOURCES)) expect(html).toContain(source);
  expect(html).toContain("合否の確率は仮定");
  expect(html).toContain("地域別の内定率");
  expect(html).toContain("交通費や宿泊費の支給");
});

test("the sources page links back to the game under the site's sub-path", async () => {
  const container = await AstroContainer.create();

  const html = await container.renderToString(SourcesPage);

  expect(html).toContain('href="/effort-or-luck/"');
});

test("pages describe themselves for search and sharing, with no font from another host", async () => {
  const container = await AstroContainer.create();

  const html = await container.renderToString(SourcesPage);

  expect(html).toMatch(/<meta name="description" content="[^"]+"/);
  expect(html).toMatch(/<meta property="og:title" content="[^"]+"/);
  expect(html).toMatch(/<meta property="og:description" content="[^"]+"/);
  expect(html).toMatch(
    /<link rel="icon" type="image\/svg\+xml" href="\/effort-or-luck\/favicon\.svg"/,
  );
  expect(html).not.toContain("fonts.googleapis.com");
  expect(html).not.toContain("fonts.gstatic.com");
});

test("pages extend under the phone's home bar, so fixed buttons can keep clear of it", async () => {
  const container = await AstroContainer.create();

  const html = await container.renderToString(SourcesPage);

  expect(html).toMatch(/<meta name="viewport" content="[^"]*viewport-fit=cover/);
});
