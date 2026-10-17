import { WEEKS } from "./calendar";
import { eventAt, pickOption, resolve, type Event } from "./events";
import type { EventFacts, EventId, Stat } from "./facts";
import { makeLife, tripYen, weekBudget, type Life } from "./life";
import {
  FAMILY_TRIP_HOURS,
  FAMILY_TRIP_YEN,
  LAPTOP_REPAIR_YEN,
  SENIOR_TALK_CHANCE,
  SICK_HOURS,
  THESIS_CRUNCH_HOURS,
} from "./parameters";
import { SMALL_EVENTS } from "./small_events";
import { liveWeek } from "./week";
import { autoLive, leastPolicy, meet, middlePolicy, mostPolicy, type Policy } from "./year";

/** One self's state at an event: just before it and once it is drawn. */
interface Moment {
  readonly life: Life;
  readonly event: Event;
  readonly moneyBefore: number;
  readonly moneyAt: number;
  readonly lostWeeklyAt: number;
  readonly lostWeeksAt: number;
}

function momentsAt(id: EventId, policy: Policy, seeds: number): Moment[] {
  const moments: Moment[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const life = makeLife(seed);
    for (let week = 0; week <= WEEKS; week++) {
      const moneyBefore = life.money;
      const event = eventAt(life, week);
      if (event?.facts.id === id) {
        moments.push({
          life,
          event,
          moneyBefore,
          moneyAt: life.money,
          lostWeeklyAt: life.lostWeekly,
          lostWeeksAt: life.lostWeeks,
        });
      }
      if (event?.options.length) meet(life, event, policy.choose(life, event, week));
      if (week < WEEKS) liveWeek(life, week, policy.timetable(life, week));
    }
  }
  return moments;
}

function factsOf<Id extends EventId>({ event }: Moment, id: Id): Extract<EventFacts, { id: Id }> {
  if (event.facts.id !== id) throw new Error(`expected ${id}`);
  return event.facts as Extract<EventFacts, { id: Id }>;
}

describe("autumn events", () => {
  const autumns = momentsAt("autumn", middlePolicy, 3000);
  const withEvent = (kind: string) =>
    autumns.filter((m) => factsOf(m, "autumn").event.kind === kind);

  it("can make a self ill, losing hours over two weeks", () => {
    const ill = withEvent("sick");

    expect(ill.length).toBeGreaterThan(0);
    for (const m of ill) expect([m.lostWeeklyAt, m.lostWeeksAt]).toEqual([SICK_HOURS / 2, 2]);
  });

  it("can send a self home for a family illness, costing money and a week's hours", () => {
    const trips = withEvent("familyIllness");

    expect(trips.length).toBeGreaterThan(0);
    for (const m of trips) {
      expect(m.moneyAt).toBe(Math.max(0, m.moneyBefore - FAMILY_TRIP_YEN));
      expect([m.lostWeeklyAt, m.lostWeeksAt]).toEqual([FAMILY_TRIP_HOURS, 1]);
    }
  });

  it("can break a laptop, costing the repair or whatever savings remain", () => {
    const breaks = withEvent("laptopBroken");

    expect(breaks.length).toBeGreaterThan(0);
    for (const m of breaks) expect(m.moneyAt).toBe(Math.max(0, m.moneyBefore - LAPTOP_REPAIR_YEN));
  });
});

test("the March thesis crunch takes hours for four weeks from some selves", () => {
  const entries = momentsAt("entries", middlePolicy, 3000);
  const busy = entries.filter((m) => factsOf(m, "entries").busy);

  expect(busy.length).toBeGreaterThan(0);
  expect(entries.length - busy.length).toBeGreaterThan(0);
  for (const m of busy)
    expect([m.lostWeeklyAt, m.lostWeeksAt]).toEqual([THESIS_CRUNCH_HOURS / 4, 4]);
});

