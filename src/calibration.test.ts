import { JUNE_OFFER_RATE, JUNE_OFFER_RATE_BY_REGION } from "./data/statistics";
import type { Life } from "./engine/life";
import type { Difficulty } from "./engine/parameters";
import { autoLive, middlePolicy, mostPolicy, type Policy } from "./engine/year";

const LIVES = 20_000;
/** Simulating thousands of years takes several seconds on slower CI runners. */
const SIMULATION_TIMEOUT_MS = 60_000;
const TOLERANCE = 0.02;
const MIDDLE_ENDED_EARLY_LIMIT = 0.05;
const MOST_ENDED_EARLY_LIMIT = 0.8;

function year(policy: Policy) {
  const tally = { all: [0, 0], metro: [0, 0], regional: [0, 0] };
  let ended = 0;
  for (let i = 0; i < LIVES; i++) {
    const life = autoLive((1 + i * 7919) >>> 0, policy);
    if (life.over) ended++;
    const offered = life.offers.length > 0 ? 1 : 0;
    for (const key of ["all", life.metro ? "metro" : "regional"] as const) {
      tally[key][0]! += 1;
      tally[key][1]! += offered;
    }
  }
  const rate = ([lives, offered]: number[]) => offered! / lives!;
  return {
    all: rate(tally.all),
    metro: rate(tally.metro),
    regional: rate(tally.regional),
    endedEarly: ended / LIVES,
  };
}

const middle = year(middlePolicy);

test("the middle way matches the surveyed June 1st offer rate within 2 points", () => {
  expect(middle.all).toBeGreaterThanOrEqual(JUNE_OFFER_RATE - TOLERANCE);
  expect(middle.all).toBeLessThanOrEqual(JUNE_OFFER_RATE + TOLERANCE);
});

test("metro selves lead regional ones by the surveyed regional gap within 2 points", () => {
  const surveyed = JUNE_OFFER_RATE_BY_REGION.kanto - JUNE_OFFER_RATE_BY_REGION.otherRegions;

  const gap = middle.metro - middle.regional;

  expect(gap).toBeGreaterThanOrEqual(surveyed - TOLERANCE);
  expect(gap).toBeLessThanOrEqual(surveyed + TOLERANCE);
});

test("few selves who take the middle way end the year early", () => {
  expect(middle.endedEarly).toBeLessThanOrEqual(MIDDLE_ENDED_EARLY_LIMIT);
});

test(
  "putting everything into job hunting ends the year early for more selves, but not all",
  () => {
    const most = year(mostPolicy);

    expect(most.endedEarly).toBeGreaterThan(middle.endedEarly);
    expect(most.endedEarly).toBeLessThan(MOST_ENDED_EARLY_LIMIT);
  },
  SIMULATION_TIMEOUT_MS,
);

/** A balanced timetable with the most effortful option at every event. */
const effortful: Policy = {
  timetable: (life, week) => middlePolicy.timetable(life, week),
  choose: () => ({ key: null, want: 2 }),
};

test(
  "effortful play cannot make luck vanish: allowance still shows and not everyone succeeds",
  () => {
    const lives: Life[] = Array.from({ length: 6000 }, (_, i) =>
      autoLive((1 + i * 7919) >>> 0, effortful),
    );
    const rate = (group: Life[]) => group.filter((l) => l.offers.length).length / group.length;
    const poorest = lives.filter((l) => l.allowance === 0);
    const richest = lives.filter((l) => l.allowance === 120_000);

    expect(rate(lives)).toBeLessThan(0.93);
    expect(rate(richest) - rate(poorest)).toBeGreaterThan(0.06);
  },
  SIMULATION_TIMEOUT_MS,
);

/** A fixed set of tiles left as is all year, with the middle option at every event. */
const careless: Policy = {
  timetable: () => ["selfAnalysis", "infoSessions", "friends", "sns", "rest"],
  choose: () => ({ key: null, want: 1 }),
};

/** Offer rate of `policy` among selves in the circumstances `difficulty` gives the player. */
function playerRate(policy: Policy, difficulty: Difficulty, sample = 1000): number {
  let lived = 0;
  let offered = 0;
  for (let i = 0; lived < sample; i++) {
    const life = autoLive((1 + i * 7919) >>> 0, policy, difficulty);
    if (!isPlayerCircumstance(life, difficulty)) continue;
    lived++;
    if (life.offers.length) offered++;
  }
  return offered / lived;
}

/** Whether `life` began in the circumstances `difficulty` gives the player. */
function isPlayerCircumstance(life: Life, difficulty: Difficulty): boolean {
  const start = life.log[0];
  if (start?.kind !== "profile") return false;
  if (difficulty === "easy") return life.metro && start.allowance === 120_000;
  if (difficulty === "hard") return !life.metro && start.allowance === 0;
  return true;
}

describe("difficulty as the luck the player draws", () => {
  test(
    "easy forgives careless play",
    () => {
      expect(playerRate(careless, "easy")).toBeGreaterThan(0.8);
    },
    SIMULATION_TIMEOUT_MS,
  );

  test(
    "normal rewards thought over carelessness",
    () => {
      expect(playerRate(careless, "normal")).toBeLessThan(0.75);
      expect(playerRate(middlePolicy, "normal") - playerRate(careless, "normal")).toBeGreaterThan(
        0.08,
      );
    },
    SIMULATION_TIMEOUT_MS,
  );

  test(
    "hard leaves even thoughtful play near a coin toss",
    () => {
      const thoughtful = playerRate(middlePolicy, "hard");
      expect(thoughtful).toBeGreaterThan(0.4);
      expect(thoughtful).toBeLessThan(0.65);
      expect(playerRate(careless, "hard")).toBeLessThan(0.4);
    },
    SIMULATION_TIMEOUT_MS,
  );
});
