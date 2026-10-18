import { JUNE_OFFER_RATE, JUNE_OFFER_RATE_BY_REGION } from "../data/statistics";
import type { LogFact, LostReason, Stat } from "../engine/facts";
import {
  METRO_SHARE,
  MONTHLY_EXPENSE_YEN,
  STARTING_MONEY_YEN,
  WAGE_YEN_PER_HOUR,
  WEEKLY_HOURS,
  type Difficulty,
} from "../engine/parameters";
import { yen } from "./format";
import { describeLog, STAT_LABELS } from "./scenes";

// Japanese text for the screen around the scenes: the play header and the year-end reveal.

/** The ways the same 100 selves are replayed: always least effort, the player's choices, always most. */
export type Path = "least" | "same" | "most";

export const TITLE = "努力か，運か";
export const NEXT = "次へ";
export const YEAR_END = "6月1日";
export const EFFORT_DEFINITION =
  "※ 努力 ＝ どれを選ぼうとしたか．お金や時間が足りずにできなかったのは「運」．";
export const LUCK_PART = "① 努力をそろえて，運だけ変えると";
export const EFFORT_PART = "② 運をそろえて，努力だけ変えると";
export const ALLOWANCE_HEADER = "仕送り";
export const DETAILS_TITLE = "詳しく見る";

/** The reveal's conclusion: the luck gap, the effort gap, and which was larger. */
export function gapSummary(gaps: { luck: number; effort: number }) {
  const percent = (rate: number) => `${Math.round(Math.abs(rate) * 100)}%`;
  return {
    luck: { label: "運の差", text: `仕送りで内定率が ${percent(gaps.luck)} 違う` },
    effort: { label: "努力の差", text: `選び方で内定率が ${percent(gaps.effort)} 違う` },
    verdict: `→ この1年は，${gaps.luck > gaps.effort ? "運" : "努力"}の差のほうが大きかった`,
  };
}

export const SOURCES_LINK = "数字の出典と仮定について";
export const SOURCES_TITLE = "数字の出典と仮定";
export const BACK_TO_GAME = "ゲームに戻る";
export const PLAY_AGAIN = "もう一度";
export const DIFFICULTY_TITLE = "難しさを選ぶ";
export const TITLE_LEAD = ["就活の1年を過ごす．", "内定を決めるのは，努力か，運か．"] as const;
export const DIFFICULTY_LABELS = {
  easy: "やさしい",
  normal: "ふつう",
  hard: "きびしい",
} as const satisfies Record<Difficulty, string>;

/** What a difficulty changes, in plain words; normal needs none. */
export const DIFFICULTY_NOTES = {
  easy: "首都圏・仕送り多め・丈夫・運のいい年",
  normal: "境遇は運しだい",
  hard: "地方・仕送りなし・疲れやすい・運の悪い年",
} as const satisfies Record<Difficulty, string | null>;
export const SHARE = "結果を共有する";
export const COPIED = "リンクをコピーした";
export const PLAY_YOURSELF = "自分も遊ぶ";

export type Subject = "you" | "them";

export const LINK_ERRORS = {
  unreadable: "このリンクは読み取れなかった．",
  oldRules: "このリンクは今とは違うルールで遊んだ結果なので，再現できない．",
} as const;

export const SECTION = { job: "就活", study: "学業", life: "自分のこと", work: "お金" } as const;
export const STEP = "次の週へ";
/** Why the game took auto play back to one week per press. */
export type PauseReason = {
  readonly kind: "limited";
  readonly tile: string;
  readonly weeks: number;
};

export const PAUSE_HEAD = "一時停止";

/** What made auto play pause and what the player can do now. */
export function pauseLines(reason: PauseReason): string[] {
  return [`${reason.tile}が出た．`, `入れるなら今（あと${reason.weeks}週）`];
}
export const SPEED_LABELS = { step: "1週ずつ", normal: "▶ 自動", double: "▶▶ 2倍" } as const;
export const TIMETABLE_TITLE = "毎週の過ごし方";
export const CARD_TITLES = { event: "出来事" } as const;
export const CLEAR_ALL = "全部外す";
export const RESET_TO_USUAL = "いつもの時間割に戻す";

const LOST_REASONS = { sick: "熱", family: "帰省" } as const satisfies Record<LostReason, string>;

/** Hours lost this week, with why and for how long, e.g. "熱で −12.5時間・あと2週". */
export function lostHoursLine(reason: LostReason, weekly: number, weeks: number): string {
  const span = weeks > 1 ? `あと${weeks}週` : "今週だけ";
  return `${LOST_REASONS[reason]}で −${Number(weekly.toFixed(1))}時間・${span}`;
}

