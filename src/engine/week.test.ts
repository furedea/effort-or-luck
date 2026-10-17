import { makeLife, type Life } from "./life";
import { DAY_HOURS, NO_REST_HEALTH, WAGE_YEN_PER_HOUR, WEEKEND_FRIENDS_FACTOR } from "./parameters";
import { routineOf } from "./routine";
import { EMPTY_TIMETABLE, withDay, type Timetable } from "./timetable";
import { liveWeek, planWeek } from "./week";

const MONDAY = 0;
const TUESDAY = 1;
const WEDNESDAY = 2;
const FRIDAY = 4;
const SATURDAY = 5;
const SUNDAY = 6;

function richLife(): Life {
  const life = makeLife(1);
  life.allowance = 120_000;
  life.money = 1_000_000;
  return life;
}

/** A life whose living costs need part-time work on Saturday and Wednesday. */
function twoDaysOfWork(): Life {
  const life = richLife();
  life.allowance = 30_000;
  return life;
}

function week(days: Record<number, Parameters<typeof withDay>[2]>): Timetable {
  return Object.entries(days).reduce(
    (timetable, [day, key]) => withDay(timetable, Number(day), key),
    EMPTY_TIMETABLE,
  );
}

const kinds = (life: Life, timetable: Timetable) =>
  planWeek(life, 0, timetable).days.map((day) => day.kind);

describe("a week's timetable", () => {
  it("takes each day's routine", () => {
    const outcome = planWeek(
      richLife(),
      0,
      week({ [MONDAY]: "selfAnalysis", [FRIDAY]: "friends" }),
    );

    expect(outcome.taken.map((spec) => spec.key)).toEqual(["selfAnalysis", "friends"]);
    expect(outcome.paid).toBe(0);
  });

  it("skips a routine on a day it does not fit, or in a week it is not open", () => {
    const timetable = week({ [SATURDAY]: "infoSessions", [MONDAY]: "interviewPractice" });

    expect(planWeek(richLife(), 0, timetable).taken).toEqual([]);
  });

  it("keeps the days living costs need for part-time work", () => {
    const life = twoDaysOfWork();

    const outcome = planWeek(life, 0, week({ [SATURDAY]: "friends", [SUNDAY]: "rest" }));

    expect(outcome.days[SATURDAY]?.kind).toBe("partTime");
    expect(outcome.days[WEDNESDAY]?.kind).toBe("partTime");
    expect(outcome.taken.map((spec) => spec.key)).toEqual(["rest"]);
  });

  it("gives a booked one-off the latest free days", () => {
    const life = twoDaysOfWork();
    life.oneOff = { hours: 30, weeks: 3 };

    expect(kinds(life, EMPTY_TIMETABLE)).toEqual([
      "idle",
      "idle",
      "partTime",
      "idle",
      "event",
      "partTime",
      "event",
    ]);
  });

  it("buys a one-off longer than the free days back from part-time work", () => {
    const life = twoDaysOfWork();
    life.oneOff = { hours: 7 * DAY_HOURS, weeks: 1 };

    const outcome = planWeek(life, 0, EMPTY_TIMETABLE);

    expect(outcome.days.every((day) => day.kind === "event")).toBe(true);
    expect(outcome.shortHours).toBe(2 * DAY_HOURS);
    expect(outcome.paid).toBe(2 * DAY_HOURS * WAGE_YEN_PER_HOUR);
  });

  it("drops a routine the self cannot pay for and keeps later ones it can", () => {
    const life = richLife();
    life.money = 0;

    const outcome = planWeek(life, 0, week({ [MONDAY]: "jobCourse", [TUESDAY]: "friends" }));

    expect(outcome.dropped).toEqual(["jobCourse"]);
    expect(outcome.taken.map((spec) => spec.key)).toEqual(["friends"]);
  });
});

describe("living a week", () => {
  it("counts friends at the weekend more than on a weekday", () => {
    const social = (day: number) => {
      const life = richLife();
      const before = life.stats.social;
      liveWeek(life, 0, week({ [day]: "friends", [MONDAY]: "rest" }));
      return life.stats.social - before;
    };
    const perDay = routineOf("friends").statsPerDay.social ?? 0;

    expect(social(SATURDAY) - social(FRIDAY)).toBeCloseTo(perDay * (WEEKEND_FRIENDS_FACTOR - 1));
  });

  it("costs health when no day is spent resting", () => {
    const health = (timetable: Timetable) => {
      const life = richLife();
      const before = life.stats.health;
      liveWeek(life, 0, timetable);
      return life.stats.health - before;
    };
    const restBonus = routineOf("rest").statsPerDay.health ?? 0;

    expect(health(week({ [SUNDAY]: "rest" })) - health(EMPTY_TIMETABLE)).toBeCloseTo(
      restBonus + NO_REST_HEALTH,
    );
  });

  it("uses up one-offs and lost hours", () => {
    const life = richLife();
    life.oneOff = { hours: 30, weeks: 3 };
    life.lostWeekly = 5;
    life.lostWeeks = 2;

    liveWeek(life, 0, EMPTY_TIMETABLE);

    expect(life.oneOff).toEqual({ hours: 20, weeks: 2 });
    expect(life.lostWeeks).toBe(1);
  });

  it("does nothing once the year has ended", () => {
    const life = richLife();
    life.over = "health";

    expect(liveWeek(life, 0, week({ [MONDAY]: "friends" }))).toBeNull();
  });
});

test("savings grow only from part-time work, a day at a time", () => {
  const life = richLife();
  const before = life.money;

  liveWeek(life, 0, week({ [MONDAY]: "longIntern", [TUESDAY]: "selfAnalysis" }));
  expect(life.money).toBe(before);

  liveWeek(life, 1, week({ [MONDAY]: "extraWork", [TUESDAY]: "extraWork" }));
  expect(life.money).toBe(before + 2 * DAY_HOURS * WAGE_YEN_PER_HOUR);
});
