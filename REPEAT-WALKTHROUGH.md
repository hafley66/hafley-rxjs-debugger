# Full Walkthrough: repeat({ delay: () => timer(1000) })

This document walks through every step of tracking a `repeat` operator with a delay function, showing how all context stacks interact.

## User Code

```typescript
import { interval } from 'rxjs';
import { take, repeat } from 'rxjs/operators';

const source$ = interval(500).pipe(take(3));  // Emits 0, 1, 2 then completes

const result$ = source$.pipe(
  repeat({ count: 2, delay: () => timer(1000) })
);

result$.subscribe(value => console.log(value));
```

## Initialization Phase

Before any user code runs, we initialize tracking:

```typescript
// 1. Patch Observable.prototype.pipe
patchPipe();

// 2. Decorate all operators
const decoratedRepeat = decorate(repeat);  // Uses repeat.name
const decoratedTake = decorate(take);

// 3. Replace operator exports
// (In practice, done via import alias)
```

## PHASE 1: Pipe Time (Module Load)

### Step 1.1: Create source$

```typescript
const source$ = interval(500).pipe(take(3));
```

**What happens:**

```typescript
// interval(500) creates obs#1:
{
  id: "obs#1",
  createdAt: "2024-01-01T00:00:00.000Z",
  location: { filePath: "app.ts", line: 5, column: 17 },
  operators: [],
  path: ""
}

// User accesses .pipe (getter trap):
// - Returns wrapped pipe function

// User calls .pipe(take(3)):

// Push pipe context:
pipeContext.push({
  pipeId: "pipe#1",
  sourceObservableId: "obs#1",
  operators: [{ name: "take", position: 0 }],
  startedAt: 1704067200000
});

// decoratedTake(3) is called:
// - Crawls arguments: [3] (no observables)
// - No ArgumentRelationship created
// - Returns wrapped take operator

// Original pipe creates obs#2:
{
  id: "obs#2",
  createdAt: "2024-01-01T00:00:00.001Z",
  location: { filePath: "app.ts", line: 5, column: 17 },
  parent: WeakRef(obs#1),
  operators: ["take"],
  path: "1",
  pipeGroupId: "pipe#1"
}

// Pop pipe context
pipeContext.pop();

// Result: source$ = obs#2
```

### Step 1.2: Create result$

```typescript
const result$ = source$.pipe(
  repeat({ count: 2, delay: () => timer(1000) })
);
```

**What happens:**

```typescript
// User accesses .pipe (getter trap)
// User calls .pipe(repeat({ count: 2, delay: () => timer(1000) }))

// Push pipe context:
pipeContext.push({
  pipeId: "pipe#2",
  sourceObservableId: "obs#2",
  operators: [{ name: "repeat", position: 0 }],
  startedAt: 1704067200002
});

// decoratedRepeat({ count: 2, delay: () => timer(1000) }) is called:

// Crawl arguments:
crawlArguments([{ count: 2, delay: () => timer(1000) }], "repeat")

// Found:
// - "0.count" = 2 (primitive, skip)
// - "0.delay" = function (WRAP IT!)

// Wrap the delay function:
const originalDelayFn = config.delay;
const wrappedDelayFn = function(...args) {
  // Operator context is ALREADY SET when this runs
  const result = originalDelayFn.apply(this, args);

  if (isObservable(result)) {
    // Observable constructor already marked it
    // Just add argument path
    const meta = getMetadata(result);
    if (meta) {
      meta.argumentPath = "0.delay.$return";
    }
  }

  return result;
};

// Replace delay function in config:
config.delay = wrappedDelayFn;

// No observables found yet (delay hasn't been called)
// No ArgumentRelationship registered

// Original pipe creates obs#3:
{
  id: "obs#3",
  createdAt: "2024-01-01T00:00:00.003Z",
  location: { filePath: "app.ts", line: 5, column: 17 },
  parent: WeakRef(obs#2),
  operators: ["repeat"],
  path: "1.1",
  pipeGroupId: "pipe#2"
}

// Pop pipe context
pipeContext.pop();

// Result: result$ = obs#3
```

**State at end of Pipe Time:**
- 3 observables created: obs#1 (interval), obs#2 (take), obs#3 (repeat)
- 2 pipe groups: pipe#1 (take), pipe#2 (repeat)
- delay function is wrapped but never called yet
- No subscriptions exist yet

---

## PHASE 2: Subscribe Time (Execution Begins)

### Step 2.1: result$.subscribe()

```typescript
result$.subscribe(value => console.log(value));
```

**What happens:**

