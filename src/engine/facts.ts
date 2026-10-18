// What the engine reports about a life. Copy turns these into text; the engine never does.

export type OfferMonth = "december" | "may";

/** The four things a self must keep above zero; reaching zero ends the year. */
/** Why hours are lost for a while. */
export type LostReason = "sick" | "family";

export type Stat = "health" | "mind" | "social" | "research" | "study";

/** How hard an event option pushes: 2 is the most effortful, -1 means stepping out. */
export type Effort = -1 | 0 | 1 | 2;
export type Shortfall = "time" | "money";

export type AutumnEvent =
  | { readonly kind: "allowanceCut" }
  | { readonly kind: "shopClosed" }
  | { readonly kind: "sick" }
  | { readonly kind: "familyIllness" }
  | { readonly kind: "laptopBroken" }
  | { readonly kind: "calm" };

type InternResult = "none" | "failed" | "passed";

/** Things a self can do every week, each for a fixed number of hours. */
export type RoutineKey =
  | "selfAnalysis"
  | "infoSessions"
  | "interviewPractice"
  | "jobCourse"
  | "longIntern"
  | "certification"
  | "friends"
  | "sns"
  | "research"
  | "rest"
  | "extraWork"
  | "summerEsPrep"
  | "earlyPrep"
  | "entryPrep"
  | "finalPrep"
  | "moreWork"
  | "coursework";

/** Selection stages that limited-time preparation raises the pass rate of. */
export type Boost = "internEs" | "early" | "entryEs" | "final";

/** Light two-way choices between the big events. */
export type SmallEventId =
  | "gwTrip"
  | "seminarTalk"
  | "summerCamp"
  | "extraShift"
  | "obChance"
  | "yearEnd"
  | "studyGroup";

export type EventFacts =
  | {
      readonly id: "intro";
      readonly allowance: number;
      readonly metro: boolean;
      readonly scholarship: number;
      /** Weekly hours of part-time work living costs would need. */
      readonly neededWorkHours: number;
      /** Living costs the allowance and scholarship leave uncovered each month, in yen. */
      readonly monthlyGapYen: number;
      readonly weeklyHours: number;
      readonly money: number;
    }
  | { readonly id: "longInternCall" }
  | { readonly id: "longInternResult"; readonly passed: boolean }
  | { readonly id: "internEs" }
  | {
      readonly id: "summerIntern";
      readonly intern: InternResult;
      readonly applications: number;
      readonly passed: number;
      readonly metro: boolean;
    }
  | { readonly id: "autumn"; readonly event: AutumnEvent }
  | { readonly id: "winterIntern"; readonly metro: boolean }
  | { readonly id: "early"; readonly result: "notInvited" | "passed" | "failed" }
  | { readonly id: "seniorTalk" }
  | { readonly id: "keepGoing" }
  | { readonly id: "entries" }
  | { readonly id: "termExam"; readonly term: "first" | "second" }
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
  | { readonly id: "over"; readonly stat: Stat }
  | { readonly id: SmallEventId };

export type EventId = EventFacts["id"];

/** Choices offered at an event. */
export type OptionKey =
  | "esFive"
  | "esTwo"
  | "esNone"
  | "faceIntern"
  | "onlineIntern"
  | "declineIntern"
  | "goWinter"
  | "skipWinter"
  | "meetSenior"
  | "passSenior"
  | "continue"
  | "stop"
  | "entryTwenty"
  | "entryEight"
  | "entryThree"
  | "entryNone"
  | "finalsAllFace"
  | "finalsOneFace"
  | "finalsAllOnline"
  | "finalsDecline"
  | "tripGo"
  | "tripSkip"
  | "seminarTake"
  | "seminarDecline"
  | "campJoin"
  | "campSkip"
  | "shiftYes"
  | "shiftNo"
  | "obVisit"
  | "obSkip"
  | "homeGo"
  | "homeStay"
  | "studyJoin"
  | "studySkip"
  | "applyIntern"
  | "skipInternCall"
  | "examHard"
  | "examSome"
  | "examSkip";

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
  | { readonly kind: "missed"; readonly event: EventId; readonly option: OptionKey }
  | { readonly kind: "over"; readonly stat: Stat }
  | { readonly kind: "june"; readonly offers: number };
