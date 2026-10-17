import type { ActivityKey, PeriodId, Stat } from "./facts";
import { tripYen, type Life } from "./life";
import { WAGE_YEN_PER_HOUR } from "./parameters";

// What a self can spend a period on. Hours and costs are assumptions based on typical effort per
// action (an info session about 2 hours, an ES about 3 hours); they are listed on the sources page.

export interface ActivitySpec {
  readonly key: ActivityKey;
  readonly kind: "job" | "life";
  /** Hours over the whole period. */
  readonly hours: number;
  readonly money: number;
  /** Money the activity pays, such as a paid internship. */
  readonly pays: number;
  /** Activities in the same group are alternatives; the first one chosen is taken. */
  readonly group?: string;
  /** Change to each stat per week of the period. */
  readonly statsPerWeek?: Readonly<Partial<Record<Stat, number>>>;
  readonly apply?: (life: Life) => void;
}

export const PERIOD_WEEKS = {
  earlySummer: 12,
  summer: 8,
  autumn: 12,
  winter: 8,
  march: 4,
  finals: 8,
} as const satisfies Record<PeriodId, number>;

/** Every activity key in a fixed order, used to encode plans in shared links. */
export const ACTIVITY_KEYS: readonly ActivityKey[] = [
  "internEsFive",
  "internEsTwo",
  "infoSessions",
  "selfAnalysis",
  "jobCourse",
  "jobFair",
  "faceIntern",
  "onlineIntern",
  "oneDayJobs",
  "longIntern",
  "languageCourse",
  "winterIntern",
  "interviewPractice",
  "aptitudePrep",
  "seniorTalk",
  "obVisits",
  "paidMockInterviews",
  "stopHunting",
  "entryTwenty",
  "entryEight",
  "entryThree",
  "companyTalks",
  "finalsAllFace",
  "finalsOneFace",
  "finalsAllOnline",
  "interviewService",
  "friends",
  "sns",
  "certification",
  "research",
  "rest",
];

type Spec = Omit<ActivitySpec, "pays" | "money"> & { pays?: number; money?: number };

function job(spec: Omit<Spec, "kind">): ActivitySpec {
  return { kind: "job", money: 0, pays: 0, ...spec };
}

function addPrep(amount: number) {
  return (life: Life) => {
    life.prep += amount;
  };
}

/** Activities open to every self in every period. */
function lifeActivities(weeks: number): ActivitySpec[] {
  return [
    {
      key: "friends",
      kind: "life",
      hours: 8 * weeks,
      money: 0,
      pays: 0,
      statsPerWeek: { mind: 0.9, social: 1.4 },
      apply: addPrep(1),
    },
    {
      key: "sns",
      kind: "life",
      hours: 5 * weeks,
      money: 0,
      pays: 0,
      statsPerWeek: { mind: 0.4 },
      apply: (life) => {
        life.inviteBonus += 0.05;
      },
    },
    {
      key: "certification",
      kind: "life",
      hours: 3 * weeks,
      money: 10_000,
      pays: 0,
      apply: (life) => {
        life.documentPrep += 1;
      },
    },
    {
      key: "research",
      kind: "life",
      hours: 4 * weeks,
      money: 0,
      pays: 0,
      statsPerWeek: { research: 1.8 },
    },
    {
      key: "rest",
      kind: "life",
      hours: 5 * weeks,
      money: 0,
      pays: 0,
      statsPerWeek: { health: 1.2, mind: 0.3 },
    },
  ];
}

export function earlySummerActivities(life: Life): ActivitySpec[] {
  return [
    job({
      key: "internEsFive",
      hours: 15,
      group: "internEs",
      apply: (x) => {
        x.internApplications = 5;
      },
    }),
    job({
      key: "internEsTwo",
      hours: 6,
      group: "internEs",
      apply: (x) => {
        x.internApplications = 2;
      },
    }),
    job({ key: "infoSessions", hours: 12, apply: addPrep(1) }),
    job({ key: "selfAnalysis", hours: 20, apply: addPrep(2) }),
    job({ key: "jobCourse", hours: 24, money: 30_000, apply: addPrep(3) }),
    job({ key: "jobFair", hours: 6, money: life.metro ? 1000 : 10_000, apply: addPrep(1) }),
    ...lifeActivities(PERIOD_WEEKS.earlySummer),
  ];
}

