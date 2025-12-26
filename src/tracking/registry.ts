/**
 * Observable and Subscription Registry
 *
 * Provides centralized storage for tracking Observable and Subscription metadata
 * with memory-safe patterns using WeakMap and WeakRef.
 *
 * Also manages context stacks for tracking execution state (pipe/operator/subscription).
 */

import type {
  ObservableMetadata,
  SubscriptionMetadata,
  OperatorExecutionContext,
  PipeContext,
  SubscriptionContext,
  ArgumentRelationship,
  Emission,
  ErrorEvent,
} from './types';
import { writeQueue$ } from './storage';

/**
 * WeakMap storing metadata for each Observable instance.
 * Using WeakMap ensures that when an Observable is garbage collected,
 * its metadata is automatically cleaned up without memory leaks.
 *
 * Key: Observable instance
 * Value: ObservableMetadata
 */
export const observableMetadata = new WeakMap<any, ObservableMetadata>();

/**
 * Map for looking up observables by their string ID.
 * Uses WeakRef to allow the observable to be garbage collected while
 * keeping the ID mapping available for debugging purposes.
 *
 * Key: Observable ID (string)
 * Value: WeakRef to the Observable instance
 */
const observableById = new Map<string, WeakRef<any>>();

/**
 * Map of currently active subscriptions.
 * These have strong references intentionally - we want to track
 * subscriptions that haven't been unsubscribed yet.
 *
 * Key: Subscription ID (string)
 * Value: SubscriptionMetadata
 */
export const activeSubscriptions = new Map<string, SubscriptionMetadata>();

/**
 * Archive for unsubscribed subscriptions.
 * Keeps historical data for debugging and analysis.
 * Consider implementing time-based cleanup or size limits for long-running apps.
 *
 * Key: Subscription ID (string)
 * Value: SubscriptionMetadata
 */
export const archivedSubscriptions = new Map<string, SubscriptionMetadata>();

/**
 * Counter for generating unique Observable IDs
 * Increments with each new Observable instance
 */
let observableCounter = 0;

/**
 * Counter for generating unique Subscription IDs
 * Increments with each new Subscription instance
 */
let subscriptionCounter = 0;

/**
 * Generates a unique identifier for an Observable instance
 * @returns Unique ID in format "obs#N"
 */
export function generateObservableId(): string {
  return `obs#${observableCounter++}`;
}

/**
 * Generates a unique identifier for a Subscription instance
 * @returns Unique ID in format "sub#N"
 */
export function generateSubscriptionId(): string {
  return `sub#${subscriptionCounter++}`;
}

/**
 * Registers an Observable instance with its metadata
 *
 * Stores the metadata in both the WeakMap (for direct lookup)
 * and the ID map (for lookup by string ID).
 *
 * @param obs - The Observable instance to register
 * @param metadata - The metadata to associate with this observable
 */
export function registerObservable(obs: any, metadata: ObservableMetadata): void {
  observableMetadata.set(obs, metadata);
  observableById.set(metadata.id, new WeakRef(obs));
}

/**
 * Retrieves an Observable instance by its string ID
 *
 * @param id - The Observable ID to look up
 * @returns The Observable instance, or undefined if not found or GC'd
 */
export function getObservableById(id: string): any | undefined {
  const ref = observableById.get(id);
  return ref?.deref();
}

/**
 * Retrieves metadata for an Observable instance
 *
 * @param obs - The Observable instance
 * @returns The associated metadata, or undefined if not found
 */
export function getMetadata(obs: any): ObservableMetadata | undefined {
  return observableMetadata.get(obs);
}

/**
 * Lazily registers an Observable if not already registered.
 * Used for Observables we couldn't intercept at construction time
 * (e.g., share's internal Subject which uses rxjs internals).
 *
 * Captures current context to link the observable to its creator.
 *
 * @param obs - The Observable instance to ensure is registered
 * @returns The metadata (existing or newly created)
 */
export function ensureObservableRegistered(obs: any): ObservableMetadata {
  const existing = observableMetadata.get(obs);
  if (existing) {
    return existing;
  }

  // Capture current context at registration time
  const opCtx = operatorContext.peek();
  const pipeCtx = pipeContext.peek();
  const subCtx = subscriptionContext.peek();

  // Detect Subject type from constructor name
  const constructorName = obs?.constructor?.name;
  const isSubject = ['Subject', 'BehaviorSubject', 'ReplaySubject', 'AsyncSubject'].includes(constructorName);

  const metadata: ObservableMetadata = {
    id: generateObservableId(),
    createdAt: Date.now(),
    operators: [],
    path: '',

    // Subject type if detected
    subjectType: isSubject ? constructorName : undefined,

    // Context at registration (subscribe-time, not creation-time)
    createdByOperator: opCtx?.operatorName,
    operatorInstanceId: opCtx?.operatorInstanceId,
    triggeredBySubscription: subCtx?.subscriptionId,
    triggeredByObservable: subCtx?.observableId,
    pipeGroupId: pipeCtx?.pipeId,

    // Mark as internally created if context suggests it
    isInternalSubject: isSubject && (!!opCtx || !!subCtx),

    // Flag for lazy registration
    lazyRegistered: true,
  };

  registerObservable(obs, metadata);
  return metadata;
}

/**
 * Registers a new subscription in the active subscriptions map
 *
 * @param metadata - The subscription metadata to register
 */
export function registerSubscription(metadata: SubscriptionMetadata): void {
  activeSubscriptions.set(metadata.id, metadata);
}

