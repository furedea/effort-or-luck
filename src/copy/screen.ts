import { JUNE_OFFER_RATE, SOURCES } from "../data/statistics";
import type { SceneTag } from "../engine/cohort";
// Japanese text for the 100-selves screen around the scenes themselves.
import type { LogFact, SceneId } from "../engine/facts";
import {
  METRO_SHARE,
  MONTHLY_HOURS,
  STARTING_MONEY_YEN,
  WAGE_YEN_PER_HOUR,
} from "../engine/parameters";
import { yen } from "./format";
import { describeLog } from "./scenes";

/** A run of text; `strong` runs are emphasized on screen. */
export type Segment = { readonly text: string; readonly strong?: true };

export type View = "same" | "most" | "least";

export const TITLE = "100人のあなた";

export const MONTHS = [
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
];

const MONTH_INDEX = {
  intro: 0,
  summerEs: 1,
  summerIntern: 4,
  autumn: 6,
  early: 8,
  feb: 10,
  march: 11,
  finals: 12,
  june: 14,
} as const satisfies Record<SceneId, number>;

export const YEAR_END_MONTH = MONTH_INDEX.june;

export function monthIndex(id: SceneId): number {
  return MONTH_INDEX[id];
}

export const LEDGER = {
  offered: "内定を持っている",
  broke: "貯金が1万円を切った",
  busy: "就活に使える時間が月20時間未満",
} as const;

export const LEGEND = {
  early: "年内に内定",
  offer: "6月1日までに内定",
  blocked: "今月，選んだことができなかった",
} as const;

export const GRID_LABEL = "100人のあなた";
export const AXIS = "左上ほど仕送りが少なく，右下ほど多い．マスに触れると，その人の一年が見える．";
export const CHOOSE_PROMPT =
  "選んだことは，100 人全員がやろうとする．できない人は，一つ下の選択になる．";
export const NEXT_MONTH = "次の月へ";
export const NEXT = "次へ";
export const FINISHED_HUNTING = "このあなたは，もう就活を終えている．";
export const COULD_NOT = "このあなたには，それができなかった．";
export const SAME_LUCK = "同じ運のまま，選択だけ変えると";
export const TRY_OTHER_CHOICES = "同じ 100 人の運のまま，選び方だけを変えてみる．";
export const PLAY_AGAIN = "別の 100 人で，もう一度";

export const VIEWS = [
  ["same", "あなたの選択"],
  ["most", "いつも一番頑張る方"],
  ["least", "いつも一番楽な方"],
] as const satisfies readonly (readonly [View, string])[];

export function people(count: number): string {
  return `${count} 人`;
}

export function legendAllowance(amount: number, count: number): string {
  return `仕送り ${yen(amount)}　${people(count)}`;
}

export function selfName(index: number): string {
  return `${index + 1} 人目のあなた`;
}

export function cellLabel(index: number, profile: LogFact | undefined): string {
  return `${index + 1} 人目，${profile ? describeLog(profile) : ""}`;
}

export function selfStatus(money: number, freeHours: number): string {
  return `貯金 ${yen(money)}　時間 月${freeHours}時間`;
}

export function cannotChoose(reason: string): string {
  return `このあなたには無理だ．${reason}`;
}

export function ableCount(active: number): string {
  return ` / ${active} 人が選べる`;
}

export function introSummary(
  allowances: readonly { amount: number; count: number }[],
  metro: number,
  size: number,
): Segment[] {
  return [
    {
      text: `あなたは ${size} 人いる．全員が大学3年の4月で，一人暮らしをしている．仕送りは人によって違う．`,
    },
    ...allowances.flatMap(({ amount, count }, k) => [
      { text: `${yen(amount)}が ${count} 人`, strong: true } as const,
      { text: k < allowances.length - 1 ? "，" : "．" },
    ]),
    {
      text: `首都圏に住むのは ${metro} 人，地方は ${size - metro} 人．これから，${size} 人全員が同じ選択をする．`,
    },
  ];
}

