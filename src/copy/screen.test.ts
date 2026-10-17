import {
  budgetLine,
  endedCount,
  overflowLine,
  periodSummary,
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

test("a period's summary names the change in savings and in each stat that moved", () => {
  expect(periodSummary(30_000, { health: -6.4, mind: 3.2, social: 0.2, research: 0 })).toBe(
    "貯金 +3万円・健康 −6・心の余裕 +3",
  );
});

test("hours beyond the budget are said to come from savings", () => {
  expect(overflowLine(5, 5_500)).toBe(
    "足りない週5時間は，バイトを減らして貯金から（−5,500円／週）",
  );
});

test("selves who ended early are counted by reason", () => {
  expect(endedCount({ mind: 5, research: 3 })).toBe("途中で終わった人：心が折れた 5 人・留年 3 人");
  expect(endedCount({})).toBe("途中で終わった人はいない．");
});

test("the week's hours are shown against the budget", () => {
  expect(budgetLine(32.5, 40)).toBe("週32.5／40時間");
});

test("a falling stat is warned about with its value", () => {
  expect(warningLine("health", 18.4)).toBe("健康が 18 まで下がった．このままだと危ない．");
});
