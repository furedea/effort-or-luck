import { eventAt } from "./events";
import { makeLife, neededWorkHours, weekBudget } from "./life";
import { routineOf } from "./routine";
import { autoLive, followDecisions, middlePolicy, mostPolicy, type Decision } from "./year";

const decisions: Decision[] = [
  { week: 0, kind: "timetable", timetable: ["friends"] },
  { week: 9, kind: "choice", option: "esFive", resting: ["friends"] },
  { week: 20, kind: "timetable", timetable: ["rest", "research"] },
];

describe("following recorded decisions", () => {
  it("uses the latest timetable set by each week", () => {
    const policy = followDecisions(decisions);
    const life = makeLife(1);

    expect(policy.timetable(life, 0)).toEqual(["friends"]);
    expect(policy.timetable(life, 19)).toEqual(["friends"]);
    expect(policy.timetable(life, 20)).toEqual(["rest", "research"]);
  });

  it("wants the recorded option and rested tiles at its week, meeting other events the middle way", () => {
    const policy = followDecisions(decisions);
    const life = makeLife(1);
    eventAt(life, 0);
    const event = eventAt(life, 9)!;

    expect(policy.choose(life, event, 9)).toEqual({ key: "esFive", want: 2, resting: ["friends"] });
    expect(policy.choose(life, event, 10)).toEqual(middlePolicy.choose(life, event, 10));
  });
});

test("the same seed and policy always give the same year", () => {
  const { rng: _a, ...first } = autoLive(42, middlePolicy);
  const { rng: _b, ...second } = autoLive(42, middlePolicy);

  expect(second).toEqual(first);
});

test("the policies take on part-time work only while savings run low", () => {
  const life = makeLife(1);
  life.allowance = 0;
  const works = (timetable: readonly string[]) =>
    timetable.some((key) => key === "extraWork" || key === "moreWork");

  life.money = 49_999;
  expect(works(mostPolicy.timetable(life, 0))).toBe(true);
  expect(works(middlePolicy.timetable(life, 0))).toBe(true);

  life.money = 50_000;
  expect(works(mostPolicy.timetable(life, 0))).toBe(false);
  expect(works(middlePolicy.timetable(life, 0))).toBe(false);
});

test("the middle way works the hours living costs need, then research and friends first", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const life = makeLife(seed);
    life.money = 0;
    const timetable = middlePolicy.timetable(life, 30);
    const hours = timetable.reduce((sum, key) => sum + routineOf(key).weeklyHours, 0);

    expect(hours).toBeLessThanOrEqual(weekBudget(life));
    const work = timetable.filter((key) => routineOf(key).kind === "work");
    const workHours = work.reduce((sum, key) => sum + routineOf(key).weeklyHours, 0);
    expect(workHours).toBeGreaterThanOrEqual(neededWorkHours(life));
    expect(timetable.slice(work.length, work.length + 2)).toEqual(["research", "friends"]);
  }
});
