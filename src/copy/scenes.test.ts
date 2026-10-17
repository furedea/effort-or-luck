import type { ActivitySpec } from "../engine/activities";
import { activityCost, activityLabel, describeLog } from "./scenes";

function spec(extra: Partial<ActivitySpec>): ActivitySpec {
  return { key: "jobCourse", kind: "job", hours: 0, money: 0, pays: 0, ...extra };
}

describe("what an activity takes and gives", () => {
  it("lists hours, cost, and pay that are not zero", () => {
    expect(activityCost(spec({ hours: 24, money: 30_000 }))).toEqual(["24時間", "3万円"]);
    expect(activityCost(spec({ hours: 128, pays: 140_800 }))).toEqual(["128時間", "+14万800円"]);
    expect(activityCost(spec({}))).toEqual([]);
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

    expect(activityLabel(spec({ key: "finalsAllFace" }), facts)).toBe("3 社とも対面で受ける");
    expect(activityLabel(spec({ key: "finalsAllOnline" }), facts)).toBe("全部オンラインで受ける");
  });
});

test("a dropped activity is logged with its period and name", () => {
  expect(describeLog({ kind: "dropped", period: "winter", activity: "obVisits" })).toBe(
    "1〜2月，お金が足りず「東京で OB 訪問（5人）」をあきらめた",
  );
});
