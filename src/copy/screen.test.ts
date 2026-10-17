import {
  budgetLine,
  endedCount,
  optionAfterLine,
  overflowLine,
  statBars,
  statusItems,
  warningLine,
} from "./screen";

const base = { allowance: 70_000, scholarship: 50_000, money: 20_000, offers: 0 };

describe("the status panel", () => {
  it("lists each figure with its label", () => {
    expect(statusItems(base).map(({ label, value }) => [label, value])).toEqual([
      ["仕送り", "7万円"],
      ["奨学金", "5万円"],
      ["貯金", "2万円"],
      ["内定", "なし"],
    ]);
  });

  it("leaves out the scholarship when none is borrowed", () => {
    expect(statusItems({ ...base, scholarship: 0 }).map(({ label }) => label)).not.toContain(
      "奨学金",
    );
  });

  it("flags savings under 10,000 yen but not at 10,000 yen", () => {
    expect(statusItems({ ...base, money: 9_999 }).find((i) => i.label === "貯金")?.low).toBe(true);
    expect(statusItems({ ...base, money: 10_000 }).find((i) => i.label === "貯金")?.low).toBe(
      false,
    );
  });
});

test("the stat bars flag stats close to zero", () => {
  const bars = statBars({ health: 24, mind: 25, social: 80, research: 3 });

  expect(bars.filter((bar) => bar.low).map((bar) => bar.label)).toEqual(["健康", "研究"]);
});

test("hours beyond the budget are said to come from sleep", () => {
  expect(overflowLine(5)).toBe("はみ出た週5時間は睡眠を削る（健康 −1／週）");
});

test("selves who ended early are counted by reason", () => {
  expect(endedCount({ mind: 5, research: 3 })).toBe("途中で終わった人：心が折れた 5 人・留年 3 人");
  expect(endedCount({})).toBe("途中で終わった人はいない．");
});

test("the week's hours are shown against the budget", () => {
  expect(budgetLine(26, 38)).toBe("週26／38時間（あと12時間）");
  expect(budgetLine(41, 38)).toBe("週41／38時間（3時間オーバー）");
});

test("a falling stat is warned about with its value", () => {
  expect(warningLine("health", 18.4)).toBe("健康が 18 まで下がった．このままだと危ない．");
});

describe("what choosing an option leaves", () => {
  it("gives the hours left this week and the savings after", () => {
    expect(optionAfterLine({ hoursLeft: 12, weeks: 1, moneyAfter: 30_000 })).toBe(
      "選ぶと：今週あと12時間・貯金 3万円",
    );
  });

  it("says how many weeks the hours last and when they run over", () => {
    expect(optionAfterLine({ hoursLeft: -4, weeks: 3, moneyAfter: 0 })).toBe(
      "選ぶと：3週間，毎週4時間オーバー（睡眠を削る）・貯金 0円",
    );
  });
});
