# Context Isolation Strategy for Parallel Agents

## Problem
When running multiple Claude Code agents in parallel, they might:
1. Conflict on file writes
2. Have inconsistent understanding of the codebase
3. Make incompatible decisions

## Solution: Pre-Context Files

Create "context files" for each parallel task that contains ONLY what that agent needs to know.

## Directory Structure
```
tasks/
├── task-03-pipe-patch.md           # Original spec
├── task-03-context.md              # Context isolation for Task 3
├── task-04-subscribe-patch.md      # Original spec  
├── task-04-context.md              # Context isolation for Task 4
└── shared-context.md               # Common knowledge for all
```

## Context File Template

```markdown
# Context for Task N

## Your Scope
You are responsible for: [specific files]
You should NOT modify: [other files]

## What You Need to Know
[Minimal info from dependencies]

## Assumptions About Other Code
[What other parallel tasks are doing]

## Interface Contract
[What you must provide for downstream tasks]

## DO NOT
- Import from files being written by other agents
- Make assumptions about implementation details
- Write to shared files
```

## Example: Tasks 3 & 4 Running in Parallel

### Task 3 Context (task-03-context.md)
```markdown
# Context for Task 3: Pipe Patching

## Your Scope
- You write: `src/tracking/pipe-patch.ts`
- You write tests: `src/tracking/__tests__/pipe-patch.test.ts`

## Dependencies (Already Complete)
Task 2 has completed and provided:
- `registry.ts` with these exports:
  - `getMetadata(obs): ObservableMetadata | undefined`
  - `observableMetadata: WeakMap`
  - `registerObservable(obs, meta): void`
  - `generateObservableId(): string`
- `types.ts` with `ObservableMetadata` interface

## What Task 4 Is Doing (Ignore It)
Task 4 is simultaneously working on subscribe patching.
- DO NOT import anything from subscribe-patch.ts
- DO NOT assume subscribe behavior
- Your pipe patching is independent of subscription tracking

## Your Interface Contract
Downstream tasks (5, 6) will import:
- `patchPipe(): void` - your main export
- `unpatchPipe(): void` - for cleanup

## Implementation Notes
- Only read from registry.ts (already written)
- Observable.prototype.pipe is globally shared, so you're modifying it
- Task 4 will modify Observable.prototype.subscribe separately
- These modifications are independent and don't conflict
```

### Task 4 Context (task-04-context.md)
```markdown
# Context for Task 4: Subscribe Patching

## Your Scope
- You write: `src/tracking/subscribe-patch.ts`
- You write tests: `src/tracking/__tests__/subscribe-patch.test.ts`

## Dependencies (Already Complete)
Task 2 has completed and provided:
- `registry.ts` with exports for subscription tracking
- `types.ts` with `SubscriptionMetadata` interface

## What Task 3 Is Doing (Ignore It)
Task 3 is simultaneously working on pipe patching.
- DO NOT import anything from pipe-patch.ts
- DO NOT assume pipe metadata exists
- Your subscribe tracking is independent

## Your Interface Contract
Downstream tasks (5, 6) will import:
- `patchSubscribe(): void`
- `unpatchSubscribe(): void`

## Implementation Notes
- Only read from registry.ts (already written)
- Observable.prototype.subscribe is globally shared
- Task 3 will modify Observable.prototype.pipe separately
- These modifications don't conflict
```

## Implementation Strategy

### 1. Create Context Files Before Running

```bash
# Generate context files for each parallel wave
./create-context-files.sh
```

### 2. Modify Task Specs to Reference Context

At the top of each task spec:
```markdown
# Task 3: Pipe Patching

**READ FIRST**: See `task-03-context.md` for scope and context isolation.

[rest of task spec...]
```

### 3. Run Agents with Combined Input

```bash
# Task 3 reads both files
claude-code tasks/task-03-context.md tasks/task-03-pipe-patch.md

# Task 4 reads both files
claude-code tasks/task-04-context.md tasks/task-04-subscribe-patch.md
```

## Key Isolation Principles

### 1. File Ownership
Each agent owns specific files. No shared file writes.

```
Task 3 owns: pipe-patch.ts, pipe-patch.test.ts
Task 4 owns: subscribe-patch.ts, subscribe-patch.test.ts
No overlap = No conflicts
```

### 2. Read-Only Dependencies
Agents can read from completed tasks but not modify.

```typescript
// Task 3 & 4 both can do:
import { getMetadata } from './registry';  // Task 2, complete

// But Task 3 CANNOT do:
import { patchSubscribe } from './subscribe-patch';  // Task 4, in progress
```

### 3. Interface Contracts
Each task declares what it will export for downstream.

```typescript
// Task 3 promises to export:
export function patchPipe(): void;
export function unpatchPipe(): void;

// Task 5 can safely assume these will exist
```

### 4. Minimal Context
Give each agent ONLY what it needs. Avoid info overload.

```markdown
# Good context
- You need getMetadata() from registry.ts
- It returns ObservableMetadata | undefined
- Your job: patch Observable.prototype.pipe

# Bad context (too much)
- Here's the entire registry.ts implementation...
- Here's how subscribe tracking works...
- Here's the history of RxJS...
```

## Validation Strategy

After parallel execution:

```bash
# Check for conflicts
./validate-parallel-output.sh

# Looks for:
# 1. Duplicate file modifications
# 2. Cross-imports between parallel tasks  
# 3. Missing exports from interface contracts
```

## Advanced: Shared Resources

If tasks MUST share a file (not recommended), use merge strategy:

```bash
# Task 3 writes to: src/tracking/index.ts (exports)
# Task 4 writes to: src/tracking/index.ts (exports)

# After both complete:
./merge-exports.sh  # Combines exports from both tasks
```

## Fallback: Sequential with Caching

If parallel causes issues, fall back to sequential but cache:

```bash
# Run sequentially but save intermediate state
./run-sequential-cached.sh

# Each task saves state
# If task N fails, restart from task N (not from scratch)
```

## Real Example: Wave 3 Execution

```bash
# Start both in parallel with isolated context
(
  cd agent-3-workspace
  claude-code ../tasks/task-03-context.md ../tasks/task-03-pipe-patch.md
) &

(
  cd agent-4-workspace  
  claude-code ../tasks/task-04-context.md ../tasks/task-04-subscribe-patch.md
) &

wait  # Wait for both to complete

# Merge outputs
cp agent-3-workspace/src/tracking/pipe-patch.* src/tracking/
cp agent-4-workspace/src/tracking/subscribe-patch.* src/tracking/

# Run integration test
npm test
```

## When NOT to Parallelize

Don't parallelize if:
1. Tasks have tight coupling (lots of cross-imports)
2. Agents need to make coordinated decisions
3. Shared files require complex merging
4. Task specs are ambiguous about boundaries

For this project, waves 3 and 4 are PERFECT for parallelization because:
- Clear file ownership
- No shared writes
- Minimal cross-dependencies
- Well-defined interfaces
