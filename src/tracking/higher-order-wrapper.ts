/**
 * Higher-Order Operator Wrapper
 *
 * Wraps operators like switchMap, mergeMap, concatMap, exhaustMap to push
 * operatorContext when their project functions execute. This allows inner
 * observables created inside the project function to be properly linked
 * to their parent operator.
 *
 * Example:
 *   session$.pipe(switchMap(user => from(fetch('/api/user'))))
 *
 * Without wrapping: from() has no idea it's inside switchMap
 * With wrapping: from() sees operatorContext { operatorName: 'switchMap', ... }
 */

import * as rxjsOps from 'rxjs/operators';
import type { ObservableInput, OperatorFunction } from 'rxjs';
import {
  operatorContext,
  subscriptionContext,
  generateOperatorInstanceId,
} from './registry';
import type { OperatorExecutionContext } from './types';
import { annotateOperator } from './pipe-patch';

/**
 * Wrap a higher-order operator's project function to push operator context
 */
function wrapProject<T, R>(
  project: (value: T, index: number) => ObservableInput<R>,
  operatorName: string,
  operatorInstanceId: string
): (value: T, index: number) => ObservableInput<R> {
  return (value: T, index: number) => {
    // Get current subscription context for linking
    const subCtx = subscriptionContext.peek();

    const ctx: OperatorExecutionContext = {
      operatorName,
      operatorInstanceId,
      subscriptionId: subCtx?.subscriptionId || 'unknown',
      observableId: subCtx?.observableId || 'unknown',
      event: 'next',
      value,
      timestamp: Date.now(),
    };

    operatorContext.push(ctx);
    try {
      return project(value, index);
    } finally {
      operatorContext.pop();
    }
  };
}

/**
 * Create a wrapped version of a higher-order operator
 */
function wrapHigherOrderOperator<T, R>(
  originalOp: (project: (value: T, index: number) => ObservableInput<R>, ...rest: any[]) => OperatorFunction<T, R>,
  operatorName: string
): typeof originalOp {
  return ((project: (value: T, index: number) => ObservableInput<R>, ...rest: any[]) => {
    const operatorInstanceId = generateOperatorInstanceId();
    const wrappedProject = wrapProject(project, operatorName, operatorInstanceId);
    const op = originalOp(wrappedProject, ...rest);
    return annotateOperator(op, operatorName);
  }) as typeof originalOp;
}

/**
 * Wrap expand operator (slightly different signature - has concurrent param)
 */
function wrapExpand<T, R>(
  originalOp: typeof rxjsOps.expand
): typeof rxjsOps.expand {
  return ((project: (value: T, index: number) => ObservableInput<R>, concurrent?: number, scheduler?: any) => {
    const operatorInstanceId = generateOperatorInstanceId();
    const wrappedProject = wrapProject(project, 'expand', operatorInstanceId);
    const op = originalOp(wrappedProject, concurrent, scheduler);
    return annotateOperator(op, 'expand');
  }) as typeof rxjsOps.expand;
}

// Export wrapped higher-order operators
export const switchMap = wrapHigherOrderOperator(rxjsOps.switchMap, 'switchMap');
export const mergeMap = wrapHigherOrderOperator(rxjsOps.mergeMap, 'mergeMap');
export const concatMap = wrapHigherOrderOperator(rxjsOps.concatMap, 'concatMap');
export const exhaustMap = wrapHigherOrderOperator(rxjsOps.exhaustMap, 'exhaustMap');
export const expand = wrapExpand(rxjsOps.expand);

// Also export flatMap as alias for mergeMap (deprecated but still used)
export const flatMap = mergeMap;
