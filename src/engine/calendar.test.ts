import { dateOf, WEEKS, weekOfMonthStart } from "./calendar";

describe("the calendar", () => {
  it("starts in the first week of April", () => {
    expect(dateOf(0)).toEqual({ month: 4, weekOfMonth: 1, following: false });
  });

  it("reaches the following April after twelve months and ends in the following May", () => {
    expect(dateOf(weekOfMonthStart(12))).toEqual({ month: 4, weekOfMonth: 1, following: true });
    expect(dateOf(WEEKS - 1)).toMatchObject({ month: 5, following: true });
  });

  it("numbers weeks within each month from 1", () => {
    const weeks = Array.from({ length: WEEKS }, (_, week) => dateOf(week));
    for (let week = 1; week < WEEKS; week++) {
      const [before, now] = [weeks[week - 1]!, weeks[week]!];
      expect(now.weekOfMonth).toBe(now.month === before.month ? before.weekOfMonth + 1 : 1);
    }
  });
});