```typescript
// Wrapped subscribe is called (from subscribe-patch.ts):

// Generate sub#1:
const subMeta = {
  id: "sub#1",
  observableId: "obs#3",  // result$
  subscribedAt: 1704067200100,
  parentSubscriptionId: undefined,
  childSubscriptionIds: [],
  triggeredByObservableId: undefined,
  triggeredByOperator: undefined
};

// Register subscription:
activeSubscriptions.set("sub#1", subMeta);

// Push subscription context:
subscriptionContext.push({
  subscriptionId: "sub#1",
  observableId: "obs#3",
  depth: 0
});

// Call original subscribe:
// repeat operator's logic subscribes to source$ (obs#2)
```

### Step 2.2: repeat subscribes to source$

Inside repeat's implementation:

```typescript
// repeat needs to subscribe to source$ (obs#2)

// Generate sub#2:
const subMeta = {
  id: "sub#2",
  observableId: "obs#2",  // source$
  subscribedAt: 1704067200101,
  parentSubscriptionId: "sub#1",
  childSubscriptionIds: [],
  triggeredByObservableId: "obs#3",  // result$ triggered this
  triggeredByOperator: "repeat"
};

// Register:
activeSubscriptions.set("sub#2", subMeta);

// Add to parent's children:
activeSubscriptions.get("sub#1").childSubscriptionIds.push("sub#2");

// Push subscription context:
subscriptionContext.push({
  subscriptionId: "sub#2",
  observableId: "obs#2",
  parentSubscriptionId: "sub#1",
  depth: 1
});

// Subscribe to source$
```

### Step 2.3: take subscribes to interval

Inside take's implementation:

```typescript
// take needs to subscribe to interval (obs#1)

// Generate sub#3:
const subMeta = {
  id: "sub#3",
  observableId: "obs#1",  // interval
  subscribedAt: 1704067200102,
  parentSubscriptionId: "sub#2",
  childSubscriptionIds: [],
  triggeredByObservableId: "obs#2",
  triggeredByOperator: "take"
};

// Register and link:
activeSubscriptions.set("sub#3", subMeta);
activeSubscriptions.get("sub#2").childSubscriptionIds.push("sub#3");

// Push subscription context:
subscriptionContext.push({
  subscriptionId: "sub#3",
  observableId: "obs#1",
  parentSubscriptionId: "sub#2",
  depth: 2
});

// Subscribe to interval
// interval starts emitting every 500ms
```

**Subscription tree at this point:**
```
sub#1 -> obs#3 (result$, repeat)
  └─ sub#2 -> obs#2 (source$, take)
     └─ sub#3 -> obs#1 (interval)
```

---

## PHASE 3: Execution Time (Values Flow)

### Step 3.1: interval emits 0

```typescript
// interval (obs#1) emits 0

// Decorated take intercepts (from decorateOperator):

operatorContext.push({
  operatorName: "take",
  subscriptionId: "sub#3",
  observableId: "obs#1",
  event: "next",
  value: 0,
  timestamp: 1704067200600  // 500ms later
});

try {
  // take's logic: count is 0, pass through
  subscriber.next(0);

  // Record emission:
  recordEmission({
    id: "emit#1",
    subscriptionId: "sub#3",
    observableId: "obs#1",
    value: 0,
    timestamp: 1704067200600
  });
} finally {
  operatorContext.pop();
}

// Value flows up to repeat, then to user's console.log
// Console: 0
```

### Step 3.2: interval emits 1

```typescript
// Similar to Step 3.1

operatorContext.push({
  operatorName: "take",
  subscriptionId: "sub#3",
  observableId: "obs#1",
  event: "next",
  value: 1,
  timestamp: 1704067201100  // 1000ms after subscribe
});

try {
  subscriber.next(1);
  recordEmission({ ... });  // emit#2
} finally {
  operatorContext.pop();
}

// Console: 1
```

### Step 3.3: interval emits 2

```typescript
// Similar to above

operatorContext.push({
  operatorName: "take",
  subscriptionId: "sub#3",
  observableId: "obs#1",
  event: "next",
  value: 2,
  timestamp: 1704067201600  // 1500ms after subscribe
});

try {
  subscriber.next(2);
  recordEmission({ ... });  // emit#3
} finally {
  operatorContext.pop();
}

// Console: 2
```

### Step 3.4: take completes (count reached)

```typescript
// take has received 3 values, completes

operatorContext.push({
  operatorName: "take",
  subscriptionId: "sub#3",
  observableId: "obs#1",
  event: "complete",
  timestamp: 1704067201600
});

try {
  // take unsubscribes from interval
  subscription.unsubscribe();  // sub#3

  // Archive sub#3:
  archiveSubscription("sub#3");

  // take completes downstream:
  subscriber.complete();
} finally {
  operatorContext.pop();
}

// Complete flows to repeat's complete handler
```

---

## PHASE 4: Repeat State Machine (First Iteration)

### Step 4.1: repeat receives complete

