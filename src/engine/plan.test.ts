import type { ActivitySpec } from "./activities";
import type { ActivityKey } from "./facts";
import { makeLife } from "./life";
import { EXTRA_WORK_WEEKLY_HOURS, WAGE_YEN_PER_HOUR } from "./parameters";
import { allocate, carryOut, type Scene } from "./plan";

function activity(
  key: ActivityKey,
  hours: number,
  extra: Partial<ActivitySpec> = {},
): ActivitySpec {
  return { key, kind: "job", hours, money: 0, pays: 0, ...extra };
}

function periodScene(budget: number, activities: ActivitySpec[], weeks = 4): Scene {
  return {
    facts: { id: "march", busy: false },
    period: { id: "march", weeks, fourthYear: true, activities, budget },
  };
}

describe("dividing a period's time", () => {
  it("takes chosen activities that fit the budget at no cost", () => {
    const scene = periodScene(40, [activity("infoSessions", 12), activity("selfAnalysis", 20)]);

    const allocation = allocate(makeLife(1), scene, ["infoSessions", "selfAnalysis"]);

    expect(allocation.taken.map((a) => a.key)).toEqual(["infoSessions", "selfAnalysis"]);
    expect(allocation).toMatchObject({ hours: 32, shortHours: 0, paid: 0 });
  });

  it("buys hours beyond the budget back from part-time work with savings", () => {
    const life = makeLife(1);
    life.money = 100_000;
    const scene = periodScene(10, [
      activity("infoSessions", 12),
      activity("jobFair", 6, { money: 1000 }),
    ]);

    const allocation = allocate(life, scene, ["infoSessions", "jobFair"]);

    expect(allocation.shortHours).toBe(8);
    expect(allocation.paid).toBe(8 * WAGE_YEN_PER_HOUR + 1000);
  });

  it("drops what the self cannot pay for and still takes later picks it can", () => {
    const life = makeLife(1);
    life.money = 5000;
    const scene = periodScene(30, [
      activity("jobCourse", 24, { money: 30_000 }),
      activity("infoSessions", 12),
    ]);

    const allocation = allocate(life, scene, ["jobCourse", "infoSessions"]);

    expect(allocation.dropped).toEqual(["jobCourse"]);
    expect(allocation.taken.map((a) => a.key)).toEqual(["infoSessions"]);
  });

  it("takes only the first affordable alternative in a group", () => {
    const life = makeLife(1);
    life.money = 0;
    const scene = periodScene(100, [
      activity("finalsAllFace", 24, { money: 90_000, group: "finals" }),
      activity("finalsOneFace", 12, { money: 30_000, group: "finals" }),
      activity("finalsAllOnline", 6, { group: "finals" }),
    ]);

    const allocation = allocate(life, scene, ["finalsAllFace", "finalsOneFace", "finalsAllOnline"]);

    expect(allocation.taken.map((a) => a.key)).toEqual(["finalsAllOnline"]);
    expect(allocation.dropped).toEqual(["finalsAllFace", "finalsOneFace"]);
  });

  it("puts left-over hours into part-time work, up to the weekly limit", () => {
    const weeks = 4;
    const roomy = allocate(makeLife(1), periodScene(200, [activity("infoSessions", 12)], weeks), [
      "infoSessions",
    ]);
    const tight = allocate(makeLife(1), periodScene(20, [activity("infoSessions", 12)], weeks), [
      "infoSessions",
    ]);

    expect(roomy.extraWorkHours).toBe(EXTRA_WORK_WEEKLY_HOURS * weeks);
    expect(tight.extraWorkHours).toBe(8);
    expect(tight.earned).toBe(8 * WAGE_YEN_PER_HOUR);
  });

  it("adds what a paid activity pays to the earnings", () => {
    const scene = periodScene(300, [activity("longIntern", 128, { pays: 140_800 })], 8);

    const allocation = allocate(makeLife(1), scene, ["longIntern"]);

    expect(allocation.earned).toBe(EXTRA_WORK_WEEKLY_HOURS * 8 * WAGE_YEN_PER_HOUR + 140_800);
  });

  it("changes the life only when carried out, recording what was dropped", () => {
    const life = makeLife(1);
    life.money = 0;
    const scene = periodScene(30, [activity("jobCourse", 24, { money: 30_000 })]);

    allocate(life, scene, ["jobCourse"]);
    expect(life.log.some((fact) => fact.kind === "dropped")).toBe(false);

    carryOut(life, scene, ["jobCourse"]);
    expect(life.log).toContainEqual({ kind: "dropped", period: "march", activity: "jobCourse" });
  });
});
