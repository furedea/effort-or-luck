// What the engine reports about a life. Copy turns these into text; the engine never does.

/** How hard an option pushes: 2 is the most effortful, -1 means stepping out. */
export type Effort = -1 | 0 | 1 | 2;
export type OfferMonth = "december" | "may";
export type Outcome = "early" | "offer" | "none";
export type Shortfall = "time" | "money";

export type SceneFacts =
  | {
      readonly id: "intro";
      readonly allowance: number;
      readonly metro: boolean;
      readonly scholarship: number;
      readonly partTimeHours: number;
      readonly freeHours: number;
      readonly money: number;
    }
  | { readonly id: "summerEs" }
  | { readonly id: "summerIntern"; readonly result: "none" }
  | { readonly id: "summerIntern"; readonly result: "failed"; readonly applications: number }
  | {
      readonly id: "summerIntern";
      readonly result: "passed";
      readonly applications: number;
      readonly passed: number;
      readonly metro: boolean;
    }
  | { readonly id: "autumn"; readonly event: AutumnEvent; readonly invited: boolean }
  | { readonly id: "early"; readonly result: "notInvited"; readonly hadIntern: boolean }
  | { readonly id: "early"; readonly result: "passed" | "failed" }
  | { readonly id: "feb"; readonly hasOffer: boolean }
  | { readonly id: "march" }
  | {
      readonly id: "finals";
      readonly entries: number;
      readonly firstRound: number;
      readonly finals: number;
      readonly metro: boolean;
    }
  | {
      readonly id: "june";
      readonly done: boolean;
      readonly won: number;
      readonly finalsTaken: number;
      readonly offers: number;
      readonly scholarshipTotal: number;
    };

export type SceneId = SceneFacts["id"];

export type AutumnEvent =
  | { readonly kind: "allowanceCut"; readonly freeHours: number }
  | { readonly kind: "shopClosed" }
  | { readonly kind: "sick" }
  | { readonly kind: "calm" };

export type OptionKey =
  | "esFive"
  | "esTwo"
  | "onlineSession"
  | "keepWorking"
  | "attend"
  | "switchOnline"
  | "practice"
  | "prepareLightly"
  | "workMore"
  | "continue"
  | "stop"
  | "entryTwenty"
  | "entryEight"
  | "entryThree"
  | "skip"
  | "allFace"
  | "oneFace"
  | "allOnline"
  | "decline";

export type ResultFact =
  | { readonly kind: "saved"; readonly amount: number }
  | { readonly kind: "ended" };

export type LogFact =
  | { readonly kind: "profile"; readonly allowance: number; readonly metro: boolean }
  | { readonly kind: "scholarship"; readonly amount: number }
  | { readonly kind: "internAllFailed" }
  | { readonly kind: "faceIntern" }
  | { readonly kind: "allowanceCut" }
  | { readonly kind: "shopClosed" }
  | { readonly kind: "sick" }
  | { readonly kind: "earlyOffer" }
  | { readonly kind: "missed"; readonly scene: SceneFacts; readonly option: OptionKey }
  | { readonly kind: "june"; readonly offers: number };