const TAG_LABELS: Partial<Record<SceneId, readonly (readonly [SceneTag, string])[]>> = {
  summerIntern: [
    ["passed", "一社以上通った"],
    ["failed", "どこも通らなかった"],
    ["none", "出していない"],
  ],
  autumn: [
    ["calm", "何も起きなかった"],
    ["allowanceCut", "仕送りが減った"],
    ["shopClosed", "バイト先が閉店した"],
    ["sick", "熱を出した"],
    ["invite", "早期選考の案内が来た"],
  ],
  early: [
    ["passed", "早期選考で内定が出た"],
    ["failed", "早期選考で落ちた"],
    ["notInvited", "案内が来なかった"],
  ],
  feb: [
    ["offer", "内定を持っている"],
    ["none", "まだ持っていない"],
  ],
  finals: [
    ["final", "最終面接まで進んだ"],
    ["noFinal", "最終面接まで進めなかった"],
  ],
};

/** How the month went across the selves still hunting, by what happened to them. */
export function monthSummary(
  id: SceneId,
  tagCounts: ReadonlyMap<SceneTag, number>,
  active: number,
  size: number,
): Segment[] {
  const labels = TAG_LABELS[id];
  const everyone = active === size;
  if (!labels) {
    return [
      {
        text: everyone
          ? `${size} 人全員が，同じ月を迎えた．`
          : `就活を続けているのは ${active} 人．`,
      },
    ];
  }
  const parts = labels
    .map(([tag, label]) => [label, tagCounts.get(tag) ?? 0] as const)
    .filter(([, count]) => count > 0);
  return [
    { text: everyone ? `${size} 人のうち，` : `就活を続けている ${active} 人のうち，` },
    ...parts.flatMap(([label, count], k) => [
      { text: `${label}のは` },
      { text: ` ${people(count)}`, strong: true } as const,
      { text: k < parts.length - 1 ? "，" : "．" },
    ]),
  ];
}

export function turnOutcome(did: number, blocked: number, absent: number): Segment[] {
  return [
    { text: `同じことができたのは ${people(did)}．` },
    ...(blocked
      ? [
          { text: "お金か時間が足りず，できなかったのは " },
          { text: people(blocked), strong: true } as const,
          { text: "．" },
        ]
      : []),
    ...(absent > 0 ? [{ text: `${people(absent)}には，その選択肢がなかった．` }] : []),
  ];
}

export function yearEndSummary(
  view: View,
  offered: number,
  early: number,
  size: number,
): Segment[] {
  const label = VIEWS.find(([key]) => key === view)?.[1] ?? "";
  return [
    { text: `6月1日．${label}を選び続けた ${size} 人のうち，内定を持っているのは` },
    { text: ` ${people(offered)}`, strong: true },
    { text: `．年内に決まったのは ${people(early)}．` },
  ];
}

/** One self's year as a sentence, leaving out the profile and scholarship it started with. */
export function pathText(log: readonly LogFact[]): string {
  const steps = log.filter((fact) => fact.kind !== "profile" && fact.kind !== "scholarship");
  return steps.map(describeLog).join("．") + "．";
}

export function sourcesNote(): string {
  return "数字の出典　" + Object.values(SOURCES).join("．") + "．";
}

export function assumptionsNote(): string {
  return (
    "仕送りの分布，奨学金，インターン参加率，各時点の内定率は調査の数字です．合否の確率は，この試作の仮定です．" +
    `中くらいの選択を続けた場合の 6月1日の内定率が，実際の ${(JUNE_OFFER_RATE * 100).toFixed(1)}% に近くなるよう合わせています．` +
    `時給は ${WAGE_YEN_PER_HOUR.toLocaleString("ja-JP")} 円，授業とバイト以外の時間は月 ${MONTHLY_HOURS} 時間，` +
    `最初の貯金は ${yen(STARTING_MONEY_YEN)}，首都圏に住む人は ${METRO_SHARE * 10} 割と置きました．`
  );
}
