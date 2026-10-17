// Events that stop the weeks for a choice or a notice. Each may draw from the life's RNG, so the
// order of draws here is part of what makes a seed reproducible.
import { EVENT_WEEKS, weekOfMonthStart, WEEKS } from "./calendar";
import type { AutumnEvent, Effort, EventFacts, OptionKey, Shortfall, Stat } from "./facts";
import { isActive, loseHours, neededWorkHours, tripYen, type Life } from "./life";
import {
  ALLOWANCE_CUT_YEN,
  AUTUMN_EVENT,
  FAMILY_TRIP_HOURS,
  FAMILY_TRIP_YEN,
  LAPTOP_REPAIR_YEN,
  MAX_PASS_PROBABILITY,
  PASS,
  SCHOLARSHIP_MONTHS,
  SENIOR_TALK_CHANCE,
  SHOP_CLOSED_LOSS_YEN,
  SICK_HOURS,
  THESIS_CRUNCH_CHANCE,
  THESIS_CRUNCH_HOURS,
  THESIS_CRUNCH_RESEARCH,
  TRAVEL_REIMBURSED_CHANCE,
  WEEKLY_HOURS,
} from "./parameters";
import { countSuccesses } from "./random";
import { SMALL_EVENTS, type SmallOption } from "./small_events";
import { nudge, setBack, shock } from "./wellbeing";

interface EventOption {
  readonly key: OptionKey;
  readonly effort: Effort;
  /** Hours the option takes, spread evenly over `weeks` weeks from now. */
  readonly hours: number;
  readonly weeks: number;
  readonly money: number;
  /** Stat changes and preparation the option brings, shown before choosing. */
  readonly stats?: Readonly<Partial<Record<Stat, number>>>;
  readonly prep?: number;
  /** Money earned, such as from an extra shift. */
  readonly pay?: number;
  readonly apply?: (life: Life) => void;
}

export interface PricedOption extends EventOption {
  /** Savings the option takes: its money plus part-time wages given up for hours beyond the budget. */
  readonly total: number;
  /** null when the life can afford the option. */
  readonly shortfall: Shortfall | null;
}

export interface Event {
  readonly facts: EventFacts;
  readonly options: readonly PricedOption[];
}

/** How hard each option pushes; also used to fall back when a self cannot take the same one. */
export const OPTION_EFFORT = {
  esFive: 2,
  esTwo: 1,
  esNone: 0,
  faceIntern: 2,
  onlineIntern: 1,
  declineIntern: 0,
  goWinter: 2,
  skipWinter: 0,
  meetSenior: 2,
  passSenior: 0,
  continue: 2,
  stop: 0,
  entryTwenty: 2,
  entryEight: 1,
  entryThree: 0,
  entryNone: -1,
  finalsAllFace: 2,
  finalsOneFace: 1,
  finalsAllOnline: 0,
  finalsDecline: -1,
  // Small choices: the middle way takes time for oneself and declines extra work; the all-in
  // path declines anything that takes time from job hunting.
  tripGo: 1,
  tripSkip: 2,
  seminarTake: 1,
  seminarDecline: 2,
  campJoin: 1,
  campSkip: 2,
  shiftYes: 0,
  shiftNo: 1,
  obVisit: 1,
  obSkip: 0,
  homeGo: 1,
  homeStay: 2,
  midtermPrep: 1,
  midtermMinimal: 2,
  studyJoin: 1,
  studySkip: 0,
} as const satisfies Record<OptionKey, Effort>;

type EventBuilder = (life: Life) => { facts: EventFacts; options: readonly EventOption[] } | null;

/** The week each event comes in. The result comes after the last week. */
const SCHEDULE: readonly (readonly [number, EventBuilder])[] = [
  [0, intro],
  [EVENT_WEEKS.internEs, internEs],
  [weekOfMonthStart(4), summerIntern],
  [weekOfMonthStart(6), autumn],
  [weekOfMonthStart(7), winterIntern],
  [EVENT_WEEKS.early, earlySelection],
  [weekOfMonthStart(9) + 1, seniorTalk],
  [weekOfMonthStart(10) + 1, keepGoing],
  [EVENT_WEEKS.entries, entries],
  [EVENT_WEEKS.finals, finals],
  [WEEKS, june],
  ...SMALL_EVENTS.map(({ week, ...event }) => [week, smallEvent(event)] as const),
];

