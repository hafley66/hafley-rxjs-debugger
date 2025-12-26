/**
 * RxJS Devtools Configuration
 *
 * Similar to React DevTools global hook pattern.
 * Controls what gets tracked and when.
 */

// Use raw BehaviorSubject - this must NOT be proxied
// Config is read at boot time before any patching
import { BehaviorSubject } from 'rxjs';

// Note: This file must be imported BEFORE patchConstructors() is called
// to ensure trackingConfig$ uses the original BehaviorSubject

/**
 * Tracking configuration options
 */
export interface TrackingConfig {
  /**
   * Enable subscribe-time tracking (subscriptions, emissions, errors)
   * - true: Track pipe() calls, subscribe() calls, emissions, unsubscribe
   * - false: Only track observable creation (pipe-time metadata)
   *
   * Default: true (enabled for dev mode)
   */
  enabled: boolean;

  /**
   * Track emissions (next events)
   * Can create a LOT of data - disable for high-frequency streams in production
   */
  trackEmissions: boolean;

  /**
   * Track errors
   */
  trackErrors: boolean;

  /**
   * Track completion events
   */
  trackCompletions: boolean;

  /**
   * Max emissions per subscription before throttling
   * 0 = unlimited (careful!)
   */
  maxEmissionsPerSubscription: number;
}

/**
 * Default configuration
 * Enabled by default for development
 */
const defaultConfig: TrackingConfig = {
  enabled: true,
  trackEmissions: true,
  trackErrors: true,
  trackCompletions: true,
  maxEmissionsPerSubscription: 1000,
};

/**
 * Global tracking configuration
 * Use BehaviorSubject so changes can be observed
 */
export const trackingConfig$ = new BehaviorSubject<TrackingConfig>(defaultConfig);

/**
 * Check if subscribe-time tracking is enabled
 */
export function isTrackingEnabled(): boolean {
  return trackingConfig$.value.enabled;
}

/**
 * Enable tracking
 */
export function enableTracking(): void {
  trackingConfig$.next({ ...trackingConfig$.value, enabled: true });
}

/**
 * Disable tracking
 */
export function disableTracking(): void {
  trackingConfig$.next({ ...trackingConfig$.value, enabled: false });
}

/**
 * Update tracking configuration
 */
export function updateConfig(partial: Partial<TrackingConfig>): void {
  trackingConfig$.next({ ...trackingConfig$.value, ...partial });
}

/**
 * Reset to default configuration
 */
export function resetConfig(): void {
  trackingConfig$.next(defaultConfig);
}

// Global hook pattern (like React DevTools)
// Allows extension to check if devtools are available
declare global {
  interface Window {
    __RXJS_DEVTOOLS_GLOBAL_HOOK__?: {
      config: BehaviorSubject<TrackingConfig>;
      enable: () => void;
      disable: () => void;
      version: string;
    };
  }
}

// Install global hook if in browser
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).window !== 'undefined') {
  (globalThis as any).window.__RXJS_DEVTOOLS_GLOBAL_HOOK__ = {
    config: trackingConfig$,
    enable: enableTracking,
    disable: disableTracking,
    version: '0.1.0',
  };
}
