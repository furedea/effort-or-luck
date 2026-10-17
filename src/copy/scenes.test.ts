import { weekOfMonthStart } from "../engine/calendar";
import type { PricedOption } from "../engine/events";
import { routineOf } from "../engine/routine";
import { describeLog, optionCost, optionLabel, routineDetail, weekLabel } from "./scenes";

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
    expect(optionCost(option({ hours: 15, weeks: 3, money: 30_000 }))).toBe("15時間（3週）・3万円");
    expect(optionCost(option({ hours: 8 }))).toBe("8時間");
    expect(optionCost(option({}))).toBe("");
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
    "ゆっくり休む（週5時間）：健康 +1.2・心の余裕 +0.3／週",
  );
});

test("an option that could not be taken is logged with its name", () => {
  expect(describeLog({ kind: "missed", event: "internEs", option: "esFive" })).toBe(
    "お金か時間が足りず「5 社に出す」ができなかった",
  );
});