export const CHOSEN_LABEL = "選んだ活動";

/** What a chip of a chosen tile does, for screen readers, e.g. "説明会を外す". */
export function removeLabel(tile: string): string {
  return `${tile}を外す`;
}
export const LIMITED_TITLE = "★ 今だけ";

export function weeksLeftLine(weeks: number): string {
  return `あと${weeks}週`;
}

/** A limited-time tile that has just appeared, e.g. "★ 今だけ：夏インターンのES対策（あと4週）". */
export function limitedLine(tile: string, weeks: number): string {
  return `${LIMITED_TITLE}：${tile}（${weeksLeftLine(weeks)}）`;
}
export const CANNOT_PAY = "お金が足りない";
/** Names of the hour bar's parts, in the order they are drawn. */
export const BAR_LABELS = {
  oneOff: "予定",
  job: "就活",
  study: "学業",
  life: "自分のこと",
  work: "バイト",
  over: "オーバー",
} as const;

export function barLegendItem(label: string, hours: number): string {
  return `${label} ${Number(hours.toFixed(1))}時間`;
}

/** The week's hours against the budget, with what is left or over, e.g. "週26／38時間（あと12時間）". */
export function budgetLine(used: number, budget: number): string {
  const hours = (value: number) => Number(value.toFixed(1));
  const rest =
    used <= budget ? `あと${hours(budget - used)}時間` : `${hours(used - budget)}時間オーバー`;
  return `週${hours(used)}／${budget}時間（${rest}）`;
}

/** This week's hours and savings, shown at an event, e.g. "週26／40時間（あと14時間）・貯金 5万円". */
export function weekStatusLine(used: number, budget: number, money: number): string {
  return `${budgetLine(used, budget)}・貯金 ${yen(Math.round(money))}`;
}

/**
 * What an option leaves of the week in two lines: what happens to the hours, then what it costs
 * or what taking it leads to.
 */
export function optionRoom(plan: { spare: number; short: number; need: number }): {
  over: boolean;
  head: string;
  sub: string | null;
} {
  const hours = (n: number) => `${Number(n.toFixed(1))}時間`;
  if (plan.need > 0) {
    return { over: true, head: `週${hours(plan.need)}たりない`, sub: "予定の間の時間割を組む ›" };
  }
  if (plan.short > 0)
    return { over: true, head: `睡眠を削る ${hours(plan.short)}`, sub: "健康↓・心↓" };
  return { over: false, head: `あと${hours(plan.spare)}`, sub: null };
}

/** The title of the timetable followed while a booking lasts, e.g. "予定の間の時間割（あと3週）". */
export function bookingTitle(weeks: number): string {
  return `予定の間の時間割（あと${weeks}週）`;
}
export const BOOKING_NOTE = "予定が終わると，いつもの時間割に戻る";

/** Whether the week fits, or the sleep the hours over cost. */
export function restStatusLine(shortHours: number): string {
  if (shortHours <= 0) return "時間内に収まる";
  return `${Number(shortHours.toFixed(1))}時間オーバー：睡眠を削る・健康↓・心↓`;
}

export const REST_PICK_CONFIRM = "この時間割で進む";
export const REST_PICK_BACK = "選択肢に戻る";

/** What the week's slack does: hours over cost health and mind, hours left over help them. */
export function slackLine(shortHours: number, spareHours: number): string | null {
  if (shortHours > 0) return "睡眠を削るので，健康・心↓";
  if (spareHours > 0) return "余った時間で，健康・心↑";
  return null;
}

export function oneOffLine(hours: number): string {
  return `この週は，決めたことに ${Number(hours.toFixed(1))} 時間使う`;
}

