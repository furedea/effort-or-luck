import { act } from "react";
import { createRoot } from "react-dom/client";

import { GameScreen } from "./game_screen";

// Drives the game screen in happy-dom for component tests, as a player would.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Runs each test on fake timers; current browsers resolve scroll methods with a promise, unlike happy-dom. */
export function setUpGameScreenTests(): void {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "scrollTo").mockImplementation((() =>
      Promise.resolve()) as typeof window.scrollTo);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}

export function mountRaw() {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<GameScreen />));
  return host;
}

export function click(button: HTMLButtonElement) {
  act(() => button.click());
}

export function chooseDifficulty(host: HTMLElement, name: string) {
  const buttons = [...host.querySelectorAll<HTMLButtonElement>(".difficulty .opt")];
  click(buttons.find((button) => button.querySelector(".label")?.textContent === name)!);
}

/** Mounts the game and starts it at normal difficulty. */
export function mount() {
  const host = mountRaw();
  chooseDifficulty(host, "ふつう");
  return host;
}

export function startYear(host: HTMLElement) {
  click(host.querySelector<HTMLButtonElement>(".event .next")!);
}

export const when = (host: HTMLElement) => host.querySelector(".when")?.textContent;
/** The tile named `name`, switching tabs until its group is shown. */
export function tileNamed(host: HTMLElement, name: string): HTMLButtonElement {
  const visible = () =>
    [...host.querySelectorAll<HTMLButtonElement>(".tiles.active .activity")].find(
      (button) => button.querySelector(".activity-name")?.textContent === name,
    );
  for (const tab of [null, ...host.querySelectorAll<HTMLButtonElement>(".tab")]) {
    if (tab) click(tab);
    const found = visible();
    if (found) return found;
  }
  throw new Error(`no tile named ${name}`);
}

export function tabNamed(host: HTMLElement, name: string): HTMLButtonElement {
  return [...host.querySelectorAll<HTMLButtonElement>(".tab")].find(
    (tab) => tab.textContent === name,
  )!;
}
export const stepButton = (host: HTMLElement) =>
  host.querySelector<HTMLButtonElement>(".actions .step");
export const speedButton = (host: HTMLElement, label: string) =>
  [...host.querySelectorAll<HTMLButtonElement>(".speeds button")].find(
    (button) => button.textContent === label,
  )!;
export const passMs = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** Lets a week pass at double speed, setting the speed again if time went back to steps. */
export function keepFlowing(host: HTMLElement) {
  if (stepButton(host)) click(speedButton(host, "▶▶ 2倍"));
  passMs(300);
}
