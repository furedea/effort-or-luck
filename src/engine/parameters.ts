// Survey-based values carry their source; pass probabilities are prototype assumptions tuned so
// that always choosing the middle option lands near the surveyed June 1st offer rate.

/** Bump whenever a change alters results, so shared links from older rules are reported as old. */
export const RULES_VERSION = 5;

export const WAGE_YEN_PER_HOUR = 1100;
export const MONTHLY_EXPENSE_YEN = 130_000;
/** Hours per week outside classes, coursework, sleep, and chores, before part-time work. */
export const WEEKLY_HOURS = 40;
export const WEEKS_PER_MONTH = 52 / 12;
export const STARTING_MONEY_YEN = 50_000;
export const SCHOLARSHIP_YEN = 50_000;
/** Lives with less allowance than this borrow a scholarship. */
export const SCHOLARSHIP_ALLOWANCE_LIMIT_YEN = 100_000;
export const SCHOLARSHIP_MONTHS = 48;
export const METRO_SHARE = 0.4;

/** Monthly allowance and its share in percent (全国大学生協連 第60回学生生活実態調査). */
export const ALLOWANCE_DISTRIBUTION = [
  [0, 6.9],
  [30_000, 16.1],
  [70_000, 31.1],
  [120_000, 27.2],
] as const;

export const TRIP_YEN = { metro: 1000, regional: 30_000 } as const;
export const ALLOWANCE_CUT_YEN = 30_000;
export const SHOP_CLOSED_LOSS_YEN = 30_000;
export const SICK_HOURS = 25;

export const MAX_PASS_PROBABILITY = 0.9;
export const PASS = {
  internEs: 0.3,
  inviteAfterFaceIntern: 0.7,
  inviteAfterOnlineIntern: 0.35,
  early: 0.25,
  earlyPerPrep: 0.015,
  entryEs: 0.46,
  /** Written screening; document preparation counts twice. */
  documentPerPrep: 0.006,
  toFinal: 0.39,
  toFinalPerPrep: 0.006,
  final: 0.51,
  finalPerPrep: 0.006,
  onlineFinalFactor: 0.85,
  /** Sized so the metro/regional gap matches the surveyed 関東 vs other-regions offer rates. */
  regionalFinalFactor: 0.83,
} as const;

// Chances and sizes below are assumptions unless a source is given.
export const AUTUMN_EVENT = {
  allowanceCut: 0.08,
  sick: 0.1,
  familyIllness: 0.05,
  laptopBroken: 0.05,
} as const;
export const FAMILY_TRIP_YEN = 20_000;
export const FAMILY_TRIP_HOURS = 15;
export const LAPTOP_REPAIR_YEN = 50_000;
export const THESIS_CRUNCH_CHANCE = 0.3;
export const THESIS_CRUNCH_HOURS = 20;
export const THESIS_CRUNCH_RESEARCH = 15;
/**
 * Chance that a company pays a regional self's travel to a final interview. マイナビ 2025年卒
 * 学生就職モニター調査 (6月): 67.9% of students received travel or lodging from companies, from
 * 2.7 companies on average; at 0.5 per company, most selves with two or three finals get one.
 */
export const TRAVEL_REIMBURSED_CHANCE = 0.5;
export const SENIOR_TALK_CHANCE = { metro: 0.5, regional: 0.25 } as const;

// Wellbeing: each stat runs 0–100 and the year ends when one reaches zero. All assumptions.
export const STARTING_STATS = { health: 70, mind: 70, social: 60, research: 50 } as const;
/**
 * Difficulty shifts every starting stat and scales the weekly drift; the calibration uses normal.
 */
export const DIFFICULTY = {
  easy: { statShift: 15, driftFactor: 0.7 },
  normal: { statShift: 0, driftFactor: 1 },
  hard: { statShift: -15, driftFactor: 1.3 },
} as const;
export type Difficulty = keyof typeof DIFFICULTY;
/** Weekly drift when nothing is done for a stat; research drifts faster in the fourth year. */
export const WEEKLY_DRIFT = { health: -0.5, mind: -0.6, social: -0.8, research: -0.4 } as const;
export const FOURTH_YEAR_RESEARCH_DRIFT = -1.2;
/** Weekly hours of part-time and job hunting together beyond which health wears down. */
export const HEALTHY_WORKLOAD_WEEKLY_HOURS = 30;
export const HEALTH_PER_OVERLOAD_HOUR = 0.15;
export const MIND_PER_JOB_HOUR = 0.025;
export const MIND_WHEN_BROKE_WEEKLY = 0.8;
export const BROKE_BELOW_YEN = 10_000;
export const STAT_SHOCK = {
  sick: { health: -15 },
  familyIllness: { mind: -10 },
  rejection: { mind: -8 },
  offer: { mind: 20 },
} as const;
