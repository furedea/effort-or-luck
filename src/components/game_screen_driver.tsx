import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { createRng } from "../engine/random";
import { GameScreen } from "./game_screen";

// Drives the game screen in happy-dom for component tests, as a player would.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DEFAULT_SEED = 1;

/**
 * Runs each test on fake timers and a fixed seed, so every run plays the same game; current
 * browsers resolve scroll methods with a promise, unlike happy-dom.
 */
export function setUpGameScreenTests(): void {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "scrollTo").mockImplementation((() =>
      Promise.resolve()) as typeof window.scrollTo);
    seedGame(DEFAULT_SEED);
  });

  afterEach(async () => {
    unmountAll();
    vi.useRealTimers();
    vi.restoreAllMocks();
    await endMacrotask();
  });
}

/**
 * V8 keeps every WeakRef target that was created or read in the current macrotask alive until it
 * ends, and happy-dom holds DOM nodes through WeakRefs. These tests run on fake timers and never
 * wait on I/O, so without this the unmounted trees of every test pile up until the file ends.
 */
function endMacrotask(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

const mounted: { root: Root; host: HTMLElement }[] = [];

function unmountAll(): void {
  for (const { root, host } of mounted.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
}

/** Fixes the game's base seed and the draw that picks the player, until the test ends. */
export function seedGame(seed: number): void {
  vi.spyOn(crypto, "getRandomValues").mockImplementation(((array: Uint32Array) => {
    array[0] = seed >>> 0;
    return array;
  }) as typeof crypto.getRandomValues);
  vi.spyOn(Math, "random").mockImplementation(createRng(seed));
}

/** Mounts `screen`, the game by default, and unmounts it when the test ends. */
export function mountRaw(screen: ReactNode = <GameScreen />) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push({ root, host });
  act(() => root.render(screen));
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