test("companies paying travel lower a regional self's in-person finals cost", () => {
  const finals = momentsAt("finals", mostPolicy, 3000).filter(
    (m) => factsOf(m, "finals").finals > 0,
  );

  expect(finals.some((m) => !m.life.metro && factsOf(m, "finals").reimbursed > 0)).toBe(true);
  for (const m of finals) {
    const facts = factsOf(m, "finals");
    const allFace = m.event.options.find((o) => o.key === "finalsAllFace");
    expect(allFace?.money).toBe(tripYen(m.life) * (facts.finals - facts.reimbursed));
  }
});

test("a chance to talk with a senior comes more often in the metro area", () => {
  const lives = 4000;
  // Nobody living only for themselves ends the year early, so every life reaches January.
  const talks = momentsAt("seniorTalk", leastPolicy, lives);
  const share = (metro: boolean) => talks.filter((m) => m.life.metro === metro).length;

  expect(share(true) / (lives * 0.4)).toBeCloseTo(SENIOR_TALK_CHANCE.metro, 1);
  expect(share(false) / (lives * 0.6)).toBeCloseTo(SENIOR_TALK_CHANCE.regional, 1);
});

describe("choosing at an event", () => {
  function internEs(life: Life): Event {
    const event = eventAt(life, 9);
    if (event?.facts.id !== "internEs") throw new Error("expected the ES deadline in week 9");
    return event;
  }

  it("spreads an option's hours over its weeks when pricing it", () => {
    const life = makeLife(1);
    life.money = 0;
    const five = internEs(life).options.find((o) => o.key === "esFive")!;

    expect(five.shortfall).toBe(5 > weekBudget(life) ? "time" : null);
  });

  it("takes the wanted option, or the affordable one nearest below its effort", () => {
    const life = makeLife(1);
    const event = internEs(life);
    const broke = {
      ...event,
      options: event.options.map((o) =>
        o.key === "esFive" ? { ...o, shortfall: "money" as const } : o,
      ),
    };

    expect(pickOption(event, "esFive", 2).key).toBe("esFive");
    expect(pickOption(broke, "esFive", 2).key).toBe("esTwo");
  });

  it("records an option the self wanted but could not take", () => {
    const life = makeLife(1);
    const event = internEs(life);

    resolve(
      life,
      event,
      event.options.find((o) => o.key === "esTwo")!,
      "esFive",
    );

    expect(life.log).toContainEqual({ kind: "missed", event: "internEs", option: "esFive" });
    expect(life.oneOff).toEqual({ hours: 6, weeks: 3 });
  });
});

test("preparing for the summer internship ES while it is open raises the pass rate", () => {
  const prepared: Policy = {
    timetable: (life, week) => [...middlePolicy.timetable(life, week), "summerEsPrep"],
    choose: (life, event, week) => middlePolicy.choose(life, event, week),
  };
  const allFailed = (policy: Policy) =>
    Array.from({ length: 3000 }, (_, i) => autoLive(1 + i, policy)).filter((life) =>
      life.log.some((fact) => fact.kind === "internAllFailed"),
    ).length;

  expect(allFailed(prepared)).toBeLessThan(allFailed(middlePolicy) * 0.9);
});

describe("small choices", () => {
  it("come every few weeks to every self still living the year", () => {
    const life = makeLife(1);
    const weeks = SMALL_EVENTS.map((event) => event.week);

    for (const week of weeks) expect(eventAt(life, week)?.options.length).toBe(2);
    expect(weeks.every((week, i) => i === 0 || week - weeks[i - 1]! >= 3)).toBe(true);
  });

  it("apply the stats, money, and preparation each option shows", () => {
    const life = makeLife(1);
    const [first] = SMALL_EVENTS;
    const event = eventAt(life, first!.week)!;
    const option = event.options[0]!;
    const before = { ...life.stats, money: life.money, prep: life.prep };

    resolve(life, event, option, option.key);

    for (const [stat, amount] of Object.entries(option.stats ?? {}) as [Stat, number][]) {
      expect(life.stats[stat]).toBeCloseTo(before[stat] + amount);
    }
    expect(life.money).toBe(before.money - option.money);
    expect(life.prep).toBeCloseTo(before.prep + (option.prep ?? 0));
    expect(life.oneOff).toEqual({ hours: option.hours, weeks: option.weeks });
  });
});
