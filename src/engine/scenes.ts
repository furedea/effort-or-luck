// The year as scenes in a fixed order. Each scene may draw from the life's RNG, so the order of
// draws here is part of what makes a seed reproducible.
import type { AutumnEvent, Effort, OptionKey, ResultFact, SceneFacts } from "./facts";
import { freeHours, partTimeHours, tripYen, type Life } from "./life";
import {
  ALLOWANCE_CUT_YEN,
  AUTUMN_EVENT,
  EXTRA_WORK_HOURS,
  MAX_PASS_PROBABILITY,
  PASS,
  SCHOLARSHIP_MONTHS,
  SHOP_CLOSED_LOSS_YEN,
  SICK_HOURS,
  WAGE_YEN_PER_HOUR,
} from "./parameters";
import { countSuccesses } from "./random";

export interface OptionSpec {
  readonly key: OptionKey;
  readonly effort: Effort;
  readonly hours: number;
  readonly money: number;
  /** Whether wanting this option and not affording it is worth recording. */
  readonly blockable: boolean;
  readonly apply?: (life: Life) => ResultFact | undefined;
}

interface SceneDraft {
  readonly facts: SceneFacts;
  readonly options: readonly OptionSpec[];
}

type SceneBuilder = (life: Life) => SceneDraft | null;

