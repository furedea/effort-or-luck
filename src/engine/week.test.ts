import { EVENT_WEEKS, weekOfMonthStart } from "./calendar";
import type { RoutineKey } from "./facts";
import { makeLife, monthlyIncomeYen, weekBudget, type Life } from "./life";
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
    const timetable = [
      "selfAnalysis",
      "infoSessions",
      "friends",
      "rest",
      "sns",
      "research",
    ] as const;
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

describe("a week with booked hours that do not fit", () => {
  // 40 free hours: friends 10, rest 10, sns 7 make 27, so a 30-hour booking runs 17 over.
  const timetable = ["friends", "rest", "sns"] as const;
  function bookedLife(hours: number): Life {
    const life = richLife();
    life.oneOff = { hours, weeks: 1 };
    return life;
  }

  it("rests the routines set last until the week fits, by default", () => {
    const outcome = planWeek(bookedLife(30), 0, timetable);

    expect(outcome.skipped).toEqual(["rest", "sns"]);
    expect(outcome.shortHours).toBe(0);
  });

  it("takes every routine out of sleep instead when the player cuts sleep", () => {
    const outcome = planWeek(bookedLife(30), 0, timetable, true);

    expect(outcome.skipped).toEqual([]);
    expect(outcome.shortHours).toBe(17);
  });

  it("keeps the sleep the timetable already cut, resting only what the booking adds", () => {
    // The timetable takes 48 hours, 8 over; a 10-hour booking rests research to get back to 48.
    const over = ["selfAnalysis", "infoSessions", "friends", "rest", "sns", "research"] as const;

    const outcome = planWeek(bookedLife(10), 0, over);

    expect(outcome.skipped).toEqual(["research"]);
    expect(outcome.shortHours).toBe(8);
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

    expect(outcome?.earned).toBe(routineOf("extraWork").weeklyPay);
    expect(life.money).toBe(
      before + monthlyIncomeYen(life) + (outcome?.earned ?? 0) - (outcome?.paid ?? 0),
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

test("allowance and scholarship after living costs move savings once a month, at its start", () => {
  const life = richLife();
  const before = life.money;
  const income = monthlyIncomeYen(life);
  const may = weekOfMonthStart(1);

  liveWeek(life, 0, ["longIntern"]);
  expect(life.money).toBe(before + income);

  for (let week = 1; week < may; week++) liveWeek(life, week, ["longIntern"]);
  expect(life.money).toBe(before + income);

  liveWeek(life, may, ["extraWork"]);
  expect(life.money).toBe(before + 2 * income + routineOf("extraWork").weeklyPay);
});

test("without part-time work, a self whose allowance falls short loses savings each month", () => {
  const life = makeLife(1);
  life.allowance = 0;
  const before = life.money;

  liveWeek(life, 0, ["friends"]);

  expect(monthlyIncomeYen(life)).toBeLessThan(0);
  expect(life.money).toBeLessThan(before);
});

test("a limited routine is open only in the weeks before its event", () => {
  const spec = routineOf("summerEsPrep");

  expect(spec.until).toBe(EVENT_WEEKS.internEs);
  expect(planWeek(richLife(), spec.from - 1, ["summerEsPrep"]).taken).toEqual([]);
  expect(planWeek(richLife(), spec.from, ["summerEsPrep"]).taken).toEqual([spec]);
  expect(planWeek(richLife(), spec.until, ["summerEsPrep"]).taken).toEqual([]);
});

test("savings stay in round thousands of yen week after week", () => {
  const life = makeLife(1);
  life.allowance = 30_000;

  for (let week = 0; week < 10; week++) liveWeek(life, week, ["extraWork", "certification"]);

  expect(Number.isInteger(life.money / 1_000)).toBe(true);
});

test("the long internship tile counts only for a self accepted into it", () => {
  const life = richLife();
  const june = weekOfMonthStart(2);

  expect(planWeek(life, june, ["longIntern"]).taken).toEqual([]);
  life.longInternAccepted = true;
  expect(planWeek(life, june, ["longIntern"]).taken.map((spec) => spec.key)).toEqual([
    "longIntern",
  ]);
});

describe("unnatural trades the week rules out", () => {
  // 10 + 10 + 7 + 8 = 35 hours: adding 10 hours of rest runs 5 hours into sleep.
  const full = ["friends", "research", "sns", "extraWork"] as const;

  it("never lets rest added to a full week pay off its hours taken from sleep", () => {
    const health = (timetable: readonly RoutineKey[]) => {
      const life = richLife();
      liveWeek(life, 30, timetable);
      return life.stats.health;
    };

    expect(health([...full, "rest"])).toBeLessThanOrEqual(health(full));
  });

  it("skips the last routines that no longer fit when hours are lost, instead of cutting sleep", () => {
    const life = richLife();
    life.lostWeekly = 12.5;
    life.lostWeeks = 1;

    const outcome = planWeek(life, 30, full);

    expect(outcome.shortHours).toBe(0);
    expect(outcome.skipped.length).toBeGreaterThan(0);
    expect(outcome.hours).toBeLessThanOrEqual(outcome.budget);
  });
});

test("part-time work is one choice: a second part-time tile in the timetable is ignored", () => {
  const outcome = planWeek(richLife(), 0, ["extraWork", "moreWork"]);

  expect(outcome.taken.map((spec) => spec.key)).toEqual(["extraWork"]);
});
