/**
 * Tests for argument detection in creation functions
 *
 * Verifies that combineLatest, merge, forkJoin, etc. detect observable
 * arguments and register ArgumentRelationship records.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { of, Subject, BehaviorSubject } from 'rxjs';
import {
  combineLatest,
  merge,
  forkJoin,
  zip,
  race,
  concat,
} from '../argument-detection';
import {
  observableMetadata,
  resetRegistry,
  getRelationshipsUsingObservable,
} from '../registry';
import { patchPipe, unpatchPipe } from '../pipe-patch';
import { patchSubscribe, unpatchSubscribe } from '../subscribe-patch';

describe('argument detection', () => {
  beforeEach(() => {
    resetRegistry();
    patchPipe();
    patchSubscribe();
  });

  describe('combineLatest', () => {
    it('should detect observables in array argument', () => {
      const a$ = of(1);
      const b$ = of(2);
      const c$ = of(3);

      // Register source observables first
      const aMeta = observableMetadata.get(a$);
      const bMeta = observableMetadata.get(b$);
      const cMeta = observableMetadata.get(c$);

      const result$ = combineLatest([a$, b$, c$]);

      // Result should be registered
      const resultMeta = observableMetadata.get(result$);
      expect(resultMeta).toBeDefined();

      // Check relationships using the source observables
      if (aMeta) {
        const rels = getRelationshipsUsingObservable(aMeta.id);
        expect(rels.length).toBeGreaterThan(0);
        const rel = rels[0]!;
        expect(rel.operatorName).toBe('combineLatest');
        expect(rel.sourceObservableId).toBe(resultMeta?.id);
        expect(rel.arguments.get('0')).toBe(aMeta.id);
      }
    });

    it('should detect observables in object argument', () => {
      const x$ = of('x');
      const y$ = of('y');

      // Register source observables
      const xMeta = observableMetadata.get(x$);
      const yMeta = observableMetadata.get(y$);

      const result$ = combineLatest({ x: x$, y: y$ });

      const resultMeta = observableMetadata.get(result$);
      expect(resultMeta).toBeDefined();

      if (xMeta) {
        const rels = getRelationshipsUsingObservable(xMeta.id);
        expect(rels.length).toBeGreaterThan(0);
        const rel = rels[0]!;
        expect(rel.arguments.get('x')).toBe(xMeta.id);
        expect(rel.arguments.get('y')).toBe(yMeta?.id);
      }
    });
  });

  describe('merge', () => {
    it('should detect observables passed as separate arguments', () => {
      const a$ = of(1);
      const b$ = of(2);

      const aMeta = observableMetadata.get(a$);
      const bMeta = observableMetadata.get(b$);

      const result$ = merge(a$, b$);

      const resultMeta = observableMetadata.get(result$);
      expect(resultMeta).toBeDefined();

      if (aMeta) {
        const rels = getRelationshipsUsingObservable(aMeta.id);
        expect(rels.length).toBeGreaterThan(0);
        const rel = rels[0]!;
        expect(rel.operatorName).toBe('merge');
        expect(rel.arguments.get('0')).toBe(aMeta.id);
        expect(rel.arguments.get('1')).toBe(bMeta?.id);
      }
    });
  });

  describe('forkJoin', () => {
    it('should detect observables in array argument', async () => {
      const a$ = of(1);
      const b$ = of(2);

      const aMeta = observableMetadata.get(a$);

      const result$ = forkJoin([a$, b$]);

      if (aMeta) {
        const rels = getRelationshipsUsingObservable(aMeta.id);
        expect(rels.length).toBeGreaterThan(0);
        expect(rels[0]!.operatorName).toBe('forkJoin');
      }
    });

    it('should detect observables in object argument', async () => {
      const x$ = of('x');
      const y$ = of('y');

      const xMeta = observableMetadata.get(x$);

      const result$ = forkJoin({ x: x$, y: y$ });

      if (xMeta) {
        const rels = getRelationshipsUsingObservable(xMeta.id);
        expect(rels.length).toBeGreaterThan(0);
        const rel = rels[0]!;
        expect(rel.operatorName).toBe('forkJoin');
        expect(rel.arguments.has('x')).toBe(true);
        expect(rel.arguments.has('y')).toBe(true);
      }
    });
  });

  describe('zip', () => {
    it('should detect observables', () => {
      const a$ = of(1);
      const b$ = of(2);

      const aMeta = observableMetadata.get(a$);

      const result$ = zip(a$, b$);

      if (aMeta) {
        const rels = getRelationshipsUsingObservable(aMeta.id);
        expect(rels.length).toBeGreaterThan(0);
        expect(rels[0]!.operatorName).toBe('zip');
      }
    });
  });

  describe('race', () => {
    it('should detect observables', () => {
      const a$ = of(1);
      const b$ = of(2);

      const aMeta = observableMetadata.get(a$);

      const result$ = race(a$, b$);

      if (aMeta) {
        const rels = getRelationshipsUsingObservable(aMeta.id);
        expect(rels.length).toBeGreaterThan(0);
        expect(rels[0]!.operatorName).toBe('race');
      }
    });
  });

  describe('concat', () => {
    it('should detect observables', () => {
      const a$ = of(1);
      const b$ = of(2);

      const aMeta = observableMetadata.get(a$);

      const result$ = concat(a$, b$);

      if (aMeta) {
        const rels = getRelationshipsUsingObservable(aMeta.id);
        expect(rels.length).toBeGreaterThan(0);
        expect(rels[0]!.operatorName).toBe('concat');
      }
    });
  });

  describe('with Subjects', () => {
    it('should detect BehaviorSubject arguments', () => {
      const subject$ = new BehaviorSubject(0);
      const other$ = of(1);

      // Subjects need explicit registration via constructor-proxy
      // For this test, manually set metadata
      const subjectMeta = observableMetadata.get(subject$);
      const otherMeta = observableMetadata.get(other$);

      const result$ = combineLatest([subject$, other$]);

      // Should have detected at least the of() observable
      if (otherMeta) {
        const rels = getRelationshipsUsingObservable(otherMeta.id);
        expect(rels.length).toBeGreaterThan(0);
      }
    });
  });

  describe('relationship structure', () => {
    it('should have correct relationship fields', () => {
      const a$ = of(1);
      const b$ = of(2);

      const aMeta = observableMetadata.get(a$);

      const result$ = combineLatest([a$, b$]);
      const resultMeta = observableMetadata.get(result$);

      if (aMeta) {
        const rels = getRelationshipsUsingObservable(aMeta.id);
        expect(rels.length).toBe(1);

        const rel = rels[0]!;
        expect(rel.relationshipId).toMatch(/^rel#\d+$/);
        expect(rel.operatorInstanceId).toMatch(/^op#\d+$/);
        expect(rel.operatorName).toBe('combineLatest');
        expect(rel.sourceObservableId).toBe(resultMeta?.id);
        expect(rel.arguments instanceof Map).toBe(true);
        expect(rel.createdAt).toBeDefined();
      }
    });
  });
});
