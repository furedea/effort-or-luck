import { grouped, yen } from "./format";

describe("yen", () => {
  it("writes man and the rest with thousands separators", () => {
    expect(yen(72_350)).toBe("7万2,350円");
    expect(yen(120_000)).toBe("12万円");
    expect(yen(5_000)).toBe("5,000円");
    expect(yen(999)).toBe("999円");
    expect(yen(0)).toBe("0円");
  });

  // The first locale-aware format loads number data in the browser, a long task at game start.
  it("formats without the locale-aware number formatting", () => {
    const toLocaleString = vi.spyOn(Number.prototype, "toLocaleString");

    yen(72_350);

    expect(toLocaleString).not.toHaveBeenCalled();
    toLocaleString.mockRestore();
  });
});

test("numbers are grouped by thousands", () => {
  expect(grouped(1_100)).toBe("1,100");
  expect(grouped(1_234_567)).toBe("1,234,567");
  expect(grouped(42)).toBe("42");
});