const SCENES: readonly SceneBuilder[] = [
  intro,
  summerEs,
  summerIntern,
  autumn,
  earlySelection,
  february,
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

function intro(life: Life): SceneDraft {
  life.log.push({ kind: "profile", allowance: life.allowance, metro: life.metro });
  if (life.scholarship) life.log.push({ kind: "scholarship", amount: life.scholarship });
  return {
    facts: {
      id: "intro",
      allowance: life.allowance,
      metro: life.metro,
      scholarship: life.scholarship,
      partTimeHours: partTimeHours(life),
      freeHours: freeHours(life),
      money: life.money,
    },
    options: [],
  };
}

function summerEs(): SceneDraft {
  return {
    facts: { id: "summerEs" },
    options: [
      option("esFive", 2, { hours: 30, blockable: true }, (x) => {
        x.internApplications = 5;
        x.prep += 2;
      }),
      option("esTwo", 1, { hours: 12, blockable: true }, (x) => {
        x.internApplications = 2;
        x.prep += 1;
      }),
      option("skip", 0, {}, (x) => {
        x.internApplications = 0;
      }),
    ],
  };
}

function summerIntern(life: Life): SceneDraft {
  const passed = countSuccesses(
    life.rng,
    life.internApplications,
    passChance(PASS.internEs, PASS.internEsPerPrep, life),
  );
  const fallback = [
    option("onlineSession", 1, { hours: 8 }, (x) => {
      x.prep += 1;
    }),
    option("keepWorking", 0),
  ];
  if (life.internApplications === 0) {
    return { facts: { id: "summerIntern", result: "none" }, options: fallback };
  }
  if (passed === 0) {
    life.log.push({ kind: "internAllFailed" });
    return {
      facts: { id: "summerIntern", result: "failed", applications: life.internApplications },
      options: fallback,
    };
  }
  return {
    facts: {
      id: "summerIntern",
      result: "passed",
      applications: life.internApplications,
      passed,
      metro: life.metro,
    },
    options: [
      option("attend", 2, { hours: 40, money: tripYen(life), blockable: true }, (x) => {
        x.intern = "face";
        x.prep += 3;
        x.log.push({ kind: "faceIntern" });
      }),
      option("switchOnline", 1, { hours: 8 }, (x) => {
        x.intern = "online";
        x.prep += 1;
      }),
      option("decline", 0),
    ],
  };
}

function autumn(life: Life): SceneDraft {
  const event = drawAutumnEvent(life);
  const inviteChance =
    life.intern === "face"
      ? PASS.inviteAfterFaceIntern
      : life.intern === "online"
        ? PASS.inviteAfterOnlineIntern
        : 0;
  life.invited = life.rng() < inviteChance;
  return {
    facts: { id: "autumn", event, invited: life.invited },
    options: [
      option("practice", 2, { hours: 20, blockable: true }, (x) => {
        x.prep += 2;
      }),
      option("prepareLightly", 1, { hours: 8 }, (x) => {
        x.prep += 1;
      }),
      option("workMore", 0, {}, (x) => {
        const amount = Math.min(EXTRA_WORK_HOURS, freeHours(x)) * WAGE_YEN_PER_HOUR;
        x.money += amount;
        return { kind: "saved", amount };
      }),
    ],
  };
}

function drawAutumnEvent(life: Life): AutumnEvent {
  const roll = life.rng();
  if (roll < AUTUMN_EVENT.allowanceCut) {
    if (life.allowance > 0) {
      life.allowance = Math.max(0, life.allowance - ALLOWANCE_CUT_YEN);
      life.log.push({ kind: "allowanceCut" });
      return { kind: "allowanceCut", freeHours: freeHours(life) };
    }
    life.money = Math.max(0, life.money - SHOP_CLOSED_LOSS_YEN);
    life.log.push({ kind: "shopClosed" });
    return { kind: "shopClosed" };
  }
  if (roll < AUTUMN_EVENT.allowanceCut + AUTUMN_EVENT.sick) {
    life.sickHours = SICK_HOURS;
    life.log.push({ kind: "sick" });
    return { kind: "sick" };
  }
  return { kind: "calm" };
}

function earlySelection(life: Life): SceneDraft {
  life.sickHours = 0;
  if (!life.invited) {
    return {
      facts: { id: "early", result: "notInvited", hadIntern: life.intern !== "none" },
      options: [],
    };
  }
  const passed = life.rng() < passChance(PASS.early, PASS.earlyPerPrep, life);
  if (passed) {
    life.offers.push("december");
    life.log.push({ kind: "earlyOffer" });
  }
  return { facts: { id: "early", result: passed ? "passed" : "failed" }, options: [] };
}

function february(life: Life): SceneDraft {
  const hasOffer = life.offers.length > 0;
  return {
    facts: { id: "feb", hasOffer },
    options: hasOffer
      ? [
          option("continue", 2),
          option("stop", 0, {}, (x) => {
            x.done = true;
            return { kind: "ended" };
          }),
        ]
      : [],
  };
}

function march(life: Life): SceneDraft | null {
  if (life.done) return null;
  return {
    facts: { id: "march" },
    options: [
      option("entryTwenty", 2, { hours: 40, blockable: true }, (x) => {
        x.entries = 20;
        x.prep += 1;
      }),
      option("entryEight", 1, { hours: 16, blockable: true }, (x) => {
        x.entries = 8;
      }),
      option("entryThree", 0, { hours: 6 }, (x) => {
        x.entries = 3;
      }),
      option("skip", -1, {}, (x) => {
        x.entries = 0;
      }),
    ],
  };
}

function finals(life: Life): SceneDraft | null {
  if (life.done) return null;
  const firstRound = countSuccesses(
    life.rng,
    life.entries,
    passChance(PASS.entryEs, PASS.entryEsPerPrep, life),
  );
  const count = countSuccesses(
    life.rng,
    firstRound,
    passChance(PASS.toFinal, PASS.toFinalPerPrep, life),
  );
  const facts = {
    id: "finals",
    entries: life.entries,
    firstRound,
    finals: count,
    metro: life.metro,
  } as const;
  if (!count) return { facts, options: [] };
  const trip = tripYen(life);
  const take =
    (face: number, online: number) =>
    (x: Life): undefined => {
      x.finals = { face, online };
    };
  return {
    facts,
    options: [
      option(
        "allFace",
        2,
        { hours: 8 * count, money: trip * count, blockable: true },
        take(count, 0),
      ),
      ...(count > 1
        ? [
            option(
              "oneFace",
              1,
              { hours: 8 + 2 * (count - 1), money: trip, blockable: true },
              take(1, count - 1),
            ),
          ]
        : []),
      option("allOnline", 0, { hours: 2 * count, blockable: true }, take(0, count)),
      option("decline", -1, {}, take(0, 0)),
    ],
  };
}

function june(life: Life): SceneDraft {
  const chance =
    passChance(PASS.final, PASS.finalPerPrep, life) * (life.metro ? 1 : PASS.regionalFinalFactor);
  const won =
    countSuccesses(life.rng, life.finals.face, chance) +
    countSuccesses(life.rng, life.finals.online, chance * PASS.onlineFinalFactor);
  for (let i = 0; i < won; i++) life.offers.push("may");
  life.log.push({ kind: "june", offers: life.offers.length });
  return {
    facts: {
      id: "june",
      done: life.done,
      won,
      finalsTaken: life.finals.face + life.finals.online,
      offers: life.offers.length,
      scholarshipTotal: life.scholarship * SCHOLARSHIP_MONTHS,
    },
    options: [],
  };
}

function passChance(base: number, perPrep: number, life: Life): number {
  return Math.max(0, Math.min(MAX_PASS_PROBABILITY, base + perPrep * life.prep));
}

function option(
  key: OptionKey,
  effort: Effort,
  cost: { readonly hours?: number; readonly money?: number; readonly blockable?: boolean } = {},
  apply?: (life: Life) => ResultFact | undefined,
): OptionSpec {
  const spec = {
    key,
    effort,
    hours: cost.hours ?? 0,
    money: cost.money ?? 0,
    blockable: cost.blockable ?? false,
  };
  return apply ? { ...spec, apply } : spec;
}
