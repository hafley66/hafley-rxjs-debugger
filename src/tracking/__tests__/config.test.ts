/**
 * Tests for tracking configuration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackingConfig$,
  isTrackingEnabled,
  enableTracking,
  disableTracking,
  updateConfig,
  resetConfig,
} from '../config';

describe('Tracking Configuration', () => {
  beforeEach(() => {
    resetConfig();
  });

  describe('Default configuration', () => {
    it('should be enabled by default', () => {
      expect(isTrackingEnabled()).toBe(true);
      expect(trackingConfig$.value.enabled).toBe(true);
    });

    it('should track emissions by default', () => {
      expect(trackingConfig$.value.trackEmissions).toBe(true);
    });

    it('should track errors by default', () => {
      expect(trackingConfig$.value.trackErrors).toBe(true);
    });

    it('should track completions by default', () => {
      expect(trackingConfig$.value.trackCompletions).toBe(true);
    });

    it('should have max emissions limit', () => {
      expect(trackingConfig$.value.maxEmissionsPerSubscription).toBe(1000);
    });
  });

  describe('Enable/Disable tracking', () => {
    it('should disable tracking', () => {
      disableTracking();
      expect(isTrackingEnabled()).toBe(false);
      expect(trackingConfig$.value.enabled).toBe(false);
    });

    it('should enable tracking', () => {
      disableTracking();
      enableTracking();
      expect(isTrackingEnabled()).toBe(true);
      expect(trackingConfig$.value.enabled).toBe(true);
    });

    it('should preserve other config when toggling', () => {
      updateConfig({ maxEmissionsPerSubscription: 500 });
      disableTracking();

      expect(trackingConfig$.value.maxEmissionsPerSubscription).toBe(500);
    });
  });

  describe('Update configuration', () => {
    it('should update single field', () => {
      updateConfig({ trackEmissions: false });

      expect(trackingConfig$.value.trackEmissions).toBe(false);
      expect(trackingConfig$.value.trackErrors).toBe(true);
    });

    it('should update multiple fields', () => {
      updateConfig({
        trackEmissions: false,
        trackErrors: false,
        maxEmissionsPerSubscription: 100,
      });

      expect(trackingConfig$.value.trackEmissions).toBe(false);
      expect(trackingConfig$.value.trackErrors).toBe(false);
      expect(trackingConfig$.value.maxEmissionsPerSubscription).toBe(100);
    });

    it('should preserve unchanged fields', () => {
      updateConfig({ trackEmissions: false });

      expect(trackingConfig$.value.enabled).toBe(true);
      expect(trackingConfig$.value.trackErrors).toBe(true);
    });
  });

  describe('Reset configuration', () => {
    it('should reset to defaults', () => {
      updateConfig({
        enabled: false,
        trackEmissions: false,
        maxEmissionsPerSubscription: 10,
      });

      resetConfig();

      expect(trackingConfig$.value.enabled).toBe(true);
      expect(trackingConfig$.value.trackEmissions).toBe(true);
      expect(trackingConfig$.value.maxEmissionsPerSubscription).toBe(1000);
    });
  });

  describe('Observable behavior', () => {
    it('should emit when config changes', async () => {
      let emitCount = 0;

      await new Promise<void>((resolve) => {
        const sub = trackingConfig$.subscribe(() => {
          emitCount++;
          if (emitCount === 2) {
            // First emit is current value, second is from updateConfig
            expect(emitCount).toBe(2);
            sub.unsubscribe();
            resolve();
          }
        });

        updateConfig({ enabled: false });
      });
    });

    it('should provide current value immediately', () => {
      let receivedValue = false;

      trackingConfig$.subscribe((config) => {
        receivedValue = true;
        expect(config.enabled).toBeDefined();
      });

      expect(receivedValue).toBe(true);
    });
  });

  describe('Global hook', () => {
    it('should expose global hook in browser environment', () => {
      if (typeof window !== 'undefined') {
        expect(window.__RXJS_DEVTOOLS_GLOBAL_HOOK__).toBeDefined();
        expect(window.__RXJS_DEVTOOLS_GLOBAL_HOOK__?.config).toBe(trackingConfig$);
        expect(window.__RXJS_DEVTOOLS_GLOBAL_HOOK__?.version).toBe('0.1.0');
      }
    });

    it('should expose enable/disable methods', () => {
      if (typeof window !== 'undefined') {
        expect(typeof window.__RXJS_DEVTOOLS_GLOBAL_HOOK__?.enable).toBe('function');
        expect(typeof window.__RXJS_DEVTOOLS_GLOBAL_HOOK__?.disable).toBe('function');
      }
    });
  });
});
