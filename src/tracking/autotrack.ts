/**
 * autotrackRxjs() - Opt-in marker for automatic RxJS tracking
 *
 * This function is a no-op at runtime. Its presence in a file signals
 * to the Vite plugin that this file should:
 * 1. Have rxjs imports redirected to tracked versions
 * 2. Have observables auto-annotated with variable names
 *
 * Usage:
 * ```ts
 * import { autotrackRxjs } from '@tracking/autotrack';
 * autotrackRxjs(); // Enable tracking for this file
 *
 * // Now all rxjs usage in this file is automatically tracked
 * const myData$ = of(1, 2, 3).pipe(map(x => x * 2));
 * ```
 *
 * Files without autotrackRxjs() get regular, untracked rxjs.
 */
export function autotrackRxjs(): void {
  // No-op at runtime - this is a compile-time marker
}
