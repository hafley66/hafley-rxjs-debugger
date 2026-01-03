/**
 * User Code Transform for HMR
 *
 * AST-based transform that wraps RxJS observables and subscriptions
 * with __$ and __$.sub() for HMR tracking.
 *
 * Before:
 *   import { of } from 'rxjs'
 *   const data$ = of(1, 2, 3)
 *   data$.subscribe(console.log)
 *
 * After:
 *   import { _rxjs_debugger_module_start } from "rxjs-debugger/hmr"
 *   import { of } from 'rxjs'
 *   const __$ = _rxjs_debugger_module_start(import.meta.url)
 *   const data$ = __$("data$:a1b2c3d4", () => of(1, 2, 3))
 *   __$.sub("sub:e5f6g7h8", () => data$.subscribe(console.log))
 *   __$.end()
 */

import MagicString from "magic-string"

// Types
interface OxcParseResult {
  program: any
  errors: any[]
}

type ParseSyncFn = (filename: string, code: string, options?: any) => OxcParseResult

export interface UserTransformOptions {
  include?: RegExp
  exclude?: RegExp
  hmrImport?: string
}

interface TransformTarget {
  type: "observable" | "subscription"
  varName?: string
  start: number
  end: number
  node: any
}

// Known RxJS creators (used to validate imports)
const KNOWN_RXJS_CREATORS = new Set([
  "of", "from", "interval", "timer", "defer", "range",
  "fromEvent", "fromEventPattern", "ajax", "fromFetch",
  "combineLatest", "merge", "forkJoin", "zip", "race", "concat",
])

const KNOWN_SUBJECT_CLASSES = new Set([
  "Subject", "BehaviorSubject", "ReplaySubject", "AsyncSubject",
])

// Collect imports from rxjs modules
function collectRxjsImports(ast: any): { creators: Set<string>; subjects: Set<string>; lastImportEnd: number } {
  const creators = new Set<string>()
  const subjects = new Set<string>()
  let lastImportEnd = 0

  for (const stmt of ast.body || []) {
    if (stmt.type === "ImportDeclaration") {
      // Track last import position (handles interleaved imports)
      if (stmt.end > lastImportEnd) {
        lastImportEnd = stmt.end
      }

      const source = stmt.source?.value
      if (!source || !source.startsWith("rxjs")) continue

      for (const spec of stmt.specifiers || []) {
        if (spec.type === "ImportSpecifier") {
          const name = spec.local?.name || spec.imported?.name
          if (KNOWN_RXJS_CREATORS.has(name)) {
            creators.add(name)
          }
          if (KNOWN_SUBJECT_CLASSES.has(name)) {
            subjects.add(name)
          }
        }
      }
    }
  }

  return { creators, subjects, lastImportEnd }
}

// FNV-1a hash for stable keys
function fnv1aHash(str: string): string {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

// Strip location info from AST for stable hashing
function normalizeAst(node: any): any {
  if (!node || typeof node !== "object") return node
  const clone: any = {}
  for (const key of Object.keys(node)) {
    if (["start", "end", "loc", "range", "span"].includes(key)) continue
    const val = node[key]
    if (Array.isArray(val)) {
      clone[key] = val.map(normalizeAst)
    } else if (val && typeof val === "object") {
      clone[key] = normalizeAst(val)
    } else {
      clone[key] = val
    }
  }
  return clone
}

function generateKey(prefix: string, node: any): string {
  const normalized = normalizeAst(node)
  const hash = fnv1aHash(JSON.stringify(normalized))
  return `${prefix}:${hash}`
}

// AST detection helpers - now take imported symbols as context
function isRxjsCreatorCall(node: any, importedCreators: Set<string>): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  return callee?.type === "Identifier" && importedCreators.has(callee.name)
}

function isSubjectConstruction(node: any, importedSubjects: Set<string>): boolean {
  if (node.type !== "NewExpression") return false
  const callee = node.callee
  return callee?.type === "Identifier" && importedSubjects.has(callee.name)
}

function isPipeCall(node: any): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  return callee?.type === "MemberExpression" && callee.property?.name === "pipe"
}

function isSubscribeCall(node: any): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee?.type !== "MemberExpression") return false
  const prop = callee.property?.name
  return prop === "subscribe" || prop === "forEach"
}

function isObservableExpression(node: any, creators: Set<string>, subjects: Set<string>): boolean {
  return isRxjsCreatorCall(node, creators) || isSubjectConstruction(node, subjects) || isPipeCall(node)
}

// Skip rules - don't transform inside these contexts
function shouldSkip(ancestors: any[]): boolean {
  return ancestors.some(a => {
    // Already inside __$ wrapper
    if (a.type === "CallExpression" && a.callee?.type === "Identifier" && a.callee.name === "__$") {
      return true
    }
    // Inside function body (not top-level declarations)
    if (a.type === "FunctionDeclaration" || a.type === "FunctionExpression" || a.type === "ArrowFunctionExpression") {
      return true
    }
    return false
  })
}

