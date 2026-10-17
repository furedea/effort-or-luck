import type { ActivitySpec } from "../engine/activities";
import type { ActivityKey, LogFact, PeriodId, SceneFacts, Stat } from "../engine/facts";
import {
  ALLOWANCE_CUT_YEN,
  FAMILY_TRIP_YEN,
  LAPTOP_REPAIR_YEN,
  SHOP_CLOSED_LOSS_YEN,
  TRIP_YEN,
} from "../engine/parameters";
import type { Scene } from "../engine/plan";
import { region, yen } from "./format";

// Japanese text for what the engine reports. Wording lives here, never in the engine.

interface SceneText {
  readonly when: string;
  readonly lines: readonly string[];
  /** Label of the button that moves on from a notice. */
  readonly next?: string;
}

export const STAT_LABELS = {
  health: "健康",
  mind: "心の余裕",
  social: "人間関係",
  research: "研究",
} as const satisfies Record<Stat, string>;

const WHEN = {
  intro: "3年 4月",
  earlySummer: "3年 5〜7月",
  summer: "3年 8〜9月",
  autumn: "3年 10〜12月",
  early: "3年 12月",
  winter: "4年 1〜2月",
  march: "4年 3月",
  finals: "4年 4〜5月",
  june: "4年 6月1日",
  over: "その後",
} as const satisfies Record<SceneFacts["id"], string>;

const PERIOD_SHORT = {
  earlySummer: "5〜7月",
  summer: "8〜9月",
  autumn: "10〜12月",
  winter: "1〜2月",
  march: "3月",
  finals: "4〜5月",
} as const satisfies Record<PeriodId, string>;

export function describeScene({ facts }: Scene): SceneText {
  const when = WHEN[facts.id];
  switch (facts.id) {
    case "intro":
      return { when, lines: introLines(facts), next: "始める" };
    case "earlySummer":
      return { when, lines: ["夏のインターンの募集が始まった．", "この3か月の時間を，何に使う？"] };
    case "summer":
      return { when, lines: [...summerLines(facts), "夏休み．この2か月を，何に使う？"] };
    case "autumn":
      return { when, lines: [autumnLine(facts), "秋から年末まで，何に使う？"] };
    case "early":
      return { when, lines: [EARLY[facts.result]] };
    case "winter":
      return {
        when,
        lines: [
          facts.hasOffer ? "内定が一つある．" : "まだ内定はない．",
          ...(facts.seniorTalk ? ["先輩から，会社の話を聞かせてもらえることになった．"] : []),
        ],
      };
    case "march":
      return {
        when,
        lines: [
          "本選考のエントリーが始まった．",
          ...(facts.busy ? ["ゼミの発表と卒論の締切が重なり，時間が減った．"] : []),
        ],
      };
    case "finals":
      return { when, lines: finalsLines(facts) };
    case "june":
      return { when, lines: juneLines(facts), next: "結果を見る" };
    case "over":
      return { when, lines: [ENDINGS[facts.stat]], next: "結果を見る" };
  }
}

export function activityLabel(activity: ActivitySpec, facts: SceneFacts): string {
  if (facts.id === "finals" && facts.finals > 1) {
    if (activity.key === "finalsAllFace") return `${facts.finals} 社とも対面で受ける`;
    if (activity.key === "finalsAllOnline") return "全部オンラインで受ける";
  }
  return ACTIVITIES[activity.key].label;
}

/** The short name written on an activity's tile. */
export function activityTileLabel(activity: ActivitySpec, facts: SceneFacts): string {
  if (facts.id === "finals" && facts.finals > 1 && activity.key === "finalsAllFace") {
    return `${facts.finals}社とも対面`;
  }
  return TILE_LABELS[activity.key];
}

/** One line explaining an activity, e.g. "自己分析・業界研究：準備がよく進む". */
export function activityDetail(activity: ActivitySpec, facts: SceneFacts): string {
  const oneOf = activity.group ? "（どれか一つ）" : "";
  return `${activityLabel(activity, facts)}：${ACTIVITIES[activity.key].effect}${oneOf}`;
}

/** What an activity takes and gives, e.g. "15時間" "3万円" "+14万800円". */
export function activityCost({ hours, money, pays }: ActivitySpec): string[] {
  return [hours ? `${hours}時間` : "", money ? yen(money) : "", pays ? `+${yen(pays)}` : ""].filter(
    Boolean,
  );
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
    case "dropped":
      return `${PERIOD_SHORT[fact.period]}，お金が足りず「${ACTIVITIES[fact.activity].label}」をあきらめた`;
    case "over":
      return ENDING_LOG[fact.stat];
    case "june":
      return fact.offers ? `6月1日，内定 ${fact.offers} 社` : "6月1日，内定なし";
  }
}

type Facts<Id extends SceneFacts["id"]> = Extract<SceneFacts, { id: Id }>;

