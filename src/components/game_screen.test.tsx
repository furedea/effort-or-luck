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

test("moves focus to the new month after a choice", () => {
  const host = mount();
  click(nextAction(host)!);

  click(nextAction(host)!);

  expect(document.activeElement).toBe(host.querySelector(".when"));
});

test("describes each allowance row in words for screen readers", () => {
  const host = mount();
  for (let guard = 0; guard < 20 && !host.querySelector(".reveal"); guard++)
    click(nextAction(host)!);

  const rows = [...host.querySelectorAll(".band")];

  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(row.querySelector(".dots")?.getAttribute("aria-hidden")).toBe("true");
    expect(row.querySelector(".sr-only")?.textContent).toMatch(
      /^仕送り.+円の \d+ 人のうち，内定は \d+ 人/,
    );
  }
  expect(host.querySelectorAll(".band .sr-only")).toHaveLength(4);
  expect(
    [...host.querySelectorAll(".band .sr-only")].filter((n) => n.textContent?.includes("あなた")),
  ).toHaveLength(1);
});

test("shows, next to this game's counts, the long-run rate for the same choices", async () => {
  const host = mount();
  for (let guard = 0; guard < 20 && !host.querySelector(".reveal"); guard++)
    click(nextAction(host)!);

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  const averages = [...host.querySelectorAll(".band .band-average")].map(
    (node) => node.textContent,
  );
  expect(averages).toHaveLength(4);
  for (const average of averages) expect(average).toMatch(/^平均 \d+%$/);
  expect(host.querySelector(".long-run-note")?.textContent).toBeTruthy();
});