// Walk AST with ancestor tracking
function walkAst(node: any, visitor: (node: any, ancestors: any[]) => void, ancestors: any[] = []) {
  if (!node || typeof node !== "object") return

  visitor(node, ancestors)

  const newAncestors = [...ancestors, node]

  for (const key of Object.keys(node)) {
    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        walkAst(item, visitor, newAncestors)
      }
    } else if (child && typeof child === "object" && child.type) {
      walkAst(child, visitor, newAncestors)
    }
  }
}

// Collect all transform targets in a single pass
function collectTargets(
  ast: any,
  creators: Set<string>,
  subjects: Set<string>,
): TransformTarget[] {
  const targets: TransformTarget[] = []

  walkAst(ast, (node, ancestors) => {
    if (shouldSkip(ancestors)) return

    // Observable declarations: const x$ = of(1)
    if (node.type === "VariableDeclarator" &&
        node.id?.type === "Identifier" &&
        node.init &&
        isObservableExpression(node.init, creators, subjects)) {
      targets.push({
        type: "observable",
        varName: node.id.name,
        start: node.init.start,
        end: node.init.end,
        node: node.init,
      })
    }

    // Subscribe calls: x$.subscribe(...)
    if (isSubscribeCall(node)) {
      targets.push({
        type: "subscription",
        start: node.start,
        end: node.end,
        node,
      })
    }
  })

  return targets
}

// Apply transforms using MagicString (reverse order)
function applyTransforms(
  ms: MagicString,
  code: string,
  targets: TransformTarget[],
  insertPoint: number,
  hmrImport: string,
): void {
  if (targets.length === 0) return

  // Apply in reverse order to preserve positions
  const sorted = [...targets].sort((a, b) => b.start - a.start)

  for (const t of sorted) {
    const key = t.type === "observable"
      ? generateKey(t.varName!, t.node)
      : generateKey("sub", t.node)

    if (t.type === "observable") {
      ms.prependLeft(t.start, `__$("${key}", () => `)
      ms.appendRight(t.end, `)`)
    } else {
      ms.prependLeft(t.start, `__$.sub("${key}", () => `)
      ms.appendRight(t.end, `)`)
    }
  }

  // Module wrapper - add after wraps so positions are correct
  ms.prepend(`import { _rxjs_debugger_module_start } from "${hmrImport}"\n`)
  ms.appendRight(insertPoint, `\nconst __$ = _rxjs_debugger_module_start(import.meta.url)\n`)

  // Add __$.end() at the end of the original code (not append() which goes to final string end)
  const codeEnd = code.length
  ms.appendRight(codeEnd, `\n__$.end()\n`)
}

// File detection
export function shouldTransformUserCode(id: string, options: UserTransformOptions = {}): boolean {
  const {
    include = /\.[tj]sx?$/,
    // Exclude: node_modules, .d.ts, tests, AND our own tracking code (avoid circular imports)
    exclude = /node_modules|\.d\.ts|\.test\.|\.spec\.|\/tracking\/v2\//,
  } = options

  const cleanId = id.split("?")[0] ?? id
  if (!include.test(cleanId)) return false
  if (exclude.test(cleanId)) return false
  return true
}

// Main transform function
export function transformUserCode(
  code: string,
  id: string,
  parseSync: ParseSyncFn,
  options: UserTransformOptions = {},
): { code: string; map: any } | null {
  const { hmrImport = "@hafley/rxjs-debugger/hmr" } = options

  // Skip if already instrumented
  if (code.includes("_rxjs_debugger_module_start")) {
    return null
  }

  // Quick check: does this look like it uses RxJS?
  if (!code.includes("rxjs") && !code.includes("Subject") && !code.includes("pipe")) {
    return null
  }

  // Parse
  let ast: any
  try {
    const result = parseSync(id, code, { sourceType: "module" })
    if (result.errors.length > 0) return null
    ast = result.program
  } catch {
    return null
  }

  // Collect RxJS imports - only wrap symbols actually imported from rxjs
  const { creators, subjects, lastImportEnd } = collectRxjsImports(ast)

  // If no rxjs imports found, nothing to transform
  if (creators.size === 0 && subjects.size === 0) {
    // But we might still have .subscribe() calls - those don't need import verification
    // So we continue with empty sets for creators/subjects
  }

  // Collect targets using verified imports
  const targets = collectTargets(ast, creators, subjects)
  if (targets.length === 0) return null

  // Apply transforms
  const ms = new MagicString(code)
  applyTransforms(ms, code, targets, lastImportEnd, hmrImport)

  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: "boundary", source: id }),
  }
}
