import { expect, test, type Browser, type Page } from "@playwright/test";

import { LINKS } from "../../src/links";
import { pickDifficulty } from "../game_driver";
import {
  type PerformanceBudget as Budget,
  type PerformanceMeasurement,
  type PerformanceMetrics as Metrics,
} from "./performance_report";
import { PERFORMANCE_RESULT_ATTACHMENT } from "./performance_reporter";
import { collectAdaptiveMetrics } from "./performance_sampler";

const NETWORK_LATENCY_MS = 150;
const NETWORK_THROUGHPUT_BYTES_PER_SECOND = (1_600 * 1_024) / 8;
const CPU_SLOWDOWN_RATE = 4;

type ObservedMetrics = {
  blockingTime: number;
  cumulativeLayoutShift: number;
  largestContentfulPaint: number;
};

const BUDGET: Budget = {
  firstContentfulPaint: 2_800,
  largestContentfulPaint: 2_800,
  cumulativeLayoutShift: 0.1,
  blockingTime: 300,
};

/** What a visit does after the page has loaded, before the metrics are read. */
type Scenario = { name: string; interact?: (page: Page) => Promise<void> };

const SCENARIOS: readonly Scenario[] = [
  { name: "top page" },
  {
    // Paint metrics stop at the first input, so this adds starting the year to the top page's.
    name: "game screen",
    interact: async (page) => {
      await pickDifficulty(page);
      await page.locator(".event .next").click();
      await page.locator(".actions .step").waitFor();
    },
  },
];

for (const scenario of SCENARIOS) {
  test(`the ${scenario.name} remains within its performance budget`, async ({
    browser,
    baseURL,
  }) => {
    const { metrics, samples, wasExtended } = await collectAdaptiveMetrics(
      () => measurePage(browser, baseURL!, scenario),
      BUDGET,
    );

    const measurement = {
      budget: BUDGET,
      metrics,
      page: scenario.name,
      samples,
      wasExtended,
    } satisfies PerformanceMeasurement;
    await test.info().attach(PERFORMANCE_RESULT_ATTACHMENT, {
      body: Buffer.from(JSON.stringify(measurement)),
      contentType: "application/json",
    });

    printMetrics(scenario.name, metrics, samples.length);
    expectMetricsWithinBudget(metrics, BUDGET);
  });
}

async function measurePage(
  browser: Browser,
  baseURL: string,
  scenario: Scenario,
): Promise<Metrics> {
  const context = await browser.newContext({
    baseURL,
    serviceWorkers: "block",
    viewport: { width: 1_280, height: 720 },
  });
  try {
    const page = await context.newPage();
    const session = await context.newCDPSession(page);

    await session.send("Network.enable");
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: NETWORK_LATENCY_MS,
      downloadThroughput: NETWORK_THROUGHPUT_BYTES_PER_SECOND,
      uploadThroughput: NETWORK_THROUGHPUT_BYTES_PER_SECOND,
    });
    await session.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN_RATE });
    await installPerformanceObservers(page);
    await page.goto(LINKS.game, { waitUntil: "networkidle" });
    await scenario.interact?.(page);
    await page.waitForTimeout(1_000);

    return await readMetrics(page);
  } finally {
    await context.close();
  }
}

async function installPerformanceObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const metrics: ObservedMetrics = {
      blockingTime: 0,
      cumulativeLayoutShift: 0,
      largestContentfulPaint: 0,
    };
    Object.defineProperty(window, "__performanceBudgetMetrics", { value: metrics });

    observe("largest-contentful-paint", (entry) => {
      metrics.largestContentfulPaint = entry.startTime;
    });
    observe("layout-shift", (entry) => {
      const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
      if (!shift.hadRecentInput) metrics.cumulativeLayoutShift += shift.value;
    });
    observe("longtask", (entry) => {
      metrics.blockingTime += Math.max(0, entry.duration - 50);
    });

    function observe(type: string, record: (entry: PerformanceEntry) => void): void {
      try {
        new PerformanceObserver((list) => list.getEntries().forEach(record)).observe({
          buffered: true,
          type,
        });
      } catch {
        // The assertion catches unsupported metrics as zero values below.
      }
    }
  });
}

async function readMetrics(page: Page): Promise<Metrics> {
  const snapshot = await page.evaluate(() => {
    const observed = (window as typeof window & { __performanceBudgetMetrics: ObservedMetrics })
      .__performanceBudgetMetrics;
    const paint = performance.getEntriesByName("first-contentful-paint")[0];

    return {
      observed,
      firstContentfulPaint: paint?.startTime ?? 0,
    };
  });

  return {
    firstContentfulPaint: snapshot.firstContentfulPaint,
    largestContentfulPaint: snapshot.observed.largestContentfulPaint,
    cumulativeLayoutShift: snapshot.observed.cumulativeLayoutShift,
    blockingTime: snapshot.observed.blockingTime,
  };
}

function expectMetricsWithinBudget(metrics: Metrics, budget: Budget): void {
  expect(metrics.firstContentfulPaint, "first contentful paint (ms)").toBeGreaterThan(0);
  expect(metrics.firstContentfulPaint, "first contentful paint (ms)").toBeLessThanOrEqual(
    budget.firstContentfulPaint,
  );
  expect(metrics.largestContentfulPaint, "largest contentful paint (ms)").toBeGreaterThan(0);
  expect(metrics.largestContentfulPaint, "largest contentful paint (ms)").toBeLessThanOrEqual(
    budget.largestContentfulPaint,
  );
  expect(metrics.cumulativeLayoutShift, "cumulative layout shift").toBeLessThanOrEqual(
    budget.cumulativeLayoutShift,
  );
  expect(metrics.blockingTime, "blocking time (ms)").toBeLessThanOrEqual(budget.blockingTime);
}

function printMetrics(name: string, metrics: Metrics, sampleCount: number): void {
  console.table({
    name,
    samples: sampleCount,
    fcpMs: Math.round(metrics.firstContentfulPaint),
    lcpMs: Math.round(metrics.largestContentfulPaint),
    cls: metrics.cumulativeLayoutShift.toFixed(3),
    blockingMs: Math.round(metrics.blockingTime),
  });
}
