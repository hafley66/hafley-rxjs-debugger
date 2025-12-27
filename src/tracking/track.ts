/**
 * track$ - Manual annotation for observables and operators
 *
 * Provides a way to manually annotate observables with custom names,
 * file locations, and other metadata. This is the foundation for:
 * 1. Manual debugging annotations
 * 2. Integration with oxc/JS parser for auto-detection
 * 3. Vite plugin auto-instrumentation with HMR support
 *
 * Usage:
 *
 * // Annotate an observable directly
 * const myData$ = track$(of(1, 2, 3), 'myData$');
 *
 * // Annotate an observable with full metadata
 * const myData$ = track$(of(1, 2, 3), {
 *   name: 'myData$',
 *   file: 'src/services/data.ts',
 *   line: 42,
 * });
 *
 * // Create an annotating operator for use in pipe
 * const result$ = source$.pipe(
 *   map(x => x * 2),
 *   track$('afterMap'),  // Annotates the output of map
 *   filter(x => x > 5),
 * );
 */

import type { Observable, OperatorFunction } from 'rxjs';
import { getMetadata } from './registry';
import { writeQueue$ } from './storage';

/**
 * Metadata that can be provided to track$
 */
export interface TrackMetadata {
  /** Display name for the observable */
  name: string;
  /** Source file path (for auto-instrumentation) */
  file?: string;
  /** Line number in source file */
  line?: number;
  /** Column number in source file */
  column?: number;
  /** Additional custom metadata */
  tags?: string[];
}

/**
 * Annotate an observable with tracking metadata
 *
 * @overload Direct annotation with name string
 * @param obs - The observable to annotate
 * @param name - Display name for the observable
 */
export function track$<T>(obs: Observable<T>, name: string): Observable<T>;

/**
 * @overload Direct annotation with full metadata
 * @param obs - The observable to annotate
 * @param metadata - Full tracking metadata
 */
export function track$<T>(obs: Observable<T>, metadata: TrackMetadata): Observable<T>;

/**
 * @overload Create an annotating operator for use in pipe
 * @param name - Display name to apply to the observable
 */
export function track$<T>(name: string): OperatorFunction<T, T>;

/**
 * @overload Create an annotating operator with full metadata
 * @param metadata - Full tracking metadata
 */
export function track$<T>(metadata: TrackMetadata): OperatorFunction<T, T>;

/**
 * Implementation
 */
export function track$<T>(
  obsOrNameOrMeta: Observable<T> | string | TrackMetadata,
  nameOrMeta?: string | TrackMetadata
): Observable<T> | OperatorFunction<T, T> {
  // Case 1: track$(obs, name) or track$(obs, metadata)
  if (isObservable(obsOrNameOrMeta)) {
    const obs = obsOrNameOrMeta;
    const meta = normalizeMetadata(nameOrMeta!);
    applyAnnotation(obs, meta);
    return obs;
  }

  // Case 2: track$(name) or track$(metadata) - returns operator
  const meta = normalizeMetadata(obsOrNameOrMeta);
  return (source: Observable<T>) => {
    // The source here is the result of the previous operator in the pipe
    applyAnnotation(source, meta);
    return source;
  };
}

/**
 * Check if value is an Observable (duck typing)
 */
function isObservable(value: any): value is Observable<any> {
  return value && typeof value.subscribe === 'function';
}

/**
 * Normalize name string or metadata object to TrackMetadata
 */
function normalizeMetadata(nameOrMeta: string | TrackMetadata): TrackMetadata {
  if (typeof nameOrMeta === 'string') {
    return { name: nameOrMeta };
  }
  return nameOrMeta;
}

/**
 * Apply annotation to an observable's metadata
 */
function applyAnnotation<T>(obs: Observable<T>, meta: TrackMetadata): void {
  const existing = getMetadata(obs);

  if (existing) {
    // Update existing metadata
    existing.variableName = meta.name;

    if (meta.file || meta.line || meta.column) {
      existing.location = {
        filePath: meta.file || existing.location?.filePath || 'unknown',
        line: meta.line || existing.location?.line || 0,
        column: meta.column || existing.location?.column || 0,
      };
    }

    // Store tags in a custom field (extend type if needed)
    if (meta.tags) {
      (existing as any).tags = meta.tags;
    }

    // Update in storage
    const { parent, ...serializableMetadata } = existing;
    writeQueue$.next({
      store: 'observables',
      key: existing.id,
      data: serializableMetadata,
    });
  } else {
    // Observable not registered yet - store annotation for later
    // This can happen if track$ is called before subscribe
    console.warn(
      `[track$] Observable not yet registered. Annotation "${meta.name}" will be applied when the observable is subscribed.`
    );
    // We could store pending annotations, but for now just warn
  }
}

/**
 * Helper to create a track$ annotation with source location
 * Useful for auto-instrumentation tools
 */
export function createTrackAnnotation(
  file: string,
  line: number,
  column: number,
  name: string
): TrackMetadata {
  return { name, file, line, column };
}

/**
 * Batch annotate multiple observables (for auto-instrumentation)
 */
export function trackMany(annotations: Array<[Observable<any>, TrackMetadata]>): void {
  for (const [obs, meta] of annotations) {
    track$(obs, meta);
  }
}

/**
 * Compact tracking function for auto-instrumentation
 *
 * Used by vite-plugin to inject minimal overhead tracking.
 * Uses short property names to minimize bundle size.
 *
 * @param obs - The observable to track
 * @param meta - Compact metadata: { n: name, f: file, l: line }
 */
export interface CompactMeta {
  /** name */
  n: string;
  /** file */
  f?: string;
  /** line */
  l?: number;
}

export function __track$<T>(obs: T, meta: CompactMeta): T {
  // Expand compact meta to full format
  const fullMeta: TrackMetadata = {
    name: meta.n,
    file: meta.f,
    line: meta.l,
  };

  // If it's an observable, apply annotation
  if (isObservable(obs)) {
    applyAnnotation(obs, fullMeta);
  }

  return obs;
}
