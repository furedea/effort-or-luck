// What the engine reports about a life. Copy turns these into text; the engine never does.

export type OfferMonth = "december" | "may";

/** The four things a self must keep above zero; reaching zero ends the year. */
export type Stat = "health" | "mind" | "social" | "research";

/** Periods in which the self divides its time among activities. */
export type PeriodId = "earlySummer" | "summer" | "autumn" | "winter" | "march" | "finals";

export type AutumnEvent =
  | { readonly kind: "allowanceCut" }
  | { readonly kind: "shopClosed" }
  | { readonly kind: "sick" }
  | { readonly kind: "familyIllness" }
  | { readonly kind: "laptopBroken" }
  | { readonly kind: "calm" };

type InternResult = "none" | "failed" | "passed";

export type SceneFacts =
  | {
      readonly id: "intro";
      readonly allowance: number;
      readonly metro: boolean;
      readonly scholarship: number;
      readonly partTimeHours: number;
      readonly weeklyFreeHours: number;
      readonly money: number;
    }
  | { readonly id: "earlySummer" }
  | {
      readonly id: "summer";
      readonly intern: InternResult;
      readonly applications: number;
      readonly passed: number;
      readonly metro: boolean;
    }
  | { readonly id: "autumn"; readonly event: AutumnEvent }
  | { readonly id: "early"; readonly result: "notInvited" | "passed" | "failed" }
  | { readonly id: "winter"; readonly seniorTalk: boolean; readonly hasOffer: boolean }
  | { readonly id: "march"; readonly busy: boolean }
  | {
      readonly id: "finals";
      readonly entries: number;
      readonly firstRound: number;
      readonly finals: number;
      /** Finals whose travel the company pays. */
      readonly reimbursed: number;
      readonly metro: boolean;
    }
  | {
      readonly id: "june";
      readonly done: boolean;
      readonly won: number;
      readonly finalsTaken: number;
      readonly offers: number;
      readonly scholarshipTotal: number;
    }
  | { readonly id: "over"; readonly stat: Stat };

export type SceneId = SceneFacts["id"];

export type ActivityKey =
  | "internEsFive"
  | "internEsTwo"
  | "infoSessions"
  | "selfAnalysis"
  | "jobCourse"
  | "jobFair"
  | "faceIntern"
  | "onlineIntern"
  | "oneDayJobs"
  | "longIntern"
  | "languageCourse"
  | "winterIntern"
  | "interviewPractice"
  | "aptitudePrep"
  | "seniorTalk"
  | "obVisits"
  | "paidMockInterviews"
  | "stopHunting"
  | "entryTwenty"
  | "entryEight"
  | "entryThree"
  | "companyTalks"
  | "finalsAllFace"
  | "finalsOneFace"
  | "finalsAllOnline"
  | "interviewService"
  | "friends"
  | "sns"
  | "certification"
  | "research"
  | "rest";

export type LogFact =
  | { readonly kind: "profile"; readonly allowance: number; readonly metro: boolean }
  | { readonly kind: "scholarship"; readonly amount: number }
  | { readonly kind: "internAllFailed" }
  | { readonly kind: "faceIntern" }
  | { readonly kind: "allowanceCut" }
  | { readonly kind: "shopClosed" }
  | { readonly kind: "sick" }
  | { readonly kind: "familyIllness" }
  | { readonly kind: "laptopBroken" }
  | { readonly kind: "earlyOffer" }
  | { readonly kind: "seniorTalk" }
  | { readonly kind: "thesisCrunch" }
  | { readonly kind: "dropped"; readonly period: PeriodId; readonly activity: ActivityKey }
  | { readonly kind: "over"; readonly stat: Stat }
  | { readonly kind: "june"; readonly offers: number };
