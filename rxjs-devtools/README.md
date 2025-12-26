# RxJS Runtime Devtools

Runtime debugging and introspection tools for RxJS observables.

## Setup Complete! 🎉

### Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run tasks with Claude Code:
   ```bash
   ./run-task.sh 01  # Stack parser
   ./run-task.sh 02  # Observable wrapper
   # ... continue through task 06
   ```

3. Run tests after each task:
   ```bash
   npm test
   ```

### Task Order

1. `task-01` - Stack trace parser
2. `task-02` - Observable wrapper & registry
3. `task-03` - Pipe method patching
4. `task-04` - Subscribe method patching
5. `task-05` - Debugger query API
6. `task-06` - Special operator handling

### Manual Claude Code Usage

If you prefer to run Claude Code directly:

```bash
# Make sure API key is set
export ANTHROPIC_API_KEY="your-key-here"

# Run on a specific task
claude-code tasks/task-01-stack-parser.md

# With network approval (recommended for sandbox)
claude-code --network-mode manual tasks/task-01-stack-parser.md
```

### Project Structure

```
rxjs-devtools/
├── src/
│   └── tracking/
│       ├── stack-parser.ts
│       ├── observable-wrapper.ts
│       ├── registry.ts
│       ├── types.ts
│       ├── pipe-patch.ts
│       ├── subscribe-patch.ts
│       ├── debugger-api.ts
│       ├── special-operators.ts
│       └── __tests__/
├── tasks/           # Claude Code task specifications
├── docs/            # Main specification document
└── package.json
```

### Vite Configuration

After implementation, add this to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'rxjs': path.resolve(__dirname, 'src/tracking/observable-wrapper.ts')
    }
  }
});
```

### Testing Strategy

Each task includes test specifications. Run tests with:

```bash
npm test                    # Run all tests
npm test stack-parser       # Run specific test file
npm test -- --watch         # Watch mode
```

### Debugging

Expose the debugger API globally for console access:

```typescript
// In your app initialization
import { debugger } from './tracking/debugger-api';

if (import.meta.env.DEV) {
  window.__rxjsDebugger = debugger;
}
```

Then in browser console:
```javascript
__rxjsDebugger.getActiveSubscriptions()
__rxjsDebugger.printSubscriptionTree('sub#0')
```

### Network Mode for Docker

If running in Docker with manual network approval:

```bash
# Claude Code with restricted network
claude-code --network-mode manual tasks/task-01-stack-parser.md

# Or disable network entirely
claude-code --no-network tasks/task-01-stack-parser.md
```

### Next Steps

1. Review the main spec: `docs/rxjs-devtools-spec.md`
2. Start with task 01: `./run-task.sh 01`
3. Test each implementation before moving to next task
4. Build incrementally - each task is independent but builds on previous
