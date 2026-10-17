import { EVENT_WEEKS } from "./calendar";
import { makeLife, weekBudget, weeklyIncomeYen, type Life } from "./life";
import { WAGE_YEN_PER_HOUR } from "./parameters";
import { routineOf } from "./routine";
import { liveWeek, planWeek } from "./week";

function richLife(): Life {
  const life = makeLife(1);
  life.allowance = 120_000;
  life.money = 1_000_000;
  return life;
}

describe("a week's timetable", () => {
  it("takes open routines that fit the budget at no cost", () => {
    const outcome = planWeek(richLife(), 0, ["selfAnalysis", "friends"]);

    expect(outcome.taken.map((spec) => spec.key)).toEqual(["selfAnalysis", "friends"]);
    const hours = routineOf("selfAnalysis").weeklyHours + routineOf("friends").weeklyHours;
    expect(outcome).toMatchObject({ hours, shortHours: 0, paid: 0 });
  });

  it("skips routines not open that week", () => {
    expect(planWeek(richLife(), 0, ["interviewPractice"]).taken).toEqual([]);
  });

  it("takes hours beyond the budget from sleep, without paying for them", () => {
    const life = richLife();
    const budget = weekBudget(life);
    const timetable = ["longIntern", "friends", "rest", "sns", "research"] as const;
    const hours = timetable.reduce((sum, key) => sum + routineOf(key).weeklyHours, 0);

    const outcome = planWeek(life, 0, timetable);

    expect(outcome.shortHours).toBe(Math.max(0, hours - budget));
    expect(outcome.paid).toBe(0);
  });

  it("drops a routine the self cannot pay for and keeps later ones it can", () => {
    const life = richLife();
    life.money = 0;

    const outcome = planWeek(life, 0, ["jobCourse", "friends"]);

    expect(outcome.dropped).toEqual(["jobCourse"]);
    expect(outcome.taken.map((spec) => spec.key)).toEqual(["friends"]);
  });

  it("counts a booked one-off before the timetable", () => {
    const life = richLife();
    life.oneOff = { hours: 30, weeks: 3 };

    expect(planWeek(life, 0, ["friends"]).hours).toBe(10 + routineOf("friends").weeklyHours);
  });
});

describe("living a week", () => {
  it("earns what paid routines pay and uses up one-offs and lost hours", () => {
    const life = richLife();
    life.oneOff = { hours: 30, weeks: 3 };
    life.lostWeekly = 5;
    life.lostWeeks = 2;
    const before = life.money;

    const outcome = liveWeek(life, 0, ["extraWork"]);

    expect(outcome?.earned).toBe(routineOf("extraWork").weeklyHours * WAGE_YEN_PER_HOUR);
    expect(life.money).toBeCloseTo(
      before + weeklyIncomeYen(life) + (outcome?.earned ?? 0) - (outcome?.paid ?? 0),
    );
    expect(life.oneOff).toEqual({ hours: 20, weeks: 2 });
    expect(life.lostWeeks).toBe(1);
  });

  it("does nothing once the year has ended", () => {
    const life = richLife();
    life.over = "health";

    expect(liveWeek(life, 0, ["friends"])).toBeNull();
  });
});

test("savings move by allowance and scholarship after living costs, plus part-time pay", () => {
  const life = richLife();
  const before = life.money;
  const income = weeklyIncomeYen(life);

  liveWeek(life, 0, ["longIntern", "selfAnalysis"]);
  expect(life.money).toBeCloseTo(before + income);

  liveWeek(life, 1, ["extraWork"]);
  expect(life.money).toBeCloseTo(
    before + 2 * income + routineOf("extraWork").weeklyHours * WAGE_YEN_PER_HOUR,
  );
});

test("without part-time work, a self whose allowance falls short loses savings each week", () => {
  const life = makeLife(1);
  life.allowance = 0;
  const before = life.money;

  liveWeek(life, 0, ["friends"]);

  expect(weeklyIncomeYen(life)).toBeLessThan(0);
  expect(life.money).toBeLessThan(before);
});

test("a limited routine is open only in the weeks before its event", () => {
  const spec = routineOf("summerEsPrep");

  expect(spec.until).toBe(EVENT_WEEKS.internEs);
  expect(planWeek(richLife(), spec.from - 1, ["summerEsPrep"]).taken).toEqual([]);
  expect(planWeek(richLife(), spec.from, ["summerEsPrep"]).taken).toEqual([spec]);
  expect(planWeek(richLife(), spec.until, ["summerEsPrep"]).taken).toEqual([]);
});
