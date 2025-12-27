/**
 * Argument Detection for Creation Functions
 *
 * Wraps creation functions like combineLatest, merge, forkJoin to detect
 * observables passed as arguments and register ArgumentRelationship.
 *
 * Example:
 *   combineLatest([a$, b$]) → registers relationship {
 *     operatorName: 'combineLatest',
 *     sourceObservableId: result$.id,
 *     arguments: Map { "0": a$.id, "1": b$.id }
 *   }
 */

import * as rx from 'rxjs';
import {
  observableMetadata,
  generateObservableId,
  generateOperatorInstanceId,
  generateRelationshipId,
  registerArgumentRelationship,
  registerObservable,
} from './registry';
import { getCallerInfo } from './stack-parser';
import type { ArgumentRelationship, ArgumentPath } from './types';

/**
 * Check if a value is likely an Observable
 */
function isObservable(value: any): boolean {
  return value && typeof value.subscribe === 'function';
}

/**
 * Scan arguments for observables and build argument map
 *
 * Handles:
 * - Direct observables: merge(a$, b$) → { "0": a$.id, "1": b$.id }
 * - Array of observables: combineLatest([a$, b$]) → { "0": a$.id, "1": b$.id }
 * - Object with observables: combineLatest({ x: a$, y: b$ }) → { "x": a$.id, "y": b$.id }
 */
function scanForObservables(args: any[]): Map<ArgumentPath, string> {
  const result = new Map<ArgumentPath, string>();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (isObservable(arg)) {
      // Direct observable argument
      const metadata = observableMetadata.get(arg);
      if (metadata) {
        result.set(String(i), metadata.id);
      }
    } else if (Array.isArray(arg)) {
      // Array of observables (common pattern for combineLatest, forkJoin)
      for (let j = 0; j < arg.length; j++) {
        const item = arg[j];
        if (isObservable(item)) {
          const metadata = observableMetadata.get(item);
          if (metadata) {
            result.set(String(j), metadata.id);
          }
        }
      }
    } else if (arg && typeof arg === 'object' && !isObservable(arg)) {
      // Object with observable properties (combineLatest({ x: a$, y: b$ }))
      for (const [key, value] of Object.entries(arg)) {
        if (isObservable(value)) {
          const metadata = observableMetadata.get(value);
          if (metadata) {
            result.set(key, metadata.id);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Wrap a creation function to detect observable arguments
 */
function wrapCreationWithArgDetection<T extends (...args: any[]) => rx.Observable<any>>(
  fn: T,
  name: string
): T {
  return ((...args: any[]) => {
    // Call original function
    const result = fn(...args);

    // Get or create metadata for result
    let resultMetadata = observableMetadata.get(result);
    if (!resultMetadata) {
      const callerInfo = getCallerInfo();
      resultMetadata = {
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
      registerObservable(result, resultMetadata);
    }

    // Scan arguments for observables
    const argumentObservables = scanForObservables(args);

    // Register relationship if we found any observable arguments
    if (argumentObservables.size > 0) {
      const operatorInstanceId = generateOperatorInstanceId();
      const relationship: ArgumentRelationship = {
        relationshipId: generateRelationshipId(),
        operatorName: name,
        operatorInstanceId,
        sourceObservableId: resultMetadata.id,
        arguments: argumentObservables,
        createdAt: new Date().toISOString(),
      };
      registerArgumentRelationship(relationship);
    }

    return result;
  }) as T;
}

// Export wrapped creation functions with argument detection
export const combineLatest = wrapCreationWithArgDetection(rx.combineLatest, 'combineLatest');
export const merge = wrapCreationWithArgDetection(rx.merge, 'merge');
export const forkJoin = wrapCreationWithArgDetection(rx.forkJoin, 'forkJoin');
export const zip = wrapCreationWithArgDetection(rx.zip, 'zip');
export const race = wrapCreationWithArgDetection(rx.race, 'race');
export const concat = wrapCreationWithArgDetection(rx.concat, 'concat');

// Also wrap onErrorResumeNext which takes observables
export const onErrorResumeNext = wrapCreationWithArgDetection(rx.onErrorResumeNext, 'onErrorResumeNext');
