import { JUNE_OFFER_RATE, JUNE_OFFER_RATE_BY_REGION } from "../data/statistics";
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
export const SHARE = "結果を共有する";
export const COPIED = "リンクをコピーした";
export const PLAY_YOURSELF = "自分も遊ぶ";

export type Subject = "you" | "them";

export const LINK_ERRORS = {
  unreadable: "このリンクは読み取れなかった．",
  oldRules: "このリンクは今とは違うルールで遊んだ結果なので，再現できない．",
} as const;

export const VIEWS = [
  ["same", "あなたの選択"],
  ["most", "いつも頑張る"],
  ["least", "いつも楽をする"],
] as const satisfies readonly (readonly [View, string])[];

export function previousChoice(result: string): string {
  return `前の選択で，${result}`;
}

interface StatusItem {
  readonly label: string;
  readonly value: string;
  /** Running low enough to limit what the self can choose. */
  readonly low: boolean;
}

/** Read out after a figure flagged as low, since the flag is otherwise only a color. */
export const LOW_NOTE = "（少ない）";

const LOW_SAVINGS_YEN = 10_000;
const LOW_FREE_HOURS = 20;

/** The self's situation as labeled figures, shown under the month. */
export function statusItems(status: {
  allowance: number;
  scholarship: number;
  money: number;
  freeHours: number;
  offers: number;
}): StatusItem[] {
  return [
    { label: "仕送り", value: yen(status.allowance), low: false },
    ...(status.scholarship
      ? [{ label: "奨学金", value: yen(status.scholarship), low: false }]
      : []),
    { label: "貯金", value: yen(status.money), low: status.money < LOW_SAVINGS_YEN },
    {
      label: "就活に使える時間",
      value: `月${status.freeHours}時間`,
      low: status.freeHours < LOW_FREE_HOURS,
    },
    { label: "内定", value: status.offers ? `${status.offers} 社` : "なし", low: false },
  ];
}

const SUBJECT = { you: "あなた", them: "この人" } as const;

export function resultLine(subject: Subject, offers: number): string {
  const who = SUBJECT[subject];
  return offers ? `${who}には，内定が ${offers} 社ある．` : `${who}には，内定がない．`;
}

export function shareText(offers: number): string {
  return `${TITLE}｜6月1日，内定 ${offers ? `${offers} 社` : "なし"}`;
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
  counts: { total: number; offered: number; average: number | null },
  member: Subject | null,
): string {
  const among = member ? `${SUBJECT[member]}もこの中にいる．` : "";
  const average =
    counts.average === null ? "" : `同じ選び方での平均は ${Math.round(counts.average * 100)}%．`;
  return `仕送り${yen(amount)}の ${counts.total} 人のうち，内定は ${counts.offered} 人．${average}${among}`;
}

export const LONG_RUN_NOTE =
  "平均は，同じ選び方で別の運を 4,000 人分試したときの内定率．1回だけだと，運で数字がぶれる．";
export const LONG_RUN_PENDING = "平均を計算中…";

export function longRunRate(rate: number): string {
  return `平均 ${Math.round(rate * 100)}%`;
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
  const { kanto, otherRegions } = JUNE_OFFER_RATE_BY_REGION;
  return (
    "仕送りの分布，奨学金，インターン参加率，各時点の内定率は調査の数字です．合否の確率は仮定で，" +
    `中くらいの選択を続けた場合の 6月1日の内定率が実際の ${rate}% に近くなるよう合わせています．` +
    `首都圏と地方の差も，同じ調査の地域別の内定率（関東 ${percent(kanto)}，関東・中部・近畿以外 ${percent(otherRegions)}）に` +
    "近くなるよう，地方の最終面接の通過率を少し下げています．差が生まれる理由は調査からはわからないため，この形は仮定です．" +
    `時給は ${WAGE_YEN_PER_HOUR.toLocaleString("ja-JP")} 円，授業とバイト以外の時間は月 ${MONTHLY_HOURS} 時間，` +
    `最初の貯金は ${yen(STARTING_MONEY_YEN)}，首都圏に住む人は ${METRO_SHARE * 10} 割と置きました．`
  );
}

function percent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
