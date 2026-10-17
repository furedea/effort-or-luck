// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";

import { GameScreen } from "./game_screen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Current browsers resolve scroll methods with a promise, unlike happy-dom.
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation((() =>
    Promise.resolve()) as typeof window.scrollTo);
});

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(<GameScreen />));
  return host;
}

function click(button: HTMLButtonElement) {
  act(() => button.click());
}

function nextAction(host: HTMLElement): HTMLButtonElement | undefined {
  const enabled = [...host.querySelectorAll<HTMLButtonElement>(".actions button:not(:disabled)")];
  return enabled[0];
}

test("shows the first month once mounted in the browser", () => {
  const host = mount();

  expect(host.querySelector(".when")?.textContent).toBe("3年 4月");
  expect(host.querySelector(".actions button")).not.toBeNull();
});

test("can be played from the first month to the reveal", () => {
  const host = mount();

  for (let guard = 0; guard < 20 && !host.querySelector(".reveal"); guard++) {
    const button = nextAction(host);
    if (!button) throw new Error(`no action on ${host.querySelector(".when")?.textContent}`);
    click(button);
  }

  expect(host.querySelector(".reveal")).not.toBeNull();
  expect(host.querySelectorAll(".dots i")).toHaveLength(100);
});
