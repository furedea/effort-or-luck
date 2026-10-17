import { makeLife, weeklyPartTimeHours } from "./life";
import {
  FOURTH_YEAR_RESEARCH_DRIFT,
  HEALTH_PER_OVERLOAD_HOUR,
  HEALTHY_WORKLOAD_WEEKLY_HOURS,
  MIND_PER_JOB_HOUR,
  STARTING_STATS,
  WEEKLY_DRIFT,
} from "./parameters";
import { liveThroughPeriod, shock } from "./wellbeing";

const friends = { statsPerWeek: { social: 1.4 } };

function richLife() {
  const life = makeLife(1);
  life.allowance = 120_000;
  life.money = 1_000_000;
  return life;
}

describe("living through a period", () => {
  it("lets every stat drift by the week when nothing is done", () => {
    const life = richLife();

    liveThroughPeriod(life, {
      weeks: 4,
      fourthYear: false,
      taken: [],
      jobHours: 0,
      extraWorkHours: 0,
    });

    expect(life.stats.social).toBeCloseTo(STARTING_STATS.social + WEEKLY_DRIFT.social * 4);
    expect(life.stats.health).toBeCloseTo(STARTING_STATS.health + WEEKLY_DRIFT.health * 4);
  });

  it("drifts research faster in the fourth year", () => {
    const life = richLife();

    liveThroughPeriod(life, {
      weeks: 4,
      fourthYear: true,
      taken: [],
      jobHours: 0,
      extraWorkHours: 0,
    });

    expect(life.stats.research).toBeCloseTo(
      STARTING_STATS.research + FOURTH_YEAR_RESEARCH_DRIFT * 4,
    );
  });

  it("adds what each activity gives per week", () => {
    const life = richLife();

    liveThroughPeriod(life, {
      weeks: 4,
      fourthYear: false,
      taken: [friends],
      jobHours: 0,
      extraWorkHours: 0,
    });

    expect(life.stats.social).toBeCloseTo(STARTING_STATS.social + (WEEKLY_DRIFT.social + 1.4) * 4);
  });

  it("wears health down for weekly work beyond the healthy load, and mind for job hunting", () => {
    const life = richLife();
    const jobHours = 4 * (HEALTHY_WORKLOAD_WEEKLY_HOURS - weeklyPartTimeHours(life) + 10);

    liveThroughPeriod(life, {
      weeks: 4,
      fourthYear: false,
      taken: [],
      jobHours,
      extraWorkHours: 0,
    });

    expect(life.stats.health).toBeCloseTo(
      STARTING_STATS.health + WEEKLY_DRIFT.health * 4 - 10 * HEALTH_PER_OVERLOAD_HOUR * 4,
    );
    expect(life.stats.mind).toBeCloseTo(
      STARTING_STATS.mind + WEEKLY_DRIFT.mind * 4 - jobHours * MIND_PER_JOB_HOUR,
    );
  });
});

describe("the end of the year", () => {
  it("comes when a stat reaches zero, and is recorded", () => {
    const life = richLife();
    life.stats.social = 1;

    liveThroughPeriod(life, {
      weeks: 4,
      fourthYear: false,
      taken: [],
      jobHours: 0,
      extraWorkHours: 0,
    });

    expect(life.over).toBe("social");
    expect(life.stats.social).toBe(0);
    expect(life.log).toContainEqual({ kind: "over", stat: "social" });
  });

  it("can come from a sudden shock", () => {
    const life = richLife();
    life.stats.health = 10;

    shock(life, "sick");

    expect(life.over).toBe("health");
  });

  it("stops the stats once it has come", () => {
    const life = richLife();
    life.stats.social = 1;
    liveThroughPeriod(life, {
      weeks: 4,
      fourthYear: false,
      taken: [],
      jobHours: 0,
      extraWorkHours: 0,
    });
    const health = life.stats.health;

    liveThroughPeriod(life, {
      weeks: 4,
      fourthYear: false,
      taken: [],
      jobHours: 0,
      extraWorkHours: 0,
    });

    expect(life.stats.health).toBe(health);
  });
});
