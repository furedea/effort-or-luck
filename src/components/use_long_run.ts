import { useEffect, useState } from "react";

import type { View } from "../copy/screen";
import type { Effort, SceneId } from "../engine/facts";
import { longRunByAllowance } from "../engine/long_run";

const FIXED_EFFORT = { most: 2, least: 0 } as const;

/**
 * Long-run offer rates per allowance for the choices behind `view`, computed after the
 * screen is drawn and remembered per view; null until ready.
 */
export function useLongRun(
  wants: Readonly<Partial<Record<SceneId, Effort>>>,
  view: View,
): readonly number[] | null {
  const [rates, setRates] = useState<Partial<Record<View, readonly number[]>>>({});
  const ready = rates[view] !== undefined;
  useEffect(() => {
    if (ready) return undefined;
    const wantFor =
      view === "same" ? (month: SceneId) => wants[month] ?? 1 : () => FIXED_EFFORT[view];
    const timer = setTimeout(() => {
      setRates((known) => ({ ...known, [view]: longRunByAllowance(wantFor) }));
    }, 0);
    return () => clearTimeout(timer);
  }, [ready, view, wants]);
  return rates[view] ?? null;
}
