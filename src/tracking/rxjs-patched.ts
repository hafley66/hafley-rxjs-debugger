/**
 * Patched RxJS exports
 *
 * Re-exports RxJS with tracking:
 * - Creation functions (of, from, interval, etc.) register returned observables
 * - Observable class replaced with OObservable
 *
 * Usage:
 *   import { interval, of, Observable } from './tracking/rxjs-patched';
 *   // Instead of: import { interval, of, Observable } from 'rxjs';
 */

import * as rx from 'rxjs';
import { Observable } from './observable-wrapper';
import {
  generateObservableId,
  observableMetadata,
} from './registry';
import { writeQueue$ } from './storage';
import { getCallerInfo } from './stack-parser';
import { patchPipe } from './pipe-patch';
import type { ObservableMetadata } from './types';

// Import argument-detecting wrappers for combination functions
import {
  combineLatest as argCombineLatest,
  merge as argMerge,
  forkJoin as argForkJoin,
  zip as argZip,
  race as argRace,
  concat as argConcat,
  onErrorResumeNext as argOnErrorResumeNext,
} from './argument-detection';

// Apply pipe patch when this module loads
patchPipe();
console.log('[rxjs-patched] pipe() patched');

/**
 * Wrap a creation function to register the returned observable
 */
function wrapCreation<T extends (...args: any[]) => rx.Observable<any>>(
  fn: T,
  name: string
): T {
  return ((...args: any[]) => {
    const obs = fn(...args);

    // Register if not already registered
    if (!observableMetadata.has(obs)) {
      const callerInfo = getCallerInfo();

      const metadata: ObservableMetadata = {
        id: generateObservableId(),
        createdAt: Date.now(),
        location: {
          filePath: callerInfo?.filePath || 'unknown',
          line: callerInfo?.line || 0,
          column: callerInfo?.column || 0,
        },
        variableName: callerInfo?.context || name,
        operators: [],
        path: '',
      };

      observableMetadata.set(obs, metadata);

      writeQueue$.next({
        store: 'observables',
        key: metadata.id,
        data: metadata,
      });
    }

    return obs;
  }) as T;
}

/**
 * Auto-wrap all creation functions from an object
 */
function autoWrapCreations<T extends Record<string, any>>(
  fns: T,
  names: string[]
): Pick<T, (typeof names)[number]> {
  const result: any = {};
  for (const name of names) {
    if (typeof fns[name] === 'function') {
      result[name] = wrapCreation(fns[name], name);
    }
  }
  return result;
}

// Creation functions to wrap (basic registration only)
// NOTE: merge, concat, combineLatest, forkJoin, zip, race, onErrorResumeNext
// are handled by argument-detection.ts with observable argument scanning
const creationFunctionNames = [
  'of',
  'from',
  'interval',
  'timer',
  'defer',
  'range',
  'generate',
  'empty',
  'never',
  'throwError',
  'ajax',
  'fromEvent',
  'fromEventPattern',
  'fromFetch',
  'bindCallback',
  'bindNodeCallback',
  'partition',
  'iif',
  'using',
];

const wrappedCreations = autoWrapCreations(rx, creationFunctionNames);

// Export wrapped creation functions (basic registration)
export const {
  of,
  from,
  interval,
  timer,
  defer,
  range,
  generate,
  throwError,
  fromEvent,
  fromEventPattern,
  iif,
} = wrappedCreations;

// Export argument-detecting wrappers for combination functions
export {
  argCombineLatest as combineLatest,
  argMerge as merge,
  argForkJoin as forkJoin,
  argZip as zip,
  argRace as race,
  argConcat as concat,
  argOnErrorResumeNext as onErrorResumeNext,
};

// Export our Observable
export { Observable };

// Re-export Subject and variants with proxied constructors that capture creation context
export { Subject, BehaviorSubject, ReplaySubject, AsyncSubject } from './constructor-proxy';

// Re-export everything else from rxjs that wasn't overridden
export {
  Subscription,
  Subscriber,
  Scheduler,
  asyncScheduler,
  asapScheduler,
  queueScheduler,
  animationFrameScheduler,
  VirtualTimeScheduler,
  EMPTY,
  NEVER,
  config,
  pipe,
  noop,
  identity,
  isObservable,
  lastValueFrom,
  firstValueFrom,
  connectable,
  scheduled,
} from 'rxjs';

// Re-export types
export type {
  Observer,
  Operator,
  OperatorFunction,
  MonoTypeOperatorFunction,
  UnaryFunction,
  ObservableInput,
  ObservedValueOf,
  ObservableInputTuple,
  SchedulerLike,
  SchedulerAction,
  Unsubscribable,
  TeardownLogic,
  SubjectLike,
} from 'rxjs';