/** The event this life meets in `week`, with options priced for it, or null. */
export function eventAt(life: Life, week: number): Event | null {
  const builder = SCHEDULE.find(([at]) => at === week)?.[1];
  const draft = builder?.(life);
  if (!draft) return null;
  return { facts: draft.facts, options: draft.options.map((option) => price(life, option)) };
}

function price(life: Life, option: EventOption): PricedOption {
  const weeklyHours = option.hours / option.weeks;
  // Hours beyond the free hours come out of sleep; only a week's worth that cannot fit at all is short.
  const total = option.money;
  const shortfall = weeklyHours > WEEKLY_HOURS ? "time" : total <= life.money ? null : "money";
  return { ...option, total, shortfall };
}

/** The option `key` if offered and affordable, else the affordable option nearest below `want`. */
export function pickOption(event: Event, key: OptionKey | null, want: Effort): PricedOption {
  const exact = event.options.find((option) => option.key === key && option.shortfall === null);
  if (exact) return exact;
  const affordable = event.options.filter((option) => option.shortfall === null);
  const below = affordable.filter((o) => o.effort <= want).sort((a, b) => b.effort - a.effort)[0];
  const lowest = affordable.toSorted((a, b) => a.effort - b.effort)[0];
  const picked = below ?? lowest;
  if (!picked) throw new Error("every event with options offers one that costs nothing");
  return picked;
}

/** Takes `option`: pays its money, books its hours for the coming weeks, and applies it. */
export function resolve(
  life: Life,
  event: Event,
  option: PricedOption,
  wanted: OptionKey | null,
): void {
  life.money -= option.money;
  life.oneOff = { hours: option.hours, weeks: option.weeks };
  option.apply?.(life);
  if (wanted && wanted !== option.key && event.options.some((o) => o.key === wanted)) {
    life.log.push({ kind: "missed", event: event.facts.id, option: wanted });
  }
}

/** A small choice for a self still living the year; its options carry their effects as data. */
function smallEvent({ id, options }: Omit<(typeof SMALL_EVENTS)[number], "week">): EventBuilder {
  return (life) => {
    if (!isActive(life)) return null;
    const toOption = (o: SmallOption): EventOption => ({
      key: o.key,
      effort: OPTION_EFFORT[o.key],
      hours: o.hours ?? 0,
      weeks: o.weeks ?? 1,
      money: o.money ?? 0,
      ...(o.stats ? { stats: o.stats } : {}),
      ...(o.prep ? { prep: o.prep } : {}),
      ...(o.pay ? { pay: o.pay } : {}),
      apply: (x) => {
        x.money += o.pay ?? 0;
        x.prep += o.prep ?? 0;
        nudge(x, o.stats ?? {});
      },
    });
    return { facts: { id }, options: options(life).map(toOption) };
  };
}

function option(
  key: OptionKey,
  cost: { hours?: number; weeks?: number; money?: number } = {},
  apply?: (life: Life) => void,
): EventOption {
  const effort = OPTION_EFFORT[key];
  const spec = {
    key,
    effort,
    hours: cost.hours ?? 0,
    weeks: cost.weeks ?? 1,
    money: cost.money ?? 0,
  };
  return apply ? { ...spec, apply } : spec;
}

function intro(life: Life) {
  life.log.push({ kind: "profile", allowance: life.allowance, metro: life.metro });
  if (life.scholarship) life.log.push({ kind: "scholarship", amount: life.scholarship });
  const facts: EventFacts = {
    id: "intro",
    allowance: life.allowance,
    metro: life.metro,
    scholarship: life.scholarship,
    neededWorkHours: neededWorkHours(life),
    weeklyHours: WEEKLY_HOURS,
    money: life.money,
  };
  return { facts, options: [] };
}

function internEs(life: Life) {
  if (!isActive(life)) return null;
  const apply = (count: number) => (x: Life) => {
    x.internApplications = count;
  };
  return {
    facts: { id: "internEs" } as const,
    options: [
      option("esFive", { hours: 15, weeks: 3 }, apply(5)),
      option("esTwo", { hours: 6, weeks: 3 }, apply(2)),
      option("esNone", {}, apply(0)),
    ],
  };
}

