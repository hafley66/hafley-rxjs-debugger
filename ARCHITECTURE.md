# RxJS Devtools - Architecture Document

## Core Philosophy

**Three "Times" + Four Context Stacks = Complete Execution Trace**

1. **Pipe Time** (static) - When observables are created via operators
2. **Subscribe Time** (dynamic) - When .subscribe() is called and execution flows
3. **Argument Time** (relational) - When observables are passed as operator arguments

Four context stacks track execution:
1. **Pipe Context** - Which `.pipe()` call we're in
2. **Subscription Context** - Which subscription is executing
3. **Operator Execution Context** - Which operator event (next/error/complete) is firing
4. **Function Call Context** - (Future) Which wrapped function is executing

## Global Context Structure

```typescript
// Global tracking state
const globalContext = {
  // Pipe context stack
  pipeStack: [] as PipeContext[],

  // Subscription context stack
  subscriptionStack: [] as SubscriptionContext[],

  // Operator execution context stack
  operatorStack: [] as OperatorExecutionContext[],

  // Current root observable being created (optional)
  currentRootObservable?: string,
};

interface PipeContext {
  pipeId: string;              // "pipe#5"
  sourceObservableId: string;  // Which observable is being piped
  operators: {                 // Operators in this pipe call
    name: string;
    position: number;
  }[];
  startedAt: number;
}

interface SubscriptionContext {
  subscriptionId: string;
  observableId: string;
  parentSubscriptionId?: string;
  depth: number;
}

interface OperatorExecutionContext {
  operatorName: string;        // From func.name
  subscriptionId: string;
  observableId: string;
  event: 'next' | 'error' | 'complete';
  value?: any;
  timestamp: number;
}
```

## Key Design Patterns

### 1. Operators Decorated Once, Referenced Many Times

```typescript
// At init/import time:
import { map, filter, switchMap } from 'rxjs/operators';

// Decorate all operators once:
const decoratedMap = decorate(map);       // Uses map.name
const decoratedFilter = decorate(filter);
const decoratedSwitchMap = decorate(switchMap);

// Each usage just references the decorated version:
a$.pipe(decoratedMap(x => x * 2))  // No per-usage ID
b$.pipe(decoratedMap(x => x * 2))  // Same function ref
```

**Operators are stateless. The PIPE CALL creates the context.**

### 2. Pipe Call as Event/Closure

```typescript
// Trap pipe getter to wrap calls:
Object.defineProperty(Observable.prototype, 'pipe', {
  get() {
    const self = this;
    return function wrappedPipe(...operators) {
      const pipeId = generatePipeId();

      // Push pipe context
      pipeContext.push({
        pipeId,
        sourceObservableId: getMetadata(self)?.id,
        operators: operators.map((op, i) => ({
          name: op.name || 'operator',
          position: i
        })),
        startedAt: Date.now()
      });

      try {
        // Call original pipe
        const result = originalPipe.apply(self, operators);

        // Result observable knows it came from this pipe
        const meta = getMetadata(result);
        if (meta) {
          meta.pipeGroupId = pipeId;
        }

        return result;
      } finally {
        pipeContext.pop();
      }
    };
  }
});
```

### 3. Observable Tree Structure (DOM-like)

```typescript
// Pipe-time structure:
source$ (obs#1)
  └─ pipe#1 [map, filter]
     └─ result$ (obs#2)
        └─ pipe#2 [switchMap]
           └─ switched$ (obs#3)

// Subscribe-time structure:
sub#1 -> obs#3 (switched$)
  └─ sub#2 -> obs#2 (result$)
     └─ sub#3 -> obs#1 (source$)
        └─ sub#4 -> obs#7 (inner$ from switchMap)

// Observable metadata links to pipe-time structure
// Subscription metadata links to subscribe-time structure
// Context stacks link them together during execution
```

### 4. Argument Paths with `.$return` Sigil

Use lodash-style paths, append `.$return` for function returns:

```typescript
// Examples:
"0"                    // Direct parameter
"0.delay"              // Object property
"0.delay.$return"      // Function return (NOT "0.delay()")
"0[1]"                 // Array element
"0.notifier.$return"   // Function in notifier property

// Use lodash for actual path manipulation:
import { get, set } from 'lodash';

const config = { delay: () => timer(1000) };
const delayFn = get(config, 'delay');  // Get the function
// When called, mark return with path "0.delay.$return"
```

### 5. Decorator Simplicity

