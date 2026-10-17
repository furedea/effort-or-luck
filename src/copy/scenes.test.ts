import { optionCostLines, paymentLine } from "./scenes";

describe("what an option costs", () => {
  it("shows hours bought back from part-time work and the savings they take", () => {
    expect(optionCostLines({ hours: 30, money: 0, shortHours: 23, total: 25_300 })).toEqual([
      "30時間：バイトを23時間減らす",
      "貯金 −2万5,300円",
    ]);
  });

  it("shows only the hours when free time covers them", () => {
    expect(optionCostLines({ hours: 12, money: 0, shortHours: 0, total: 0 })).toEqual(["12時間"]);
  });

  it("shows money spent alongside the hours", () => {
    expect(optionCostLines({ hours: 40, money: 30_000, shortHours: 0, total: 30_000 })).toEqual([
      "40時間",
      "貯金 −3万円",
    ]);
  });

  it("shows nothing for a free option", () => {
    expect(optionCostLines({ hours: 0, money: 0, shortHours: 0, total: 0 })).toEqual([]);
  });
});

describe("what a choice took", () => {
  it("names the part-time hours given up and the savings spent", () => {
    expect(paymentLine({ shortHours: 23, total: 25_300 })).toBe(
      "バイトを23時間減らし，貯金が2万5,300円減った．",
    );
  });

  it("names savings spent without giving up part-time work", () => {
    expect(paymentLine({ shortHours: 0, total: 30_000 })).toBe("貯金が3万円減った．");
  });

  it("says nothing when the choice cost nothing", () => {
    expect(paymentLine({ shortHours: 0, total: 0 })).toBeNull();
  });
});
