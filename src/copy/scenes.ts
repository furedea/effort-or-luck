import { STATISTICS, type Statistic } from "../data/statistics";
import type { Scene } from "../engine/choice";
// Japanese text for what the engine reports. Wording lives here, never in the engine.
import type { LogFact, OptionKey, ResultFact, SceneFacts, Shortfall } from "../engine/facts";
import {
  ALLOWANCE_CUT_YEN,
  MONTHLY_EXPENSE_YEN,
  SHOP_CLOSED_LOSS_YEN,
  TRIP_YEN,
} from "../engine/parameters";
import { region, yen } from "./format";

interface SceneText {
  readonly when: string;
  readonly lines: readonly string[];
  readonly stats: readonly Statistic[];
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
      return {
        when,
        lines: introLines(facts),
        stats: facts.scholarship
          ? [STATISTICS.allowance, STATISTICS.scholarship]
          : [STATISTICS.allowance],
        next: "就活を始める",
      };
    case "summerEs":
      return {
        when,
        lines: ["夏のインターンの募集が始まった．", "エントリーシートは一社に 6 時間かかる．"],
        stats: [STATISTICS.internship],
      };
    case "summerIntern":
      return { when, lines: summerInternLines(facts), stats: [] };
    case "autumn":
      return { when, lines: autumnLines(facts), stats: [] };
    case "early":
      return facts.result === "notInvited"
        ? {
            when,
            lines: [
              "12月．早期選考の案内は来ていない．",
              ...(facts.hadIntern ? [] : ["案内の多くは，インターンに来た学生に届く．"]),
            ],
            stats: [],
          }
        : {
            when,
            lines: [
              "12月，早期選考の面接．",
              facts.result === "passed" ? "内定が出た．" : "通らなかった．",
            ],
            stats: [STATISTICS.earlySelection],
          };
    case "feb":
      return {
        when,
        lines: [
          facts.hasOffer
            ? "2月1日．あなたは内定を一つ持っている．"
            : "2月1日．あなたはまだ内定を持っていない．",
        ],
        stats: [STATISTICS.offersFebruary],
      };
    case "march":
      return {
        when,
        lines: ["3月1日．エントリーが一斉に始まる．", "エントリーシートは一社 2 時間．"],
        stats: [STATISTICS.offersMarch],
      };
    case "finals":
      return { when, lines: finalsLines(facts), stats: [] };
    case "june":
      return {
        when,
        lines: juneLines(facts),
        stats: [STATISTICS.offersJune],
        next: "100 人のあなたを見る",
      };
  }
}

export function optionLabel(facts: SceneFacts, key: OptionKey): string {
  if (facts.id === "finals") return finalsOptionLabel(facts.finals, key);
  if (facts.id === "march" && key === "skip") return "今はエントリーしない";
  return OPTION_LABELS[key];
}

export function shortfallReason(shortfall: Shortfall | null): string {
  if (shortfall === "time") return "時間が足りない．バイトを減らす貯金もない．";
  if (shortfall === "money") return "お金が足りない．";
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
      return "夏のインターンはどこも通らなかった";
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
      return missedMessage(fact.scene, fact.option);
    case "june":
      return fact.offers ? `6月1日，内定 ${fact.offers} 社` : "6月1日，内定なし";
  }
}

type Facts<Id extends SceneFacts["id"]> = Extract<SceneFacts, { id: Id }>;

function introLines(facts: Facts<"intro">): string[] {
  return [
    "大学3年の4月．一人暮らしをしている．",
    `仕送りは月 ${yen(facts.allowance)}．`,
    `住んでいるのは${region(facts.metro)}．`,
    ...(facts.scholarship
      ? [`足りない分は奨学金で借りている．月 ${yen(facts.scholarship)}．`]
      : []),
    facts.partTimeHours
      ? `生活費は月 ${yen(MONTHLY_EXPENSE_YEN)}．だからバイトを月 ${facts.partTimeHours} 時間入れている．`
      : `生活費は月 ${yen(MONTHLY_EXPENSE_YEN)}．仕送りで足りるので，バイトはしていない．`,
    `授業とバイトを除くと，就活に使える時間は月 ${facts.freeHours} 時間．`,
    `貯金は ${yen(facts.money)}．`,
  ];
}

function summerInternLines(facts: Facts<"summerIntern">): string[] {
  switch (facts.result) {
    case "none":
      return ["8月．同級生たちはインターンに行っている．"];
    case "failed":
      return [`${facts.applications} 社に出して，どこも通らなかった．`];
    case "passed":
      return [
        `${facts.applications} 社に出して，${facts.passed} 社が通った．`,
        `そのうち一社は，${facts.metro ? "都内" : "東京"}で 5 日間の対面インターン．`,
        ...(facts.metro ? [] : [`東京までの往復と 4 泊で，${yen(TRIP_YEN.regional)}かかる．`]),
        "5 日間，バイトには入れない．",
      ];
  }
}

