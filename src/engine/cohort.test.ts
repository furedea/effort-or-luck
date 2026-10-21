import { WEEKS } from "./calendar";
import {
  choose,
  COHORT_SIZE,
  isOver,
  pickPlayer,
  replayYear,
  revealByAllowance,
  revealGaps,
  setBookingTimetable,
  setTimetable,
  startCohort,
  step,
  type Cohort,
} from "./cohort";
import type { OptionKey, RoutineKey } from "./facts";
import type { Life } from "./life";
import { autoLive, followDecisions, leastPolicy, mostPolicy } from "./year";

function withoutRng({ rng: _, ...rest }: Life) {
  return rest;
}

/**
 * Plays a year as `player`: sets `first` as the timetable, switches to `later` halfway, and
 * takes the first option offered at each event, doing only friends while its hours last.
 */
function playYear(
  seed: number,
  player: number,
  { first, later }: { first: readonly RoutineKey[]; later: readonly RoutineKey[] },
): Cohort {
  let cohort = setTimetable(startCohort(seed), first);
  while (!isOver(cohort)) {
    if (cohort.week === WEEKS / 2) cohort = setTimetable(cohort, later);
    const event = cohort.events[player];
    const option: OptionKey | undefined = event?.options.find((o) => o.shortfall === null)?.key;
    if (option) cohort = setBookingTimetable(choose(cohort, option), ["friends"]);
    cohort = step(cohort);
  }
  return cohort;
}

describe("starting the 100 selves", () => {
  it("creates 100 lives sorted by allowance, then regional before metro", () => {
    const { lives, seeds } = startCohort(7);

    expect(lives).toHaveLength(COHORT_SIZE);
    expect(lives.map((life) => life.seed)).toEqual(seeds);
    const order = lives.map((life) => [life.allowance, Number(life.metro)] as const);
    expect(order).toEqual(order.toSorted(([a, x], [b, y]) => a - b || x - y));
  });

  it("opens on the first week with everyone's introduction", () => {
    const cohort = startCohort(7);

    expect(cohort.week).toBe(0);
    expect(cohort.events.every((event) => event?.facts.id === "intro")).toBe(true);
  });
});

describe("a shared year", () => {
  it("gives each self the year its recorded decisions give it alone", () => {
    const cohort = playYear(2026, 0, {
      first: ["selfAnalysis", "friends", "rest"],
      later: ["interviewPractice", "research"],
    });

    expect(isOver(cohort)).toBe(true);
    for (const life of cohort.lives) {
      expect(withoutRng(life)).toEqual(
        withoutRng(autoLive(life.seed, followDecisions(cohort.decisions))),
      );
    }
  });

  it("remembers everyone who could not pay for part of the timetable in some week", () => {
    // Paid extras plus more hours than poorer selves have: their savings run out within weeks.
    let cohort = setTimetable(startCohort(46), [
      "jobCourse",
      "certification",
      "friends",
      "rest",
      "sns",
      "research",
    ]);
    const seen = new Set<number>();
    while (!isOver(cohort)) {
      cohort = step(cohort);
      cohort.lastWeek.forEach((outcome, i) => {
        if (outcome?.dropped.length) seen.add(i);
      });
    }

    expect(seen.size).toBeGreaterThan(0);
    expect([...cohort.everBlocked].sort((a, b) => a - b)).toEqual([...seen].sort((a, b) => a - b));
  });

  it("records each timetable and choice with the week it was made", () => {
    const cohort = playYear(3, 0, { first: ["friends"], later: ["rest"] });

    expect(cohort.decisions[0]).toEqual({ week: 0, kind: "timetable", timetable: ["friends"] });
    expect(cohort.decisions).toContainEqual({
      week: WEEKS / 2,
      kind: "timetable",
      timetable: ["rest"],
    });
    expect(cohort.decisions.some((d) => d.kind === "choice")).toBe(true);
    expect(cohort.decisions).toContainEqual(
      expect.objectContaining({ kind: "booking", timetable: ["friends"] }),
    );
  });
});

describe("the end of the year", () => {
  it("replays the same seeds putting the most and the least into job hunting", () => {
    const cohort = playYear(9, 0, { first: ["friends"], later: ["friends"] });

    const { most, least } = replayYear(cohort);

    expect(most.map(withoutRng)).toEqual(
      cohort.seeds.map((seed) => withoutRng(autoLive(seed, mostPolicy))),
    );
    expect(least.map(withoutRng)).toEqual(
      cohort.seeds.map((seed) => withoutRng(autoLive(seed, leastPolicy))),
    );
  });

  it("counts, for each allowance, how many selves had an offer", () => {
    const cohort = playYear(11, 0, {
      first: ["selfAnalysis", "infoSessions"],
      later: ["interviewPractice"],
    });

    const rows = revealByAllowance(cohort.lives, cohort.allowanceRanks);

    expect(rows.map((row) => row.amount)).toEqual([0, 30_000, 70_000, 120_000]);
    expect(rows.reduce((sum, row) => sum + row.members.length, 0)).toBe(COHORT_SIZE);
    for (const row of rows) {
      expect(row.offered).toBe(
        row.members.filter((i) => cohort.lives[i]!.offers.length > 0).length,
      );
    }
  });
});

test("every self, and every replayed path, lives at the chosen difficulty", () => {
  let cohort = startCohort(5, "hard");
  while (!isOver(cohort)) cohort = step(cohort);

  const { most, least } = replayYear(cohort);

  expect(new Set([...cohort.lives, ...most, ...least].map((life) => life.difficulty))).toEqual(
    new Set(["hard"]),
  );
});

describe("choosing whom the player lives as", () => {
  const cohort = startCohort(5);

  it("is a metro self on the largest allowance when easy", () => {
    for (const draw of [0, 0.5, 0.99]) {
      const life = cohort.lives[pickPlayer(cohort, "easy", draw)]!;
      expect([life.metro, life.allowance]).toEqual([true, 120_000]);
    }
  });

  it("is a regional self on no allowance when hard", () => {
    for (const draw of [0, 0.5, 0.99]) {
      const life = cohort.lives[pickPlayer(cohort, "hard", draw)]!;
      expect(life.metro).toBe(false);
      expect(life.allowance).toBe(0);
    }
  });

  it("is anyone when normal", () => {
    expect(pickPlayer(cohort, "normal", 0)).toBe(0);
    expect(pickPlayer(cohort, "normal", 0.999)).toBe(COHORT_SIZE - 1);
  });
});

test("the reveal's two gaps: across allowances for the same choices, and across choices for the same luck", () => {
  const cohort = playYear(13, 0, {
    first: ["selfAnalysis", "friends", "rest"],
    later: ["interviewPractice", "research"],
  });
  const { most, least } = replayYear(cohort);
  const rate = (lives: readonly Life[]) =>
    lives.filter((l) => l.offers.length).length / lives.length;
  const rows = revealByAllowance(cohort.lives, cohort.allowanceRanks).filter(
    (r) => r.members.length,
  );
  const rowRates = rows.map((r) => r.offered / r.members.length);

  expect(revealGaps(cohort.lives, cohort.allowanceRanks, { most, least })).toEqual({
    luck: Math.max(...rowRates) - Math.min(...rowRates),
    effort: rate(most) - rate(least),
  });
});