/**
 * Moves a subscription from active to archived when it's unsubscribed
 *
 * @param subscriptionId - The ID of the subscription to archive
 */
export function archiveSubscription(subscriptionId: string): void {
  const metadata = activeSubscriptions.get(subscriptionId);
  if (metadata) {
    metadata.unsubscribedAt = Date.now();
    archivedSubscriptions.set(subscriptionId, metadata);
    activeSubscriptions.delete(subscriptionId);
  }
}

/**
 * Gets all currently active subscriptions for a specific observable
 *
 * @param observableId - The Observable ID to filter by
 * @returns Array of active subscription metadata
 */
export function getActiveSubscriptionsForObservable(
  observableId: string
): SubscriptionMetadata[] {
  const result: SubscriptionMetadata[] = [];
  for (const metadata of activeSubscriptions.values()) {
    if (metadata.observableId === observableId) {
      result.push(metadata);
    }
  }
  return result;
}

/**
 * Clears all archived subscriptions
 * Useful for preventing unbounded memory growth in long-running applications
 */
export function clearArchivedSubscriptions(): void {
  archivedSubscriptions.clear();
}

// === CONTEXT STACKS ===
// These track execution state and allow Observable constructor to know
// whether it's being created at pipe-time or subscribe-time

/**
 * Operator execution context stack
 * THE KEY PIECE - Observable constructor peeks this to determine dynamic vs static creation
 */
const operatorContextStack: OperatorExecutionContext[] = [];

export const operatorContext = {
  push: (ctx: OperatorExecutionContext) => operatorContextStack.push(ctx),
  pop: () => operatorContextStack.pop(),
  peek: () => operatorContextStack[operatorContextStack.length - 1],
};

/**
 * Pipe context stack
 * Tracks which .pipe() call we're currently in
 */
const pipeContextStack: PipeContext[] = [];

export const pipeContext = {
  push: (ctx: PipeContext) => pipeContextStack.push(ctx),
  pop: () => pipeContextStack.pop(),
  peek: () => pipeContextStack[pipeContextStack.length - 1],
};

/**
 * Subscription context stack
 * Tracks which subscription is currently executing
 */
const subscriptionContextStack: SubscriptionContext[] = [];

export const subscriptionContext = {
  push: (ctx: SubscriptionContext) => subscriptionContextStack.push(ctx),
  pop: () => subscriptionContextStack.pop(),
  peek: () => subscriptionContextStack[subscriptionContextStack.length - 1],
};

// === ARGUMENT RELATIONSHIPS ===

const argumentRelationships = new Map<string, ArgumentRelationship>();
const observableUsedIn = new Map<string, Set<string>>(); // obsId -> Set<relationshipId>

let relationshipCounter = 0;
let operatorInstanceCounter = 0;

export function generateRelationshipId(): string {
  return `rel#${relationshipCounter++}`;
}

export function generateOperatorInstanceId(): string {
  return `op#${operatorInstanceCounter++}`;
}

export function registerArgumentRelationship(rel: ArgumentRelationship): void {
  argumentRelationships.set(rel.relationshipId, rel);

  // Build reverse index
  for (const [_path, obsId] of rel.arguments) {
    if (!observableUsedIn.has(obsId)) {
      observableUsedIn.set(obsId, new Set());
    }
    observableUsedIn.get(obsId)!.add(rel.relationshipId);
  }

  // Queue write to storage
  writeQueue$.next({
    store: 'relationships',
    key: rel.relationshipId,
    data: {
      ...rel,
      arguments: Array.from(rel.arguments.entries()), // Serialize Map
    },
  });
}

export function getRelationshipsUsingObservable(observableId: string): ArgumentRelationship[] {
  const relIds = observableUsedIn.get(observableId);
  if (!relIds) return [];
  return Array.from(relIds)
    .map((id) => argumentRelationships.get(id))
    .filter(Boolean) as ArgumentRelationship[];
}

// === EMISSION AND ERROR TRACKING ===

let emissionCounter = 0;
let errorCounter = 0;

export function generateEmissionId(): string {
  return `emit#${emissionCounter++}`;
}

export function generateErrorId(): string {
  return `err#${errorCounter++}`;
}

export function recordEmission(emission: Emission): void {
  // Add to subscription's emission list
  const sub = activeSubscriptions.get(emission.subscriptionId);
  if (sub) {
    sub.emissionIds.push(emission.id);
  }

  // Queue write to storage (batched)
  writeQueue$.next({
    store: 'emissions',
    key: emission.id,
    data: emission,
  });
}

export function recordError(error: ErrorEvent): void {
  // Add to subscription's error list
  const sub = activeSubscriptions.get(error.subscriptionId);
  if (sub) {
    sub.errorIds.push(error.id);
  }

  // Queue write to storage (batched)
  writeQueue$.next({
    store: 'errors',
    key: error.id,
    data: error,
  });
}

// === PIPE GROUP ID ===

let pipeGroupCounter = 0;

export function generatePipeGroupId(): string {
  return `pipe#${pipeGroupCounter++}`;
}

/**
 * Reset all counters and clear all state.
 * Used for testing to ensure deterministic IDs.
 */
export function resetRegistry(): void {
  observableCounter = 0;
  subscriptionCounter = 0;
  relationshipCounter = 0;
  operatorInstanceCounter = 0;
  emissionCounter = 0;
  errorCounter = 0;
  pipeGroupCounter = 0;
  activeSubscriptions.clear();
  archivedSubscriptions.clear();
}
