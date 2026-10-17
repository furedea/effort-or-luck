import type { Scene } from "../engine/choice";
import type { LogFact, OptionKey, ResultFact, SceneFacts, Shortfall } from "../engine/facts";
import { ALLOWANCE_CUT_YEN, SHOP_CLOSED_LOSS_YEN, TRIP_YEN } from "../engine/parameters";
import { region, yen } from "./format";

// Japanese text for what the engine reports. Wording lives here, never in the engine.

interface SceneText {
  readonly when: string;
  readonly lines: readonly string[];
  /** Label of the button that moves on when the scene has no options. */
  readonly next?: string;
}

const WHEN = {
  intro: "3年 4月",
  summerEs: "3年 5月",
  summerIntern: "3年 8月",
  autumn: "3年 10月",
  early: "3年 12月",
  feb: "4年 2月",
  march: "4年 3月",
  finals: "4年 4月",
  june: "4年 6月",
} as const satisfies Record<SceneFacts["id"], string>;

export function describeScene({ facts }: Scene): SceneText {
  const when = WHEN[facts.id];
  switch (facts.id) {
    case "intro":
      return { when, lines: introLines(facts), next: "始める" };
    case "summerEs":
      return { when, lines: ["夏のインターンの募集が始まった．", "ES は一社 6 時間かかる．"] };
    case "summerIntern":
      return { when, lines: summerInternLines(facts) };
    case "autumn":
      return { when, lines: autumnLines(facts) };
    case "early":
      return { when, lines: [EARLY[facts.result]] };
    case "feb":
      return { when, lines: [facts.hasOffer ? "内定が一つある．" : "まだ内定はない．"] };
    case "march":
      return { when, lines: ["本選考のエントリーが始まった．", "ES は一社 2 時間．"] };
    case "finals":
      return { when, lines: finalsLines(facts) };
    case "june":
      return { when, lines: juneLines(facts), next: "結果を見る" };
  }
}

export function optionLabel(facts: SceneFacts, key: OptionKey): string {
  if (facts.id === "finals") return finalsOptionLabel(facts.finals, key);
  if (facts.id === "march" && key === "skip") return "今はエントリーしない";
  return OPTION_LABELS[key];
}

/** What an option costs, e.g. "30時間" or "16時間・6万円"; empty when free. */
export function optionCost(hours: number, money: number): string {
  return [hours ? `${hours}時間` : "", money ? yen(money) : ""].filter(Boolean).join("・");
}

export function shortfallReason(shortfall: Shortfall | null): string {
  if (shortfall === "time") return "時間が足りない";
  if (shortfall === "money") return "お金が足りない";
  return "";
}

export function describeResult(result: ResultFact): string {
  switch (result.kind) {
    case "saved":
      return `${yen(result.amount)}貯まった．`;
    case "ended":
      return "就活を終えた．";
  }
}

export function describeLog(fact: LogFact): string {
  switch (fact.kind) {
    case "profile":
      return `仕送り ${yen(fact.allowance)}・${region(fact.metro)}`;
    case "scholarship":
      return `奨学金 月${yen(fact.amount)}`;
    case "internAllFailed":
      return "夏のインターンは全部落ちた";
    case "faceIntern":
      return "8月，対面インターンに行った";
    case "allowanceCut":
      return "10月，仕送りが減った";
    case "shopClosed":
      return "10月，バイト先が閉店した";
    case "sick":
      return "10月，熱を出した";
    case "earlyOffer":
      return "12月，早期選考で内定";
    case "missed":
      return missedMessage(fact.option);
    case "june":
      return fact.offers ? `6月1日，内定 ${fact.offers} 社` : "6月1日，内定なし";
  }
}

type Facts<Id extends SceneFacts["id"]> = Extract<SceneFacts, { id: Id }>;

function introLines(facts: Facts<"intro">): string[] {
  return [
    `${region(facts.metro)}で一人暮らし．仕送りは月 ${yen(facts.allowance)}．`,
    ...(facts.scholarship ? [`奨学金を月 ${yen(facts.scholarship)}借りている．`] : []),
    facts.partTimeHours ? `バイトは月 ${facts.partTimeHours} 時間．` : "バイトはしていない．",
  ];
}

