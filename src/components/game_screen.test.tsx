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
/** The tile named `name`, switching tabs until its group is shown. */
function tileNamed(host: HTMLElement, name: string): HTMLButtonElement {
  const visible = () =>
    [...host.querySelectorAll<HTMLButtonElement>(".tiles.active .activity")].find(
      (button) => button.querySelector(".activity-name")?.textContent === name,
    );
  for (const tab of [null, ...host.querySelectorAll<HTMLButtonElement>(".tab")]) {
    if (tab) click(tab);
    const found = visible();
    if (found) return found;
  }
  throw new Error(`no tile named ${name}`);
}

function tabNamed(host: HTMLElement, name: string): HTMLButtonElement {
  return [...host.querySelectorAll<HTMLButtonElement>(".tab")].find(
    (tab) => tab.textContent === name,
  )!;
}
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

test("opens on a title screen that explains the game above the difficulty choice", () => {
  const host = mountRaw();

  expect(host.querySelector(".title-screen h1")?.textContent).toBe("努力か，運か");
  expect(host.querySelector(".title-screen .lead")?.textContent).toBe(
    "就活の1年を過ごす．内定を決めるのは，努力か，運か．",
  );
  expect(host.querySelector(".title-screen .difficulty")).not.toBeNull();
});

test("asks for a difficulty before the year starts", () => {
  const host = mountRaw();

  const labels = [...host.querySelectorAll(".difficulty .opt .label")].map((n) => n.textContent);
  expect(labels).toEqual(["やさしい", "ふつう", "きびしい"]);
  const notes = [...host.querySelectorAll(".difficulty .opt")].map(
    (n) => n.querySelector(".cost")?.textContent ?? null,
  );
  expect(notes).toEqual([
    "首都圏・仕送り多め・丈夫・運のいい年",
    "境遇は運しだい",
    "地方・仕送りなし・疲れやすい・運の悪い年",
  ]);
});

test("hard places the player in a regional home on little allowance", () => {
  const host = mountRaw();

  chooseDifficulty(host, "きびしい");

  expect(host.querySelector(".event .lines")?.textContent).toContain("地方で一人暮らし");
});

test("starts the stats from the chosen difficulty", () => {
  const host = mountRaw();

  chooseDifficulty(host, "きびしい");

  const health = host.querySelector(".stat-bar .meter-value")?.textContent;
  expect(health).toBe("50");
});

test("groups the situation and the event into cards, with buttons below them", () => {
  const host = mount();

  const titles = [...host.querySelectorAll(".card > .card-title")].map((n) => n.textContent);
  expect(titles).toEqual(["出来事"]);
  expect(host.querySelector(".card .stat-bars")).not.toBeNull();
  expect(host.querySelector(".card .next")).toBeNull();
});

test("keeps the top slim: the date beside the progress, and only the latest happening", () => {
  const host = mount();
  startYear(host);
  click(speedButton(host, "▶▶ 2倍"));
  for (let guard = 0; guard < 40 && host.querySelectorAll(".feed-entry").length === 0; guard++) {
    keepFlowing(host);
  }

  expect(host.querySelector(".play-head .progress-bar")).not.toBeNull();
  expect(host.querySelectorAll(".feed-entry")).toHaveLength(1);
});

test("shows the monthly money flow under savings, with its parts on demand", () => {
  const host = mount();

  expect(host.querySelector(".money-detail summary")?.textContent).toMatch(/^毎月 [−+]/);
  expect(host.querySelector(".money-detail dl")?.textContent).toContain("生活費・家賃込み");
});

test("keeps every happening and choice in a history opened from the latest line", () => {
  const host = mount();
  startYear(host);
  click(speedButton(host, "▶▶ 2倍"));
  for (let guard = 0; guard < 100 && !host.querySelector(".event .opt"); guard++) {
    keepFlowing(host);
  }
  const label = host.querySelector(".event .opt:not([disabled]) .label")?.textContent ?? "";
  click(host.querySelector<HTMLButtonElement>(".event .opt:not([disabled])")!);

  const history = [...host.querySelectorAll(".history li")].map((n) => n.textContent);
  expect(history[0]).toContain(`→ ${label}`);
  expect(host.querySelector(".history summary")?.textContent).toContain(`→ ${label}`);
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
  expect(host.querySelector(".feed-entry")?.textContent).toContain(
    "★ 今だけ：夏インターンのES対策（あと4週）",
  );
  expect(host.querySelector(".tab[aria-selected='true']")?.textContent).toBe("★ 今だけ");
  const note = host.querySelector(".actions .paused-note");
  expect(note?.querySelector(".paused-head")?.textContent).toBe("一時停止");
  expect([...(note?.querySelectorAll(".paused-line") ?? [])].map((n) => n.textContent)).toEqual([
    "夏インターンのES対策が出た．",
    "入れるなら今（あと4週）",
  ]);

  click(speedButton(host, "▶ 自動"));
  expect(host.querySelector(".actions .paused-note")).toBeNull();
});

