// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";

import { GameScreen } from "./game_screen";
import { playToReveal } from "./play_to_reveal";
import { ShareScreen } from "./share_screen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation((() =>
    Promise.resolve()) as typeof window.scrollTo);
});

afterEach(() => {
  vi.useRealTimers();
});

function mount(node: React.ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => createRoot(host).render(node));
  return host;
}

async function shareLinkOf(host: HTMLElement): Promise<string> {
  let copied = "";
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: (text: string) => {
        copied = text;
        return Promise.resolve();
      },
    },
    configurable: true,
  });
  await act(async () => host.querySelector<HTMLButtonElement>(".share")!.click());
  return copied;
}

function summary(host: HTMLElement) {
  return {
    // The subject differs on purpose (あなた vs この人); the counts must not.
    rows: [...host.querySelectorAll(".band .sr-only")].map((node) =>
      node.textContent?.replace(/^(.*?)(あなた|この人)もこの中にいる．$/, "$1★"),
    ),
    profile: host.querySelector(".profile")?.textContent,
  };
}

test("a shared link shows the same reveal the player saw", async () => {
  const game = mount(<GameScreen />);
  act(() => game.querySelector<HTMLButtonElement>(".difficulty .opt")!.click());
  playToReveal(game);
  const link = await shareLinkOf(game);

  window.history.replaceState({}, "", new URL(link).pathname + new URL(link).search);
  const shared = mount(<ShareScreen />);

  expect(new URL(link).pathname).toBe("/effort-or-luck/share/");
  expect(summary(shared)).toEqual(summary(game));
  expect(shared.querySelector(".you")?.textContent).toMatch(/^この人には/);
});

test("an unreadable link explains itself and offers to play", () => {
  window.history.replaceState({}, "", "/effort-or-luck/share/?r=1&s=!!");

  const shared = mount(<ShareScreen />);

  expect(shared.querySelector(".link-error")?.textContent).toBeTruthy();
  expect(shared.querySelector<HTMLAnchorElement>("a.next")?.getAttribute("href")).toBe(
    "/effort-or-luck/",
  );
});
