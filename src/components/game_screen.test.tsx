// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";

import { GameScreen } from "./game_screen";
import { playToReveal } from "./play_to_reveal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Current browsers resolve scroll methods with a promise, unlike happy-dom.
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation((() =>
    Promise.resolve()) as typeof window.scrollTo);
});

afterEach(() => {
  vi.useRealTimers();
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

function startYear(host: HTMLElement) {
  click(host.querySelector<HTMLButtonElement>(".event .next")!);
}

const when = (host: HTMLElement) => host.querySelector(".when")?.textContent;
const tileNamed = (host: HTMLElement, name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>(".activity")].find(
    (button) => button.querySelector(".activity-name")?.textContent === name,
  )!;
const stepButton = (host: HTMLElement) => host.querySelector<HTMLButtonElement>(".actions .step");
const speedButton = (host: HTMLElement, label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>(".speeds button")].find(
    (button) => button.textContent === label,
  )!;
const passMs = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

test("opens on the first week with the opening notice", () => {
  const host = mount();

  expect(when(host)).toBe("4月 第1週");
  expect(host.querySelector(".event .next")?.textContent).toBe("始める");
});

test("moves one week per press by default, and not on its own", () => {
  const host = mount();
  startYear(host);

  passMs(3000);
  expect(when(host)).toBe("4月 第2週");

  click(stepButton(host)!);
  expect(when(host)).toBe("4月 第3週");
});

test("flows on its own at normal or double speed until set back to one week per press", () => {
  const host = mount();
  startYear(host);

  click(speedButton(host, "▶ 自動"));
  passMs(600);
  expect(when(host)).toBe("4月 第3週");
  expect(stepButton(host)).toBeNull();

  click(speedButton(host, "▶▶ 2倍"));
  passMs(300);
  passMs(300);
  expect(when(host)).toBe("4月 第5週");

  click(speedButton(host, "1週ずつ"));
  passMs(3000);
  expect(when(host)).toBe("4月 第5週");
});

test("stops only for choices, listing other happenings while time flows", () => {
  const host = mount();
  startYear(host);
  // Living only for oneself never ends the year early, so the year reaches June.
  for (const name of ["友達と遊ぶ", "SNS・動画", "研究・ゼミ", "ゆっくり休む"]) {
    click(tileNamed(host, name));
  }
  click(speedButton(host, "▶▶ 2倍"));

  const stopsWithoutChoice: string[] = [];
  for (let guard = 0; guard < 400 && !host.querySelector(".event .next"); guard++) {
    const event = host.querySelector(".event");
    const option = event?.querySelector<HTMLButtonElement>(".opt:not([disabled])");
    if (event && !event.querySelector(".opt")) stopsWithoutChoice.push(when(host) ?? "");
    if (option) {
      click(option);
    } else {
      act(() => {
        vi.advanceTimersByTime(300);
      });
    }
  }

  expect(stopsWithoutChoice).toEqual([]);
  expect(when(host)).toBe("6月1日");
  expect(host.querySelectorAll(".feed li").length).toBeGreaterThan(0);
});

test("can be played from the first week to the reveal", () => {
  const host = mount();

  playToReveal(host);

  expect(host.querySelector(".reveal")).not.toBeNull();
  expect(host.querySelectorAll(".dots i")).toHaveLength(100);
});

test("moves focus to an event when time stops for it", () => {
  const host = mount();
  startYear(host);
  click(speedButton(host, "▶▶ 2倍"));

  for (let guard = 0; guard < 100 && !host.querySelector(".event"); guard++) passMs(300);

  expect(host.querySelector(".event")).not.toBeNull();
  expect(document.activeElement).toBe(host.querySelector(".when"));
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
  playToReveal(host);

  expect(host.querySelector(".effort-definition")?.textContent).toContain(
    "努力 ＝ どれを選ぼうとしたか",
  );
  expect(host.querySelector(".blocked-count")?.textContent).toMatch(
    /^(お金か時間が足りず，選んだことができなかった人：\d+ 人|全員が，選んだとおりにできた．)$/,
  );
});

describe("the weekly timetable", () => {
  function firstWeek() {
    const host = mount();
    startYear(host);
    return host;
  }
  const total = (host: HTMLElement) => host.querySelector(".time-total")?.textContent;
  const tile = (host: HTMLElement, name: string) =>
    [...host.querySelectorAll<HTMLButtonElement>(".activity")].find(
      (button) => button.querySelector(".activity-name")?.textContent === name,
    )!;

  it("adds a chosen routine's weekly hours to the bar and removes them when chosen again", () => {
    const host = firstWeek();
    const before = total(host);

    click(tile(host, "説明会"));
    expect(total(host)).toMatch(/^週2／\d+(\.\d)?時間$/);

    click(tile(host, "説明会"));
    expect(total(host)).toBe(before);
  });

  it("explains the last pressed tile with its numbers", () => {
    const host = firstWeek();

    click(tile(host, "ゆっくり休む"));

    expect(host.querySelector(".activity-detail")?.textContent).toBe(
      "ゆっくり休む（週5時間）：健康 +1.2・心の余裕 +0.3／週",
    );
  });

  it("shows the four stats", () => {
    const host = firstWeek();

    const labels = [...host.querySelectorAll(".stat-bar dt")].map((node) => node.textContent);
    expect(labels).toEqual(["健康", "心の余裕", "人間関係", "研究"]);
  });
});
