// The year as scenes in a fixed order: notices, and periods in which the self divides its time.
// Each scene may draw from the life's RNG, so the order of draws here is part of what makes a
// seed reproducible.
import {
  autumnActivities,
  earlySummerActivities,
  finalsActivities,
  marchActivities,
  PERIOD_WEEKS,
  summerActivities,
  winterActivities,
  type ActivitySpec,
} from "./activities";
import type { AutumnEvent, PeriodId, SceneFacts } from "./facts";
import { isActive, partTimeHours, weeklyFreeHours, type Life } from "./life";
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
} from "./parameters";
import { countSuccesses } from "./random";
import { setBack, shock } from "./wellbeing";

export interface PeriodDraft {
  readonly id: PeriodId;
  readonly weeks: number;
  readonly fourthYear: boolean;
  readonly activities: readonly ActivitySpec[];
}

export interface SceneDraft {
  readonly facts: SceneFacts;
  /** The period the self divides its time over, or null for a notice. */
  readonly period: PeriodDraft | null;
}

type SceneBuilder = (life: Life) => SceneDraft | null;

const SCENES: readonly SceneBuilder[] = [
  intro,
  earlySummer,
  summer,
  autumn,
  earlySelection,
  winter,
  march,
  finals,
  june,
];

export const SCENE_COUNT = SCENES.length;

/** Builds the scene at `index` for this life, or null when the life skips it. */
export function buildScene(life: Life, index: number): SceneDraft | null {
  const builder = SCENES[index];
  if (!builder) throw new RangeError(`no scene at index ${index}`);
  return builder(life);
}

function notice(facts: SceneFacts): SceneDraft {
  return { facts, period: null };
}

function period(
  facts: SceneFacts & { id: PeriodId },
  activities: readonly ActivitySpec[],
  fourthYear = false,
): SceneDraft {
  return { facts, period: { id: facts.id, weeks: PERIOD_WEEKS[facts.id], fourthYear, activities } };
}

function intro(life: Life): SceneDraft {
  life.log.push({ kind: "profile", allowance: life.allowance, metro: life.metro });
  if (life.scholarship) life.log.push({ kind: "scholarship", amount: life.scholarship });
  return notice({
    id: "intro",
    allowance: life.allowance,
    metro: life.metro,
    scholarship: life.scholarship,
    partTimeHours: partTimeHours(life),
    weeklyFreeHours: weeklyFreeHours(life),
    money: life.money,
  });
}

function earlySummer(life: Life): SceneDraft | null {
  if (!isActive(life)) return null;
  return period({ id: "earlySummer" }, earlySummerActivities(life));
}

function summer(life: Life): SceneDraft | null {
  if (!isActive(life)) return null;
  const applications = life.internApplications;
  const passed = countSuccesses(life.rng, applications, documentChance(PASS.internEs, life));
  const intern = applications === 0 ? "none" : passed === 0 ? "failed" : "passed";
  if (intern === "failed") {
    life.log.push({ kind: "internAllFailed" });
    shock(life, "rejection");
  }
  const facts = { id: "summer", intern, applications, passed, metro: life.metro } as const;
  return period(facts, summerActivities(life, passed > 0));
}

function autumn(life: Life): SceneDraft | null {
  if (!isActive(life)) return null;
  const event = drawAutumnEvent(life);
  return period({ id: "autumn", event }, autumnActivities(life));
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
    life.lostHours = SICK_HOURS;
    life.log.push({ kind: "sick" });
    shock(life, "sick");
    return { kind: "sick" };
  }
  threshold += AUTUMN_EVENT.familyIllness;
  if (roll < threshold) {
    life.money = Math.max(0, life.money - FAMILY_TRIP_YEN);
    life.lostHours = FAMILY_TRIP_HOURS;
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

function earlySelection(life: Life): SceneDraft | null {
  if (!isActive(life)) return null;
  life.lostHours = 0;
  const internChance =
    life.intern === "face"
      ? PASS.inviteAfterFaceIntern
      : life.intern === "online"
        ? PASS.inviteAfterOnlineIntern
        : 0;
  life.invited = life.rng() < Math.min(MAX_PASS_PROBABILITY, internChance + life.inviteBonus);
  if (!life.invited) return notice({ id: "early", result: "notInvited" });
  const passed = life.rng() < passChance(PASS.early, PASS.earlyPerPrep, life);
  if (passed) {
    life.offers.push("december");
    life.log.push({ kind: "earlyOffer" });
    shock(life, "offer");
  } else {
    shock(life, "rejection");
  }
  return notice({ id: "early", result: passed ? "passed" : "failed" });
}

function winter(life: Life): SceneDraft | null {
  if (!isActive(life)) return null;
  life.lostHours = 0;
  const chance = life.metro ? SENIOR_TALK_CHANCE.metro : SENIOR_TALK_CHANCE.regional;
  const seniorTalk = life.rng() < chance;
  const hasOffer = life.offers.length > 0;
  return period(
    { id: "winter", seniorTalk, hasOffer },
    winterActivities(life, seniorTalk, hasOffer),
    true,
  );
}

function march(life: Life): SceneDraft | null {
  if (!isActive(life)) return null;
  const busy = life.rng() < THESIS_CRUNCH_CHANCE;
  life.lostHours = busy ? THESIS_CRUNCH_HOURS : 0;
  if (busy) {
    life.log.push({ kind: "thesisCrunch" });
    setBack(life, "research", THESIS_CRUNCH_RESEARCH);
  }
  return period({ id: "march", busy }, marchActivities(life), true);
}

function finals(life: Life): SceneDraft | null {
  if (!isActive(life)) return null;
  life.lostHours = 0;
  const firstRound = countSuccesses(life.rng, life.entries, documentChance(PASS.entryEs, life));
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
  return period(facts, finalsActivities(life, count, reimbursed), true);
}

function june(life: Life): SceneDraft {
  if (life.over) return notice({ id: "over", stat: life.over });
  const chance =
    passChance(PASS.final, PASS.finalPerPrep, life) * (life.metro ? 1 : PASS.regionalFinalFactor);
  const won =
    countSuccesses(life.rng, life.finals.face, chance) +
    countSuccesses(life.rng, life.finals.online, chance * PASS.onlineFinalFactor);
  for (let i = 0; i < won; i++) life.offers.push("may");
  life.log.push({ kind: "june", offers: life.offers.length });
  return notice({
    id: "june",
    done: life.done,
    won,
    finalsTaken: life.finals.face + life.finals.online,
    offers: life.offers.length,
    scholarshipTotal: life.scholarship * SCHOLARSHIP_MONTHS,
  });
}

function passChance(base: number, perPrep: number, life: Life): number {
  return Math.max(0, Math.min(MAX_PASS_PROBABILITY, base + perPrep * life.prep));
}

/** Pass chance for written screening, raised by both kinds of preparation. */
function documentChance(base: number, life: Life): number {
  const raised = base + PASS.documentPerPrep * (life.prep + 2 * life.documentPrep);
  return Math.max(0, Math.min(MAX_PASS_PROBABILITY, raised));
}
