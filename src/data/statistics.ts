// Statistics shown in the game, each credited to its publisher.

export interface Statistic {
  readonly text: string;
  readonly source: string;
}

const SOURCES = {
  seikyo: "全国大学生協連 第60回学生生活実態調査（2024）",
  jasso: "日本学生支援機構 令和4年度学生生活調査",
  mynavi: "マイナビ 2026年卒 インターンシップ・就職活動準備に関する調査",
  nikkei: "日経HR 内定者調査2025年版",
  mirai: "就職みらい研究所 就職プロセス調査（2026年卒）",
  indeed: "インディードリクルートパートナーズ 就職プロセス調査（2026年卒）",
} as const;

/** Share of 2026 graduates holding an offer on June 1st; the target of the calibration test. */
export const JUNE_OFFER_RATE = 0.816;

export const STATISTICS = {
  allowance: {
    text: "一人暮らしの大学生の仕送りは平均で月 7万2350円．0円の人は 6.9%．",
    source: SOURCES.seikyo,
  },
  scholarship: { text: "大学生の 55.0% が奨学金を受けている．", source: SOURCES.jasso },
  internship: {
    text: "3年の2月までに，同級生の 85.3% がどこかのインターンに参加していた．平均 5.2 社．",
    source: SOURCES.mynavi,
  },
  earlySelection: {
    text: "インターン経由の早期選考を受けた学生のうち，年内に内定を得たのは 24%．",
    source: SOURCES.nikkei,
  },
  offersFebruary: {
    text: "2月1日の時点で，同級生の 39.3% はもう内定を持っていた．",
    source: SOURCES.mirai,
  },
  offersMarch: {
    text: "3月1日の時点で，同級生の 48.4% はもう内定を持っていた．",
    source: SOURCES.mirai,
  },
  offersJune: {
    text: `6月1日の時点で，同級生の ${(JUNE_OFFER_RATE * 100).toFixed(1)}% が内定を持っていた．`,
    source: SOURCES.indeed,
  },
} as const satisfies Record<string, Statistic>;
