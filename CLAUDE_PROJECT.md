# Claude Code Project Context

## Project Overview
Observable tracking library with automatic memory leak detection for JavaScript/TypeScript.

## Tech Stack & Tools

### Package Manager
- **pnpm** (v10.26.2) - Fast, disk-space efficient package manager

### Build System
- **rolldown-vite** (v7.3.0) - Rust-based bundler, drop-in Vite replacement
  - 10-30x faster than Rollup
  - Full Vite plugin compatibility
  - Package: `rolldown-vite` (not regular `vite`)

### Testing
- **vitest** (v4.0.16) - Fast Vite-native test runner
- **@vitest/ui** - Visual test interface
- All tests use globals (defined in vite.config.ts)

### Type Checking
- **tsgo** (@typescript/native-preview) - TypeScript 7 Go beta
  - 10x faster than tsc
  - Command: `tsgo` (not `tsc`)
  - Package: `@typescript/native-preview`

## Project Structure

```
/workspace
├── src/
│   ├── index.ts                     # Main entry point
│   └── tracking/
│       ├── stack-parser.ts          # Stack trace parser (COMPLETED)
│       └── __tests__/
│           └── stack-parser.test.ts # Tests (25 tests, all passing)
├── dist/                            # Build output (git-ignored)
├── tasks/                           # Task specifications
│   └── task-01-stack-parser.md      # COMPLETED
├── package.json                     # Library config
├── tsconfig.json                    # TypeScript config (strict mode, ESNext)
├── vite.config.ts                   # Rolldown-vite config
└── CLAUDE_PROJECT.md                # This file - project context for Claude

```

## Available Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build library with rolldown-vite

# Testing
pnpm test             # Run tests in watch mode
pnpm test:ui          # Run tests with visual UI
pnpm test:run         # Run tests once (CI mode)

# Type Checking
pnpm typecheck        # Type check with tsgo (fast!)
```

## Key Configuration Details

### Package.json
- Type: `"module"` (ESM only)
- Main: `./dist/index.js`
- Exports: ES modules only
- Library name: `observable-tracker`

### TypeScript Config
- Target: ES2022
- Module: ESNext
- Strict mode: Enabled
- Module resolution: Bundler
- Test globals: vitest/globals, node

### Vite Config
- Library mode
- Format: ES only
- Source maps: Enabled
- Test environment: Node
- Coverage provider: v8

## Code Conventions

### File Organization
- Source: `src/` directory
- Tests: `__tests__/` subdirectories next to source
- Test files: `*.test.ts` suffix

### Testing Standards
- Comprehensive test coverage required
- Test files use vitest globals (no imports needed)
- Edge cases must be covered
- Real-world usage scenarios included

### Type Safety
- All code must pass `tsgo --noEmit`
- Strict null checks enforced
- No implicit any
- Proper type guards for regex matches and array access

### Error Handling
- Library code must never throw
- Return null on failures
- Graceful degradation

## Completed Work

### Task 1: Stack Parser ✅
- Location: `src/tracking/stack-parser.ts`
- Tests: 25/25 passing
- Type check: ✅ Clean
- Build: ✅ Working (1.17 kB output)
- Features:
  - V8 stack trace parsing
  - Automatic frame filtering (node_modules, internals)
  - Context extraction and cleanup
  - Zero dependencies
  - Fast and safe

## Next Tasks
See `tasks/` directory for remaining task specifications.

## Installation Notes

If starting fresh or missing dependencies:
```bash
npm install -g pnpm          # Install pnpm globally if needed
pnpm install                 # Install all dependencies
```

## Build Output
- Output directory: `dist/`
- Format: ES module
- Includes source maps
- Tree-shakeable

## Notes for Future Claude Sessions
- Always use `pnpm` not `npm` or `yarn`
- Tests run automatically with vitest (no jest/mocha)
- Type checking uses `tsgo` not `tsc`
- Build uses `rolldown-vite` not regular `vite`
- All test files can use vitest globals without imports
- Library is ESM-only, no CommonJS
- When creating new features, follow the pattern from stack-parser:
  - Implementation in `src/` with inline docs
  - Tests in `__tests__/` subdirectory
  - Export from `src/index.ts`
  - Run tests and typecheck before considering complete