```typescript
// repeat's decorated complete handler:

operatorContext.push({
  operatorName: "repeat",
  subscriptionId: "sub#2",
  observableId: "obs#2",
  event: "complete",
  timestamp: 1704067201600
});

try {
  // repeat's logic:
  // - Check count: currentIteration = 0, config.count = 2
  // - Need to repeat!
  // - Check if delay function exists: YES

  // Call wrapped delay function:
  const delayNotifier$ = wrappedDelayFn();

  // Inside wrappedDelayFn:
  // - operatorContext is ALREADY SET (from push above)
  // - Call originalDelayFn():

  const result = timer(1000);  // Creates new observable!

  // timer() calls new Observable():
  // Observable constructor:
  {
    // Get stack trace:
    const callerInfo = getCallerInfo();  // Points to delay function

    // Check operator context:
    const ctx = operatorContext.peek();

    // ctx exists! We're in repeat's complete handler:
    const metadata = {
      id: "obs#4",  // NEW OBSERVABLE!
      createdAt: "2024-01-01T00:00:01.600Z",
      location: { filePath: "app.ts", line: 9, column: 48 },
      operators: [],
      path: "",

      // Dynamic context (from operator stack):
      createdByOperator: "repeat",
      operatorInstanceId: undefined,  // repeat doesn't have instance ID
      triggeredBySubscription: "sub#2",
      triggeredByObservable: "obs#2",
      triggeredByEvent: "complete",

      // Will be set by wrapper:
      argumentPath: "0.delay.$return"  // Set by wrappedDelayFn
    };

    registerObservable(obs#4, metadata);
  }

  // Back in wrappedDelayFn:
  const meta = getMetadata(result);
  meta.argumentPath = "0.delay.$return";  // Mark with path

  // Return timer observable:
  return result;  // obs#4

  // Now register ArgumentRelationship:
  registerArgumentRelationship({
    relationshipId: "rel#1",
    operatorName: "repeat",
    operatorInstanceId: undefined,
    sourceObservableId: "obs#3",  // result$
    arguments: new Map([
      ["0.delay.$return", "obs#4"]  // timer is at this path!
    ]),
    createdAt: "2024-01-01T00:00:01.600Z"
  });

  // repeat subscribes to timer:
  // Generate sub#4:
  const timerSubMeta = {
    id: "sub#4",
    observableId: "obs#4",  // timer
    subscribedAt: 1704067201600,
    parentSubscriptionId: "sub#2",
    childSubscriptionIds: [],
    triggeredByObservableId: "obs#2",
    triggeredByOperator: "repeat"
  };

  activeSubscriptions.set("sub#4", timerSubMeta);
  activeSubscriptions.get("sub#2").childSubscriptionIds.push("sub#4");

  // Subscribe to timer
  delayNotifier$.subscribe({
    complete: () => {
      // Timer completes after 1000ms
      // repeat resubscribes to source$
    }
  });

} finally {
  operatorContext.pop();
}
```

