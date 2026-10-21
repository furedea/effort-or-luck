// The autumn misfortune draw. It draws from the life's RNG, so its order of draws is part of what
// makes a seed reproducible.
import type { AutumnEvent } from "./facts";
import { loseHours, type Life } from "./life";
import {
  ALLOWANCE_CUT_YEN,
  AUTUMN_EVENT,
  FAMILY_TRIP_HOURS,
  FAMILY_TRIP_YEN,
  LAPTOP_REPAIR_YEN,
  SHOP_CLOSED_LOSS_YEN,
  SICK_HOURS,
  YEAR_LUCK,
} from "./parameters";
import { shock } from "./wellbeing";

export function drawAutumnEvent(life: Life): AutumnEvent {
  // Difficulty sets how likely any misfortune is; which one it is keeps its usual odds.
  const anyMisfortune = Object.values(AUTUMN_EVENT).reduce((sum, chance) => sum + chance, 0);
  const share = YEAR_LUCK[life.difficulty]?.misfortune ?? anyMisfortune;
  const drawn = life.rng();
  if (drawn >= share) return { kind: "calm" };
  const roll = (drawn / share) * anyMisfortune;
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
    loseHours(life, { weekly: SICK_HOURS / 2, weeks: 2, reason: "sick" });
    life.log.push({ kind: "sick" });
    shock(life, "sick");
    return { kind: "sick" };
  }
  threshold += AUTUMN_EVENT.familyIllness;
  if (roll < threshold) {
    life.money = Math.max(0, life.money - FAMILY_TRIP_YEN);
    loseHours(life, { weekly: FAMILY_TRIP_HOURS, weeks: 1, reason: "family" });
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
