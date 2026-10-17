import { JUNE_OFFER_RATE, SOURCES } from "../data/statistics";
import type { LogFact } from "../engine/facts";
import {
  METRO_SHARE,
  MONTHLY_HOURS,
  STARTING_MONEY_YEN,
  WAGE_YEN_PER_HOUR,
} from "../engine/parameters";
import { yen } from "./format";
import { describeLog } from "./scenes";

// Japanese text for the screen around the scenes: the play header and the year-end reveal.

export type View = "same" | "most" | "least";

export const TITLE = "努力か，運か";
export const NEXT = "次へ";
export const YEAR_END = "4年 6月1日";
export const SAME_LUCK = "同じ運のまま，選び方だけ変えると";
export const PLAY_AGAIN = "もう一度";
export const YOU = "あなた";

export const VIEWS = [
  ["same", "あなたの選択"],
  ["most", "いつも一番頑張る"],
  ["least", "いつも一番楽をする"],
] as const satisfies readonly (readonly [View, string])[];

export function previousChoice(result: string): string {
  return `前の選択で，${result}`;
}

export function savings(money: number): string {
  return `貯金 ${yen(money)}`;
}

export function hours(free: number): string {
  return `就活に使える時間 月 ${free} 時間`;
}

export function yourResult(offers: number): string {
  return offers ? `あなたには，内定が ${offers} 社ある．` : "あなたには，内定がない．";
}

export function revealLead(size: number): string {
  return `あなたと同じ選択を，仕送りの違う ${size} 人のあなたがしていた．`;
}

export function allowanceRow(amount: number): string {
  return `仕送り ${yen(amount)}`;
}

export function offeredCount(offered: number, total: number): string {
  return `${offered} / ${total} 人`;
}

/** One self's year as a sentence, leaving out the profile and scholarship it started with. */
export function pathText(log: readonly LogFact[]): string {
  const steps = log.filter((fact) => fact.kind !== "profile" && fact.kind !== "scholarship");
  return steps.map(describeLog).join("．") + "．";
}

export function profileText(log: readonly LogFact[]): string {
  return log
    .filter((fact) => fact.kind === "profile" || fact.kind === "scholarship")
    .map(describeLog)
    .join("・");
}

export function sourcesNote(): string {
  return "数字の出典　" + Object.values(SOURCES).join("．") + "．";
}

export function assumptionsNote(): string {
  const rate = (JUNE_OFFER_RATE * 100).toFixed(1);
  return (
    "仕送りの分布，奨学金，インターン参加率，各時点の内定率は調査の数字です．合否の確率は仮定で，" +
    `中くらいの選択を続けた場合の 6月1日の内定率が実際の ${rate}% に近くなるよう合わせています．` +
    `時給は ${WAGE_YEN_PER_HOUR.toLocaleString("ja-JP")} 円，授業とバイト以外の時間は月 ${MONTHLY_HOURS} 時間，` +
    `最初の貯金は ${yen(STARTING_MONEY_YEN)}，首都圏に住む人は ${METRO_SHARE * 10} 割と置きました．`
  );
}
