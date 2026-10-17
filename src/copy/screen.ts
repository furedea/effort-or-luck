import { JUNE_OFFER_RATE } from "../data/statistics";
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
export const SOURCES_LINK = "数字の出典と仮定について";
export const SOURCES_TITLE = "数字の出典と仮定";
export const BACK_TO_GAME = "ゲームに戻る";
export const PLAY_AGAIN = "もう一度";

export const VIEWS = [
  ["same", "あなたの選択"],
  ["most", "いつも頑張る"],
  ["least", "いつも楽をする"],
] as const satisfies readonly (readonly [View, string])[];

export function previousChoice(result: string): string {
  return `前の選択で，${result}`;
}

/** The self's situation as short parts, shown under the month. */
export function statusParts(status: {
  allowance: number;
  scholarship: number;
  money: number;
  freeHours: number;
  offers: number;
}): string[] {
  return [
    `仕送り ${yen(status.allowance)}`,
    ...(status.scholarship ? [`奨学金 ${yen(status.scholarship)}`] : []),
    `貯金 ${yen(status.money)}`,
    `時間 月${status.freeHours}時間`,
    `内定 ${status.offers ? `${status.offers} 社` : "なし"}`,
  ];
}

export function yourResult(offers: number): string {
  return offers ? `あなたには，内定が ${offers} 社ある．` : "あなたには，内定がない．";
}

export function revealLead(size: number): string {
  return `同じ選択を，仕送りの違う ${size} 人のあなたがしていた．`;
}

export function allowanceRow(amount: number): string {
  return yen(amount);
}

export function actualRate(): string {
  return `実際の同級生は ${(JUNE_OFFER_RATE * 100).toFixed(1)}% が内定を持っていた．`;
}

export function sourceCredit(source: string): string {
  return `出典：${source}`;
}

/** One allowance row read out in words, since the dots carry no text. */
export function bandSummary(
  amount: number,
  total: number,
  offered: number,
  hasYou: boolean,
): string {
  return `仕送り${yen(amount)}の ${total} 人のうち，内定は ${offered} 人．${hasYou ? "あなたもこの中にいる．" : ""}`;
}

export function offeredCount(offered: number, total: number): string {
  return `${offered} / ${total} 人`;
}

export function profileText(log: readonly LogFact[]): string {
  return log
    .filter((fact) => fact.kind === "profile" || fact.kind === "scholarship")
    .map(describeLog)
    .join("・");
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
