import { act } from "react";

const WEEK_MS = 300;
const MAX_ACTIONS = 2000;

/**
 * Plays the year to the reveal: moves on from stopping notices, takes the first option the player
 * can afford, and otherwise moves one week on.
 */
export function playToReveal(host: HTMLElement): void {
  for (let guard = 0; guard < MAX_ACTIONS && !host.querySelector(".reveal"); guard++) {
    const button =
      host.querySelector<HTMLButtonElement>(".event .next") ??
      host.querySelector<HTMLButtonElement>(".event .opt:not([disabled])") ??
      host.querySelector<HTMLButtonElement>(".actions .step");
    if (button) act(() => button.click());
    else
      act(() => {
        vi.advanceTimersByTime(WEEK_MS);
      });
  }
}