**Key insight**: The timer observable (obs#4) was created dynamically at subscribe-time, triggered by repeat's complete event, and is linked via:
- `createdByOperator: "repeat"`
- `triggeredBySubscription: "sub#2"`
- `triggeredByEvent: "complete"`
- `argumentPath: "0.delay.$return"`

### Step 4.2: timer completes (1 second later)

```typescript
// Timer (obs#4) completes after 1000ms

// repeat's delay completion handler:
// - Unsubscribe from timer: sub#4
// - Archive sub#4
// - Resubscribe to source$ (obs#2)

// Generate new subscription sub#5:
const subMeta = {
  id: "sub#5",
  observableId: "obs#2",
  subscribedAt: 1704067202600,  // 1 second after first complete
  parentSubscriptionId: "sub#2",  // Still child of repeat's sub
  childSubscriptionIds: [],
  triggeredByObservableId: "obs#3",
  triggeredByOperator: "repeat"
};

activeSubscriptions.set("sub#5", subMeta);

// sub#5 subscribes to source$ -> take -> interval
// Creates sub#6 to interval
// Interval starts emitting again: 0, 1, 2
// Console: 0, 1, 2

// Source completes again
// repeat's complete handler fires again
```

### Step 4.3: Second iteration (count = 2, second time)

```typescript
// repeat receives complete again

operatorContext.push({
  operatorName: "repeat",
  subscriptionId: "sub#5",  // New subscription
  observableId: "obs#2",
  event: "complete",
  timestamp: 1704067204100  // After second iteration
});

try {
  // Check count: currentIteration = 1, config.count = 2
  // Need to repeat one more time!

  // Call delay function again:
  const delayNotifier$ = wrappedDelayFn();

  // Creates NEW timer observable: obs#5
  {
    id: "obs#5",  // Different observable from obs#4!
    createdByOperator: "repeat",
    triggeredBySubscription: "sub#5",  // Different subscription!
    triggeredByObservable: "obs#2",
    triggeredByEvent: "complete",
    argumentPath: "0.delay.$return"
  }

  // Subscribe to new timer: sub#7
  // ... repeat process

} finally {
  operatorContext.pop();
}
```

**Key insight**: Each repeat iteration creates a NEW timer observable (obs#4, obs#5) and NEW subscription (sub#4, sub#7), but they're all linked to the same repeat operator via context.

---

## Final State Summary

### Observables Created
1. **obs#1**: interval(500) - pipe-time, static
2. **obs#2**: take(3) result - pipe-time, static
3. **obs#3**: repeat result - pipe-time, static
4. **obs#4**: timer(1000) - subscribe-time, dynamic (first iteration)
5. **obs#5**: timer(1000) - subscribe-time, dynamic (second iteration)

### Subscriptions
1. **sub#1**: User's subscription to obs#3
2. **sub#2**: repeat's subscription to obs#2
3. **sub#3**: take's subscription to obs#1 (first iteration) - archived
4. **sub#4**: repeat's subscription to obs#4 (timer) - archived
5. **sub#5**: take's subscription to obs#1 (second iteration) - archived
6. **sub#6**: repeat's subscription to obs#1 (via take, second iteration) - archived
7. **sub#7**: repeat's subscription to obs#5 (timer) - archived
8. (and so on...)

### Relationships
1. **rel#1**: repeat -> timer (obs#4) at path "0.delay.$return"
2. **rel#2**: repeat -> timer (obs#5) at path "0.delay.$return"

### Debugger Can Now Show

**Observable Tree:**
```
obs#1 (interval)
  └─ pipe#1 [take]
     └─ obs#2 (source$)
        └─ pipe#2 [repeat]
           └─ obs#3 (result$)

Dynamic observables:
  obs#4 (timer) - created by repeat at complete event, iteration 1
  obs#5 (timer) - created by repeat at complete event, iteration 2
```

**Subscription Tree (at any point in time):**
```
sub#1 -> obs#3
  └─ sub#2 -> obs#2
     ├─ sub#3 -> obs#1 [archived]
     ├─ sub#4 -> obs#4 [archived]
     ├─ sub#5 -> obs#2
     │  └─ sub#6 -> obs#1 [archived]
     └─ sub#7 -> obs#5 [archived]
```

**Timeline View:**
```
t=0ms:      result$.subscribe() creates sub#1, sub#2, sub#3
t=500ms:    interval emits 0 (emit#1)
t=1000ms:   interval emits 1 (emit#2)
t=1500ms:   interval emits 2 (emit#3), take completes
t=1600ms:   repeat creates timer (obs#4), subscribes (sub#4)
t=2600ms:   timer completes, repeat resubscribes to source
t=2600ms:   Creates sub#5, sub#6
t=3100ms:   interval emits 0 (emit#4)
...
```

**Animation:** Scrub through timeline, see values flowing, observables being created, subscriptions changing.

## Two Debugger Views

### 1. Current View (Live Snapshot)
Shows the **current state** right now - combines pipe tree (static structure) with active subscriptions:

```
obs#1 (interval) [1 active subscription]
  └─ pipe#1 [take]
     └─ obs#2 (source$) [2 active subscriptions]
        └─ pipe#2 [repeat]
           └─ obs#3 (result$) [1 active subscription]
              └─ obs#4 (timer) [1 active subscription] ← dynamic, created at t=1600ms
```

Like Chrome DevTools Elements panel - shows current DOM state.

### 2. Time-Travel View (Historical Replay)
- **Scrub timeline**: Move slider to any point in time, see tree state at that moment
- **Select & inspect**: Click any observable/subscription, see its full history:
  - When created
  - All emissions (values + timestamps)
  - All errors
  - When completed/unsubscribed
  - What triggered it (which event, which subscription)

Like React DevTools - select a component, see its props over time. Here: select obs#4, see it was created at t=1600ms by repeat's complete event on sub#2, lived for 1000ms, then completed.

**Example**: Click on `obs#2` → see it was subscribed to 3 times (sub#3, sub#5, sub#8) across 3 repeat iterations, each lasting ~1.5 seconds.

## What Makes This Work

1. **Context Stacks**: Track execution state at all times
2. **Wrapped Functions**: Capture closure at pipe-time, execute at subscribe-time
3. **Observable Constructor**: Checks context, marks dynamically-created observables
4. **Event Interception**: Every operator event (next/error/complete) sets context
5. **Lodash Paths**: Serializable argument paths link observables to operators
6. **Bidirectional Linking**: Navigate from observable -> subscription or subscription -> observable

This gives us **complete execution tracing** with **time-traveling debugging** capabilities!
