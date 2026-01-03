# User Transform Test Gaps

**Date**: 2026-01-03
**Current**: 36 tests in `user-transform.test.ts` (up from 27)
**Status**: High priority gaps fixed

---

## High Priority (Break Stuff / Real User Patterns)

| Gap | Why Important | Status |
|-----|---------------|--------|
| **Aliased imports** `import { of as rxOf }` | Common pattern, would fail to detect | ✅ Fixed + tested |
| **Namespace imports** `import * as rx from 'rxjs'` | Another common pattern (`rx.of(1)`) | ✅ Fixed + tested |
| **Export declarations** `export const x$ = of(1)` | Very common in service files | ✅ Already worked |
| **Class properties** `class Foo { data$ = of(1) }` | React/Angular services | ✅ Fixed + tested |
| **let/var declarations** | Currently only tested const | ✅ Already worked |
| **Chained pipe().pipe()** | Real codebases do this | ✅ Already worked |

---

## Medium Priority (Completeness)

| Gap | Why Important | Status |
|-----|---------------|--------|
| **ReplaySubject / AsyncSubject** | Covered in KNOWN list, no test | ⬜ |
| **Other creators** `from(), interval(), combineLatest()` | Listed but not tested | ⬜ |
| **Class method bodies** | Should skip, similar to function bodies | ⬜ |
| **Subscribe inside callbacks** | Runtime handles but worth testing skip | ⬜ |
| **Mixed observable + subscription** | Combined scenario | ⬜ |

---

## Low Priority (Edge Cases)

| Gap | Why Important | Status |
|-----|---------------|--------|
| **.jsx files** | Should work, no test | ⬜ |
| **Parse errors** | Currently returns null | ⬜ |
| **Conditional expressions** `cond ? of(1) : of(2)` | Edge case | ⬜ |
| **Object literal values** `{ data$: of(1) }` | Less common | ⬜ |

---

## Hash Collision Scenarios (Added 2026-01-03)

| Test | Result | Notes |
|------|--------|-------|
| Two `of(1)` declarations (a$, b$) | ✅ Different keys | Var name prefix makes unique: `a$:17fa50f4`, `b$:17fa50f4` |
| Two identical `.subscribe(console.log)` | ✅ Different keys | Observable being subscribed (a$ vs b$) is part of AST hash |

---

## Planned: Nested Observable Structure

User request: "highly woven dynamic observables (switchMaps, manual subscribes with new Obs/Sub inside them)"

Potential approach: **Nested hash referencing parent structurally**

```typescript
// Example of what we might want:
const outer$ = of(1).pipe(
  switchMap(x => of(x).pipe(  // <- inner observable
    map(y => y * 2)
  ))
)

// Could generate hierarchical keys like:
// outer$:abc123
//   └── switchMap.0:def456 (parent=abc123)
//       └── pipe.0:ghi789 (parent=def456)
```

This needs planning - see `/vite-transform/nested-scope-design.md` (TBD)

---

## Not Gaps (Runtime Handles)

| Pattern | Why OK |
|---------|--------|
| Nested observables in args | Runtime arg-crawler decorates at call time |
| switchMap inner observables | Runtime decoration handles |
| Observables created inside functions | Created fresh each call, runtime tracks |

---

## Current Test Coverage (36 tests)

```
shouldTransformUserCode (7 tests)
├── accepts .ts, .tsx, .js
├── rejects node_modules
├── rejects .d.ts
└── rejects .test.ts, .spec.ts

transformUserCode
├── observable wrapping (5 tests)
│   ├── of() creation
│   ├── new Subject()
│   ├── new BehaviorSubject()
│   ├── .pipe() chains
│   └── multiple observables
├── subscription wrapping (3 tests)
│   ├── .subscribe() callback
│   ├── .subscribe() observer object
│   └── .forEach()
├── skip rules (4 tests)
│   ├── function body
│   ├── arrow function body
│   ├── non-rxjs same name
│   └── import verification
├── import ordering (2 tests)
│   ├── interleaved imports
│   └── multiple import blocks
├── key generation (2 tests)
│   ├── stable across whitespace
│   └── different for different content
├── module wrapper (2 tests)
│   ├── correct structure
│   └── source map generation
├── high priority gaps (7 tests) ← NEW
│   ├── aliased imports
│   ├── namespace imports
│   ├── export declarations
│   ├── class properties
│   ├── let declarations
│   ├── var declarations
│   └── chained pipe().pipe()
└── hash collision scenarios (2 tests) ← NEW
    ├── identical observable content
    └── identical subscription content
```

---

## Implementation Notes

### Aliased Imports
```typescript
// Current: collectRxjsImports only checks spec.local?.name
// Need: Also track aliased name mapping
import { of as createObs } from 'rxjs'
const x$ = createObs(1)  // Should wrap, currently won't
```

### Namespace Imports
```typescript
// Current: Only handles ImportSpecifier
// Need: Handle ImportNamespaceSpecifier
import * as rx from 'rxjs'
const x$ = rx.of(1)  // Should wrap, currently won't
```

### Class Properties
```typescript
// Current: Only handles VariableDeclarator
// Need: Handle PropertyDefinition
class Store {
  data$ = of(1)  // Should wrap
}
```

### Export Declarations
```typescript
// Current: Wraps init expression only
// Need: Verify export keyword preserved
export const x$ = of(1)  // Should become: export const x$ = __$("x$:...", () => of(1))
```
