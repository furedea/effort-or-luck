import { choose, isOver, setTimetable, startCohort, step, type Cohort } from "../engine/cohort";
import { RULES_VERSION } from "../engine/parameters";
import { leastPolicy, middlePolicy, mostPolicy, type Policy } from "../engine/year";
import { encode, parse, replay, type ShareParams } from "./result_link";

/** Plays a year as `player`, switching to the next of `policies` at every event. */
function play(seed: number, player: number, policies: readonly Policy[]) {
  let cohort: Cohort = startCohort(seed);
  let turn = 0;
  while (!isOver(cohort)) {
    const life = cohort.lives[player]!;
    const policy = policies[turn % policies.length]!;
    const event = cohort.events[player];
    if (event?.options.length) {
      turn++;
      const { key, want } = policy.choose(life, event, cohort.week);
      const affordable = event.options.filter((o) => !o.shortfall);
      const option = affordable.find((o) => o.key === key) ?? nearest(affordable, want);
      cohort = choose(cohort, option.key);
    }
    cohort = setTimetable(cohort, policy.timetable(life, cohort.week));
    cohort = step(cohort);
  }
  return {
    cohort,
    params: {
      seed,
      player,
      difficulty: "normal",
      decisions: cohort.decisions,
    } satisfies ShareParams,
  };
}

function nearest<T extends { effort: number }>(options: readonly T[], want: number): T {
  return [...options].sort((a, b) => Math.abs(a.effort - want) - Math.abs(b.effort - want))[0]!;
}

describe("a share link", () => {
  it("reads back the parameters it was built from", () => {
    const { params } = play(123_456, 42, [mostPolicy, leastPolicy, middlePolicy]);

    expect(parse(encode(params))).toEqual({ ok: true, value: params });
  });

  it("carries the difficulty, reading a link without one as normal", () => {
    const params = { seed: 1, player: 0, difficulty: "hard", decisions: [] } as const;

    expect(parse(encode(params))).toEqual({ ok: true, value: params });
    expect(parse(`?r=${RULES_VERSION}&s=1&p=0&c=`)).toMatchObject({
      ok: true,
      value: { difficulty: "normal" },
    });
    expect(parse(`?r=${RULES_VERSION}&s=1&p=0&c=&d=x`)).toEqual({ ok: false, error: "unreadable" });
  });

  it("replays to the same year the player lived", () => {
    const { cohort, params } = play(987_654, 7, [middlePolicy, mostPolicy]);

    const replayed = replay(params);

    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.value.cohort.lives.map((life) => life.offers)).toEqual(
      cohort.lives.map((life) => life.offers),
    );
    expect(replayed.value.cohort.lives[7]?.log).toEqual(cohort.lives[7]?.log);
  });

  it.each([
    ["missing fields", "?r=4&s=abc"],
    ["a player outside the 100", `?r=${RULES_VERSION}&s=1&p=100&c=0t0`],
    ["a character that names no routine", `?r=${RULES_VERSION}&s=1&p=0&c=0tz`],
    ["a character that names no option", `?r=${RULES_VERSION}&s=1&p=0&c=9ozz`],
    ["a decision without a week", `?r=${RULES_VERSION}&s=1&p=0&c=t0`],
    ["a seed that is not a number", `?r=${RULES_VERSION}&s=zz!&p=0&c=0t0`],
  ])("is unreadable with %s", (_, search) => {
    expect(parse(search)).toEqual({ ok: false, error: "unreadable" });
  });

  it("is rejected when made under other rules", () => {
    expect(parse(`?r=${RULES_VERSION + 1}&s=1&p=0&c=0t0`)).toEqual({
      ok: false,
      error: "oldRules",
    });
  });

  it("fails to replay when an event the player met has no recorded choice", () => {
    const { params } = play(55, 3, [middlePolicy]);
    const withoutChoices = params.decisions.filter((d) => d.kind === "timetable");

    expect(replay({ ...params, decisions: withoutChoices })).toEqual({
      ok: false,
      error: "unreadable",
    });
  });

  it("fails to replay when decisions go back in time", () => {
    const { params } = play(55, 3, [middlePolicy]);

    expect(replay({ ...params, decisions: [...params.decisions].reverse() })).toEqual({
      ok: false,
      error: "unreadable",
    });
  });
});

// Changing anything that alters results breaks this test: bump RULES_VERSION, so links made
// under the old rules are reported as old instead of replaying to a different year, then
// re-record the expected values.
test("a recorded link still replays to the recorded result under the current rules", () => {
  const { params } = play(20_261_017, 0, [middlePolicy]);
  const replayed = replay(params);

  expect(replayed.ok).toBe(true);
  if (!replayed.ok) return;
  const offersPerSelf = replayed.value.cohort.lives.map((life) => life.offers.length).join("");
  expect(offersPerSelf).toBe(
    "1032131123110321213102312351010113022213111102102122132411210110113211010242401202113312011121311131",
  );
});
