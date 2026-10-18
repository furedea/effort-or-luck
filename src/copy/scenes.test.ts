import { weekOfMonthStart } from "../engine/calendar";
import { eventAt, type PricedOption } from "../engine/events";
import { makeLife } from "../engine/life";
import { routineOf } from "../engine/routine";
import { SMALL_EVENTS } from "../engine/small_events";
import {
  describeEvent,
  describeLog,
  optionCost,
  optionLabel,
  routineDetail,
  routineEffects,
  weekLabel,
} from "./scenes";

describe("week labels", () => {
  it("name the month and its week, marking the following spring", () => {
    expect(weekLabel(0)).toBe("4月 第1週");
    expect(weekLabel(weekOfMonthStart(1) + 1)).toBe("5月 第2週");
    expect(weekLabel(weekOfMonthStart(12))).toBe("翌4月 第1週");
  });

  it("show the result day once the weeks are over", () => {
    expect(weekLabel(60)).toBe("6月1日");
  });
});

function option(extra: Partial<PricedOption>): PricedOption {
  return {
    key: "esFive",
    effort: 2,
    hours: 0,
    weeks: 1,
    money: 0,
    apply: () => undefined,
    total: 0,
    shortfall: null,
    ...extra,
  };
}

describe("what an option takes", () => {
  it("lists hours, the weeks they spread over, and money that are not zero", () => {
    expect(optionCost(option({ hours: 15, weeks: 3, money: 30_000 }))).toBe("週5時間 × 3週・3万円");
    expect(optionCost(option({ hours: 8 }))).toBe("8時間");
    expect(optionCost(option({}))).toBe("");
  });

  it("adds the stats and preparation it changes", () => {
    expect(optionCost(option({ hours: 10, money: 20_000, stats: { mind: 5, social: -3 } }))).toBe(
      "10時間・2万円・心の余裕 +5・人間関係 −3",
    );
    expect(optionCost(option({ hours: 6, prep: 1 }))).toBe("6時間・面接・書類の通過率 +0.3%");
  });
});

describe("final interview labels", () => {
  it("name how many finals are taken in person when there are several", () => {
    const facts = {
      id: "finals",
      entries: 20,
      firstRound: 6,
      finals: 3,
      reimbursed: 0,
      metro: true,
    } as const;

    expect(optionLabel(option({ key: "finalsAllFace" }), facts)).toBe("3 社とも対面で受ける");
    expect(optionLabel(option({ key: "finalsAllOnline" }), facts)).toBe("全部オンラインで受ける");
  });
});

test("a routine's detail gives its weekly hours and effects in numbers", () => {
  expect(routineDetail(routineOf("rest"))).toBe(
    "ゆっくり休む（週10時間）：健康 +2.4・心の余裕 +0.6／週",
  );
});

test("an option that could not be taken is logged with its name", () => {
  expect(describeLog({ kind: "missed", event: "internEs", option: "esFive" })).toBe(
    "お金か時間が足りず「5 社に出す」ができなかった",
  );
});

function intro(extra: { neededWorkHours?: number; monthlyGapYen?: number } = {}) {
  return describeEvent({
    facts: {
      id: "intro",
      allowance: 70_000,
      metro: false,
      scholarship: 50_000,
      neededWorkHours: 3,
      monthlyGapYen: 10_000,
      weeklyHours: 40,
      money: 0,
      ...extra,
    },
    options: [],
  });
}

describe("the opening notice", () => {
  it("says in two lines when the year ends, where the self lives, and the monthly gap", () => {
    expect(intro().lines).toEqual([
      "翌年6月1日までの，就活の1年が始まる．",
      "地方で一人暮らし．仕送りと奨学金では，生活費が毎月1万円足りない．",
    ]);
    expect(intro().table).toEqual([
      { label: "自由な時間", value: "週 40 時間" },
      { label: "バイトの時給", value: "1,100円" },
      { label: "必要なバイト", value: "週 3 時間" },
    ]);
  });

  it("says when living costs are covered without part-time work", () => {
    const covered = intro({ neededWorkHours: 0, monthlyGapYen: 0 });

    expect(covered.lines.at(-1)).toBe("地方で一人暮らし．");
    expect(covered.table?.at(-1)).toEqual({ label: "必要なバイト", value: "なし" });
  });
});

describe("why the year ends on June 1st", () => {
  it("is recalled with the result: job hunting goes on after it", () => {
    const june = describeEvent({
      facts: { id: "june", done: false, won: 0, finalsTaken: 0, offers: 0, scholarshipTotal: 0 },
      options: [],
    });

    expect(june.lines.at(-1)).toBe("就活はこの後も続く．ここでは6月1日の時点で比べている．");
  });
});

test("every small choice has its own lines and option labels", () => {
  const life = makeLife(1);
  for (const { week } of SMALL_EVENTS) {
    const event = eventAt(life, week)!;
    expect(describeEvent(event).lines.length).toBeGreaterThan(0);
    for (const option of event.options) expect(optionLabel(option, event.facts)).toBeTruthy();
  }
});

describe("what a tile raises and lowers, in short", () => {
  it.each([
    ["selfAnalysis", "通過率↑・心↓"],
    ["infoSessions", "通過率↑・早期選考↑・心↓"],
    ["jobCourse", "通過率↑・心↓・お金↓"],
    ["certification", "書類↑・お金↓"],
    ["friends", "通過率↑・心↑・人間関係↑"],
    ["research", "研究↑"],
    ["rest", "健康↑・心↑"],
    ["extraWork", "お金↑"],
    ["summerEsPrep", "夏インターン↑・心↓"],
  ] as const)("%s: %s", (key, effects) => {
    expect(routineEffects(routineOf(key))).toBe(effects);
  });
});
