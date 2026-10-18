import { weekOfMonthStart } from "./calendar";
import type { OptionKey, SmallEventId, Stat } from "./facts";
import type { Life } from "./life";
import { WAGE_YEN_PER_HOUR } from "./parameters";

// Light two-way choices every few weeks, between the big events. Costs and effects are
// assumptions, listed on the sources page. Each option's effects are data, so the screen can show
// them in numbers before the player chooses. Declining costs a little where turning someone down
// would: a friend, a seminar, a shop manager, family.

export interface SmallOption {
  readonly key: OptionKey;
  readonly hours?: number;
  readonly weeks?: number;
  readonly money?: number;
  /** Money earned, such as from an extra shift. */
  readonly pay?: number;
  readonly stats?: Readonly<Partial<Record<Stat, number>>>;
  readonly prep?: number;
}

interface SmallEvent {
  readonly id: SmallEventId;
  readonly week: number;
  readonly options: (life: Life) => readonly [SmallOption, SmallOption];
}

const HOME_TRIP_YEN = { metro: 5_000, regional: 20_000 } as const;
const EXTRA_SHIFT_HOURS = 10;

export const SMALL_EVENTS: readonly SmallEvent[] = [
  {
    id: "gwTrip",
    week: weekOfMonthStart(1) + 1,
    options: () => [
      { key: "tripGo", hours: 10, money: 20_000, stats: { mind: 5, social: 6 } },
      { key: "tripSkip", stats: { social: -2 } },
    ],
  },
  {
    id: "seminarTalk",
    week: weekOfMonthStart(3),
    options: () => [
      { key: "seminarTake", hours: 10, weeks: 2, stats: { research: 8 } },
      { key: "seminarDecline", stats: { research: -3 } },
    ],
  },
  {
    id: "summerCamp",
    week: weekOfMonthStart(5),
    options: () => [
      { key: "campJoin", hours: 10, money: 15_000, stats: { social: 8, mind: 4 } },
      { key: "campSkip", stats: { social: -2 } },
    ],
  },
  {
    id: "extraShift",
    week: weekOfMonthStart(6) + 2,
    options: () => [
      {
        key: "shiftYes",
        hours: EXTRA_SHIFT_HOURS,
        pay: EXTRA_SHIFT_HOURS * WAGE_YEN_PER_HOUR,
        stats: { mind: -2 },
      },
      { key: "shiftNo", stats: { mind: -1 } },
    ],
  },
  {
    id: "obChance",
    week: weekOfMonthStart(7) + 2,
    options: () => [{ key: "obVisit", hours: 6, money: 2_000, prep: 1 }, { key: "obSkip" }],
  },
  {
    id: "yearEnd",
    week: weekOfMonthStart(8) + 3,
    options: (life) => [
      {
        key: "homeGo",
        hours: 10,
        money: life.metro ? HOME_TRIP_YEN.metro : HOME_TRIP_YEN.regional,
        stats: { mind: 8 },
      },
      { key: "homeStay", stats: { mind: -2 } },
    ],
  },
  {
    id: "studyGroup",
    week: weekOfMonthStart(10) + 2,
    options: () => [
      { key: "studyJoin", hours: 6, prep: 1.5, stats: { mind: 2 } },
      { key: "studySkip" },
    ],
  },
];
