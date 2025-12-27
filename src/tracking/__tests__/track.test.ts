/**
 * Tests for track$ manual annotation function
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Subject, Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import { track$, createTrackAnnotation, trackMany } from '../track';
import {
  observableMetadata,
  resetRegistry,
  registerObservable,
  generateObservableId,
} from '../registry';
import { patchPipe } from '../pipe-patch';
import { patchSubscribe } from '../subscribe-patch';
import type { ObservableMetadata } from '../types';

/**
 * Helper to create a registered observable for testing
 */
function createRegisteredObservable<T>(values: T[]): Observable<T> {
  const obs = new Observable<T>((subscriber) => {
    for (const v of values) {
      subscriber.next(v);
    }
    subscriber.complete();
  });

  // Manually register it
  const meta: ObservableMetadata = {
    id: generateObservableId(),
    createdAt: Date.now(),
    operators: [],
    path: '',
  };
  registerObservable(obs, meta);

  return obs;
}

describe('track$', () => {
  beforeEach(() => {
    resetRegistry();
    patchPipe();
    patchSubscribe();
  });

  describe('direct observable annotation', () => {
    it('should annotate observable with string name', () => {
      const source$ = createRegisteredObservable([1, 2, 3]);

      // Observable should be registered
      const metaBefore = observableMetadata.get(source$);
      expect(metaBefore).toBeDefined();

      // Apply annotation
      const annotated$ = track$(source$, 'myNumbers$');

      // Should return same observable
      expect(annotated$).toBe(source$);

      // Metadata should be updated
      const metaAfter = observableMetadata.get(source$);
      expect(metaAfter?.variableName).toBe('myNumbers$');
    });

    it('should annotate observable with full metadata', () => {
      const source$ = createRegisteredObservable(['hello']);

      track$(source$, {
        name: 'greeting$',
        file: 'src/app/greeting.ts',
        line: 42,
        column: 10,
      });

      const meta = observableMetadata.get(source$);
      expect(meta?.variableName).toBe('greeting$');
      expect(meta?.location?.filePath).toBe('src/app/greeting.ts');
      expect(meta?.location?.line).toBe(42);
      expect(meta?.location?.column).toBe(10);
    });

    it('should annotate observable with tags', () => {
      const source$ = createRegisteredObservable([1]);

      track$(source$, {
        name: 'tagged$',
        tags: ['api', 'cache'],
      });

      const meta = observableMetadata.get(source$) as any;
      expect(meta?.variableName).toBe('tagged$');
      expect(meta?.tags).toEqual(['api', 'cache']);
    });
  });

  describe('operator annotation in pipe', () => {
    it('should return operator function when called with just name', () => {
      const operator = track$<number>('doubled$');
      expect(typeof operator).toBe('function');
    });

    it('should return operator function when called with metadata', () => {
      const operator = track$<number>({ name: 'transformed$', tags: ['transform'] });
      expect(typeof operator).toBe('function');
    });

    it('should work in pipe and pass through values', () => {
      const source$ = createRegisteredObservable([1, 2, 3]);
      const result$ = source$.pipe(
        map(x => x * 2),
        track$('doubled$'),
        filter(x => x > 2)
      );

      // Subscribe to trigger execution
      const values: number[] = [];
      result$.subscribe(v => values.push(v));

      // Values should flow through
      expect(values).toEqual([4, 6]);
    });
  });

  describe('with Subjects', () => {
    it('should annotate Subject', () => {
      const subject$ = new Subject<number>();

      // Subject may or may not be auto-registered depending on constructor-proxy
      // Manually register if needed for this test
      if (!observableMetadata.has(subject$)) {
        const meta: ObservableMetadata = {
          id: generateObservableId(),
          createdAt: Date.now(),
          operators: [],
          path: '',
          subjectType: 'Subject',
        };
        registerObservable(subject$, meta);
      }

      track$(subject$, 'mySubject$');

      const meta = observableMetadata.get(subject$);
      expect(meta?.variableName).toBe('mySubject$');
    });
  });

  describe('createTrackAnnotation helper', () => {
    it('should create proper metadata object', () => {
      const meta = createTrackAnnotation(
        'src/services/api.ts',
        100,
        5,
        'apiResponse$'
      );

      expect(meta).toEqual({
        name: 'apiResponse$',
        file: 'src/services/api.ts',
        line: 100,
        column: 5,
      });
    });
  });

  describe('trackMany batch annotation', () => {
    it('should annotate multiple observables', () => {
      const a$ = createRegisteredObservable([1]);
      const b$ = createRegisteredObservable([2]);
      const c$ = createRegisteredObservable([3]);

      trackMany([
        [a$, { name: 'a$' }],
        [b$, { name: 'b$', file: 'test.ts', line: 1 }],
        [c$, { name: 'c$', tags: ['batch'] }],
      ]);

      expect(observableMetadata.get(a$)?.variableName).toBe('a$');
      expect(observableMetadata.get(b$)?.variableName).toBe('b$');
      expect(observableMetadata.get(b$)?.location?.filePath).toBe('test.ts');
      expect(observableMetadata.get(c$)?.variableName).toBe('c$');
    });
  });

  describe('edge cases', () => {
    it('should handle annotation before registration (with warning)', () => {
      // Create a raw RxJS observable that bypasses our wrappers
      const raw$ = new Observable((subscriber: any) => {
        subscriber.next(1);
        subscriber.complete();
      });

      // This should warn but not throw
      // We can't easily test console.warn, but we ensure no error
      expect(() => track$(raw$, 'raw$')).not.toThrow();
    });

    it('should preserve other metadata when annotating', () => {
      // Create a registered observable
      const source$ = createRegisteredObservable([1]);

      // Pipe it - this creates a new observable with operators tracked
      const piped$ = source$.pipe(map(x => x * 2));

      // Register the piped observable with operators
      const pipedMeta: ObservableMetadata = {
        id: generateObservableId(),
        createdAt: Date.now(),
        operators: ['map'],
        path: '',
      };
      registerObservable(piped$, pipedMeta);

      // Piped observable should have operators
      const metaBefore = observableMetadata.get(piped$);
      expect(metaBefore?.operators).toContain('map');

      // Annotate
      track$(piped$, 'doubled$');

      // Should preserve operators
      const metaAfter = observableMetadata.get(piped$);
      expect(metaAfter?.operators).toContain('map');
      expect(metaAfter?.variableName).toBe('doubled$');
    });
  });
});
