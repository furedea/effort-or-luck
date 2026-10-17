import { advanceFor, chooseAndAdvance, isOver, startCohort } from "../engine/cohort";
import { RULES_VERSION } from "../engine/parameters";
import { leastPolicy, middlePolicy, mostPolicy, type Plan, type Policy } from "../engine/plan";
import { encode, parse, replay, type ShareParams } from "./result_link";

/** Plays a year as `player`, cycling through `policies` period by period. */
function play(seed: number, player: number, policies: readonly Policy[]) {
  let cohort = startCohort(seed);
  const plans: Plan[] = [];
  while (!isOver(cohort)) {
    const scene = cohort.scenes[player];
    const life = cohort.lives[player];
    if (!scene?.period || !life) {
      cohort = advanceFor(cohort, player);
      continue;
    }
    const plan = policies[plans.length % policies.length]!(life, scene);
    plans.push(plan);
    cohort = chooseAndAdvance(cohort, player, plan).cohort;
  }
  return { cohort, params: { seed, player, plans } satisfies ShareParams };
}

describe("a share link", () => {
  it("reads back the parameters it was built from", () => {
    const { params } = play(123_456, 42, [mostPolicy, leastPolicy, middlePolicy]);

    expect(parse(encode(params))).toEqual({ ok: true, value: params });
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
    ["missing fields", "?r=3&s=abc"],
    ["a player outside the 100", `?r=${RULES_VERSION}&s=1&p=100&c=0`],
    ["a character that names no activity", `?r=${RULES_VERSION}&s=1&p=0&c=0z`],
    ["a seed that is not a number", `?r=${RULES_VERSION}&s=zz!&p=0&c=0`],
  ])("is unreadable with %s", (_, search) => {
    expect(parse(search)).toEqual({ ok: false, error: "unreadable" });
  });

  it("is rejected when made under other rules", () => {
    expect(parse(`?r=${RULES_VERSION + 1}&s=1&p=0&c=0`)).toEqual({ ok: false, error: "oldRules" });
  });

  it("fails to replay when the recorded plans do not fit the year", () => {
    const { params } = play(55, 3, [middlePolicy]);

    expect(replay({ ...params, plans: params.plans.slice(0, 1) })).toEqual({
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
    "0000110010001001110111110011000000111000000000011000000000110010100100000100011000111110110000101000",
  );
});