function summerIntern(life: Life) {
  if (!isActive(life)) return null;
  const applications = life.internApplications;
  const passed = countSuccesses(
    life.rng,
    applications,
    documentChance(PASS.internEs + life.boosts.internEs, life),
  );
  const intern = applications === 0 ? "none" : passed === 0 ? "failed" : "passed";
  if (intern === "failed") {
    life.log.push({ kind: "internAllFailed" });
    shock(life, "rejection");
  }
  const facts = { id: "summerIntern", intern, applications, passed, metro: life.metro } as const;
  if (intern !== "passed") return { facts, options: [] };
  return {
    facts,
    options: [
      option("faceIntern", { hours: 40, money: tripYen(life) }, (x) => {
        x.intern = "face";
        x.prep += 3;
        x.log.push({ kind: "faceIntern" });
      }),
      option("onlineIntern", { hours: 8 }, (x) => {
        x.intern = "online";
        x.prep += 1;
      }),
      option("declineIntern"),
    ],
  };
}

function autumn(life: Life) {
  if (!isActive(life)) return null;
  return { facts: { id: "autumn", event: drawAutumnEvent(life) } as const, options: [] };
}

function drawAutumnEvent(life: Life): AutumnEvent {
  const roll = life.rng();
  let threshold = AUTUMN_EVENT.allowanceCut;
  if (roll < threshold) {
    if (life.allowance > 0) {
      life.allowance = Math.max(0, life.allowance - ALLOWANCE_CUT_YEN);
      life.log.push({ kind: "allowanceCut" });
      return { kind: "allowanceCut" };
    }
    life.money = Math.max(0, life.money - SHOP_CLOSED_LOSS_YEN);
    life.log.push({ kind: "shopClosed" });
    return { kind: "shopClosed" };
  }
  threshold += AUTUMN_EVENT.sick;
  if (roll < threshold) {
    loseHours(life, SICK_HOURS / 2, 2);
    life.log.push({ kind: "sick" });
    shock(life, "sick");
    return { kind: "sick" };
  }
  threshold += AUTUMN_EVENT.familyIllness;
  if (roll < threshold) {
    life.money = Math.max(0, life.money - FAMILY_TRIP_YEN);
    loseHours(life, FAMILY_TRIP_HOURS, 1);
    life.log.push({ kind: "familyIllness" });
    shock(life, "familyIllness");
    return { kind: "familyIllness" };
  }
  threshold += AUTUMN_EVENT.laptopBroken;
  if (roll < threshold) {
    life.money = Math.max(0, life.money - LAPTOP_REPAIR_YEN);
    life.log.push({ kind: "laptopBroken" });
    return { kind: "laptopBroken" };
  }
  return { kind: "calm" };
}

function winterIntern(life: Life) {
  if (!isActive(life)) return null;
  return {
    facts: { id: "winterIntern", metro: life.metro } as const,
    options: [
      option("goWinter", { hours: 24, money: tripYen(life) }, (x) => {
        x.inviteBonus += 0.25;
        x.prep += 1;
      }),
      option("skipWinter"),
    ],
  };
}

function earlySelection(life: Life) {
  if (!isActive(life)) return null;
  const internChance =
    life.intern === "face"
      ? PASS.inviteAfterFaceIntern
      : life.intern === "online"
        ? PASS.inviteAfterOnlineIntern
        : 0;
  life.invited = life.rng() < Math.min(MAX_PASS_PROBABILITY, internChance + life.inviteBonus);
  if (!life.invited) return { facts: { id: "early", result: "notInvited" } as const, options: [] };
  const passed = life.rng() < passChance(PASS.early + life.boosts.early, PASS.earlyPerPrep, life);
  if (passed) {
    life.offers.push("december");
    life.log.push({ kind: "earlyOffer" });
    shock(life, "offer");
  } else {
    shock(life, "rejection");
  }
  return { facts: { id: "early", result: passed ? "passed" : "failed" } as const, options: [] };
}

