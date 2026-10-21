import type { Life } from "./life";
import { ACADEMIC, APPLICATION_FOCUS, MAX_PASS_PROBABILITY, PASS } from "./parameters";

/** How much interviews credit what the self has to talk about from research and study. */
export function academicFactor(life: Life): number {
  const worked = (life.stats.research + life.stats.study) / 2;
  return ACADEMIC.floor + (1 - ACADEMIC.floor) * Math.min(1, worked / ACADEMIC.full);
}

/** How much of each application's chance survives spreading preparation over `count`. */
export function applicationQuality(count: number, focused: number): number {
  return count <= focused ? 1 : (focused / count) ** APPLICATION_FOCUS.exponent;
}

export function passChance(base: number, perPrep: number, life: Life): number {
  return Math.max(0, Math.min(MAX_PASS_PROBABILITY, base + perPrep * life.prep));
}

/** Pass chance for written screening, raised by both kinds of preparation. */
export function documentChance(base: number, life: Life): number {
  const raised = base + PASS.documentPerPrep * (life.prep + 2 * life.documentPrep);
  return Math.max(0, Math.min(MAX_PASS_PROBABILITY, raised));
}
