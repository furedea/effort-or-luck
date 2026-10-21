// @vitest-environment happy-dom
import {
  chooseDifficulty,
  click,
  mount,
  mountRaw,
  startYear,
  stepButton,
  tabNamed,
  tileNamed,
  when,
  setUpGameScreenTests,
} from "./game_screen_driver";

setUpGameScreenTests();

describe("the weekly timetable", () => {
  function firstWeek() {
    const host = mount();
    startYear(host);
    return host;
  }
  const total = (host: HTMLElement) => host.querySelector(".time-total")?.textContent;
  const tile = tileNamed;

  it("adds a chosen routine's weekly hours to the bar and removes them when chosen again", () => {
    const host = firstWeek();
    const before = total(host);

    click(tile(host, "説明会"));
    expect(total(host)).toMatch(/^週6／\d+時間（あと\d+(\.\d)?時間）$/);

    click(tile(host, "説明会"));
    expect(total(host)).toBe(before);
  });

  it("offers limited-time preparation only in the weeks before its event, with weeks left", () => {
    const host = firstWeek();
    expect(host.querySelector(".limited")).toBeNull();

    for (let i = 0; i < 4; i++) click(stepButton(host)!);

    expect(when(host)).toBe("5月 第1週");
    click(tabNamed(host, "★ 今だけ"));
    const tile = host.querySelector(".tiles.active .activity");
    expect(tile?.querySelector(".activity-name")?.textContent).toBe("夏インターンのES対策");
    expect(tile?.querySelector(".activity-cost")?.textContent).toBe("週4時間・あと4週");
  });

  it("shows one group of tiles at a time, chosen by tabs", () => {
    const host = firstWeek();
    const names = () =>
      [...host.querySelectorAll(".tiles.active .activity-name")].map((n) => n.textContent);

    expect([...host.querySelectorAll(".tab")].map((n) => n.textContent)).toEqual([
      "就活",
      "学業",
      "自分のこと",
      "お金",
    ]);
    click(tabNamed(host, "学業"));
    expect(names()).toEqual(["資格の勉強", "研究・ゼミ", "授業の予習・復習"]);
  });

  it("keeps every tab's tiles stacked in one place, so switching tabs keeps the height", () => {
    const host = firstWeek();
    const panels = [...host.querySelectorAll(".tile-stack > .tiles")];

    expect(panels).toHaveLength(host.querySelectorAll(".tab").length);
    expect(panels.filter((panel) => panel.classList.contains("active"))).toHaveLength(1);
    for (const panel of panels.filter((p) => !p.classList.contains("active"))) {
      expect(panel.hasAttribute("inert")).toBe(true);
    }
  });

  it("lists the chosen tiles under the bar as small chips, each removed by its ×", () => {
    const host = firstWeek();
    click(tile(host, "説明会"));
    click(tile(host, "友達と遊ぶ"));
    const chips = () =>
      [...host.querySelectorAll(".chosen-chips .chip-name")].map((c) => c.textContent);

    expect(chips()).toEqual(["説明会", "友達と遊ぶ"]);

    click(host.querySelector<HTMLButtonElement>(".chosen-chips .chip-remove")!);

    expect(chips()).toEqual(["友達と遊ぶ"]);
    expect(tile(host, "説明会").getAttribute("aria-pressed")).toBe("false");
  });

  it("opens the tab of a chosen tile when its chip is tapped", () => {
    const host = firstWeek();
    click(tile(host, "友達と遊ぶ"));
    click(tabNamed(host, "就活"));

    click(host.querySelector<HTMLButtonElement>(".chosen-chips .chip-name")!);

    expect(host.querySelector(".tab[aria-selected='true']")?.textContent).toBe("自分のこと");
    const shown = [...host.querySelectorAll(".tiles.active .activity-name")].map(
      (n) => n.textContent,
    );
    expect(shown).toContain("友達と遊ぶ");
  });

  it("gives the price of tiles that cost or pay money", () => {
    // Easy starts with savings, so the paid tile is affordable whatever the draw.
    const host = mountRaw();
    chooseDifficulty(host, "やさしい");
    startYear(host);

    expect(tile(host, "就活講座").querySelector(".activity-cost")?.textContent).toBe(
      "週4時間・5,000円",
    );
    expect(tile(host, "バイト").querySelector(".activity-cost")?.textContent).toBe(
      "週8時間・+9,000円",
    );
  });

  it("cannot choose a paid tile the savings do not cover, and says why", () => {
    const host = mountRaw();
    chooseDifficulty(host, "きびしい");
    startYear(host);

    const course = tile(host, "就活講座");

    expect(course.disabled).toBe(true);
    expect(course.querySelector(".activity-cost")?.textContent).toBe("5,000円・お金が足りない");
  });

  it("clears every tile at once", () => {
    const host = firstWeek();
    click(tile(host, "説明会"));
    click(tile(host, "友達と遊ぶ"));

    click(host.querySelector<HTMLButtonElement>(".clear-all")!);

    expect(host.querySelectorAll(".activity[aria-pressed='true']")).toHaveLength(0);
    expect(host.querySelector<HTMLButtonElement>(".clear-all")?.disabled).toBe(true);
  });

  it("lets only one amount of part-time work be chosen", () => {
    const host = firstWeek();

    click(tile(host, "バイト"));
    click(tile(host, "バイト（多め）"));

    expect(tile(host, "バイト（多め）").getAttribute("aria-pressed")).toBe("true");
    expect(tile(host, "バイト").getAttribute("aria-pressed")).toBe("false");
  });

  it("says on each tile what it raises and lowers", () => {
    const host = firstWeek();

    expect(tile(host, "ゆっくり休む").querySelector(".activity-effects")?.textContent).toBe(
      "健康↑・心↑",
    );
  });

  it("names the bar's colors with their hours", () => {
    const host = firstWeek();

    click(tile(host, "説明会"));
    click(tile(host, "研究・ゼミ"));
    click(tile(host, "友達と遊ぶ"));

    const legend = [...host.querySelectorAll(".bar-legend li")].map((n) => n.textContent);
    expect(legend).toEqual(["就活 6時間", "学業 10時間", "自分のこと 10時間"]);
  });

  it("keeps the numbers off the screen, for screen readers only", () => {
    const host = firstWeek();

    click(tile(host, "ゆっくり休む"));

    expect(host.querySelector(".activity-detail")).toBeNull();
    expect(tile(host, "ゆっくり休む").getAttribute("aria-label")).toBe(
      "ゆっくり休む（週10時間）：健康 +2.4・心の余裕 +0.6／週",
    );
  });

  it("shows the four stats", () => {
    const host = firstWeek();

    const labels = [...host.querySelectorAll(".stat-bar dt")].map((node) => node.textContent);
    // Each value sits beside its own label, before the gauge, so it is never read with the next stat.
    for (const bar of host.querySelectorAll(".stat-bar dd")) {
      expect([...bar.children].map((child) => child.className)).toEqual(["meter-value", "meter"]);
    }
    expect(labels).toEqual(["健康", "心の余裕", "人間関係", "研究", "勉強"]);
  });
});
