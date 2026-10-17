import { JUNE_OFFER_RATE } from "../data/statistics";
import { dateOf, WEEKS } from "../engine/calendar";
import type { Event, PricedOption } from "../engine/events";
import type {
  Boost,
  EventFacts,
  LogFact,
  OptionKey,
  RoutineKey,
  SmallEventId,
  Stat,
} from "../engine/facts";
import {
  ALLOWANCE_CUT_YEN,
  FAMILY_TRIP_YEN,
  LAPTOP_REPAIR_YEN,
  PASS,
  SHOP_CLOSED_LOSS_YEN,
  TRIP_YEN,
} from "../engine/parameters";
import type { RoutineSpec } from "../engine/routine";
import { region, yen } from "./format";

// Japanese text for what the engine reports. Wording lives here, never in the engine.

export const STAT_LABELS = {
  health: "健康",
  mind: "心の余裕",
  social: "人間関係",
  research: "研究",
} as const satisfies Record<Stat, string>;

/** The date of a week, e.g. "5月 第2週" or "翌4月 第1週"; the result comes on "6月1日". */
export function weekLabel(week: number): string {
  if (week >= WEEKS) return "6月1日";
  const { month, weekOfMonth, following } = dateOf(week);
  return `${following ? "翌" : ""}${month}月 第${weekOfMonth}週`;
}

interface TableRow {
  readonly label: string;
  readonly value: string;
}

interface EventText {
  readonly lines: readonly string[];
  /** Figures shown under the lines as a labeled table. */
  readonly table?: readonly TableRow[];
  /** Label of the button that moves on from a notice. */
  readonly next?: string;
}

export function describeEvent({ facts }: Event): EventText {
  switch (facts.id) {
    case "intro":
      return { lines: INTRO_LINES, table: introTable(facts), next: "始める" };
    case "internEs":
      return { lines: ["夏インターンの ES の締切が来た．ES は一社 3 時間．"] };
    case "summerIntern":
      return { lines: summerLines(facts), ...(facts.intern === "passed" ? {} : { next: "次へ" }) };
    case "autumn":
      return { lines: [autumnLine(facts)], next: "次へ" };
    case "winterIntern":
      return {
        lines: [
          facts.metro
            ? "冬インターン（3日間）の募集が来た．"
            : `冬インターン（3日間，東京）の募集が来た．往復と宿で ${yen(TRIP_YEN.regional)}．`,
        ],
      };
    case "early":
      return { lines: [EARLY[facts.result]], next: "次へ" };
    case "seniorTalk":
      return { lines: ["先輩から，会社の話を聞かせてもらえることになった．"] };
    case "keepGoing":
      return { lines: ["内定が一つある．就活を続ける？"] };
    case "entries":
      return {
        lines: [
          "本選考のエントリーが始まった．ES は一社 2 時間．",
          ...(facts.busy ? ["ゼミの発表と卒論の締切も重なり，4週間は時間が減る．"] : []),
        ],
      };
    case "finals":
      return { lines: finalsLines(facts), ...(facts.finals ? {} : { next: "次へ" }) };
    case "june":
      return { lines: juneLines(facts), next: "結果を見る" };
    case "over":
      return { lines: [ENDINGS[facts.stat]], next: "結果を見る" };
    default:
      return { lines: [SMALL_EVENT_LINES[facts.id]] };
  }
}

export function optionLabel(option: PricedOption, facts: EventFacts): string {
  if (facts.id === "finals" && facts.finals > 1) {
    if (option.key === "finalsAllFace") return `${facts.finals} 社とも対面で受ける`;
    if (option.key === "finalsAllOnline") return "全部オンラインで受ける";
  }
  return OPTION_LABELS[option.key];
}

/** What an option takes and brings, e.g. "15時間（3週）・3万円・心の余裕 +5". */
export function optionCost({ hours, weeks, money, pay, stats, prep }: PricedOption): string {
  const time = hours ? `${hours}時間${weeks > 1 ? `（${weeks}週）` : ""}` : "";
  const signed = (value: number) => (value < 0 ? `−${-value}` : `+${value}`);
  const statChanges = (Object.keys(STAT_LABELS) as Stat[])
    .filter((stat) => stats?.[stat])
    .map((stat) => `${STAT_LABELS[stat]} ${signed(stats?.[stat] ?? 0)}`);
  const prepChange = prep
    ? `面接・書類の通過率 +${Number((prep * PASS.finalPerPrep * 100).toFixed(2))}%`
    : "";
  return [time, money ? yen(money) : "", pay ? `+${yen(pay)}` : "", ...statChanges, prepChange]
    .filter(Boolean)
    .join("・");
}

