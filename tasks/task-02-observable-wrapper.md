# Task 2: Observable Wrapper & Registry

## Objective
Create wrapped Observable class that captures creation context and maintains metadata registry.

## Files to Create
- `src/tracking/observable-wrapper.ts`
- `src/tracking/registry.ts`
- `src/tracking/types.ts`

## File 1: `src/tracking/types.ts`

Define core types:

```typescript
export interface ObservableMetadata {
  id: string;                           // Unique identifier
  createdAt: string;                    // ISO timestamp
  location: {
    filePath: string;
    line: number;
    column: number;
  };
  variableName?: string;                // Extracted from stack
  parent?: WeakRef<any>;                // Parent observable in pipe chain
  operators: string[];                  // Operators applied in pipe
  path: string;                         // Tree path like "0.2.1"
}

export interface SubscriptionMetadata {
  id: string;
  observableId: string;
  subscribedAt: number;
  unsubscribedAt?: number;
  parentSubscriptionId?: string;
  childSubscriptionIds: string[];
}
```

## File 2: `src/tracking/registry.ts`

Implement storage registries:

```typescript
import { ObservableMetadata, SubscriptionMetadata } from './types';

// WeakMap for observable metadata (auto-cleanup)
export const observableMetadata = new WeakMap<any, ObservableMetadata>();

// WeakMap for quick id -> observable lookup
// Use string key, WeakRef value to allow GC
const observableById = new Map<string, WeakRef<any>>();

// Strong refs for active subscriptions only
export const activeSubscriptions = new Map<string, SubscriptionMetadata>();

// Archive for unsubscribed (could be WeakMap or time-based cleanup)
export const archivedSubscriptions = new Map<string, SubscriptionMetadata>();

// Counter for unique IDs
let observableCounter = 0;
let subscriptionCounter = 0;

export function generateObservableId(): string {
  return `obs#${observableCounter++}`;
}

export function generateSubscriptionId(): string {
  return `sub#${subscriptionCounter++}`;
}

export function registerObservable(obs: any, metadata: ObservableMetadata): void {
  observableMetadata.set(obs, metadata);
  observableById.set(metadata.id, new WeakRef(obs));
}

export function getObservableById(id: string): any | undefined {
  const ref = observableById.get(id);
  return ref?.deref();
}

export function getMetadata(obs: any): ObservableMetadata | undefined {
  return observableMetadata.get(obs);
}
```

## File 3: `src/tracking/observable-wrapper.ts`

Main wrapper implementation:

```typescript
import { Observable as RxJSObservable } from 'rxjs';
import { getCallerInfo } from './stack-parser';
import { 
  generateObservableId, 
  registerObservable, 
  observableMetadata 
} from './registry';
import { ObservableMetadata } from './types';

export class Observable<T> extends RxJSObservable<T> {
  constructor(
    subscribe?: (subscriber: any) => any
  ) {
    super(subscribe);
    
    // Capture creation context
    const callerInfo = getCallerInfo();
    
    const metadata: ObservableMetadata = {
      id: generateObservableId(),
      createdAt: new Date().toISOString(),
      location: {
        filePath: callerInfo?.filePath || 'unknown',
        line: callerInfo?.line || 0,
        column: callerInfo?.column || 0,
      },
      variableName: callerInfo?.context,
      operators: [],
      path: '', // Will be set by pipe if needed
    };
    
    registerObservable(this, metadata);
  }
}

// Re-export everything else from rxjs
// This makes our wrapper a drop-in replacement
export * from 'rxjs';
```

## Setup Instructions

In `vite.config.ts` (or similar):
```typescript
export default {
  resolve: {
    alias: {
      // In dev mode, use our wrapper
      'rxjs': path.resolve(__dirname, 'src/tracking/observable-wrapper.ts')
    }
  }
}
```

## Requirements

### Observable Wrapper
- Extends RxJSObservable with same constructor signature
- Calls super() first to maintain proper Observable behavior
- Uses stack-parser to get creation location
- Generates unique ID for each instance
- Stores metadata in WeakMap immediately
- Zero behavioral changes to Observable functionality

### Registry
- Use WeakMap for observable metadata (prevents leaks)
- Use Map with WeakRef for id lookup (allows GC but keeps id valid)
- Provide helper functions for registration/lookup
- Keep counters for unique IDs

### Memory Safety
- Observables can be garbage collected normally
- WeakMap entries auto-cleanup
- WeakRef in id map allows GC
- Active subscriptions have strong refs (intentional)
- Archived subscriptions could have TTL cleanup

## Testing

Create `src/tracking/__tests__/observable-wrapper.test.ts`:

Test cases:
1. Observable creation registers metadata
2. Metadata includes location info
3. Same I/O as regular Observable
4. Multiple observables get unique IDs
5. Can retrieve metadata by id
6. WeakMap allows GC (mock/spy on WeakMap if needed)

## Edge Cases
- Stack parser returns null → use fallback values
- Observable created in node_modules → handle gracefully
- Subclass of Observable → should still capture correctly

## Validation
After implementation, verify:
```typescript
import { Observable } from './tracking/observable-wrapper';
import { getMetadata } from './tracking/registry';

const test$ = new Observable(sub => {
  sub.next(1);
  sub.complete();
});

const meta = getMetadata(test$);
console.log(meta);
// Should show: id, location, createdAt, etc.
```

## Dependencies
- Requires Task 1 (stack-parser) to be completed
- rxjs (peer dependency)

## Deliverables
- All three files with implementations
- Test file
- Inline comments explaining key decisions
- Type exports
