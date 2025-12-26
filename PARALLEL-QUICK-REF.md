# Parallel Execution Quick Reference

## TL;DR

```bash
# Simple parallel run (recommended)
./run-parallel-isolated.sh

# Or manual control
./run-task.sh 01      # Wave 1: Sequential
./run-task.sh 02      # Wave 2: Sequential

# Wave 3: Parallel (Tasks 3 & 4)
claude-code tasks/task-03-context.md tasks/task-03-pipe-patch.md &
claude-code tasks/task-04-context.md tasks/task-04-subscribe-patch.md &
wait

# Wave 4: Parallel (Tasks 5 & 6)
claude-code tasks/task-05-debugger-api.md &
claude-code tasks/task-06-special-operators.md &
wait
```

## Dependency Graph

```
Wave 1 (Sequential):
  Task 1: stack-parser

Wave 2 (Sequential):
  Task 2: observable-wrapper (depends on 1)

Wave 3 (PARALLEL):
  Task 3: pipe-patch (depends on 2)
  Task 4: subscribe-patch (depends on 2)
  ↑ These two are independent!

Wave 4 (PARALLEL):
  Task 5: debugger-api (depends on 3 & 4)
  Task 6: special-operators (depends on 3 & 4)
  ↑ These two are independent!
```

## Why This Works

### Wave 3 Parallelization
**Task 3** (pipe-patch.ts) and **Task 4** (subscribe-patch.ts):
- ✅ Different files - no write conflicts
- ✅ Both patch different methods (pipe vs subscribe)
- ✅ Both only READ from Task 2 (registry)
- ✅ Neither imports from the other
- ✅ Clear interface contracts

### Wave 4 Parallelization
**Task 5** (debugger-api.ts) and **Task 6** (special-operators.ts):
- ✅ Different files - no write conflicts
- ✅ Both READ from Tasks 3 & 4
- ✅ Neither imports from the other
- ✅ Task 6 writes slightly to Task 3, but it's append-only

## Context Files Explained

### task-03-context.md
Tells Task 3:
- "You own pipe-patch.ts"
- "Task 4 is writing subscribe-patch.ts, ignore it"
- "Only read from registry.ts"
- "Export patchPipe() and unpatchPipe()"

### task-04-context.md  
Tells Task 4:
- "You own subscribe-patch.ts"
- "Task 3 is writing pipe-patch.ts, ignore it"
- "Only read from registry.ts"
- "Export patchSubscribe() and unpatchSubscribe()"

This keeps agents focused and prevents conflicts.

## Time Savings

Sequential: ~60-90 minutes
- Task 1: 10 min
- Task 2: 15 min
- Task 3: 15 min
- Task 4: 15 min
- Task 5: 20 min
- Task 6: 15 min

Parallel: ~35-50 minutes
- Wave 1: 10 min
- Wave 2: 15 min
- Wave 3: 15 min (3+4 parallel)
- Wave 4: 20 min (5+6 parallel)

**~40% time savings**

## Scripts Available

1. **run-parallel-isolated.sh** (RECOMMENDED)
   - Runs all waves automatically
   - Uses context files
   - Validates no conflicts
   - Runs tests after each wave
   - Full error handling

2. **run-parallel.sh** (simpler)
   - Runs waves in parallel
   - No context isolation
   - Basic logging
   - Good for quick runs

3. **run-task.sh** (sequential)
   - Run one task at a time
   - Good for debugging
   - Full control

## Troubleshooting

### Conflict Detected
```bash
# Check what imported what
grep -r "import.*from.*pipe-patch" src/tracking/subscribe-patch.ts

# Should return nothing - they shouldn't cross-import
```

### Agent Confused About Scope
- Check if context file exists
- Verify context file is being used: `cat logs/task-03.log | grep "Context: YES"`
- Add more explicit boundaries in context file

### Tests Failing After Parallel Run
```bash
# Run integration test
npm test

# If fails, check for:
# 1. Missing exports
# 2. Undefined imports  
# 3. Type mismatches
```

### Want to Re-run Just One Task
```bash
# After parallel run, re-run individual task
./run-task.sh 03

# Or with context
claude-code tasks/task-03-context.md tasks/task-03-pipe-patch.md
```

## Monitoring Parallel Execution

```bash
# In another terminal, watch logs live
tail -f logs/task-03.log &
tail -f logs/task-04.log &

# Or watch all
watch -n 1 'ls -lh logs/*.log'
```

## Best Practices

1. **Always use context files for Wave 3 & 4**
   - Prevents scope creep
   - Keeps agents focused
   - Reduces conflicts

2. **Run tests after each wave**
   - Catch issues early
   - Don't continue if tests fail
   - Integration tests at the end

3. **Review logs after parallel runs**
   - Check for warnings
   - Verify no unexpected behavior
   - Look for cross-imports

4. **Start with sequential if unsure**
   - Get familiar with tasks first
   - Then try parallel
   - Can always fall back

## Advanced: Different Claude Models

```bash
# Use Opus for complex tasks, Sonnet for simple
claude-code --model claude-opus-4-1-20241129 tasks/task-05-debugger-api.md &
claude-code --model claude-sonnet-4-5-20250929 tasks/task-06-special-operators.md &
```

## Validation Checklist

After parallel execution:
- [ ] No errors in logs
- [ ] All files generated
- [ ] No cross-imports between parallel tasks
- [ ] Tests pass
- [ ] Exports match interface contracts
- [ ] No duplicate code

## When Things Go Wrong

### Nuclear Option (Start Over)
```bash
# Clean everything
rm -rf src/tracking/*
rm -rf logs/*

# Run sequential to establish baseline
./run-task.sh 01
./run-task.sh 02
./run-task.sh 03
./run-task.sh 04
./run-task.sh 05
./run-task.sh 06
```

### Surgical Option (Fix One Task)
```bash
# Identify problem task
npm test -- task-03

# Delete just that file
rm src/tracking/pipe-patch.ts

# Re-run with context
claude-code tasks/task-03-context.md tasks/task-03-pipe-patch.md

# Test again
npm test -- pipe-patch
```

## Success Metrics

You'll know it worked when:
- ✅ All 6 tasks completed
- ✅ All tests passing
- ✅ No import conflicts
- ✅ ~40% faster than sequential
- ✅ Code quality same as sequential

Happy parallel coding! 🚀
