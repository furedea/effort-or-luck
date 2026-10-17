import { advanceFor, chooseAndAdvance, isOver, startCohort } from "../engine/cohort";
import type { Effort } from "../engine/facts";
import { RULES_VERSION } from "../engine/parameters";
import { encode, parse, replay, type ShareParams } from "./result_link";

function play(seed: number, player: number, wants: readonly Effort[]) {
  let cohort = startCohort(seed);
  const choices: Effort[] = [];
  let k = 0;
  while (!isOver(cohort)) {
    const scene = cohort.scenes[player]!;
    if (!scene.options.length) {
      cohort = advanceFor(cohort, player);
      continue;
    }
    const want = wants[k++ % wants.length]!;
    const effort =
      scene.options.filter((o) => o.shortfall === null && o.effort <= want).at(0)?.effort ?? 0;
    choices.push(effort);
    cohort = chooseAndAdvance(cohort, player, effort).cohort;
  }
  return { cohort, params: { seed, player, choices } satisfies ShareParams };
}

describe("a share link", () => {
  it("reads back the parameters it was built from", () => {
    const { params } = play(123_456, 42, [2, 0, 1]);

    expect(parse(encode(params))).toEqual({ ok: true, value: params });
  });

  it("replays to the same year the player lived", () => {
    const { cohort, params } = play(987_654, 7, [1, 2]);

    const replayed = replay(params);

    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.value.cohort.lives.map((life) => life.offers)).toEqual(
      cohort.lives.map((life) => life.offers),
    );
    expect(replayed.value.cohort.lives[7]?.log).toEqual(cohort.lives[7]?.log);
  });

  it.each([
    ["missing fields", "?r=1&s=abc"],
    ["a player outside the 100", `?r=${RULES_VERSION}&s=1&p=100&c=21`],
    ["a choice digit that is not an effort", `?r=${RULES_VERSION}&s=1&p=0&c=29`],
    ["a seed that is not a number", `?r=${RULES_VERSION}&s=zz!&p=0&c=21`],
  ])("is unreadable with %s", (_, search) => {
    expect(parse(search)).toEqual({ ok: false, error: "unreadable" });
  });

  it("is rejected when made under other rules", () => {
    expect(parse(`?r=${RULES_VERSION + 1}&s=1&p=0&c=21`)).toEqual({ ok: false, error: "oldRules" });
  });

  it("fails to replay when a recorded choice does not fit the year", () => {
    const { params } = play(55, 3, [1]);

    expect(replay({ ...params, choices: params.choices.slice(0, 1) })).toEqual({
      ok: false,
      error: "unreadable",
    });
  });
});

// Changing anything that alters results breaks this test: bump RULES_VERSION, so links made
// under the old rules are reported as old instead of replaying to a different year, then
// re-record the expected values.
test("a recorded link still replays to the recorded result under the current rules", () => {
  const replayed = replay({ seed: 20_261_017, player: 0, choices: [2, 1, 2, 0, 0] });

  expect(replayed.ok).toBe(true);
  if (!replayed.ok) return;
  const offersPerSelf = replayed.value.cohort.lives.map((life) => life.offers.length).join("");
  expect(offersPerSelf).toBe(
    "2010101022012001111012110242010001110201000001001010011220110020001110031020001100111212100100200010",
  );
});
