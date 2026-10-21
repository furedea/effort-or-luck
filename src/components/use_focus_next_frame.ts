import { useEffect, type RefObject } from "react";

/**
 * Moves keyboard focus to `ref` whenever `key` changes to a truthy value. Focusing forces a
 * layout, so it waits for the next frame instead of lengthening the task that rendered the change.
 */
export function useFocusNextFrame(ref: RefObject<HTMLElement | null>, key: unknown): void {
  useEffect(() => {
    if (!key) return undefined;
    const frame = requestAnimationFrame(() => ref.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [ref, key]);
}
