import {
  budgetLine,
  endedCount,
  optionRoom,
  pauseLines,
  monthlyBreakdown,
  slackLine,
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
  const bars = statBars({ health: 24, mind: 25, social: 80, research: 3, study: 60 });

  expect(bars.filter((bar) => bar.low).map((bar) => bar.label)).toEqual(["健康", "研究"]);
});

test("hours beyond the budget are said to come from sleep", () => {
  expect(slackLine(10, 0)).toBe("睡眠を削るので，健康・心↓");
});

test("hours left over are said to help health and mind, and an exact fit says nothing", () => {
  expect(slackLine(0, 5)).toBe("余った時間で，健康・心↑");
  expect(slackLine(0, 0)).toBeNull();
});

test("selves who ended early are counted by reason", () => {
  expect(endedCount({ mind: 5, research: 3 })).toBe(
    "途中で終わった人：心が折れた 5 人・ゼミに居場所がなくなった 3 人",
  );
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
    expect(optionRoom(1)).toEqual({
      over: false,
      caption: "今週の残り",
      hours: "1時間",
      cost: null,
    });
  });

  it("marks hours over the week", () => {
    expect(optionRoom(-4.5)).toEqual({
      over: true,
      caption: "今週オーバー",
      hours: "4.5時間",
      cost: "睡眠を削る・健康↓・心↓",
    });
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
      "今週の予定が4時間オーバーした．",
      "札を外すか，睡眠を削って進む",
    ]);
  });
});

describe("the monthly money flow", () => {
  it("sums allowance, scholarship, and living costs into one monthly figure with its parts", () => {
    expect(monthlyBreakdown({ allowance: 30_000, scholarship: 50_000 })).toEqual({
      summary: "毎月 −5万円",
      rows: [
        { label: "仕送り", value: "+3万円" },
        { label: "奨学金", value: "+5万円" },
        { label: "生活費・家賃込み", value: "−13万円" },
      ],
    });
  });

  it("leaves out a scholarship not borrowed and shows a surplus with a plus", () => {
    expect(monthlyBreakdown({ allowance: 140_000, scholarship: 0 })).toEqual({
      summary: "毎月 +1万円",
      rows: [
        { label: "仕送り", value: "+14万円" },
        { label: "生活費・家賃込み", value: "−13万円" },
      ],
    });
  });
});

test("a self who ran out of study repeats the year, and one out of research loses the seminar", () => {
  expect(endedCount({ study: 2, research: 1 })).toBe(
    "途中で終わった人：ゼミに居場所がなくなった 1 人・留年 2 人",
  );
});