function introLines(facts: Facts<"intro">): string[] {
  return [
    facts.allowance
      ? `${region(facts.metro)}で一人暮らし．仕送りは月 ${yen(facts.allowance)}．`
      : `${region(facts.metro)}で一人暮らし．仕送りはない．`,
    ...(facts.scholarship ? [`奨学金を月 ${yen(facts.scholarship)}借りている．`] : []),
    facts.partTimeHours
      ? `生活費のため，バイトは月 ${facts.partTimeHours} 時間．`
      : "バイトはしていない．",
    `授業や課題のほかに，自由に使える時間は週 ${facts.weeklyFreeHours} 時間．`,
  ];
}

function summerLines(facts: Facts<"summer">): string[] {
  switch (facts.intern) {
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

function autumnLine(facts: Facts<"autumn">): string {
  return {
    allowanceCut: `仕送りが月 ${yen(ALLOWANCE_CUT_YEN)}減った．`,
    shopClosed: `バイト先が閉店した．貯金が ${yen(SHOP_CLOSED_LOSS_YEN)}減った．`,
    sick: "一週間，熱が下がらなかった．",
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

const ACTIVITIES = {
  internEsFive: { label: "夏インターンに ES を出す（5社）", effect: "5社に応募" },
  internEsTwo: { label: "夏インターンに ES を出す（2社）", effect: "2社に応募" },
  infoSessions: { label: "説明会に6回出る", effect: "準備が進む" },
  selfAnalysis: { label: "自己分析・業界研究", effect: "準備がよく進む" },
  jobCourse: { label: "就活講座に通う", effect: "準備がかなり進む" },
  jobFair: { label: "合同説明会に行く", effect: "準備が進む" },
  faceIntern: { label: "対面インターンに行く（5日間）", effect: "早期選考の案内が来やすい" },
  onlineIntern: { label: "オンライン版にしてもらう（1日）", effect: "早期選考の案内が少し来る" },
  oneDayJobs: { label: "1日の仕事体験に3回", effect: "準備が進む" },
  longIntern: { label: "長期インターン（有給，週16時間）", effect: "準備がかなり進む．給料が出る" },
  languageCourse: { label: "短期の語学研修", effect: "準備がかなり進む" },
  winterIntern: { label: "冬インターン（3日間）", effect: "早期選考の案内が来やすい" },
  interviewPractice: { label: "面接の練習", effect: "面接に強くなる" },
  aptitudePrep: { label: "適性検査の対策", effect: "書類が通りやすい" },
  seniorTalk: { label: "先輩に話を聞く", effect: "準備がよく進む" },
  obVisits: { label: "東京で OB 訪問（5人）", effect: "準備がよく進む" },
  paidMockInterviews: { label: "有料の模擬面接（3回）", effect: "面接に強くなる" },
  stopHunting: { label: "ここで就活を終える", effect: "このあとは就活をしない" },
  entryTwenty: { label: "20 社にエントリー", effect: "20社に応募" },
  entryEight: { label: "8 社にエントリー", effect: "8社に応募" },
  entryThree: { label: "3 社にエントリー", effect: "3社に応募" },
  companyTalks: { label: "説明会・座談会を回る（8回）", effect: "準備が進む" },
  finalsAllFace: { label: "対面で受ける", effect: "一番通りやすい" },
  finalsOneFace: { label: "1 社だけ対面，残りはオンライン", effect: "対面の1社は通りやすい" },
  finalsAllOnline: { label: "オンラインで受ける", effect: "少し通りにくい" },
  interviewService: { label: "面接対策サービス", effect: "面接に強くなる" },
  friends: { label: "友達と遊ぶ・サークル", effect: "心と人間関係が回復．ES の話も増える" },
  sns: { label: "SNS・動画", effect: "心が少し回復．就活の情報が入る" },
  certification: { label: "資格の勉強", effect: "書類が通りやすい" },
  research: { label: "研究・ゼミ", effect: "研究が進む" },
  rest: { label: "ゆっくり休む", effect: "健康が回復" },
} as const satisfies Record<ActivityKey, { label: string; effect: string }>;

const TILE_LABELS = {
  internEsFive: "ES 5社",
  internEsTwo: "ES 2社",
  infoSessions: "説明会6回",
  selfAnalysis: "自己分析",
  jobCourse: "就活講座",
  jobFair: "合同説明会",
  faceIntern: "対面インターン",
  onlineIntern: "オンライン版",
  oneDayJobs: "仕事体験3回",
  longIntern: "長期インターン",
  languageCourse: "語学研修",
  winterIntern: "冬インターン",
  interviewPractice: "面接練習",
  aptitudePrep: "適性検査対策",
  seniorTalk: "先輩の話",
  obVisits: "OB訪問5人",
  paidMockInterviews: "模擬面接3回",
  stopHunting: "就活を終える",
  entryTwenty: "20社エントリー",
  entryEight: "8社エントリー",
  entryThree: "3社エントリー",
  companyTalks: "座談会8回",
  finalsAllFace: "対面で受ける",
  finalsOneFace: "1社だけ対面",
  finalsAllOnline: "オンラインで",
  interviewService: "面接対策",
  friends: "友達と遊ぶ",
  sns: "SNS・動画",
  certification: "資格の勉強",
  research: "研究・ゼミ",
  rest: "ゆっくり休む",
} as const satisfies Record<ActivityKey, string>;
