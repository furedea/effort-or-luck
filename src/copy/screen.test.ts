import {
  budgetLine,
  endedCount,
  optionRoom,
  pauseLines,
  overflowLine,
  statBars,
  statusItems,
  warningLine,
} from "./screen";

const base = { money: 20_000, offers: 0 };

describe("the status panel", () => {
  it("shows only what changes during play: savings and offers", () => {
    expect(statusItems(base).map(({ label, value }) => [label, value])).toEqual([
      ["貯金", "2万円"],
      ["内定", "なし"],
    ]);
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

describe("the room an option leaves in the week", () => {
  it("gives the hours left", () => {
    expect(optionRoom(1)).toEqual({ over: false, caption: "今週の残り", hours: "1時間" });
  });

  it("marks hours over the week", () => {
    expect(optionRoom(-4.5)).toEqual({ over: true, caption: "今週オーバー", hours: "4.5時間" });
  });
});

describe("why auto play paused", () => {
  it("names the limited-time tile and how long it stays", () => {
    expect(pauseLines({ kind: "limited", tile: "夏インターンのES対策", weeks: 4 })).toEqual([
      "夏インターンのES対策が出た．",
      "入れるなら今（あと4週）",
    ]);
  });

  it("gives the hours over and what to do", () => {
    expect(pauseLines({ kind: "over", hours: 4 })).toEqual([
      "今週が4時間はみ出た．",
      "札を外すか，そのまま進む",
    ]);
  });
});
