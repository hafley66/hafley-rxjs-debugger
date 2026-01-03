/**
 * Tests for user code HMR transforms
 *
 * Tests transformUserCode directly without full vite build.
 */

import { beforeAll, describe, expect, it } from "vitest"
import { shouldTransformUserCode, transformUserCode } from "../0_user-transform"

describe("user-transform", () => {
  let parseSync: any

  beforeAll(async () => {
    const oxc = await import("oxc-parser")
    parseSync = oxc.parseSync
  })

  describe("shouldTransformUserCode", () => {
    it("accepts .ts files", () => {
      expect(shouldTransformUserCode("/app/test.ts")).toBe(true)
    })

    it("accepts .tsx files", () => {
      expect(shouldTransformUserCode("/app/test.tsx")).toBe(true)
    })

    it("accepts .js files", () => {
      expect(shouldTransformUserCode("/app/test.js")).toBe(true)
    })

    it("rejects node_modules", () => {
      expect(shouldTransformUserCode("/app/node_modules/foo/index.ts")).toBe(false)
    })

    it("rejects .d.ts files", () => {
      expect(shouldTransformUserCode("/app/types.d.ts")).toBe(false)
    })

    it("rejects .test.ts files", () => {
      expect(shouldTransformUserCode("/app/foo.test.ts")).toBe(false)
    })

    it("rejects .spec.ts files", () => {
      expect(shouldTransformUserCode("/app/foo.spec.ts")).toBe(false)
    })
  })

  describe("transformUserCode", () => {
    const transform = (code: string, id = "/app/test.ts") =>
      transformUserCode(code, id, parseSync, { hmrImport: "@hafley/rxjs-debugger/hmr" })

    it("returns null for files without rxjs patterns", () => {
      const result = transform("const x = 1")
      expect(result).toBeNull()
    })

    it("returns null for already instrumented files", () => {
      const code = `
import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
const __$ = _rxjs_debugger_module_start(import.meta.url)
`
      const result = transform(code)
      expect(result).toBeNull()
    })

    describe("observable wrapping", () => {
      it("wraps of() creation", () => {
        const code = `import { of } from 'rxjs'
const data$ = of(1, 2, 3)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const data$ = __$("data$:f6b9a3e0", () => of(1, 2, 3))
          __$.end()
          "
        `)
      })

      it("wraps new Subject()", () => {
        const code = `import { Subject } from 'rxjs'
const events$ = new Subject()`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { Subject } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const events$ = __$("events$:b8dfa078", () => new Subject())
          __$.end()
          "
        `)
      })

      it("wraps new BehaviorSubject()", () => {
        const code = `import { BehaviorSubject } from 'rxjs'
const state$ = new BehaviorSubject(0)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { BehaviorSubject } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const state$ = __$("state$:552ee4c8", () => new BehaviorSubject(0))
          __$.end()
          "
        `)
      })

      it("wraps .pipe() chains", () => {
        const code = `import { of } from 'rxjs'
import { map } from 'rxjs/operators'
const doubled$ = source$.pipe(map(x => x * 2))`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          import { map } from 'rxjs/operators'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const doubled$ = __$("doubled$:62b0a516", () => source$.pipe(map(x => x * 2)))
          __$.end()
          "
        `)
      })

      it("wraps multiple observables in same file", () => {
        const code = `import { of, Subject } from 'rxjs'
const data$ = of(1)
const events$ = new Subject()`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of, Subject } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const data$ = __$("data$:17fa50f4", () => of(1))
          const events$ = __$("events$:b8dfa078", () => new Subject())
          __$.end()
          "
        `)
      })
    })

    describe("subscription wrapping", () => {
      it("wraps .subscribe() calls", () => {
        const code = `import { of } from 'rxjs'
data$.subscribe(console.log)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          __$.sub("sub:3e4b83e0", () => data$.subscribe(console.log))
          __$.end()
          "
        `)
      })

      it("wraps .subscribe() with observer object", () => {
        const code = `import { of } from 'rxjs'
data$.subscribe({ next: console.log, error: console.error })`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          __$.sub("sub:03e685b7", () => data$.subscribe({ next: console.log, error: console.error }))
          __$.end()
          "
        `)
      })

      it("wraps .forEach() calls", () => {
        const code = `import { of } from 'rxjs'
data$.forEach(console.log)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          __$.sub("sub:37bbc250", () => data$.forEach(console.log))
          __$.end()
          "
        `)
      })
    })

    describe("skip rules", () => {
      it("skips observables inside function bodies", () => {
        const code = `import { of } from 'rxjs'
function makeObs() {
  const inner$ = of(1)
  return inner$
}`

        const result = transform(code)

        // Should not wrap inner$ since it's inside a function
        expect(result).toBeNull()
      })

      it("skips observables inside arrow functions", () => {
        const code = `import { of } from 'rxjs'
const makeObs = () => {
  const inner$ = of(1)
  return inner$
}`

        const result = transform(code)

        expect(result).toBeNull()
      })

      it("skips non-rxjs functions with same name", () => {
        const code = `const of = (x: number) => x * 2
const data$ = of(1)`

        const result = transform(code)

        // 'of' is not imported from rxjs, should not wrap
        expect(result).toBeNull()
      })

      it("only wraps identifiers actually imported from rxjs", () => {
        const code = `import { of } from 'rxjs'
import { from } from './my-utils'
const a$ = of(1)
const b$ = from([1, 2])`

        const result = transform(code)

        // Should only wrap 'of', not 'from' since it's from my-utils
        expect(result).not.toBeNull()
        expect(result!.code).toContain('__$("a$:')
        expect(result!.code).not.toContain('__$("b$:')
      })
    })

    describe("import ordering", () => {
      it("handles imports after code (interleaved)", () => {
        const code = `const x = 1
import { of } from 'rxjs'
const data$ = of(1)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          const x = 1
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const data$ = __$("data$:17fa50f4", () => of(1))
          __$.end()
          "
        `)
      })

      it("handles multiple import blocks", () => {
        const code = `import { map } from 'rxjs/operators'
const config = {}
import { of } from 'rxjs'
const data$ = of(1)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { map } from 'rxjs/operators'
          const config = {}
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const data$ = __$("data$:17fa50f4", () => of(1))
          __$.end()
          "
        `)
      })
    })

    describe("key generation", () => {
      it("generates stable keys across whitespace changes", () => {
        const code1 = `import { of } from 'rxjs'
const x$ = of(1,2,3)`

        const code2 = `import { of } from 'rxjs'
const x$ = of(1, 2, 3)`

        const result1 = transform(code1)!
        const result2 = transform(code2)!

        // Same hash because whitespace is stripped from AST before hashing
        expect(result1.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:f6b9a3e0", () => of(1,2,3))
          __$.end()
          "
        `)
        expect(result2.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:f6b9a3e0", () => of(1, 2, 3))
          __$.end()
          "
        `)
      })

      it("generates different keys for different content", () => {
        const code1 = `import { of } from 'rxjs'
const x$ = of(1)`

        const code2 = `import { of } from 'rxjs'
const x$ = of(2)`

        const result1 = transform(code1)!
        const result2 = transform(code2)!

        // Different values = different hashes
        expect(result1.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:17fa50f4", () => of(1))
          __$.end()
          "
        `)
        expect(result2.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:d14c0a00", () => of(2))
          __$.end()
          "
        `)
      })
    })

    describe("module wrapper", () => {
      it("produces correct structure with import, init, and end", () => {
        const code = `import { of } from 'rxjs'
const x$ = of(1)`

        const result = transform(code)!

        expect(result.code).toMatchInlineSnapshot(`
          "import { _rxjs_debugger_module_start } from "@hafley/rxjs-debugger/hmr"
          import { of } from 'rxjs'
          const __$ = _rxjs_debugger_module_start(import.meta.url)

          const x$ = __$("x$:17fa50f4", () => of(1))
          __$.end()
          "
        `)
      })

      it("generates source map with mappings", () => {
        const code = `import { of } from 'rxjs'
const x$ = of(1)`

        const result = transform(code)!

        expect(typeof result.map.mappings).toBe("string")
        expect(result.map.mappings.length).toBeGreaterThan(0)
      })
    })
  })
})