function seniorTalk(life: Life) {
  if (!isActive(life)) return null;
  const chance = life.metro ? SENIOR_TALK_CHANCE.metro : SENIOR_TALK_CHANCE.regional;
  if (life.rng() >= chance) return null;
  return {
    facts: { id: "seniorTalk" } as const,
    options: [
      option("meetSenior", { hours: 3 }, (x) => {
        x.prep += 2;
        x.log.push({ kind: "seniorTalk" });
      }),
      option("passSenior"),
    ],
  };
}

function keepGoing(life: Life) {
  if (!isActive(life) || !life.offers.length) return null;
  return {
    facts: { id: "keepGoing" } as const,
    options: [
      option("continue"),
      option("stop", {}, (x) => {
        x.done = true;
      }),
    ],
  };
}

function entries(life: Life) {
  if (!isActive(life)) return null;
  const busy = life.rng() < THESIS_CRUNCH_CHANCE;
  if (busy) {
    loseHours(life, THESIS_CRUNCH_HOURS / 4, 4);
    life.log.push({ kind: "thesisCrunch" });
    setBack(life, "research", THESIS_CRUNCH_RESEARCH);
  }
  const entry = (key: OptionKey, count: number, hours: number) =>
    option(key, { hours, weeks: 4 }, (x) => {
      x.entries = count;
      if (count >= 20) x.prep += 1;
    });
  return {
    facts: { id: "entries", busy } as const,
    options: [
      entry("entryTwenty", 20, 40),
      entry("entryEight", 8, 16),
      entry("entryThree", 3, 6),
      option("entryNone", {}, (x) => {
        x.entries = 0;
      }),
    ],
  };
}

function finals(life: Life) {
  if (!isActive(life)) return null;
  const firstRound = countSuccesses(
    life.rng,
    life.entries,
    documentChance(PASS.entryEs + life.boosts.entryEs, life),
  );
  const count = countSuccesses(
    life.rng,
    firstRound,
    passChance(PASS.toFinal, PASS.toFinalPerPrep, life),
  );
  const reimbursed =
    count && !life.metro ? countSuccesses(life.rng, count, TRAVEL_REIMBURSED_CHANCE) : 0;
  const facts = {
    id: "finals",
    entries: life.entries,
    firstRound,
    finals: count,
    reimbursed,
    metro: life.metro,
  } as const;
  if (!count) return { facts, options: [] };
  const trip = tripYen(life);
  const take = (face: number, online: number) => (x: Life) => {
    x.finals = { face, online };
  };
  return {
    facts,
    options: [
      option(
        "finalsAllFace",
        { hours: 8 * count, weeks: 4, money: trip * (count - reimbursed) },
        take(count, 0),
      ),
      ...(count > 1
        ? [
            option(
              "finalsOneFace",
              { hours: 8 + 2 * (count - 1), weeks: 4, money: reimbursed ? 0 : trip },
              take(1, count - 1),
            ),
          ]
        : []),
      option("finalsAllOnline", { hours: 2 * count, weeks: 4 }, take(0, count)),
      option("finalsDecline", {}, take(0, 0)),
    ],
  };
}

function june(life: Life) {
  if (life.over) return { facts: { id: "over", stat: life.over } as const, options: [] };
  const chance =
    passChance(PASS.final + life.boosts.final, PASS.finalPerPrep, life) *
    (life.metro ? 1 : PASS.regionalFinalFactor);
  const won =
    countSuccesses(life.rng, life.finals.face, chance) +
    countSuccesses(life.rng, life.finals.online, chance * PASS.onlineFinalFactor);
  for (let i = 0; i < won; i++) life.offers.push("may");
  life.log.push({ kind: "june", offers: life.offers.length });
  const facts: EventFacts = {
    id: "june",
    done: life.done,
    won,
    finalsTaken: life.finals.face + life.finals.online,
    offers: life.offers.length,
    scholarshipTotal: life.scholarship * SCHOLARSHIP_MONTHS,
  };
  return { facts, options: [] };
}

function passChance(base: number, perPrep: number, life: Life): number {
  return Math.max(0, Math.min(MAX_PASS_PROBABILITY, base + perPrep * life.prep));
}

/** Pass chance for written screening, raised by both kinds of preparation. */
function documentChance(base: number, life: Life): number {
  const raised = base + PASS.documentPerPrep * (life.prep + 2 * life.documentPrep);
  return Math.max(0, Math.min(MAX_PASS_PROBABILITY, raised));
}
