# RxJS Runtime Devtools - Implementation Spec

## Overview
Build a runtime devtools for RxJS that captures observable creation, pipe chains, and subscription trees similar to React DevTools component tree.

## Architecture Decisions

### 1. Observable Creation Tracking
- **Approach**: Vite alias in dev mode pointing to wrapped Observable
- **Location**: `src/tracking/observable-wrapper.ts`
- **Requirement**: Same I/O as rxjs, no breaking changes
- **Implementation**: 
  - Re-export everything from 'rxjs'
  - Wrap Observable constructor to capture creation context via stack trace
  - Parse stack to get file:line:variable-name

```typescript
// vite.config.ts alias in dev:
// 'rxjs' -> './src/tracking/observable-wrapper.ts'
```

### 2. Storage Strategy
- Use **WeakMap** for all observable metadata (prevent leaks)
- Use **Map** for active subscriptions (strong refs while alive)
- Move to WeakMap on unsubscribe
- Registry = flat table with id -> instance lookup (SQL-style)
- Must also support tree traversal via parent references

### 3. Monkey-Patching Targets
**Priority: Top 20 operators first, then expand**

Patch points:
- `Observable.prototype.pipe` - capture operator chain
- `Observable.prototype.subscribe` - track subscription lifecycle
- Special handling for: `share`, `shareReplay`, `repeat`, `retry` (stateful operators)

### 4. Naming Strategy
- **Primary**: Stack trace parsing to extract variable names
- **Future**: oxc/rolldown plugin to inject `__track()` calls with file:line:name
  - Note: oxc plugin would be more reliable but harder to implement
  - Stack parsing is good enough for MVP
  - TODO comment in code mentioning oxc as next evolution

### 5. Data Structure

```typescript
// WeakMap storage
const observableMetadata = new WeakMap<Observable<any>, {
  id: string;                          // unique id
  createdAt: string;                   // file:line from stack
  variableName?: string;               // parsed from stack or __track
  parent?: WeakRef<Observable<any>>;   // for pipe chains
  operators: string[];                 // operator names in this pipe
  path: string;                        // "0.2.1" tree path
}>();

// Strong refs for active subs
const activeSubscriptions = new Map<string, {
  id: string;
  observableId: string;     // link to observable
  subscribedAt: number;
  parent?: string;          // parent subscription id
  children: string[];       // child subscription ids
}>();

// Flat registry for quick lookup (can be WeakMap too)
const observableRegistry = new WeakMap<string, WeakRef<Observable<any>>>();
```

## Implementation Tasks

### Task 1: Observable Wrapper & Stack Parsing
**File**: `src/tracking/observable-wrapper.ts`

Requirements:
- Export class Observable<T> extends RxJSObservable<T>
- In constructor, capture `new Error().stack`
- Parse stack to extract:
  - File path + line number
  - Variable name (if possible from `const xyz$ = new Observable`)
- Store in observableMetadata WeakMap
- Re-export all of rxjs: `export * from 'rxjs'`

Stack parsing notes:
- Look for lines like: `at <module> (file:///path/to/file.ts:42:15)`
- Extract variable from surrounding context if possible
- Fallback to "Observable#N" if can't parse

### Task 2: Pipe Patching
**File**: `src/tracking/pipe-patch.ts`

Requirements:
- Save original `Observable.prototype.pipe`
- Override to:
  1. Call original pipe with operators
  2. Extract operator names (use `func.name` or `displayName` property)
  3. Create metadata entry for result observable:
     - Link to parent via WeakRef
     - Store operator list
     - Generate path (parent.path + "." + index)
  4. Return result

Operator naming priority:
1. `operator.displayName` if exists
2. `operator.name` (function name)
3. Built-in RxJS operator detection (import names)
4. Fallback: "operator"

### Task 3: Subscribe Patching
**File**: `src/tracking/subscribe-patch.ts`

Requirements:
- Save original `Observable.prototype.subscribe`
- Override to:
  1. Generate subscription id
  2. Track in activeSubscriptions Map
  3. Link to observable metadata
  4. Detect parent subscription (use context stack)
  5. Call original subscribe
  6. Wrap returned subscription.unsubscribe() to move to WeakMap

Context tracking:
- Use array stack: `const subContextStack: string[] = []`
- Push subscription id before subscribe, pop after
- Parent = top of stack

### Task 4: Special Operator Handling
**File**: `src/tracking/special-operators.ts`

Operators needing special tracking:
- **share/shareReplay**: Track reference count, know when shared
- **repeat**: Track iteration count
- **retry**: Track retry attempts

Approach: Detect these in pipe, wrap them to emit state updates

### Task 5: Query API
**File**: `src/tracking/debugger-api.ts`

Export class `RxJSDebugger` with methods:
- `getObservableById(id)` - lookup in registry
- `getObservableMetadata(obs)` - get metadata
- `getActiveSubscriptions()` - list all active
- `getSubscriptionTree(subId)` - build parent/child tree
- `getPipelineChain(obs)` - walk parent refs to root
- `getAllRoots()` - observables with no parent

### Task 6: Dev Setup
**File**: `vite.config.ts` addition

Add alias:
```typescript
resolve: {
  alias: {
    'rxjs': path.resolve(__dirname, 'src/tracking/observable-wrapper.ts')
  }
}
```

## Testing Strategy
Create test file with common patterns:
- Simple pipe chains
- Nested subscriptions (switchMap, mergeMap)
- Shared observables
- Multiple subscriptions to same observable
- Retry/repeat scenarios

## Success Criteria
1. Can capture all observable creations with file:line
2. Can traverse pipe chain from any observable to root
3. Can see active subscription tree
4. Operator names are meaningful (not all "operator")
5. No memory leaks (WeakMap releases unused observables)
6. Works with top 20 RxJS operators

## Top 20 Operators to Support Initially
1. map
2. filter
3. tap
4. switchMap
5. mergeMap
6. concatMap
7. exhaustMap
8. take
9. takeUntil
10. debounceTime
11. distinctUntilChanged
12. share
13. shareReplay
14. combineLatest
15. merge
16. concat
17. withLatestFrom
18. catchError
19. retry
20. repeat

## Future Enhancements (NOT FOR INITIAL IMPLEMENTATION)
- oxc/rolldown plugin for `__track()` injection
- React DevTools-style UI
- Time-travel debugging
- Marble diagram generation
- Operator execution timing
- Memory usage tracking

## Notes
- This is dev-mode only, zero production overhead
- Focus on correctness over performance for MVP
- Stack parsing is "good enough" - don't over-engineer
- WeakMap everywhere to prevent leaks
- Flat registry + tree traversal capability
