/**
 * Type definitions for RxJS Observable tracking system
 *
 * Three "Times" Philosophy:
 * 1. PIPE TIME - When observables are created via operators/constructors (static structure)
 * 2. SUBSCRIBE TIME - When .subscribe() is called and execution flows (dynamic tree)
 * 3. ARGUMENT TIME - When observables are passed as operator arguments (cross-observable relationships)
 *
 * The key insight: Observable constructor checks operatorContext.peek()
 * - Empty stack -> pipe/module time creation (static)
 * - Stack has entries -> subscribe-time creation (dynamic, e.g., switchMap inner observables)
 */

/**
 * PIPE TIME: Observable instance metadata
 *
 * Captured when observables are created via operators or creation functions.
 * Represents the static structure of the observable chain.
 *
 * Dynamic fields (createdByOperator, triggeredBy*, argumentPath) are only set
 * when the observable is created during subscribe-time execution (e.g., switchMap inner observables).
 * If these fields are undefined, the observable was created at pipe/module time.
 */
export interface ObservableMetadata {
  /** Unique identifier for this observable (e.g., "obs#42") */
  id: string;

  /** Timestamp (epoch ms) of when the observable was created */
  createdAt: number;

  /** Location in source code where the observable was created (not available for lazy registration) */
  location?: {
    /** Full file path */
    filePath: string;
    /** Line number (1-indexed) */
    line: number;
    /** Column number (1-indexed) */
    column: number;
  };

  /** Variable name extracted from stack trace, if available */
  variableName?: string;

  /** Reference to parent observable in a pipe chain (using WeakRef to allow GC) */
  parent?: WeakRef<any>;

  /** Serializable parent ID (since WeakRef can't be serialized to storage) */
  parentId?: string;

  /** Array of operator names applied via pipe() */
  operators: string[];

  /** Tree path representing position in observable hierarchy (e.g., "0.2.1") */
  path: string;

  /** Which .pipe() call created this observable (for grouping) */
  pipeGroupId?: string;

  // === DYNAMIC CONTEXT (Subscribe-time fields) ===
  // If these are undefined -> created at pipe/module time (static)
  // If these are set -> created at subscribe time (dynamic)
  // Set by checking operatorContext.peek() in Observable constructor

  /**
   * Which operator created this observable at subscribe-time.
   * Examples: "switchMap", "mergeMap", "repeat"
   * Set when operatorContext stack has entries during construction.
   */
  createdByOperator?: string;

  /**
   * Which operator instance created this (for tracking multiple uses of same operator).
   * Each operator call gets unique ID (e.g., "op#5").
   */
  operatorInstanceId?: string;

  /**
   * Which subscription execution triggered creation.
   * Links dynamic observable back to the subscription that caused it.
   */
  triggeredBySubscription?: string;

  /**
   * Which observable emitted the event that triggered this.
   * Links back to the observable being operated on.
   */
  triggeredByObservable?: string;

  /**
   * Which event type triggered creation: 'next', 'error', or 'complete'.
   * Example: repeat creates new timer on 'complete' event.
   */
  triggeredByEvent?: 'next' | 'error' | 'complete';

  /**
   * Argument path if this observable came from an operator argument.
   * Uses lodash-style paths with .$return sigil for function returns.
   * Examples: "0.delay.$return", "0[1]", "0.notifier.$return"
   */
  argumentPath?: string;

  // === SUBJECT TRACKING ===

  /** Subject type if this is a Subject variant */
  subjectType?: 'Subject' | 'BehaviorSubject' | 'ReplaySubject' | 'AsyncSubject';

  /** True if this Subject was created internally by an operator (e.g., share) */
  isInternalSubject?: boolean;

  /** True if this observable was lazily registered at subscribe-time rather than intercepted at construction */
  lazyRegistered?: boolean;
}

/**
 * SUBSCRIBE TIME: Subscription instance metadata
 *
 * Captured when .subscribe() is called.
 * Represents the dynamic execution tree.
 */
export interface SubscriptionMetadata {
  id: string;
  observableId: string;
  subscribedAt: number;
  unsubscribedAt?: number;           // Not null = unsubscribed

  // Subscribe tree structure
  parentSubscriptionId?: string;
  childSubscriptionIds: string[];

  // Bidirectional linking (subscribe-time -> pipe-time)
  triggeredByObservableId?: string;  // Which observable caused this subscription
  triggeredByOperator?: string;      // Which operator (e.g., "switchMap")

  // Execution tracking (for animation/replay)
  emissionIds: string[];
  errorIds: string[];
  completedAt?: number;              // Not null = completed
}

/**
 * ARGUMENT TIME: Argument path using lodash-style string syntax
 *
 * Uses .$return sigil for function returns (NOT "()").
 * Examples:
 * - "0" = first parameter
 * - "0.delay" = delay property of first parameter object
 * - "0.delay.$return" = observable returned from calling delay function
 * - "0[1]" = second element of array in first parameter
 * - "0.notifier.$return" = function return in notifier property
 */
export type ArgumentPath = string;

/**
 * ARGUMENT TIME: Cross-observable relationship from operator arguments
 *
 * Tracks when observables are passed as arguments to operators.
 * Example: repeat({ delay: () => timer(1000) }) creates a relationship
 * from repeat to the timer observable at path "0.delay.$return".
 */
export interface ArgumentRelationship {
  relationshipId: string;
  operatorName: string;
  operatorInstanceId: string;          // Each operator call gets unique ID
  sourceObservableId: string;          // Observable created by operator
  arguments: Map<ArgumentPath, string>; // path -> observableId
  createdAt: string;
}

/**
 * Emission tracking for animation/replay
 *
 * Captures every value that flows through the system.
 * Used to animate value propagation in the debugger UI.
 */
export interface Emission {
  id: string;
  subscriptionId: string;
  observableId: string;
  value: any;
  timestamp: number;
  sourceEmissionId?: string;           // What caused this (for operators)
  operatorName?: string;               // Which operator transformed it
}

/**
 * Error tracking
 */
export interface ErrorEvent {
  id: string;
  subscriptionId: string;
  observableId: string;
  error: any;
  timestamp: number;
}

/**
 * Operator execution context
 *
 * Pushed onto the operatorContext stack when operator events fire.
 * Observable constructor checks this to mark dynamically-created observables.
 *
 * Example: When switchMap's next event fires and creates an inner observable,
 * that observable's constructor peeks this context and marks itself.
 */
export interface OperatorExecutionContext {
  operatorName: string;
  operatorInstanceId: string;
  subscriptionId: string;
  observableId: string;
  event: 'next' | 'error' | 'complete';
  value?: any;
  timestamp: number;
}

/**
 * Pipe context
 *
 * Pushed onto the pipeContext stack when .pipe() is called.
 * Used to group operators and track pipe-time structure.
 */
export interface PipeContext {
  pipeId: string;
  sourceObservableId: string;
  operators: {
    name: string;
    position: number;
  }[];
  startedAt: number;
}

/**
 * Subscription context
 *
 * Pushed onto the subscriptionContext stack when .subscribe() is called.
 * Used to track nested subscriptions and link them together.
 */
export interface SubscriptionContext {
  subscriptionId: string;
  observableId: string;
  parentSubscriptionId?: string;
  depth: number;
}