export function shortfallReason(shortfall: "time" | "money"): string {
  return shortfall === "time" ? "時間が足りない" : "お金が足りない";
}

export function routineTileLabel(key: RoutineKey): string {
  return ROUTINES[key].tile;
}

/** What a routine takes and gives each week, in numbers. */
export function routineDetail(spec: RoutineSpec): string {
  const percent = (value: number) => `${Number((value * 100).toFixed(2))}%`;
  const effects = [
    spec.prepPerWeek ? `面接・書類の通過率 +${percent(spec.prepPerWeek * PASS.finalPerPrep)}` : "",
    spec.documentPrepPerWeek
      ? `書類の通過率 +${percent(2 * spec.documentPrepPerWeek * PASS.documentPerPrep)}`
      : "",
    spec.inviteBonusPerWeek ? `早期選考の案内 +${percent(spec.inviteBonusPerWeek)}` : "",
    ...(Object.entries(spec.boostsPerWeek) as [Boost, number][]).map(
      ([boost, amount]) => `${BOOST_LABELS[boost]} +${percent(amount)}`,
    ),
    ...(Object.keys(STAT_LABELS) as Stat[])
      .filter((stat) => spec.statsPerWeek[stat])
      .map((stat) => `${STAT_LABELS[stat]} +${spec.statsPerWeek[stat]}`),
    spec.weeklyMoney ? `−${yen(spec.weeklyMoney)}` : "",
    spec.weeklyPay ? `+${yen(spec.weeklyPay)}` : "",
  ].filter(Boolean);
  return `${ROUTINES[spec.key].label}（週${spec.weeklyHours}時間）：${effects.join("・")}／週`;
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
    case "familyIllness":
      return "10月，家族の入院で帰省した";
    case "laptopBroken":
      return "10月，パソコンが壊れた";
    case "earlyOffer":
      return "12月，早期選考で内定";
    case "seniorTalk":
      return "1月，先輩に話を聞いた";
    case "thesisCrunch":
      return "3月，卒論の締切が重なった";
    case "missed":
      return `お金か時間が足りず「${OPTION_LABELS[fact.option]}」ができなかった`;
    case "over":
      return ENDING_LOG[fact.stat];
    case "june":
      return fact.offers ? `6月1日，内定 ${fact.offers} 社` : "6月1日，内定なし";
  }
}

type Facts<Id extends EventFacts["id"]> = Extract<EventFacts, { id: Id }>;

const INTRO_LINES = [
  "就活の1年が始まる．",
  `6月1日（面接解禁）までに，同級生の${Math.round(JUNE_OFFER_RATE * 10)}割が内定を持つ．`,
];

/** The self's situation; allowance and scholarship are left to the status panel. */
function introTable(facts: Facts<"intro">): TableRow[] {
  return [
    { label: "住まい", value: `${region(facts.metro)}で一人暮らし` },
    { label: "自由な時間", value: `週 ${facts.weeklyHours} 時間` },
    ...(facts.weeklyGapYen
      ? [
          { label: "生活費の不足", value: `週 ${yen(facts.weeklyGapYen)}` },
          { label: "埋めるのに要るバイト", value: `週 ${facts.neededWorkHours} 時間` },
        ]
      : [{ label: "生活費の不足", value: "なし" }]),
  ];
}

function summerLines(facts: Facts<"summerIntern">): string[] {
  switch (facts.intern) {
    case "none":
      return ["同級生はインターンに行っている．"];
    case "failed":
      return [`夏インターンは ${facts.applications} 社とも落ちた．`];
    case "passed":
      return [
        `夏インターンは ${facts.applications} 社中 ${facts.passed} 社に通った．`,
        facts.metro
          ? "5 日間の対面インターンに呼ばれた．"
          : `東京で 5 日間の対面インターン．往復と宿で ${yen(TRIP_YEN.regional)}．`,
      ];
  }
}

function autumnLine(facts: Facts<"autumn">): string {
  return {
    allowanceCut: `仕送りが月 ${yen(ALLOWANCE_CUT_YEN)}減った．`,
    shopClosed: `バイト先が閉店した．貯金が ${yen(SHOP_CLOSED_LOSS_YEN)}減った．`,
    sick: "熱が下がらず，2週間ほとんど動けなかった．",
    familyIllness: `家族が入院し，実家に帰った．交通費で ${yen(FAMILY_TRIP_YEN)}かかった．`,
    laptopBroken: `パソコンが壊れた．修理に ${yen(LAPTOP_REPAIR_YEN)}かかった．`,
    calm: "10月は，何も起きなかった．",
  }[facts.event.kind];
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
    ...(facts.reimbursed ? [`うち ${facts.reimbursed} 社は交通費を出してくれる．`] : []),
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
    "就活はこの後も続く．ここでは6月1日の時点で比べている．",
  ];
}

