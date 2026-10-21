// @vitest-environment happy-dom
import {
  chooseDifficulty,
  click,
  keepFlowing,
  mount,
  mountRaw,
  passMs,
  speedButton,
  startYear,
  stepButton,
  tabNamed,
  tileNamed,
  when,
  setUpGameScreenTests,
} from "./game_screen_driver";
import { playToReveal } from "./play_to_reveal";

setUpGameScreenTests();

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
    if (isStopWithoutChoice(host)) stopsWithoutChoice.push(when(host) ?? "");
    const option = eventAction(host);
    if (option) click(option);
    else keepFlowing(host);
  }

  expect(stopsWithoutChoice).toEqual([]);
  expect(when(host)).toBe("6月1日");
  expect(host.querySelectorAll(".feed-entry").length).toBeGreaterThan(0);
});

/** Whether time stopped at an event that offers no choice and books nothing. */
function isStopWithoutChoice(host: HTMLElement): boolean {
  const event = host.querySelector(".event");
  return Boolean(event && !event.querySelector(".opt, .timetable.booking"));
}

/** The first affordable option at an event, or else the button confirming a booking's rest. */
function eventAction(host: HTMLElement): HTMLButtonElement | null {
  const event = host.querySelector(".event");
  return (
    event?.querySelector<HTMLButtonElement>(".opt:not([disabled])") ??
    event?.querySelector<HTMLButtonElement>(".rest-confirm") ??
    null
  );
}

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
  const rooms = [...host.querySelectorAll(".event .opt .room-head")].map((n) => n.textContent);
  expect(rooms.length).toBeGreaterThan(0);
  for (const room of rooms) expect(room).toMatch(/^(あと[\d.]+時間|週[\d.]+時間たりない)$/);
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

/** Plays to the first option whose hours do not fit a 37-hour timetable, and returns it. */
function toOptionThatDoesNotFit() {
  const host = toFirstChoice((h) => {
    for (const name of ["研究・ゼミ", "友達と遊ぶ", "ゆっくり休む", "SNS・動画"]) {
      click(tileNamed(h, name));
    }
  });
  const doesNotFit = () =>
    [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")].find((button) =>
      /たりない$/.test(button.querySelector(".room-head")?.textContent ?? ""),
    );
  for (let guard = 0; guard < 100 && !doesNotFit(); guard++) {
    takeLastOrFlow(host);
  }
  return { host, option: doesNotFit()! };
}

/** Takes the last affordable option at an event; whether there was one. */
function takeLastOption(host: HTMLElement): boolean {
  const options = [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")];
  if (!options.length) return false;
  click(options.at(-1)!);
  return true;
}

/** Takes the last affordable option at an event, or lets a week pass. */
function takeLastOrFlow(host: HTMLElement): void {
  if (!takeLastOption(host)) keepFlowing(host);
}

const actionNamed = (host: HTMLElement, label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>(".actions button")].find(
    (button) => button.textContent === label,
  )!;

test("sets a timetable for the booking when an option's hours do not fit, then returns", () => {
  const { host, option } = toOptionThatDoesNotFit();
  expect(option.querySelector(".room-head")?.textContent).toMatch(/^週\d+(\.\d)?時間たりない$/);
  expect(option.querySelector(".room-sub")?.textContent).toBe("予定の間の時間割を組む ›");

  click(option);

  const card = () => host.querySelector(".timetable.booking");
  const restStatus = () => host.querySelector(".actions .rest-status")?.textContent;
  expect(card()?.querySelector(".activity-section")?.textContent).toMatch(
    /^予定の間の時間割（あと\d+週）$/,
  );
  expect(card()?.querySelector(".booking-note")?.textContent).toBe(
    "予定が終わると，いつもの時間割に戻る",
  );
  expect(restStatus()).toMatch(/睡眠を削る/);
  // Takes out the large tiles and fits a small one in between.
  click(tileNamed(host, "友達と遊ぶ"));
  click(tileNamed(host, "ゆっくり休む"));
  click(tileNamed(host, "自己分析"));
  expect(restStatus()).toBe("時間内に収まる");

  click(actionNamed(host, "この時間割で進む"));

  expect(host.querySelector(".event")).toBeNull();
  expect(stepButton(host)).toBeNull();
  expect(card()).not.toBeNull();
  expect(tileNamed(host, "自己分析").getAttribute("aria-pressed")).toBe("true");
  expect(tileNamed(host, "友達と遊ぶ").getAttribute("aria-pressed")).toBe("false");

  // Once the booking is over, the usual timetable is back.
  for (let guard = 0; guard < 60 && card(); guard++) {
    takeLastOrFlow(host);
  }
  takeLastOption(host);
  expect(card()).toBeNull();
  expect(tileNamed(host, "友達と遊ぶ").getAttribute("aria-pressed")).toBe("true");
  expect(tileNamed(host, "自己分析").getAttribute("aria-pressed")).toBe("false");
});

test("puts the booking's timetable back to the usual one in one tap", () => {
  const { host, option } = toOptionThatDoesNotFit();
  click(option);
  const reset = () =>
    [...host.querySelectorAll<HTMLButtonElement>(".timetable.booking .timetable-head button")].find(
      (button) => button.textContent === "いつもの時間割に戻す",
    )!;
  expect(reset().disabled).toBe(true);
  click(tileNamed(host, "友達と遊ぶ"));
  click(tileNamed(host, "自己分析"));

  click(reset());

  expect(tileNamed(host, "友達と遊ぶ").getAttribute("aria-pressed")).toBe("true");
  expect(tileNamed(host, "自己分析").getAttribute("aria-pressed")).toBe("false");
  expect(reset().disabled).toBe(true);
});

test("goes back from the booking's timetable to the event's options", () => {
  const { host, option } = toOptionThatDoesNotFit();
  click(option);

  click(actionNamed(host, "選択肢に戻る"));

  expect(host.querySelector(".timetable.booking")).toBeNull();
  expect(host.querySelector(".event .opt")).not.toBeNull();
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

test("keeps flowing into the next week after a choice that books no hours", () => {
  const host = toFirstChoice();
  const takesNoTime = () =>
    [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")]
      .filter((button) => !/\d+時間/.test(button.querySelector(".cost")?.textContent ?? ""))
      .at(-1);

  click(takesNoTime()!);
  passMs(300);
  // An event in the next week hides the speeds; declining it shows whether time kept flowing.
  const next = takesNoTime();
  if (next) click(next);

  expect(stepButton(host)).toBeNull();
});

test("keeps the chosen speed after a choice that fits the week", () => {
  const host = toFirstChoice();
  const options = [...host.querySelectorAll<HTMLButtonElement>(".event .opt:not([disabled])")];

  click(options.at(-1)!);

  expect(stepButton(host)).toBeNull();
});

// Focusing forces a layout, so it waits for the next frame rather than lengthening the click.
test("moves focus to the first event on the next frame after a difficulty is picked", () => {
  const host = mountRaw();
  const before = document.activeElement;

  chooseDifficulty(host, "ふつう");

  expect(document.activeElement).toBe(before);
  passMs(20);
  expect(document.activeElement).toBe(host.querySelector(".when"));
});

test("moves focus to an event when time stops for it", () => {
  const host = mount();
  startYear(host);
  click(speedButton(host, "▶▶ 2倍"));

  for (let guard = 0; guard < 100 && !host.querySelector(".event"); guard++) keepFlowing(host);

  expect(host.querySelector(".event")).not.toBeNull();
  passMs(20);
  expect(document.activeElement).toBe(host.querySelector(".when"));
});
