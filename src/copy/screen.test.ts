import { statusItems } from "./screen";

const base = { allowance: 70_000, scholarship: 50_000, money: 20_000, freeHours: 70, offers: 0 };

describe("the status panel", () => {
  it("lists each figure with its label", () => {
    expect(statusItems(base).map(({ label, value }) => [label, value])).toEqual([
      ["仕送り", "7万円"],
      ["奨学金", "5万円"],
      ["貯金", "2万円"],
      ["就活に使える時間", "月70時間"],
      ["内定", "なし"],
    ]);
  });

  it("leaves out the scholarship when none is borrowed", () => {
    expect(statusItems({ ...base, scholarship: 0 }).map(({ label }) => label)).not.toContain(
      "奨学金",
    );
  });

  it.each([
    ["savings under 10,000 yen", { money: 9_999 }, "貯金"],
    ["fewer than 20 free hours", { freeHours: 19 }, "就活に使える時間"],
  ])("flags %s", (_, change, label) => {
    const flagged = statusItems({ ...base, ...change }).filter(({ low }) => low);

    expect(flagged.map((item) => item.label)).toEqual([label]);
  });

  it("does not flag figures at the thresholds", () => {
    expect(statusItems({ ...base, money: 10_000, freeHours: 20 }).some(({ low }) => low)).toBe(
      false,
    );
  });
});