const ENDINGS = {
  health: "体を壊して入院した．就活どころではなくなった．",
  mind: "心が折れて，就活を続けられなくなった．",
  social: "誰とも話さない日が続き，大学に行けなくなった．",
  research: "研究が進まず，留年が決まった．",
} as const satisfies Record<Stat, string>;

const ENDING_LOG = {
  health: "体を壊して，就活を続けられなくなった",
  mind: "心が折れて，就活を続けられなくなった",
  social: "大学に行けなくなった",
  research: "留年が決まった",
} as const satisfies Record<Stat, string>;

const BOOST_LABELS = {
  internEs: "夏インターンの ES 通過率",
  early: "早期選考の通過率",
  entryEs: "本選考の ES 通過率",
  final: "最終面接の通過率",
} as const satisfies Record<Boost, string>;

const SMALL_EVENT_LINES = {
  gwTrip: "ゴールデンウィーク，友達に旅行に誘われた．",
  seminarTalk: "ゼミの発表を頼まれた．",
  summerCamp: "サークルの合宿に誘われた．",
  extraShift: "バイト先から，シフトを増やしてほしいと頼まれた．",
  obChance: "OB に話を聞ける機会がある．",
  yearEnd: "年末，実家に帰る？",
  midterm: "卒論の中間発表が近い．",
  studyGroup: "就活仲間に，面接の練習会に誘われた．",
} as const satisfies Record<SmallEventId, string>;

const OPTION_LABELS = {
  esFive: "5 社に出す",
  esTwo: "2 社に出す",
  esNone: "出さない",
  faceIntern: "対面で行く",
  onlineIntern: "オンライン版にしてもらう",
  declineIntern: "辞退する",
  goWinter: "行く",
  skipWinter: "行かない",
  meetSenior: "話を聞く",
  passSenior: "見送る",
  continue: "第一志望を目指して続ける",
  stop: "ここで終える",
  entryTwenty: "20 社にエントリー",
  entryEight: "8 社にエントリー",
  entryThree: "3 社にエントリー",
  entryNone: "今はエントリーしない",
  finalsAllFace: "対面で受ける",
  finalsOneFace: "1 社だけ対面，残りはオンライン",
  finalsAllOnline: "オンラインで受ける",
  finalsDecline: "辞退する",
  tripGo: "行く",
  tripSkip: "断る",
  seminarTake: "引き受ける",
  seminarDecline: "断る",
  campJoin: "参加する",
  campSkip: "参加しない",
  shiftYes: "増やす",
  shiftNo: "断る",
  obVisit: "話を聞きに行く",
  obSkip: "行かない",
  homeGo: "帰る",
  homeStay: "帰らない",
  midtermPrep: "しっかり準備する",
  midtermMinimal: "最低限で済ませる",
  studyJoin: "参加する",
  studySkip: "参加しない",
} as const satisfies Record<OptionKey, string>;

const ROUTINES = {
  selfAnalysis: { tile: "自己分析", label: "自己分析・業界研究" },
  infoSessions: { tile: "説明会", label: "説明会に出る" },
  interviewPractice: { tile: "面接練習", label: "面接の練習" },
  jobCourse: { tile: "就活講座", label: "就活講座に通う" },
  longIntern: { tile: "長期インターン", label: "長期インターン" },
  certification: { tile: "資格の勉強", label: "資格の勉強" },
  friends: { tile: "友達と遊ぶ", label: "友達と遊ぶ・サークル" },
  sns: { tile: "SNS・動画", label: "SNS・動画" },
  research: { tile: "研究・ゼミ", label: "研究・ゼミ" },
  rest: { tile: "ゆっくり休む", label: "ゆっくり休む" },
  extraWork: { tile: "バイト", label: "バイト" },
  moreWork: { tile: "バイト（多め）", label: "バイト（多め）" },
  summerEsPrep: { tile: "夏インターンのES対策", label: "夏インターンの ES 対策" },
  earlyPrep: { tile: "早期選考の対策", label: "早期選考の対策" },
  entryPrep: { tile: "本選考のES準備", label: "本選考の ES 準備" },
  finalPrep: { tile: "最終面接の対策", label: "最終面接の対策" },
} as const satisfies Record<RoutineKey, { tile: string; label: string }>;