function autumnLines(facts: Facts<"autumn">): string[] {
  const invite = facts.invited ? ["夏のインターン先から，早期選考の案内が来た．"] : [];
  switch (facts.event.kind) {
    case "allowanceCut":
      return [
        `実家から電話があった．親の仕事が減って，来月から仕送りを月 ${yen(ALLOWANCE_CUT_YEN)}減らしたいと．`,
        `バイトを増やすしかない．就活に使える時間は月 ${facts.event.freeHours} 時間になった．`,
        ...invite,
      ];
    case "shopClosed":
      return [
        `バイト先が閉店した．次のバイトが見つかるまで 3 週間かかり，貯金を ${yen(SHOP_CLOSED_LOSS_YEN)}崩した．`,
        ...invite,
      ];
    case "sick":
      return ["10月，熱が一週間下がらなかった．", ...invite];
    case "calm":
      return ["10月は，何も起きなかった．", ...invite];
  }
}

function finalsLines(facts: Facts<"finals">): string[] {
  const lines = [`${facts.entries} 社に出して，${facts.firstRound} 社の面接に進んだ．`];
  if (!facts.finals) return [...lines, "最終面接まで進んだ会社はなかった．"];
  return [
    ...lines,
    `そのうち ${facts.finals} 社が最終面接．会場は${facts.metro ? "都内" : "東京"}の本社．`,
    ...(facts.metro ? [] : [`一社ごとに，往復と一泊で ${yen(TRIP_YEN.regional)}．`]),
  ];
}

function juneLines(facts: Facts<"june">): string[] {
  const result = facts.done
    ? ["あなたは 12月の内定先に行く．"]
    : facts.won
      ? [`最終面接の結果が出た．${facts.won} 社から内定．`]
      : facts.finalsTaken
        ? ["最終面接は，どこも通らなかった．"]
        : [];
  return [
    "6月1日．",
    ...result,
    facts.offers
      ? `あなたは内定を ${facts.offers} つ持っている．`
      : "あなたは，内定を持っていない．",
    ...(facts.scholarshipTotal
      ? [`借りた奨学金は，卒業までに ${yen(facts.scholarshipTotal)}になる．`]
      : []),
  ];
}

const OPTION_LABELS = {
  esFive: "5 社に出す",
  esTwo: "2 社に出す",
  onlineSession: "オンラインの 1 日説明会に出る",
  keepWorking: "バイトを続ける",
  attend: "行く",
  switchOnline: "1 日のオンライン版に替えてもらう",
  practice: "面接の練習に時間を使う",
  prepareLightly: "少しだけ準備する",
  workMore: "バイトを増やして，春の交通費を貯める",
  continue: "第一志望を目指して続ける",
  stop: "ここで就活を終える",
  entryTwenty: "20 社にエントリーする",
  entryEight: "8 社にエントリーする",
  entryThree: "3 社にエントリーする",
  skip: "今は出さない",
  allFace: "対面で受ける",
  oneFace: "1 社だけ対面で，残りはオンラインを頼む",
  allOnline: "オンラインを頼む",
  decline: "辞退する",
} as const satisfies Record<OptionKey, string>;

function finalsOptionLabel(count: number, key: OptionKey): string {
  if (count > 1 && key === "allFace") return `${count} 社とも対面で受ける`;
  if (count > 1 && key === "allOnline") return "全部オンラインを頼む";
  return OPTION_LABELS[key];
}

const MISSED = {
  esFive: "5月，インターンの ES を 5 社書く時間がなかった",
  esTwo: "5月，インターンの ES を書く時間がなかった",
  attend: "8月の対面インターンに行けなかった",
  practice: "秋，面接の練習をする時間がなかった",
  entryTwenty: "3月，20 社に出す時間がなかった",
  entryEight: "3月，8 社に出す時間がなかった",
  oneFace: "4月，最終面接に一社も対面で行けなかった",
  allOnline: "4月，最終面接を受ける時間がなかった",
} as const satisfies Partial<Record<OptionKey, string>>;

function missedMessage(scene: SceneFacts, key: OptionKey): string {
  if (key === "allFace") {
    const count = scene.id === "finals" ? scene.finals : 1;
    return `4月，最終面接${count > 1 ? "を全部" : "に"}対面で受けられなかった`;
  }
  if (key in MISSED) return MISSED[key as keyof typeof MISSED];
  throw new Error(`option ${key} is never recorded as missed`);
}
