// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";

import { GameScreen } from "./game_screen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Current browsers resolve scroll methods with a promise, unlike happy-dom.
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation((() =>
    Promise.resolve()) as typeof window.scrollTo);
});

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<GameScreen />));
  return host;
}

function click(button: HTMLButtonElement) {
  act(() => button.click());
}

/** The button that moves the year on: confirming a period's plan, or a notice's next button. */
function nextAction(host: HTMLElement): HTMLButtonElement | undefined {
  return host.querySelector<HTMLButtonElement>(".actions .confirm, .actions .next") ?? undefined;
}

test("shows the first month once mounted in the browser", () => {
  const host = mount();

  expect(host.querySelector(".when")?.textContent).toBe("3年 4月");
  expect(host.querySelector(".actions button")).not.toBeNull();
});

test("can be played from the first month to the reveal", () => {
  const host = mount();

  for (let guard = 0; guard < 20 && !host.querySelector(".reveal"); guard++) {
    const button = nextAction(host);
    if (!button) throw new Error(`no action on ${host.querySelector(".when")?.textContent}`);
    click(button);
  }

  expect(host.querySelector(".reveal")).not.toBeNull();
  expect(host.querySelectorAll(".dots i")).toHaveLength(100);
});

test("moves focus to the new month after a choice", () => {
  const host = mount();
  click(nextAction(host)!);

  click(nextAction(host)!);

  expect(document.activeElement).toBe(host.querySelector(".when"));
});

test("describes each allowance row in words for screen readers", () => {
  const host = mount();
  for (let guard = 0; guard < 20 && !host.querySelector(".reveal"); guard++)
    click(nextAction(host)!);

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
  for (let guard = 0; guard < 20 && !host.querySelector(".reveal"); guard++)
    click(nextAction(host)!);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
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
  for (let guard = 0; guard < 20 && !host.querySelector(".reveal"); guard++)
    click(nextAction(host)!);

  const parts = [...host.querySelectorAll(".reveal h3")].map((node) => node.textContent);
  expect(parts).toEqual(["① 努力をそろえて，運だけ変えると", "② 運をそろえて，努力だけ変えると"]);

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

test("the reveal says what counts as effort and how many could not follow the choices", () => {
  const host = mount();
  for (let guard = 0; guard < 20 && !host.querySelector(".reveal"); guard++)
    click(nextAction(host)!);

  expect(host.querySelector(".effort-definition")?.textContent).toContain(
    "努力 ＝ どれを選ぼうとしたか",
  );
  expect(host.querySelector(".blocked-count")?.textContent).toMatch(
    /^(お金か時間が足りず，選んだことができなかった人：\d+ 人|全員が，選んだとおりにできた．)$/,
  );
});

describe("dividing a period's time", () => {
  function firstPeriod() {
    const host = mount();
    click(nextAction(host)!);
    return host;
  }
  const total = (host: HTMLElement) => host.querySelector(".time-total")?.textContent;
  const activity = (host: HTMLElement, name: string) =>
    [...host.querySelectorAll<HTMLButtonElement>(".activity")].find((button) =>
      button.querySelector(".activity-name")?.textContent?.startsWith(name),
    )!;

  it("adds a chosen activity's hours to the bar and removes them when chosen again", () => {
    const host = firstPeriod();
    const before = total(host);

    click(activity(host, "説明会に6回出る"));
    expect(total(host)).toMatch(/^使う時間 12／\d+時間$/);

    click(activity(host, "説明会に6回出る"));
    expect(total(host)).toBe(before);
  });

  it("keeps only one of a group's alternatives", () => {
    const host = firstPeriod();

    click(activity(host, "夏インターンに ES を出す（5社）"));
    click(activity(host, "夏インターンに ES を出す（2社）"));

    const chosen = [...host.querySelectorAll(".activity[aria-pressed='true'] .activity-name")].map(
      (node) => node.textContent,
    );
    expect(chosen.filter((name) => name?.startsWith("夏インターン"))).toHaveLength(1);
    expect(chosen[0]).toContain("（2社）");
  });

  it("shows the four stats", () => {
    const host = firstPeriod();

    const labels = [...host.querySelectorAll(".stat-bar dt")].map((node) => node.textContent);
    expect(labels).toEqual(["健康", "心の余裕", "人間関係", "研究"]);
  });
});