test("opens the limited-time tab even when another tab was chosen", () => {
  const host = mount();
  startYear(host);
  click(tabNamed(host, "お金"));

  for (let i = 0; i < 4; i++) click(stepButton(host)!);

  expect(when(host)).toBe("5月 第1週");
  expect(host.querySelector(".tab[aria-selected='true']")?.textContent).toBe("★ 今だけ");
  expect(host.querySelector(".actions .paused-note")).toBeNull();
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
  expect(host.querySelectorAll(".feed-entry").length).toBeGreaterThan(0);
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
  const rooms = [...host.querySelectorAll(".event .opt .room")].map((n) => n.textContent);
  expect(rooms.length).toBeGreaterThan(0);
  for (const room of rooms)
    expect(room).toMatch(/^(今週の残り\d+(\.\d)?時間|今週オーバー\d+(\.\d)?時間)$/);
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

describe("tiles taken out while an event's hours need room", () => {
  /** Starts with 説明会 planned and takes the first option that books hours. */
  function bookHours() {
    const host = mount();
    startYear(host);
    click(tileNamed(host, "説明会"));
    click(speedButton(host, "▶▶ 2倍"));
    const takesHours = () =>
      [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")].find((b) =>
        /\d+時間/.test(b.querySelector(".cost")?.textContent ?? ""),
      );
    for (let guard = 0; guard < 100 && !takesHours(); guard++) {
      const options = [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")];
      if (options.length) click(options.at(-1)!);
      else keepFlowing(host);
    }
    click(takesHours()!);
    return host;
  }
  const pressed = (host: HTMLElement, name: string) =>
    tileNamed(host, name).getAttribute("aria-pressed");
  const pausedChips = (host: HTMLElement) =>
    [...host.querySelectorAll(".chosen-chips .chip.paused")].map((c) => c.textContent);
  /** Lives on, declining events, for up to `weeks` weeks or until `done`. */
  function liveOn(host: HTMLElement, done: () => boolean, weeks = 40) {
    for (let guard = 0; guard < weeks * 3 && !done(); guard++) {
      const options = [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")];
      if (options.length) click(options.at(-1)!);
      else keepFlowing(host);
    }
    const options = [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")];
    if (options.length) click(options.at(-1)!);
  }

  const answer = (host: HTMLElement, label: string) =>
    click(
      [...host.querySelectorAll<HTMLButtonElement>(".remove-question button")].find(
        (b) => b.textContent === label,
      )!,
    );

  it("ask whether to rest until the event is over or go for good", () => {
    const host = bookHours();

    click(tileNamed(host, "説明会"));

    expect(host.querySelector(".remove-question p")?.textContent).toBe("説明会を外す？");
    expect([...host.querySelectorAll(".remove-question button")].map((b) => b.textContent)).toEqual(
      ["予定のあいだだけ休む", "やめる", "そのまま"],
    );
  });

  it("rest as paused and come back afterwards, while tiles added meanwhile stay", () => {
    const host = bookHours();

    click(tileNamed(host, "説明会"));
    answer(host, "予定のあいだだけ休む");
    click(tileNamed(host, "ゆっくり休む"));
    expect(pausedChips(host)).toEqual(["説明会 ⏸ 予定後に戻る"]);
    expect(tileNamed(host, "説明会").querySelector(".activity-cost")?.textContent).toBe("休み中");

    // The chips show only with the timetable, not while an event is on screen.
    liveOn(host, () => Boolean(host.querySelector(".timetable")) && pausedChips(host).length === 0);

    expect(pressed(host, "説明会")).toBe("true");
    expect(pressed(host, "ゆっくり休む")).toBe("true");
  });

  it("go for good when the player says so, now or from the paused chip", () => {
    const host = bookHours();
    click(tileNamed(host, "説明会"));
    answer(host, "予定のあいだだけ休む");

    click(host.querySelector<HTMLButtonElement>(".chosen-chips .chip.paused")!);
    expect([...host.querySelectorAll(".remove-question button")].map((b) => b.textContent)).toEqual(
      ["今すぐ戻す", "やめる", "そのまま"],
    );
    answer(host, "やめる");
    liveOn(host, () => false, 12);

    expect(pausedChips(host)).toEqual([]);
    expect(pressed(host, "説明会")).toBe("false");
  });
});

test("puts back tiles dropped for a limited-time tile once it closes, and keeps tiles added", () => {
  const host = mount();
  startYear(host);
  click(tileNamed(host, "説明会"));
  click(tileNamed(host, "研究・ゼミ"));
  for (let i = 0; i < 4; i++) click(stepButton(host)!);
  expect(when(host)).toBe("5月 第1週");

  click(tileNamed(host, "説明会"));
  click(
    [...host.querySelectorAll<HTMLButtonElement>(".remove-question button")].find(
      (b) => b.textContent === "予定のあいだだけ休む",
    )!,
  );
  click(tileNamed(host, "夏インターンのES対策"));
  click(tileNamed(host, "ゆっくり休む"));
  const pressed = (name: string) => tileNamed(host, name).getAttribute("aria-pressed");
  expect(pressed("説明会")).toBe("false");

  // Declining events on the way, live until the limited-time tile has closed in June.
  for (let guard = 0; guard < 12 && when(host) !== "6月 第2週"; guard++) {
    const options = [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")];
    click(options.at(-1) ?? stepButton(host)!);
  }

  expect(pressed("説明会")).toBe("true");
  expect(pressed("ゆっくり休む")).toBe("true");
  expect(host.querySelector(".chosen-chips")?.textContent).not.toContain("夏インターンのES対策");
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
  const tile = tileNamed;

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
    click(tabNamed(host, "★ 今だけ"));
    const tile = host.querySelector(".tiles.active .activity");
    expect(tile?.querySelector(".activity-name")?.textContent).toBe("夏インターンのES対策");
    expect(tile?.querySelector(".activity-cost")?.textContent).toBe("週4時間・あと4週");
  });

  it("shows one group of tiles at a time, chosen by tabs", () => {
    const host = firstWeek();
    const names = () =>
      [...host.querySelectorAll(".tiles.active .activity-name")].map((n) => n.textContent);

    expect([...host.querySelectorAll(".tab")].map((n) => n.textContent)).toEqual([
      "就活",
      "学業",
      "自分のこと",
      "お金",
    ]);
    click(tabNamed(host, "学業"));
    expect(names()).toEqual(["資格の勉強", "研究・ゼミ", "授業の予習・復習"]);
  });

  it("keeps every tab's tiles stacked in one place, so switching tabs keeps the height", () => {
    const host = firstWeek();
    const panels = [...host.querySelectorAll(".tile-stack > .tiles")];

    expect(panels).toHaveLength(host.querySelectorAll(".tab").length);
    expect(panels.filter((panel) => panel.classList.contains("active"))).toHaveLength(1);
    for (const panel of panels.filter((p) => !p.classList.contains("active"))) {
      expect(panel.hasAttribute("inert")).toBe(true);
    }
  });

  it("lists the chosen tiles under the bar as small chips that remove them", () => {
    const host = firstWeek();
    click(tile(host, "説明会"));
    click(tile(host, "友達と遊ぶ"));
    const chips = () =>
      [...host.querySelectorAll<HTMLButtonElement>(".chosen-chips .chip")].map(
        (c) => c.textContent,
      );

    expect(chips()).toEqual(["説明会 ×", "友達と遊ぶ ×"]);

    click(host.querySelector<HTMLButtonElement>(".chosen-chips .chip")!);

    expect(chips()).toEqual(["友達と遊ぶ ×"]);
    expect(tile(host, "説明会").getAttribute("aria-pressed")).toBe("false");
  });

  it("gives the price of tiles that cost or pay money", () => {
    const host = firstWeek();

    expect(tile(host, "就活講座").querySelector(".activity-cost")?.textContent).toBe(
      "週4時間・5,000円",
    );
    expect(tile(host, "バイト").querySelector(".activity-cost")?.textContent).toBe(
      "週8時間・+9,000円",
    );
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
    expect(labels).toEqual(["健康", "心の余裕", "人間関係", "研究", "勉強"]);
  });
});
