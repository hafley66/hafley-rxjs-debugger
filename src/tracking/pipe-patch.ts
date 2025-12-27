/**
 * Pipe Patching for RxJS Devtools
 *
 * Monkey-patches Observable.prototype.pipe to capture:
 * - Operator chains
 * - Parent-child relationships
 * - Hierarchical paths
 *
 * This is PIPE-TIME tracking only. Subscribe-time tracking is handled by Task 4.
 */

import { Observable } from 'rxjs';
import {
  getMetadata,
  observableMetadata,
  generateObservableId,
  generatePipeGroupId,
  pipeContext,
} from './registry';
import { writeQueue$ } from './storage';
import { isTrackingEnabled } from './config';
import type { ObservableMetadata, PipeContext } from './types';

// Store original pipe for restoration
let originalPipe: typeof Observable.prototype.pipe | null = null;

// Track if we're patched
let isPatched = false;

/**
 * Extract operator name from an operator function
 *
 * RxJS operators are higher-order functions that return OperatorFunction.
 * The returned function often has the operator name attached.
 *
 * @param operator - The operator function to extract name from
 * @returns The operator name or "operator" as fallback
 */
export function getOperatorName(operator: any): string {
  if (!operator) return 'unknown';

  // Check for custom annotation first
  if (operator.__operatorName) {
    return operator.__operatorName;
  }

  // Try function name
  if (typeof operator === 'function' && operator.name) {
    return operator.name;
  }

  return 'operator';
}

/**
 * Annotate an operator with a custom display name
 *
 * Useful for debugging custom operators or named pipelines.
 *
 * @param op - The operator function to annotate
 * @param displayName - The name to display in devtools
 * @returns The same operator with annotation attached
 */
export function annotateOperator<T>(op: T, displayName: string): T {
  (op as any).__operatorName = displayName;
  return op;
}

/**
 * Generate path for a piped observable
 *
 * Path logic:
 * - Root observable: path = ""
 * - After pipe with N operators: path = "N" (if parent path is "")
 * - Nested: path = "parentPath.N"
 *
 * @param parentPath - The parent observable's path
 * @param operatorCount - Number of operators in this pipe call
 * @returns The new path for the piped observable
 */
function generatePath(parentPath: string, operatorCount: number): string {
  if (parentPath === '') {
    return String(operatorCount);
  }
  return `${parentPath}.${operatorCount}`;
}

/**
 * Patch Observable.prototype.pipe to capture metadata
 *
 * Call this once at application startup to enable pipe tracking.
 */
export function patchPipe(): void {
  if (isPatched) {
    return; // Already patched
  }

  originalPipe = Observable.prototype.pipe;

  Observable.prototype.pipe = function patchedPipe(
    this: Observable<any>,
    ...operators: any[]
  ): Observable<any> {
    // If tracking is disabled, just call original pipe
    if (!isTrackingEnabled()) {
      return (originalPipe as Function).apply(this, operators);
    }

    // Get source metadata
    const sourceMetadata = getMetadata(this);
    const sourceId = sourceMetadata?.id || 'unknown';
    const sourcePath = sourceMetadata?.path || '';

    // Generate IDs
    const pipeId = generatePipeGroupId();

    // Extract operator info
    const operatorInfos = operators.map((op, index) => ({
      name: getOperatorName(op),
      position: index,
    }));

    // Push pipe context
    const pipeCtx: PipeContext = {
      pipeId,
      sourceObservableId: sourceId,
      operators: operatorInfos,
      startedAt: Date.now(),
    };
    pipeContext.push(pipeCtx);

    // Call original pipe (cast needed due to RxJS pipe overloads)
    const result = (originalPipe as Function).apply(this, operators);

    // Pop pipe context
    pipeContext.pop();

    // Now register the result observable with metadata
    // Check if result already has metadata (from OObservable constructor)
    const existingMeta = getMetadata(result);

    if (existingMeta) {
      // Update existing metadata with pipe-specific info
      existingMeta.parent = new WeakRef(this);
      existingMeta.parentId = sourceId; // Serializable version of parent
      existingMeta.operators = operatorInfos.map((o) => o.name);
      existingMeta.path = generatePath(sourcePath, operators.length);
      existingMeta.pipeGroupId = pipeId;

      // Update in storage (strip WeakRef)
      const { parent, ...serializableMetadata } = existingMeta;
      writeQueue$.next({
        store: 'observables',
        key: existingMeta.id,
        data: serializableMetadata,
      });
    } else {
      // Result doesn't have metadata (raw RxJS observable)
      // Create and register new metadata
      const metadata: ObservableMetadata = {
        id: generateObservableId(),
        createdAt: Date.now(),
        location: {
          filePath: 'unknown',
          line: 0,
          column: 0,
        },
        parent: new WeakRef(this),
        parentId: sourceId, // Serializable version of parent
        operators: operatorInfos.map((o) => o.name),
        path: generatePath(sourcePath, operators.length),
        pipeGroupId: pipeId,
      };

      observableMetadata.set(result, metadata);

      // Write to storage (strip WeakRef)
      const { parent, ...serializableMetadata } = metadata;
      writeQueue$.next({
        store: 'observables',
        key: metadata.id,
        data: serializableMetadata,
      });
    }

    return result;
  };

  isPatched = true;
}

/**
 * Restore the original Observable.prototype.pipe
 *
 * Useful for testing or cleanup.
 */
export function unpatchPipe(): void {
  if (!isPatched || !originalPipe) {
    return;
  }

  Observable.prototype.pipe = originalPipe;
  originalPipe = null;
  isPatched = false;
}

/**
 * Check if pipe is currently patched
 */
export function isPipePatched(): boolean {
  return isPatched;
}