```typescript
// Simple decorator that just uses func.name:
function decorate(operatorFn: Function): Function {
  const operatorName = operatorFn.name || 'operator';

  return function decorated(...args: any[]) {
    // Crawl args for observables/functions (with lodash)
    const { observables, wrappedArgs } = crawlArguments(args, operatorName);

    // Register ArgumentRelationship if found
    if (observables.size > 0) {
      registerArgumentRelationship({
        operatorName,
        pipeGroupId: pipeContext.peek()?.pipeId,
        arguments: observables
      });
    }

    // Get operator implementation with wrapped args
    const impl = operatorFn(...wrappedArgs);

    // Wrap to intercept events
    return (source: Observable<any>) => {
      return new Observable(subscriber => {
        const ctx = {
          operatorName,
          subscriptionId: subscriptionContext.peek()?.subscriptionId,
          observableId: getMetadata(source)?.id,
        };

        return impl(source).subscribe({
          next: (value) => {
            operatorContext.push({ ...ctx, event: 'next', value, timestamp: Date.now() });
            try { subscriber.next(value); }
            finally { operatorContext.pop(); }
          },
          error: (err) => {
            operatorContext.push({ ...ctx, event: 'error', timestamp: Date.now() });
            try { subscriber.error(err); }
            finally { operatorContext.pop(); }
          },
          complete: () => {
            operatorContext.push({ ...ctx, event: 'complete', timestamp: Date.now() });
            try { subscriber.complete(); }
            finally { operatorContext.pop(); }
          }
        });
      });
    };
  };
}
```

## Proxying Observable at Dev Time

To avoid circular dependencies, swap Observable at dev time:

```typescript
// vite.config.ts or webpack config:
export default {
  resolve: {
    alias: {
      'rxjs': path.resolve(__dirname, 'src/tracking/rxjs-proxy.ts')
    }
  }
}

// src/tracking/rxjs-proxy.ts:
import { Observable as RxJSObservable } from 'rxjs/dist/esm5/internal/Observable';
import { TrackedObservable } from './observable-wrapper';

// Export our tracked version as Observable
export { TrackedObservable as Observable };

// Re-export everything else
export * from 'rxjs/dist/esm5/operators';
export * from 'rxjs/dist/esm5/index';
```

This way:
- User imports from 'rxjs' → gets our tracked version
- Internal tracking code imports from 'rxjs/dist/...' → gets original
- No circular dependencies

## Using Lodash for Power

```typescript
import { get, set, transform } from 'lodash';

// Recursive argument crawling:
function crawlArguments(args: any[], operatorName: string) {
  const observables = new Map<string, string>();

  function crawl(obj: any, path: string) {
    if (isObservable(obj)) {
      observables.set(path, getMetadata(obj)?.id);
    } else if (typeof obj === 'function') {
      // Wrap function
      const wrapped = wrapFunction(obj, path, operatorName);
      set(args, path, wrapped);  // Replace in original args
    } else if (typeof obj === 'object' && obj !== null) {
      // Use lodash transform for deep crawling
      transform(obj, (result, value, key) => {
        const childPath = Array.isArray(obj) ? `${path}[${key}]` : `${path}.${key}`;
        crawl(value, childPath);
      });
    }
  }

  args.forEach((arg, i) => crawl(arg, String(i)));

  return { observables, wrappedArgs: args };
}
```

## Memory Management

- **Observable metadata**: WeakMap (auto-cleanup when observable is GC'd)
- **Subscription metadata**: Map with strong refs while active, WeakMap for archived
- **Operator refs**: WeakRef in metadata (allow GC)
- **Function refs**: WeakRef (allow GC)
- **Context stacks**: Plain arrays (cleared after use)
- **Serializable**: All IDs are strings, can be serialized for devtools

## Serialization Strategy

For sending to devtools UI:
```typescript
interface SerializableSnapshot {
  observables: {
    id: string;
    location: { filePath: string; line: number; column: number };
    parent?: string;  // Parent observable ID
    pipeGroupId?: string;
    createdByOperator?: string;
    triggeredByEvent?: string;
  }[];

  subscriptions: {
    id: string;
    observableId: string;
    parentSubscriptionId?: string;
    active: boolean;
    emissions: number;
    errors: number;
  }[];

  pipeGroups: {
    id: string;
    sourceObservableId: string;
    operators: string[];
  }[];

  relationships: {
    id: string;
    operatorName: string;
    arguments: Record<string, string>;  // path -> observableId
  }[];
}

// Use WeakRef.deref() to check if still alive before serializing
```

## Next: Full Repeat Example Walkthrough

See REPEAT-WALKTHROUGH.md for detailed step-by-step execution trace.
