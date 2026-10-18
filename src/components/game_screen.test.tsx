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

function mountRaw() {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<GameScreen />));
  return host;
}

function click(button: HTMLButtonElement) {
  act(() => button.click());
}

function chooseDifficulty(host: HTMLElement, name: string) {
  const buttons = [...host.querySelectorAll<HTMLButtonElement>(".difficulty .opt")];
  click(buttons.find((button) => button.querySelector(".label")?.textContent === name)!);
}

/** Mounts the game and starts it at normal difficulty. */
function mount() {
  const host = mountRaw();
  chooseDifficulty(host, "ふつう");
  return host;
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

/** Lets a week pass at double speed, setting the speed again if time went back to steps. */
function keepFlowing(host: HTMLElement) {
  if (stepButton(host)) click(speedButton(host, "▶▶ 2倍"));
  passMs(300);
}

test("asks for a difficulty before the year starts", () => {
  const host = mountRaw();

  const labels = [...host.querySelectorAll(".difficulty .opt .label")].map((n) => n.textContent);
  expect(labels).toEqual(["やさしい", "ふつう", "きびしい"]);
  expect(host.querySelector(".difficulty .opt .cost")?.textContent).toBe(
    "健康などの初期値 +15・毎週の減り方 ×0.7",
  );
});

test("starts the stats from the chosen difficulty", () => {
  const host = mountRaw();

  chooseDifficulty(host, "きびしい");

  const health = host.querySelector(".stat-bar .meter-value")?.textContent;
  expect(health).toBe("55");
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

test("returns to one week per press when limited-time preparation appears", () => {
  const host = mount();
  startYear(host);

  click(speedButton(host, "▶▶ 2倍"));
  for (let guard = 0; guard < 10 && !host.querySelector(".limited"); guard++) passMs(300);
  passMs(3000);

  expect(when(host)).toBe("5月 第1週");
  expect(stepButton(host)).not.toBeNull();
  expect(host.querySelector(".feed li")?.textContent).toContain(
    "★ 今だけ：夏インターンのES対策（あと4週）",
  );
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
    if (option) click(option);
    else keepFlowing(host);
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

test("shows this week's hours and what each option leaves at an event", () => {
  const host = mount();
  startYear(host);
  click(speedButton(host, "▶▶ 2倍"));
  for (let guard = 0; guard < 100 && !host.querySelector(".event .opt"); guard++) {
    keepFlowing(host);
  }

  expect(host.querySelector(".event .week-status")?.textContent).toMatch(/^週.+時間（.+）・貯金 /);
  const afters = [...host.querySelectorAll(".event .opt .after")].map((n) => n.textContent);
  expect(afters.length).toBeGreaterThan(0);
  for (const after of afters) expect(after).toMatch(/^選ぶと：/);
});

/** Plays at double speed until the first event with options, after `setUp` on the first week. */
function toFirstChoice(setUp: (host: HTMLElement) => void = () => undefined) {
  const host = mount();
  startYear(host);
  setUp(host);
  click(speedButton(host, "▶▶ 2倍"));
  for (let guard = 0; guard < 100 && !host.querySelector(".event .opt"); guard++) {
    keepFlowing(host);
  }
  return host;
}

test("shows the hour bar at an event", () => {
  const host = toFirstChoice();

  expect(host.querySelector(".event .bar")).not.toBeNull();
});

test("stops on the timetable after a choice that runs the week over", () => {
  const host = toFirstChoice((h) => {
    // Over 40 hours in all, so the week runs over whichever option is taken.
    for (const name of [
      "研究・ゼミ",
      "友達と遊ぶ",
      "ゆっくり休む",
      "SNS・動画",
      "自己分析",
      "説明会",
    ]) {
      click(tileNamed(h, name));
    }
  });

  // Some events offer nothing that takes hours to this self, such as a trip it cannot pay for.
  const takesHours = () =>
    [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")].find((button) =>
      /\d+時間/.test(button.querySelector(".cost")?.textContent ?? ""),
    );
  for (let guard = 0; guard < 100 && !takesHours(); guard++) {
    const options = [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")];
    if (options.length) click(options.at(-1)!);
    else keepFlowing(host);
  }
  click(takesHours()!);

  expect(host.querySelector(".event")).toBeNull();
  expect(stepButton(host)).not.toBeNull();
  expect(host.querySelector(".time-over")).not.toBeNull();
  const legend = [...host.querySelectorAll(".bar-legend li")].map((n) => n.textContent);
  expect(legend.at(-1)).toMatch(/^オーバー \d+(\.\d)?時間$/);
});

test("keeps the chosen speed after declining, even in a week already over", () => {
  const host = toFirstChoice((h) => {
    for (const name of [
      "研究・ゼミ",
      "友達と遊ぶ",
      "ゆっくり休む",
      "SNS・動画",
      "自己分析",
      "説明会",
    ]) {
      click(tileNamed(h, name));
    }
  });
  const takesNoTime = [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")]
    .filter((button) => !/\d+時間/.test(button.querySelector(".cost")?.textContent ?? ""))
    .at(-1)!;

  click(takesNoTime);

  expect(stepButton(host)).toBeNull();
});

test("keeps the chosen speed after a choice that fits the week", () => {
  const host = toFirstChoice();
  const options = [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")];

  click(options.at(-1)!);

  expect(stepButton(host)).toBeNull();
});

test("returns to one week per press when hours booked for an event end", () => {
  const host = mount();
  startYear(host);
  click(speedButton(host, "▶▶ 2倍"));
  const takesHours = () =>
    [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")].find((button) =>
      /\d+時間/.test(button.querySelector(".cost")?.textContent ?? ""),
    );
  for (let guard = 0; guard < 100 && !takesHours(); guard++) {
    const options = [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")];
    if (options.length) click(options.at(-1)!);
    else keepFlowing(host);
  }
  click(takesHours()!);

  for (let guard = 0; guard < 6 && !stepButton(host); guard++) passMs(300);

  expect(stepButton(host)).not.toBeNull();
  expect(host.querySelector(".feed li")?.textContent).toMatch(
    /予定が終わり，週\d+(\.\d)?時間あいた/,
  );
});

test("moves focus to an event when time stops for it", () => {
  const host = mount();
  startYear(host);
  click(speedButton(host, "▶▶ 2倍"));

  for (let guard = 0; guard < 100 && !host.querySelector(".event"); guard++) keepFlowing(host);

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
    expect(total(host)).toMatch(/^週6／\d+時間（あと\d+(\.\d)?時間）$/);

    click(tile(host, "説明会"));
    expect(total(host)).toBe(before);
  });

  it("offers limited-time preparation only in the weeks before its event, with weeks left", () => {
    const host = firstWeek();
    expect(host.querySelector(".limited")).toBeNull();

    for (let i = 0; i < 4; i++) click(stepButton(host)!);

    expect(when(host)).toBe("5月 第1週");
    const tile = host.querySelector(".limited .activity");
    expect(tile?.querySelector(".activity-name")?.textContent).toBe("夏インターンのES対策");
    expect(tile?.querySelector(".activity-cost")?.textContent).toBe("週4時間・あと4週");
  });

  it("groups the tiles into job hunting, study, oneself, and money", () => {
    const host = firstWeek();
    const groups = [...host.querySelectorAll(".activity-group")].map((group) => ({
      title: group.querySelector(".activity-section")?.textContent,
      tiles: [...group.querySelectorAll(".activity-name")].map((n) => n.textContent),
    }));

    expect(groups.map((g) => g.title)).toEqual(["就活", "学業", "自分のこと", "お金"]);
    expect(groups[1]?.tiles).toEqual(["資格の勉強", "研究・ゼミ"]);
  });

  it("clears every tile at once", () => {
    const host = firstWeek();
    click(tile(host, "説明会"));
    click(tile(host, "友達と遊ぶ"));

    click(host.querySelector<HTMLButtonElement>(".clear-all")!);

    expect(host.querySelectorAll(".activity[aria-pressed='true']")).toHaveLength(0);
    expect(host.querySelector<HTMLButtonElement>(".clear-all")?.disabled).toBe(true);
  });

  it("says on each tile what it raises and lowers", () => {
    const host = firstWeek();

    expect(tile(host, "ゆっくり休む").querySelector(".activity-effects")?.textContent).toBe(
      "健康↑・心↑",
    );
  });

  it("names the bar's colors with their hours", () => {
    const host = firstWeek();

    click(tile(host, "説明会"));
    click(tile(host, "研究・ゼミ"));
    click(tile(host, "友達と遊ぶ"));

    const legend = [...host.querySelectorAll(".bar-legend li")].map((n) => n.textContent);
    expect(legend).toEqual(["就活 6時間", "学業 10時間", "自分のこと 10時間"]);
  });

  it("keeps the numbers off the screen, for screen readers only", () => {
    const host = firstWeek();

    click(tile(host, "ゆっくり休む"));

    expect(host.querySelector(".activity-detail")).toBeNull();
    expect(tile(host, "ゆっくり休む").getAttribute("aria-label")).toBe(
      "ゆっくり休む（週10時間）：健康 +2.4・心の余裕 +0.6／週",
    );
  });

  it("shows the four stats", () => {
    const host = firstWeek();

    const labels = [...host.querySelectorAll(".stat-bar dt")].map((node) => node.textContent);
    expect(labels).toEqual(["健康", "心の余裕", "人間関係", "研究"]);
  });
});
