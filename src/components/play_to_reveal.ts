import { act } from "react";

import { PLAY } from "../copy/screen";

const WEEK_MS = 300;
const MAX_ACTIONS = 2000;

/**
 * Plays the year to the reveal under fake timers: moves on from stopping notices, takes the first option
 * the player can afford, presses play when paused, and otherwise lets a week pass.
 */
export function playToReveal(host: HTMLElement): void {
  for (let guard = 0; guard < MAX_ACTIONS && !host.querySelector(".reveal"); guard++) {
    const button =
      host.querySelector<HTMLButtonElement>(".event .next") ??
      host.querySelector<HTMLButtonElement>(".event .opt:not([disabled])") ??
      pausedPlayButton(host);
    if (button) act(() => button.click());
    else
      act(() => {
        vi.advanceTimersByTime(WEEK_MS);
      });
  }
}

function pausedPlayButton(host: HTMLElement): HTMLButtonElement | null {
  const button = host.querySelector<HTMLButtonElement>(".actions .flow");
  return button?.textContent === PLAY ? button : null;
}
