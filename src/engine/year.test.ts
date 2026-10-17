import { eventAt } from "./events";
import { makeLife } from "./life";
import { autoLive, followDecisions, middlePolicy, mostPolicy, type Decision } from "./year";

const FRIENDS_ON_MONDAY = ["friends", null, null, null, null, null, null] as const;
const REST_AND_RESEARCH = ["rest", "research", null, null, null, null, null] as const;
const decisions: Decision[] = [
  { week: 0, kind: "timetable", timetable: FRIENDS_ON_MONDAY },
  { week: 9, kind: "choice", option: "esFive" },
  { week: 20, kind: "timetable", timetable: REST_AND_RESEARCH },
];

describe("following recorded decisions", () => {
  it("uses the latest timetable set by each week", () => {
    const policy = followDecisions(decisions);
    const life = makeLife(1);

    expect(policy.timetable(life, 0)).toEqual(FRIENDS_ON_MONDAY);
    expect(policy.timetable(life, 19)).toEqual(FRIENDS_ON_MONDAY);
    expect(policy.timetable(life, 20)).toEqual(REST_AND_RESEARCH);
  });

  it("wants the recorded option at its week and meets other events the middle way", () => {
    const policy = followDecisions(decisions);
    const life = makeLife(1);
    eventAt(life, 0);
    const event = eventAt(life, 9)!;

    expect(policy.choose(life, event, 9)).toEqual({ key: "esFive", want: 2 });
    expect(policy.choose(life, event, 10)).toEqual(middlePolicy.choose(life, event, 10));
  });
});

test("the same seed and policy always give the same year", () => {
  const { rng: _a, ...first } = autoLive(42, middlePolicy);
  const { rng: _b, ...second } = autoLive(42, middlePolicy);

  expect(second).toEqual(first);
});

test("putting everything into job hunting adds part-time work only while savings run low", () => {
  const life = makeLife(1);

  life.money = 19_999;
  expect(mostPolicy.timetable(life, 0)).toContain("extraWork");

  life.money = 20_000;
  expect(mostPolicy.timetable(life, 0)).not.toContain("extraWork");
});

test("the middle way keeps a rest day and sees friends at the weekend", () => {
  const timetable = middlePolicy.timetable(makeLife(1), 0);

  expect(timetable[5]).toBe("friends");
  expect(timetable[6]).toBe("rest");
});