export function summerActivities(life: Life, internPassed: boolean): ActivitySpec[] {
  return [
    ...(internPassed
      ? [
          job({
            key: "faceIntern",
            hours: 40,
            money: tripYen(life),
            group: "intern",
            apply: (x) => {
              x.intern = "face";
              x.prep += 3;
              x.log.push({ kind: "faceIntern" });
            },
          }),
          job({
            key: "onlineIntern",
            hours: 8,
            group: "intern",
            apply: (x) => {
              x.intern = "online";
              x.prep += 1;
            },
          }),
        ]
      : []),
    job({ key: "oneDayJobs", hours: 24, apply: addPrep(1) }),
    job({ key: "longIntern", hours: 128, pays: 128 * WAGE_YEN_PER_HOUR, apply: addPrep(3) }),
    job({ key: "languageCourse", hours: 80, money: 100_000, apply: addPrep(3) }),
    ...lifeActivities(PERIOD_WEEKS.summer),
  ];
}

export function autumnActivities(life: Life): ActivitySpec[] {
  return [
    job({
      key: "winterIntern",
      hours: 24,
      money: tripYen(life),
      apply: (x) => {
        x.inviteBonus += 0.25;
        x.prep += 1;
      },
    }),
    job({ key: "interviewPractice", hours: 10, apply: addPrep(2) }),
    job({
      key: "aptitudePrep",
      hours: 20,
      money: 5000,
      apply: (x) => {
        x.documentPrep += 2;
      },
    }),
    ...lifeActivities(PERIOD_WEEKS.autumn),
  ];
}

export function winterActivities(
  life: Life,
  seniorTalk: boolean,
  hasOffer: boolean,
): ActivitySpec[] {
  return [
    ...(seniorTalk
      ? [
          job({
            key: "seniorTalk",
            hours: 3,
            apply: (x) => {
              x.prep += 2;
              x.log.push({ kind: "seniorTalk" });
            },
          }),
        ]
      : []),
    job({ key: "obVisits", hours: 10, money: tripYen(life), apply: addPrep(2) }),
    job({ key: "paidMockInterviews", hours: 6, money: 10_000, apply: addPrep(2) }),
    job({ key: "interviewPractice", hours: 10, apply: addPrep(2) }),
    ...(hasOffer
      ? [
          job({
            key: "stopHunting",
            hours: 0,
            apply: (x) => {
              x.done = true;
            },
          }),
        ]
      : []),
    ...lifeActivities(PERIOD_WEEKS.winter),
  ];
}

export function marchActivities(life: Life): ActivitySpec[] {
  const entry = (key: ActivityKey, count: number, hours: number) =>
    job({
      key,
      hours,
      group: "entry",
      apply: (x) => {
        x.entries = count;
        if (count >= 20) x.prep += 1;
      },
    });
  return [
    entry("entryTwenty", 20, 40),
    entry("entryEight", 8, 16),
    entry("entryThree", 3, 6),
    job({ key: "companyTalks", hours: 16, money: life.metro ? 1000 : 20_000, apply: addPrep(1) }),
    ...lifeActivities(PERIOD_WEEKS.march),
  ];
}

export function finalsActivities(life: Life, finals: number, reimbursed: number): ActivitySpec[] {
  const trip = tripYen(life);
  const take = (face: number, online: number) => (x: Life) => {
    x.finals = { face, online };
  };
  const finalsOptions = finals
    ? [
        job({
          key: "finalsAllFace",
          hours: 8 * finals,
          money: trip * (finals - reimbursed),
          group: "finals",
          apply: take(finals, 0),
        }),
        ...(finals > 1
          ? [
              job({
                key: "finalsOneFace",
                hours: 8 + 2 * (finals - 1),
                money: reimbursed ? 0 : trip,
                group: "finals",
                apply: take(1, finals - 1),
              }),
            ]
          : []),
        job({ key: "finalsAllOnline", hours: 2 * finals, group: "finals", apply: take(0, finals) }),
      ]
    : [];
  return [
    ...finalsOptions,
    job({ key: "interviewService", hours: 6, money: 20_000, apply: addPrep(2) }),
    ...lifeActivities(PERIOD_WEEKS.finals),
  ];
}
