import { choose, pickNear, sceneAt, type Scene } from "./choice";
import type { SceneFacts, SceneId } from "./facts";
import { freeHours, makeLife, partTimeHours, tripYen } from "./life";
import {
  FAMILY_TRIP_HOURS,
  FAMILY_TRIP_YEN,
  LAPTOP_REPAIR_YEN,
  MONTHLY_HOURS,
  SENIOR_TALK_CHANCE,
  THESIS_CRUNCH_HOURS,
} from "./parameters";
import { SCENE_COUNT } from "./scenes";

/** One self's state around a scene: just before it, once it is drawn, and after choosing. */
interface Moment {
  readonly scene: Scene;
  readonly metro: boolean;
  readonly moneyBefore: number;
  readonly moneyAt: number;
  readonly freeAt: number;
  readonly partTimeAt: number;
  readonly prepAt: number;
  readonly prepAfter: number;
  readonly loggedNow: readonly string[];
}

function momentsAt(id: SceneId, want: 0 | 1 | 2, seeds: number): Moment[] {
  const moments: Moment[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const life = makeLife(seed);
    for (let index = 0; index < SCENE_COUNT; index++) {
      const moneyBefore = life.money;
      const logged = life.log.length;
      const scene = sceneAt(life, index);
      if (!scene) continue;
      const at = {
        moneyAt: life.money,
        freeAt: freeHours(life),
        partTimeAt: partTimeHours(life),
        prepAt: life.prep,
      };
      if (scene.options.length) choose(life, scene, pickNear(scene.options, want), want);
      if (scene.facts.id !== id) continue;
      const loggedNow = life.log.slice(logged).map((fact) => fact.kind);
      moments.push({
        scene,
        metro: life.metro,
        moneyBefore,
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

describe("autumn events", () => {
  const autumns = momentsAt("autumn", 1, 3000);
  const withEvent = (kind: string) =>
    autumns.filter((m) => factsOf(m, "autumn").event.kind === kind);

  it("can send a self home for a family illness, costing money and free hours", () => {
    const trips = withEvent("familyIllness");

    expect(trips.length).toBeGreaterThan(0);
    for (const m of trips) {
      expect(m.moneyAt).toBe(Math.max(0, m.moneyBefore - FAMILY_TRIP_YEN));
      expect(m.freeAt).toBe(Math.max(0, MONTHLY_HOURS - m.partTimeAt - FAMILY_TRIP_HOURS));
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
  it("takes free hours away in March for some selves", () => {
    const marches = momentsAt("march", 1, 3000);
    const busy = marches.filter((m) => factsOf(m, "march").busy);
    const calm = marches.filter((m) => !factsOf(m, "march").busy);

    expect(busy.length).toBeGreaterThan(0);
    expect(calm.length).toBeGreaterThan(0);
    for (const m of busy)
      expect(m.freeAt).toBe(Math.max(0, MONTHLY_HOURS - m.partTimeAt - THESIS_CRUNCH_HOURS));
    for (const m of calm) expect(m.freeAt).toBe(Math.max(0, MONTHLY_HOURS - m.partTimeAt));
  });
});

describe("travel paid by companies for final interviews", () => {
  it("lowers the in-person cost by the trips that are reimbursed", () => {
    const finals = momentsAt("finals", 2, 3000).filter((m) => factsOf(m, "finals").finals > 0);
    const regional = finals.filter((m) => !m.metro);

    expect(regional.some((m) => factsOf(m, "finals").reimbursed > 0)).toBe(true);
    for (const m of finals) {
      const facts = factsOf(m, "finals");
      const allFace = m.scene.options.find((o) => o.key === "allFace")!;
      const trip = tripYen({ metro: m.metro } as Parameters<typeof tripYen>[0]);
      expect(allFace.money).toBe(trip * (facts.finals - facts.reimbursed));
    }
  });
});

describe("a chance to talk with a senior", () => {
  const lives = 6000;
  const talks = momentsAt("jan", 2, lives);

  it("comes more often in the metro area", () => {
    const metro = talks.filter((m) => m.metro).length / (lives * 0.4);
    const regional = talks.filter((m) => !m.metro).length / (lives * 0.6);

    expect(metro).toBeCloseTo(SENIOR_TALK_CHANCE.metro, 1);
    expect(regional).toBeCloseTo(SENIOR_TALK_CHANCE.regional, 1);
  });

  it("advances preparation when the self goes to talk", () => {
    const went = talks.filter((m) => m.loggedNow.includes("seniorTalk"));

    expect(went.length).toBeGreaterThan(0);
    for (const m of went) expect(m.prepAfter).toBeGreaterThan(m.prepAt);
  });
});
