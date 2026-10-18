import { WEEKS } from "./calendar";
import { eventAt, OPTION_EFFORT, pickOption, resolve, type Event } from "./events";
import type { Effort, OptionKey, RoutineKey } from "./facts";
import { makeLife, neededWorkHours, weekBudget, type Life } from "./life";
import type { Difficulty } from "./parameters";
import { isOpen, ROUTINES, routineOf } from "./routine";
import { liveWeek } from "./week";

// A whole year lived by a policy: a timetable for every week and a choice at every event.

/** A player's input at a point in the year, recorded so the year can be replayed. */
export type Decision =
  | { readonly week: number; readonly kind: "timetable"; readonly timetable: readonly RoutineKey[] }
  | { readonly week: number; readonly kind: "choice"; readonly option: OptionKey };

export interface Choice {
  /** The option wanted, taken when offered and affordable; null to choose by effort alone. */
  readonly key: OptionKey | null;
  /** Effort to fall back to when the wanted option cannot be taken. */
  readonly want: Effort;
}

export interface Policy {
  timetable(life: Life, week: number): readonly RoutineKey[];
  choose(life: Life, event: Event, week: number): Choice;
}

const JOB_ROUTINES = ROUTINES.filter((spec) => spec.kind === "job").map((spec) => spec.key);
/** Study and time for oneself: everything but job hunting and part-time work. */
const LIFE_ROUTINES = ROUTINES.filter((spec) => spec.kind === "study" || spec.kind === "life").map(
  (spec) => spec.key,
);
/**
 * What the middle way wants, in priority order: research and friends to keep going, then job
 * hunting, then rest; it takes only what fits the week, without paid extras.
 */
const MIDDLE_PRIORITIES: readonly RoutineKey[] = [
  "research",
  "friends",
  "selfAnalysis",
  "infoSessions",
  "interviewPractice",
  "rest",
];
const MIDDLE_CHOICE: Choice = { key: null, want: 1 };

/** Savings below which the policies take on the part-time work living costs need. */
const WORK_BELOW_YEN = 50_000;

/**
 * The part-time work living costs need while savings are low, then as much job hunting as the
 * week holds, and the most effortful option at every event; nothing for oneself.
 */
export const mostPolicy: Policy = {
  timetable: (life, week) => {
    return withinBudget([...workFor(life), ...JOB_ROUTINES], life, week);
  },
  choose: () => ({ key: null, want: 2 }),
};

/** Part-time work as needed, then only time for oneself, and the least effortful options. */
export const leastPolicy: Policy = {
  timetable: (life, week) => withinBudget([...workFor(life), ...LIFE_ROUTINES], life, week),
  choose: () => ({ key: null, want: -1 }),
};

/**
 * Part-time work as needed, then about half of the rest on job hunting without paid extras, and
 * middle options at events.
 */
export const middlePolicy: Policy = {
  timetable: (life, week) => withinBudget([...workFor(life), ...MIDDLE_PRIORITIES], life, week),
  choose: () => MIDDLE_CHOICE,
};

/** Part-time tiles that cover the hours living costs need, while savings are low. */
function workFor(life: Life): RoutineKey[] {
  const needed = life.money < WORK_BELOW_YEN ? neededWorkHours(life) : 0;
  const short = routineOf("extraWork").weeklyHours;
  const long = routineOf("moreWork").weeklyHours;
  if (needed === 0) return [];
  if (needed <= short) return ["extraWork"];
  if (needed <= long) return ["moreWork"];
  return ["moreWork", "extraWork"];
}

/**
 * Replays recorded decisions: the latest timetable set by each week, and the recorded option at
 * each event; an event without a recorded choice is met the middle way.
 */
export function followDecisions(decisions: readonly Decision[]): Policy {
  return {
    timetable: (_, week) => {
      let timetable: readonly RoutineKey[] = [];
      for (const decision of decisions) {
        if (decision.week > week) break;
        if (decision.kind === "timetable") timetable = decision.timetable;
      }
      return timetable;
    },
    choose: (_, __, week) => {
      const recorded = decisions.find((d) => d.kind === "choice" && d.week === week);
      if (recorded?.kind !== "choice") return MIDDLE_CHOICE;
      return { key: recorded.option, want: OPTION_EFFORT[recorded.option] };
    },
  };
}

/**
 * The routines in `priorities` that are open and still fit the hours left this week after any
 * booked one-off, in order.
 */
function withinBudget(priorities: readonly RoutineKey[], life: Life, week: number): RoutineKey[] {
  const oneOff = life.oneOff.weeks > 0 ? life.oneOff.hours / life.oneOff.weeks : 0;
  let room = weekBudget(life) - oneOff;
  return priorities.filter((key) => {
    const spec = routineOf(key);
    if (!isOpen(spec, week) || spec.weeklyHours > room) return false;
    room -= spec.weeklyHours;
    return true;
  });
}

/** Meets an event with options by `choice`, falling back to what the life can afford. */
export function meet(life: Life, event: Event, choice: Choice): void {
  const picked = pickOption(event, choice.key, choice.want);
  resolve(life, event, picked, choice.key);
}

/** Lives a whole year from `seed` by `policy`. */
export function autoLive(seed: number, policy: Policy, difficulty: Difficulty = "normal"): Life {
  const life = makeLife(seed, difficulty);
  for (let week = 0; week < WEEKS; week++) {
    const event = eventAt(life, week);
    if (event?.options.length) meet(life, event, policy.choose(life, event, week));
    liveWeek(life, week, policy.timetable(life, week));
  }
  eventAt(life, WEEKS);
  return life;
}
