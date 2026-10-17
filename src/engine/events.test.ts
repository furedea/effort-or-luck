import type { SceneFacts, SceneId } from "./facts";
import { makeLife, periodBudget, tripYen, weeklyFreeHours } from "./life";
import {
  FAMILY_TRIP_HOURS,
  FAMILY_TRIP_YEN,
  LAPTOP_REPAIR_YEN,
  SENIOR_TALK_CHANCE,
  THESIS_CRUNCH_HOURS,
} from "./parameters";
import { carryOut, middlePolicy, mostPolicy, sceneAt, type Policy, type Scene } from "./plan";
import { SCENE_COUNT } from "./scenes";

/** One self's state around a scene: just before it, once it is drawn, and after its period. */
interface Moment {
  readonly scene: Scene;
  readonly metro: boolean;
  readonly moneyBefore: number;
  readonly moneyAt: number;
  readonly freeWeekly: number;
  readonly researchBefore: number;
  readonly researchAt: number;
  readonly prepAt: number;
  readonly prepAfter: number;
  readonly loggedNow: readonly string[];
}

function momentsAt(id: SceneId, policy: Policy, seeds: number): Moment[] {
  const moments: Moment[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const life = makeLife(seed);
    for (let index = 0; index < SCENE_COUNT; index++) {
      const moneyBefore = life.money;
      const researchBefore = life.stats.research;
      const logged = life.log.length;
      const scene = sceneAt(life, index);
      if (!scene) continue;
      const at = {
        moneyAt: life.money,
        freeWeekly: weeklyFreeHours(life),
        researchAt: life.stats.research,
        prepAt: life.prep,
      };
      if (scene.period) carryOut(life, scene, policy(life, scene));
      if (scene.facts.id !== id) continue;
      const loggedNow = life.log.slice(logged).map((fact) => fact.kind);
      moments.push({
        scene,
        metro: life.metro,
        moneyBefore,
        researchBefore,
        ...at,
        prepAfter: life.prep,
        loggedNow,
      });
    }
  }
  return moments;
}

function factsOf<Id extends SceneId>({ scene }: Moment, id: Id): Extract<SceneFacts, { id: Id }> {
  if (scene.facts.id !== id) throw new Error(`expected ${id}`);
  return scene.facts as Extract<SceneFacts, { id: Id }>;
}

function budgetOf({ scene }: Moment): number {
  return scene.period?.budget ?? 0;
}

describe("autumn events", () => {
  const autumns = momentsAt("autumn", middlePolicy, 3000);
  const withEvent = (kind: string) =>
    autumns.filter((m) => factsOf(m, "autumn").event.kind === kind);

  it("can send a self home for a family illness, costing money and hours", () => {
    const trips = withEvent("familyIllness");

    expect(trips.length).toBeGreaterThan(0);
    for (const m of trips) {
      expect(m.moneyAt).toBe(Math.max(0, m.moneyBefore - FAMILY_TRIP_YEN));
      expect(budgetOf(m)).toBe(Math.max(0, m.freeWeekly * 12 - FAMILY_TRIP_HOURS));
      expect(m.loggedNow).toContain("familyIllness");
    }
  });

  it("can break a laptop, costing the repair or whatever savings remain", () => {
    const breaks = withEvent("laptopBroken");

    expect(breaks.length).toBeGreaterThan(0);
    for (const m of breaks) {
      expect(m.moneyAt).toBe(Math.max(0, m.moneyBefore - LAPTOP_REPAIR_YEN));
      expect(m.loggedNow).toContain("laptopBroken");
    }
  });
});

describe("the March thesis crunch", () => {
  it("takes hours and research away for some selves", () => {
    const marches = momentsAt("march", middlePolicy, 3000);
    const busy = marches.filter((m) => factsOf(m, "march").busy);
    const calm = marches.filter((m) => !factsOf(m, "march").busy);

    expect(busy.length).toBeGreaterThan(0);
    expect(calm.length).toBeGreaterThan(0);
    for (const m of busy) {
      expect(budgetOf(m)).toBe(Math.max(0, m.freeWeekly * 4 - THESIS_CRUNCH_HOURS));
      expect(m.researchAt).toBeLessThan(m.researchBefore);
    }
    for (const m of calm) expect(budgetOf(m)).toBe(m.freeWeekly * 4);
  });
});

describe("travel paid by companies for final interviews", () => {
  it("lowers the in-person cost by the trips that are reimbursed", () => {
    const finals = momentsAt("finals", mostPolicy, 3000).filter(
      (m) => factsOf(m, "finals").finals > 0,
    );

    expect(finals.some((m) => !m.metro && factsOf(m, "finals").reimbursed > 0)).toBe(true);
    for (const m of finals) {
      const facts = factsOf(m, "finals");
      const allFace = m.scene.period?.activities.find((a) => a.key === "finalsAllFace");
      const trip = tripYen({ metro: m.metro } as Parameters<typeof tripYen>[0]);
      expect(allFace?.money).toBe(trip * (facts.finals - facts.reimbursed));
    }
  });
});

describe("a chance to talk with a senior", () => {
  const lives = 6000;
  const winters = momentsAt("winter", mostPolicy, lives);

  it("comes more often in the metro area", () => {
    const share = (metro: boolean) => {
      const group = winters.filter((m) => m.metro === metro);
      return group.filter((m) => factsOf(m, "winter").seniorTalk).length / group.length;
    };

    expect(share(true)).toBeCloseTo(SENIOR_TALK_CHANCE.metro, 1);
    expect(share(false)).toBeCloseTo(SENIOR_TALK_CHANCE.regional, 1);
  });

  it("is offered only to selves who have the chance, and advances preparation when taken", () => {
    for (const m of winters) {
      const offered = m.scene.period?.activities.some((a) => a.key === "seniorTalk") ?? false;
      expect(offered).toBe(factsOf(m, "winter").seniorTalk);
    }
    const went = winters.filter((m) => m.loggedNow.includes("seniorTalk"));
    expect(went.length).toBeGreaterThan(0);
    for (const m of went) expect(m.prepAfter).toBeGreaterThan(m.prepAt);
  });
});

test("a period's budget is the weekly free hours times its weeks, less hours lost", () => {
  const life = makeLife(3);
  life.lostHours = 7;

  expect(periodBudget(life, 8)).toBe(Math.max(0, weeklyFreeHours(life) * 8 - 7));
});
