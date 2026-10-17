import { eventAt } from "./events";
import { makeLife } from "./life";
import { autoLive, followDecisions, middlePolicy, mostPolicy, type Decision } from "./year";

const decisions: Decision[] = [
  { week: 0, kind: "timetable", timetable: ["friends"] },
  { week: 9, kind: "choice", option: "esFive" },
  { week: 20, kind: "timetable", timetable: ["rest", "research"] },
];

describe("following recorded decisions", () => {
  it("uses the latest timetable set by each week", () => {
    const policy = followDecisions(decisions);
    const life = makeLife(1);

    expect(policy.timetable(life, 0)).toEqual(["friends"]);
    expect(policy.timetable(life, 19)).toEqual(["friends"]);
    expect(policy.timetable(life, 20)).toEqual(["rest", "research"]);
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
