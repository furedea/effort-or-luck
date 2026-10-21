// @vitest-environment happy-dom
import { act } from "react";

import { mount, setUpGameScreenTests } from "./game_screen_driver";
import { playToReveal } from "./play_to_reveal";

setUpGameScreenTests();

test("the reveal opens with the offers, the luck and effort gaps, and which was larger", () => {
  const host = mount();
  playToReveal(host);

  const summary = host.querySelector(".reveal-summary");
  expect(summary?.querySelector(".gap-luck")?.textContent).toMatch(
    /^運の差仕送りで内定率が \d+% 違う$/,
  );
  expect(summary?.querySelector(".gap-effort")?.textContent).toMatch(
    /^努力の差選び方で内定率が \d+% 違う$/,
  );
  expect(summary?.querySelector(".gap-verdict")?.textContent).toMatch(
    /^→ この1年は，(運|努力)の差のほうが大きかった$/,
  );
  expect(host.querySelector(".reveal-details > summary")?.textContent).toBe("内訳を見る");
  expect(host.querySelector<HTMLAnchorElement>(".sources-link")?.getAttribute("href")).toBe(
    "/effort-or-luck/sources/",
  );
});

test("describes each allowance row in words for screen readers", () => {
  const host = mount();
  playToReveal(host);

  const rows = [...host.querySelectorAll(".band")];

  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(row.querySelector(".dots")?.getAttribute("aria-hidden")).toBe("true");
    expect(row.querySelector(".sr-only")?.textContent).toMatch(
      /^仕送り.+円の \d+ 人のうち，内定は \d+ 人/,
    );
  }
  expect(host.querySelectorAll(".band .sr-only")).toHaveLength(4);
  expect(
    [...host.querySelectorAll(".band .sr-only")].filter((n) => n.textContent?.includes("あなた")),
  ).toHaveLength(1);
});

test("shows, next to this game's counts, the long-run rate for the same choices", async () => {
  const host = mount();
  playToReveal(host);

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  const averages = [...host.querySelectorAll(".band .band-average")].map(
    (node) => node.textContent,
  );
  expect(averages).toHaveLength(4);
  for (const average of averages) expect(average).toMatch(/^平均 \d+%$/);
  expect(host.querySelector(".long-run-note")?.textContent).toBeTruthy();
});

test("the reveal sets luck against effort in two labeled parts", () => {
  const host = mount();
  playToReveal(host);

  const parts = [...host.querySelectorAll(".reveal h3")].map((node) => node.textContent);
  expect(parts).toEqual([
    "① 努力をそろえて，運だけ変えると",
    "② 運をそろえて，努力だけ変えると",
    "注",
  ]);
  // Each part leads with its gap, as in the summary above.
  const gaps = [...host.querySelectorAll(".part .part-gap")].map((node) => node.textContent);
  expect(gaps).toEqual([
    host.querySelector(".gap-luck")?.textContent?.replace("運の差", ""),
    host.querySelector(".gap-effort")?.textContent?.replace("努力の差", ""),
  ]);
  const bars = [...host.querySelectorAll(".path-bar")].map((bar) => [
    bar.querySelector(".path-label")?.textContent,
    bar.classList.contains("yours"),
  ]);
  expect(bars).toEqual([
    ["自分のことだけ", false],
    ["あなた", true],
    ["就活に全部使う", false],
  ]);
  for (const rate of host.querySelectorAll(".path-bar .path-rate")) {
    expect(rate.textContent).toMatch(/^\d+%$/);
  }
  expect(host.querySelector(".effort-detail > summary")?.textContent).toBe("仕送り別に見る");

  const header = [...host.querySelectorAll(".effort-table thead th")].map(
    (node) => node.textContent,
  );
  expect(header).toEqual(["仕送り", "自分のことだけ", "あなた", "就活に全部使う"]);

  const rows = [...host.querySelectorAll(".effort-table tbody tr")];
  expect(rows).toHaveLength(4);
  const yours = rows.map((row) => row.querySelectorAll("td")[1]?.textContent?.replace(/\s/g, ""));
  const bands = [...host.querySelectorAll(".band .band-count")].map((node) =>
    node.firstChild?.textContent?.replace(/\s|人/g, ""),
  );
  expect(yours).toEqual(bands);
  expect(host.querySelector(".toggle[aria-pressed]")).toBeNull();
});

test("the reveal gathers what counts as effort and the counts into notes at the end", () => {
  const host = mount();
  playToReveal(host);
  const notes = host.querySelector(".reveal-notes")!;

  for (const name of ["effort-definition", "blocked-count", "ended-count", "long-run-note"]) {
    expect(notes.querySelector(`li.${name}`)).not.toBeNull();
  }
  expect(notes.querySelector("cite")?.textContent).toMatch(/^出典：/);

  expect(host.querySelector(".effort-definition")?.textContent).toContain(
    "努力 ＝ どれを選ぼうとしたか",
  );
  expect(host.querySelector(".blocked-count")?.textContent).toMatch(
    /^(お金か時間が足りず，選んだことができなかった人：\d+ 人|全員が，選んだとおりにできた．)$/,
  );
});
