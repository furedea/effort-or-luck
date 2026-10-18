import { makeLife } from "./life";
import {
  DIFFICULTY,
  FOURTH_YEAR_RESEARCH_DRIFT,
  HEALTH_PER_OVERLOAD_HOUR,
  HEALTHY_WORKLOAD_WEEKLY_HOURS,
  MIND_PER_JOB_HOUR,
  STARTING_STATS,
  WEEKLY_DRIFT,
} from "./parameters";
import { liveThroughPeriod, shock, sleepCost } from "./wellbeing";

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
      shortHours: 0,
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
      shortHours: 0,
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
      shortHours: 0,
    });

    expect(life.stats.social).toBeCloseTo(STARTING_STATS.social + (WEEKLY_DRIFT.social + 1.4) * 4);
  });

  it("wears health down for weekly work beyond the healthy load, and mind for job hunting", () => {
    const life = richLife();
    const jobHours = 4 * (HEALTHY_WORKLOAD_WEEKLY_HOURS + 10);

    liveThroughPeriod(life, {
      weeks: 4,
      fourthYear: false,
      taken: [],
      jobHours,
      extraWorkHours: 0,
      shortHours: 0,
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
      shortHours: 0,
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
      shortHours: 0,
    });
    const health = life.stats.health;

    liveThroughPeriod(life, {
      weeks: 4,
      fourthYear: false,
      taken: [],
      jobHours: 0,
      extraWorkHours: 0,
      shortHours: 0,
    });

    expect(life.stats.health).toBe(health);
  });
});

describe("difficulty", () => {
  it("starts every stat higher when easy and lower when hard", () => {
    const [easy, normal, hard] = (["easy", "normal", "hard"] as const).map(
      (difficulty) => makeLife(1, difficulty).stats,
    );

    expect(normal).toEqual(STARTING_STATS);
    for (const stat of Object.keys(STARTING_STATS) as (keyof typeof STARTING_STATS)[]) {
      expect(easy![stat]).toBeGreaterThan(normal![stat]);
      expect(hard![stat]).toBeLessThan(normal![stat]);
    }
  });

  it("scales the weekly drift", () => {
    const drift = (difficulty: "easy" | "normal" | "hard") => {
      const life = makeLife(1, difficulty);
      const before = life.stats.social;
      liveThroughPeriod(life, {
        weeks: 1,
        fourthYear: false,
        taken: [],
        jobHours: 0,
        extraWorkHours: 0,
        shortHours: 0,
      });
      return life.stats.social - before;
    };

    expect(drift("normal")).toBeCloseTo(WEEKLY_DRIFT.social);
    expect(drift("easy")).toBeCloseTo(WEEKLY_DRIFT.social * DIFFICULTY.easy.driftFactor);
    expect(drift("hard")).toBeCloseTo(WEEKLY_DRIFT.social * DIFFICULTY.hard.driftFactor);
  });
});

describe("hours taken from sleep", () => {
  it("cost a little for the first few hours and much more beyond", () => {
    expect(sleepCost(2)).toEqual({ health: 0.6, mind: 0.2 });
    expect(sleepCost(5)).toEqual({ health: 1.5, mind: 0.5 });
    expect(sleepCost(10).health).toBeCloseTo(5.5);
    expect(sleepCost(20).health).toBeCloseTo(13.5);
  });

  it("move health and mind each week", () => {
    const life = makeLife(1);

    liveThroughPeriod(life, {
      weeks: 1,
      fourthYear: false,
      taken: [],
      jobHours: 0,
      extraWorkHours: 0,
      shortHours: 10,
    });

    expect(life.stats.health).toBeCloseTo(STARTING_STATS.health + WEEKLY_DRIFT.health - 5.5);
    expect(life.stats.mind).toBeCloseTo(STARTING_STATS.mind + WEEKLY_DRIFT.mind - 1);
  });
});
