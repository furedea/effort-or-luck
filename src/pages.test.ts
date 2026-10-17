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
});
