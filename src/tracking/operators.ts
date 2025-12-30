/**
 * Auto-decorated RxJS operators
 *
 * Re-exports all RxJS operators with automatic name annotation.
 * Import from here instead of 'rxjs/operators' to get proper operator names
 * in devtools tracking.
 *
 * Usage:
 *   import { map, filter, switchMap } from './tracking/operators';
 *   // Instead of: import { map, filter, switchMap } from 'rxjs/operators';
 *
 * Note: share/shareReplay work generically via constructor-proxy.ts
 * which intercepts Subject creation to capture context.
 *
 * Higher-order operators (switchMap, mergeMap, etc.) are specially wrapped
 * to push operatorContext when their project functions execute.
 */

import * as rxjsOps from "rxjs/operators"
// Import specially-wrapped higher-order operators
import {
  concatMap as wrappedConcatMap,
  exhaustMap as wrappedExhaustMap,
  expand as wrappedExpand,
  flatMap as wrappedFlatMap,
  mergeMap as wrappedMergeMap,
  switchMap as wrappedSwitchMap,
} from "./higher-order-wrapper"
import { annotateOperator } from "./pipe-patch"

/**
 * Wraps all operator factories to auto-annotate the returned OperatorFunction
 */
function autoDecorateAll<T extends Record<string, any>>(ops: T): T {
  const result: any = {}
  for (const [name, op] of Object.entries(ops)) {
    if (typeof op === "function") {
      // Wrap the operator factory to annotate its result
      result[name] = (...args: any[]) => annotateOperator(op(...args), name)
    } else {
      // Pass through non-functions (constants, types, etc.)
      result[name] = op
    }
  }
  return result
}

const decorated = autoDecorateAll(rxjsOps)

// Export all decorated operators
export const {
  // Transformation
  map,
  mapTo,
  scan,
  reduce,
  pluck,
  // NOTE: switchMap, mergeMap, concatMap, exhaustMap, expand are exported separately below
  // (they need special wrapping to push operatorContext)
  groupBy,
  pairwise,
  partition,
  buffer,
  bufferCount,
  bufferTime,
  bufferToggle,
  bufferWhen,
  window,
  windowCount,
  windowTime,
  windowToggle,
  windowWhen,

  // Filtering
  filter,
  take,
  takeUntil,
  takeWhile,
  takeLast,
  skip,
  skipUntil,
  skipWhile,
  skipLast,
  first,
  last,
  single,
  distinct,
  distinctUntilChanged,
  distinctUntilKeyChanged,
  debounce,
  debounceTime,
  throttle,
  throttleTime,
  audit,
  auditTime,
  sample,
  sampleTime,
  ignoreElements,
  elementAt,

  // Combination
  combineLatestWith,
  concatWith,
  mergeWith,
  zipWith,
  startWith,
  endWith,
  withLatestFrom,
  combineLatestAll,
  concatAll,
  mergeAll,
  switchAll,
  exhaustAll,
  zipAll,

  // Multicasting (share/shareReplay tracked via constructor-proxy)
  share,
  shareReplay,
  publish,
  publishBehavior,
  publishLast,
  publishReplay,
  multicast,
  refCount,
  connect,

  // Error handling
  catchError,
  retry,
  retryWhen,

  // Utility
  tap,
  delay,
  delayWhen,
  timeout,
  timeoutWith,
  toArray,
  defaultIfEmpty,
  throwIfEmpty,
  finalize,
  repeat,
  repeatWhen,
  observeOn,
  subscribeOn,
  timeInterval,
  timestamp,
  materialize,
  dematerialize,

  // Conditional
  every,
  find,
  findIndex,
  isEmpty,
  count,
  max,
  min,

  // Math
  // (count, max, min already listed above)
} = decorated

// Re-export the full decorated object for dynamic access
export { decorated as operators }

// Export specially-wrapped higher-order operators
// These push operatorContext when their project functions execute
export {
  wrappedSwitchMap as switchMap,
  wrappedMergeMap as mergeMap,
  wrappedConcatMap as concatMap,
  wrappedExhaustMap as exhaustMap,
  wrappedExpand as expand,
  wrappedFlatMap as flatMap,
}
