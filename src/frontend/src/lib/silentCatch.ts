/**
 * Wraps a fire-and-forget promise so errors are logged instead of silently swallowed.
 * Use for operations where failure is acceptable but should be visible in dev tools.
 */
export function silentCatch(promise: Promise<unknown>, context: string): void {
  promise.catch((err) => {
    console.warn(`[silentCatch] ${context}:`, err);
  });
}