function summerInternLines(facts: Facts<"summerIntern">): string[] {
  switch (facts.result) {
    case "none":
      return ["同級生はインターンに行っている．"];
    case "failed":
      return [`${facts.applications} 社とも落ちた．`];
    case "passed":
      return [
        `${facts.applications} 社中 ${facts.passed} 社に通った．`,
        facts.metro
          ? "5 日間の対面インターンに呼ばれた．"
          : `東京で 5 日間の対面インターン．往復と宿で ${yen(TRIP_YEN.regional)}．`,
      ];
  }
}

function autumnLines(facts: Facts<"autumn">): string[] {
  const event = {
    allowanceCut: `仕送りが月 ${yen(ALLOWANCE_CUT_YEN)}減った．`,
    shopClosed: `バイト先が閉店した．貯金が ${yen(SHOP_CLOSED_LOSS_YEN)}減った．`,
    sick: "一週間，熱が下がらなかった．",
    calm: "何も起きなかった．",
  }[facts.event.kind];
  return [event, ...(facts.invited ? ["インターン先から早期選考の案内が来た．"] : [])];
}

const EARLY = {
  notInvited: "早期選考の案内は来なかった．",
  passed: "早期選考で内定が出た．",
  failed: "早期選考で落ちた．",
} as const;

function finalsLines(facts: Facts<"finals">): string[] {
  const first = `${facts.entries} 社に出して，${facts.firstRound} 社の面接に進んだ．`;
  if (!facts.finals) return [first, "最終面接には進めなかった．"];
  return [
    first,
    facts.metro
      ? `最終面接は ${facts.finals} 社．`
      : `最終面接は東京で ${facts.finals} 社．一社 ${yen(TRIP_YEN.regional)}．`,
  ];
}

function juneLines(facts: Facts<"june">): string[] {
  const result = facts.done
    ? "12月の内定先に行く．"
    : facts.won
      ? `最終面接で ${facts.won} 社から内定．`
      : facts.finalsTaken
        ? "最終面接は全部落ちた．"
        : null;
  return [
    ...(result ? [result] : []),
    facts.offers ? `内定は ${facts.offers} 社．` : "内定はない．",
    ...(facts.scholarshipTotal
      ? [`奨学金の借入は卒業までに ${yen(facts.scholarshipTotal)}．`]
      : []),
  ];
}

const OPTION_LABELS = {
  esFive: "5 社に出す",
  esTwo: "2 社に出す",
  onlineSession: "オンライン説明会に出る",
  keepWorking: "バイトを続ける",
  attend: "行く",
  switchOnline: "オンライン版にしてもらう",
  practice: "面接の練習をする",
  prepareLightly: "少し準備する",
  workMore: "バイトを増やす",
  continue: "第一志望を目指して続ける",
  stop: "ここで終える",
  entryTwenty: "20 社に出す",
  entryEight: "8 社に出す",
  entryThree: "3 社に出す",
  skip: "出さない",
  allFace: "対面で受ける",
  oneFace: "1 社だけ対面，残りはオンライン",
  allOnline: "オンラインで受ける",
  decline: "辞退する",
} as const satisfies Record<OptionKey, string>;

function finalsOptionLabel(count: number, key: OptionKey): string {
  if (count > 1 && key === "allFace") return `${count} 社とも対面で受ける`;
  if (count > 1 && key === "allOnline") return "全部オンラインで受ける";
  return OPTION_LABELS[key];
}

const MISSED = {
  esFive: "5月，ES を 5 社書く時間がなかった",
  esTwo: "5月，ES を書く時間がなかった",
  attend: "8月，対面インターンに行けなかった",
  practice: "10月，面接の練習をする時間がなかった",
  entryTwenty: "3月，20 社に出す時間がなかった",
  entryEight: "3月，8 社に出す時間がなかった",
  allFace: "4月，最終面接を対面で受けられなかった",
  oneFace: "4月，最終面接に一社も対面で行けなかった",
  allOnline: "4月，最終面接を受ける時間がなかった",
} as const satisfies Partial<Record<OptionKey, string>>;

function missedMessage(key: OptionKey): string {
  if (key in MISSED) return MISSED[key as keyof typeof MISSED];
  throw new Error(`option ${key} is never recorded as missed`);
}
