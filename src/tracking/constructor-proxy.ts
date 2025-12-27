/**
 * Constructor Proxies for RxJS Classes
 *
 * Exports proxied versions of Subject, ReplaySubject, etc. that capture
 * creation context. Use Vite alias to replace 'rxjs' with these.
 */

import {
  Subject as OriginalSubject,
  ReplaySubject as OriginalReplaySubject,
  BehaviorSubject as OriginalBehaviorSubject,
  AsyncSubject as OriginalAsyncSubject,
} from 'rxjs';

import {
  registerObservable,
  generateObservableId,
  operatorContext,
  pipeContext,
  subscriptionContext,
} from './registry';
import { isTrackingEnabled } from './config';
import type { ObservableMetadata } from './types';

/**
 * Creates a proxied constructor that captures creation context
 */
function proxyConstructor<T extends new (...args: any[]) => any>(
  Original: T,
  className: string
): T {
  return new Proxy(Original, {
    construct(target, args, newTarget) {
      console.log(`[constructor-proxy] new ${className}() called`);

      // Create the instance normally
      const instance = Reflect.construct(target, args, newTarget);

      // Only register if tracking is enabled
      if (!isTrackingEnabled()) {
        console.log(`[constructor-proxy] tracking disabled, skipping`);
        return instance;
      }

      // Check all context stacks to see who's creating this
      const opCtx = operatorContext.peek();
      const pipeCtx = pipeContext.peek();
      const subCtx = subscriptionContext.peek();

      // Register with metadata linking to creator
      const id = generateObservableId();
      console.log(`[constructor-proxy] registering ${className} as ${id}`);
      registerObservable(instance, {
        id,
        createdAt: Date.now(),
        operators: [],
        path: '',
        subjectType: className as ObservableMetadata['subjectType'],

        // Dynamic context - who created us?
        createdByOperator: opCtx?.operatorName,
        operatorInstanceId: opCtx?.operatorInstanceId,
        triggeredBySubscription: subCtx?.subscriptionId,
        triggeredByObservable: subCtx?.observableId,

        // Pipe context
        pipeGroupId: pipeCtx?.pipeId,

        // Mark as internally created if we have operator context
        isInternalSubject: !!opCtx || !!pipeCtx,
      });

      return instance;
    },
  });
}

// Proxied versions - use these via Vite alias
export const Subject = proxyConstructor(OriginalSubject, 'Subject');
export const ReplaySubject = proxyConstructor(OriginalReplaySubject, 'ReplaySubject');
export const BehaviorSubject = proxyConstructor(OriginalBehaviorSubject, 'BehaviorSubject');
export const AsyncSubject = proxyConstructor(OriginalAsyncSubject, 'AsyncSubject');

// Re-export originals for internal use (avoid infinite loops)
export {
  OriginalSubject,
  OriginalReplaySubject,
  OriginalBehaviorSubject,
  OriginalAsyncSubject,
};