/** A stat that has dropped close to zero, e.g. "健康が 18 まで下がった．". */
export function warningLine(stat: Stat, value: number): string {
  return `${STAT_LABELS[stat]}が ${Math.round(value)} まで下がった．このままだと危ない．`;
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

/** The self's situation as labeled figures, shown under the period. */
/** What changes during play; allowance and scholarship stay as the opening says. */
export function statusItems(status: { money: number; offers: number }): StatusItem[] {
  return [
    { label: "貯金", value: yen(status.money), low: status.money < LOW_SAVINGS_YEN },
    { label: "内定", value: status.offers ? `${status.offers} 社` : "なし", low: false },
  ];
}

/** The monthly money flow for the status card, with its parts, e.g. "毎月 −5万円". */
export function monthlyBreakdown(money: { allowance: number; scholarship: number }) {
  const signed = (value: number) => (value < 0 ? `−${yen(-value)}` : `+${yen(value)}`);
  const net = money.allowance + money.scholarship - MONTHLY_EXPENSE_YEN;
  return {
    summary: `毎月 ${signed(net)}`,
    rows: [
      { label: "仕送り", value: signed(money.allowance) },
      ...(money.scholarship ? [{ label: "奨学金", value: signed(money.scholarship) }] : []),
      { label: "生活費・家賃込み", value: signed(-MONTHLY_EXPENSE_YEN) },
    ],
  };
}

export const HISTORY_TITLE = "これまで";

/** A choice in the history, e.g. "ゴールデンウィーク，友達に旅行に誘われた．→ 行く". */
export function choiceLine(situation: string, option: string): string {
  return `${situation} → ${option}`;
}

const LOW_STAT = 25;

/** The four stats as bars, flagged when close to zero. */
export function statBars(stats: Readonly<Record<Stat, number>>) {
  return (Object.keys(STAT_LABELS) as Stat[]).map((stat) => ({
    stat,
    label: STAT_LABELS[stat],
    value: Math.round(stats[stat]),
    low: stats[stat] < LOW_STAT,
  }));
}

const SUBJECT = { you: "あなた", them: "この人" } as const;

export function resultLine(subject: Subject, offers: number): string {
  const who = SUBJECT[subject];
  return offers ? `${who}には，内定が ${offers} 社ある．` : `${who}には，内定がない．`;
}

export function shareText(offers: number): string {
  return `${TITLE}｜6月1日，内定 ${offers ? `${offers} 社` : "なし"}`;
}

export function luckLead(subject: Subject, size: number): string {
  return `全員が${SUBJECT[subject]}と同じ選択をした ${size} 人`;
}

export function blockedCount(count: number): string {
  return count
    ? `お金か時間が足りず，選んだことができなかった人：${count} 人`
    : "全員が，選んだとおりにできた．";
}

export function endedCount(byStat: Readonly<Partial<Record<Stat, number>>>): string {
  const parts = (Object.keys(STAT_LABELS) as Stat[])
    .filter((stat) => byStat[stat])
    .map((stat) => `${ENDED_BY[stat]} ${byStat[stat]} 人`);
  return parts.length ? `途中で終わった人：${parts.join("・")}` : "途中で終わった人はいない．";
}

const ENDED_BY = {
  health: "体を壊した",
  mind: "心が折れた",
  social: "大学に行けなくなった",
  research: "ゼミに居場所がなくなった",
  study: "留年",
} as const satisfies Record<Stat, string>;

export function effortLead(size: number): string {
  return `同じ ${size} 人が，全員こう選んでいたら`;
}

export function pathLabel(path: Path, subject: Subject): string {
  return path === "same" ? SUBJECT[subject] : path === "most" ? "就活に全部使う" : "自分のことだけ";
}

export function offeredFraction(offered: number, total: number): string {
  return `${offered}/${total}`;
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
    "仕送りの分布，奨学金，インターン参加率，各時点の内定率は調査の数字です．数字は学部生の調査に合わせています．合否の確率は仮定で，" +
    `自己分析・説明会・面接練習と，友達・研究・休むことに週の時間を使い，出来事では真ん中の選択をした場合の 6月1日の内定率が実際の ${rate}% に近くなるよう合わせています．` +
    `首都圏と地方の差も，同じ調査の地域別の内定率（関東 ${percent(kanto)}，関東・中部・近畿以外 ${percent(otherRegions)}）に` +
    "近くなるよう，地方の最終面接の通過率を少し下げています．差が生まれる理由は調査からはわからないため，この形は仮定です．" +
    "地方の最終面接の交通費は，企業が一社ごとに半々の確率で出してくれるとしました．" +
    "交通費や宿泊費の支給を受けた学生が 67.9%（平均 2.7 社）という調査に合わせた仮定です．" +
    `授業・課題・睡眠・家事などを除いて自由に使える時間は週 ${WEEKLY_HOURS} 時間とし，生活費のためのバイトもこの中で選ぶ形にしました．仕送りと奨学金で生活費（月 ${yen(MONTHLY_EXPENSE_YEN)}）に足りない分は，毎週貯金から減ります．` +
    "毎週やることの時間・費用・効果，出来事でかかる時間，健康・心の余裕・人間関係・研究の増え方と減り方，" +
    "10月の家族の入院やパソコンの故障，前期末と後期末のレポートと試験，先輩の話を聞く機会（首都圏で起こりやすい），数週ごとの小さな出来事の時間・費用・効果は，すべて仮定です．" +
    `時給は ${WAGE_YEN_PER_HOUR.toLocaleString("ja-JP")} 円，最初の貯金は ${yen(STARTING_MONEY_YEN)}，首都圏に住む人は ${METRO_SHARE * 10} 割と置きました．`
  );
}

function percent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
