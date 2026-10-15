import { getContainerRenderer } from "@astrojs/react/container-renderer";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { loadRenderers } from "astro:container";

import IndexPage from "./pages/index.astro";

test("top page hosts the game screen as an island hydrated on load", async () => {
  const renderers = await loadRenderers([getContainerRenderer()]);
  const container = await AstroContainer.create({ renderers });

  const html = await container.renderToString(IndexPage);

  expect(html).toMatch(/<astro-island[^>]*component-export="GameScreen"[^>]*client="load"/);
});
