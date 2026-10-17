import { alwaysChoose, autoLive, choose, pickNear, price, type Scene } from "./choice";
import { freeHours, makeLife, type Life } from "./life";
import { WAGE_YEN_PER_HOUR } from "./parameters";
import type { OptionSpec } from "./scenes";

function spec(
  effort: OptionSpec["effort"],
  cost: { hours?: number; money?: number } = {},
): OptionSpec {
  return {
    key: "practice",
    effort,
    hours: cost.hours ?? 0,
    money: cost.money ?? 0,
    blockable: true,
  };
}

function withoutRng({ rng: _, ...rest }: Life) {
  return rest;
}

describe("a life is reproducible", () => {
  it("lives the same year for the same seed and choices", () => {
    const first = autoLive(42, alwaysChoose(2));
    const second = autoLive(42, alwaysChoose(2));

    expect(withoutRng(second)).toEqual(withoutRng(first));
  });
});

describe("pricing an option", () => {
  it("buys missing hours back from part-time work with savings", () => {
    const life = makeLife(1);
    life.money = 100_000;

    const priced = price(life, spec(2, { hours: freeHours(life) + 10 }));

    expect(priced).toMatchObject({
      shortHours: 10,
      total: 10 * WAGE_YEN_PER_HOUR,
      shortfall: null,
    });
  });

  it("reports a time shortfall when savings cannot buy the missing hours", () => {
    const life = makeLife(1);
    life.money = 0;

    expect(price(life, spec(2, { hours: freeHours(life) + 10 })).shortfall).toBe("time");
  });

  it("reports a money shortfall when the hours fit but the cost does not", () => {
    const life = makeLife(1);
    life.money = 10_000;

    expect(price(life, spec(2, { money: 30_000 })).shortfall).toBe("money");
  });
});

describe("choosing what a life cannot afford", () => {
  function brokeScene(life: Life): Scene {
    life.money = 0;
    return {
      facts: { id: "march", busy: false },
      options: [
        price(life, { ...spec(2, { money: 1 }), key: "entryTwenty" }),
        price(life, { ...spec(1, { money: 1 }), key: "entryEight" }),
        price(life, { ...spec(0), key: "entryThree", blockable: false }),
      ],
    };
  }

  it("takes the nearest affordable option below the one wanted", () => {
    const scene = brokeScene(makeLife(1));

    expect(pickNear(scene.options, 2).key).toBe("entryThree");
  });

  it("records the unaffordable option nearest above the one taken", () => {
    const life = makeLife(1);
    const scene = brokeScene(life);

    choose(life, scene, pickNear(scene.options, 2), 2);

    expect(life.log.at(-1)).toEqual({ kind: "missed", scene: scene.facts, option: "entryEight" });
  });

  it("records nothing when the life took what it wanted", () => {
    const life = makeLife(1);
    const scene = brokeScene(life);
    const logged = life.log.length;

    choose(life, scene, pickNear(scene.options, 0), 0);

    expect(life.log).toHaveLength(logged);
  });
});
