import { createRequire } from "module"
import path from "path"
import type { Plugin, ResolvedConfig } from "rolldown-vite"
import { shouldTransformUserCode, transformUserCode } from "./0_user-transform"

const require = createRequire(import.meta.url)

type VitestConfig = ResolvedConfig & {
  test?: {
    browser?: {
      enabled?: boolean
    }
  }
}

export interface RxjsDebuggerPluginOptions {
  debug?: boolean
  patchModulePath?: string
  hmrModulePath?: string
  /** Transform user code to wrap observables/subscriptions. Default: true */
  transformUserCode?: boolean
  /**
   * Patch RxJS creation functions (of, from, etc.) with decorateCreate.
   * Default: false because we use proxy.* wrappers instead.
   * Enable if you want to track observables created directly via raw rxjs imports.
   */
  patchCreation?: boolean
}

const IMPORT_PATCH = (patchPath: string) =>
  `import { patchObservable as __patchObservable__, emit as __emit__, createId as __createId__, observableIdMap as __observableIdMap__, __isEnabled__ } from "${patchPath}";\n`

const IMPORT_DECORATE_OP = (patchPath: string) =>
  `import { decorateOperatorFun as __decorateOp__ } from "${patchPath}";\n`

const IMPORT_DECORATE_CREATE = (patchPath: string) =>
  `import { decorateCreate as __decorateCreate__ } from "${patchPath}";\n`

// Conditionally create ID only when tracking is enabled
// If disabled, __id__ = "" (falsy) so store checks fail gracefully
const CONSTRUCTOR_START = `\nconst __id__ = __isEnabled__() ? __createId__() : "";\n`
const CONSTRUCTOR_END = `\nthis.__id__ = __id__;\nif (__id__) { __observableIdMap__.set(this, __id__); __emit__({ type: "constructor-call-return", id: __id__, observable: this }); }\n`
const PATCH_CALL = `\n__patchObservable__(Observable);\n`

// oxc-parser types
interface OxcParseResult {
  program: any
  errors: any[]
}

export function rxjsDebuggerPlugin(options: RxjsDebuggerPluginOptions = {}): Plugin {
  const {
    debug = false,
    patchModulePath,
    hmrModulePath,
    transformUserCode: enableUserTransform = true,
    patchCreation: enablePatchCreation = false,
  } = options
  let config: VitestConfig
  let resolvedPatchModulePath: string
  let resolvedHmrModulePath: string
  let parseSync: ((filename: string, code: string, options?: any) => OxcParseResult) | null = null

  const log = (...args: unknown[]) => {
    if (debug) console.log("[rxjs-debugger]", ...args)
  }

  log("Plugin created with options:", options)

  return {
    name: "rxjs-debugger-v2",
    enforce: "pre",

    configResolved(resolvedConfig) {
      config = resolvedConfig
      resolvedPatchModulePath = patchModulePath ?? path.resolve(config.root, "src/tracking/v2/01.patch-observable")
      resolvedHmrModulePath = hmrModulePath ?? path.resolve(config.root, "src/tracking/v2/hmr/4_module-scope")
      log("configResolved:", {
        command: config.command,
        isProduction: config.isProduction,
        isBrowser: config.test?.browser?.enabled,
        resolvedPatchModulePath,
        resolvedHmrModulePath,
      })
    },

    async buildStart() {
      if (enableUserTransform) {
        try {
          const oxc = await import("oxc-parser")
          parseSync = oxc.parseSync
          log("oxc-parser loaded for user code transforms")
        } catch {
          console.warn("[rxjs-debugger] oxc-parser not available, user code transforms disabled")
        }
      }
    },

    resolveId(source) {
      // For vitest (non-browser), redirect rxjs imports to esm5 dist files
      // so they go through our transform hook
      const isBrowser = config.test?.browser?.enabled
      if (!isBrowser && (source === "rxjs" || source.startsWith("rxjs/"))) {
        const rxjsPath = path.dirname(require.resolve("rxjs/package.json"))
        log("resolveId redirecting:", source)

        if (source === "rxjs") {
          return path.join(rxjsPath, "dist/esm5/index.js")
        }

        const subpath = source.slice("rxjs/".length)
        if (subpath === "operators") {
          return path.join(rxjsPath, "dist/esm5/operators/index.js")
        } else if (subpath.startsWith("internal/")) {
          return path.join(rxjsPath, `dist/esm5/${subpath}.js`)
        } else {
          return path.join(rxjsPath, "dist/esm5", subpath, "index.js")
        }
      }
      return null
    },

    transform(code, id) {
      const cleanId = id.split("?")[0] ?? id

      // Log all rxjs-related files
      if (cleanId.includes("/rxjs/")) {
        log("transform called for rxjs file:", cleanId)
      }

      // dist/esm5/internal/Observable.js - ES5 function style
      if (cleanId.includes("/rxjs/dist/esm5/") && cleanId.endsWith("/Observable.js")) {
        log("MATCHED esm5 Observable.js")
        log("patchPath:", resolvedPatchModulePath)
        log("code length:", code.length)
        log("code preview:", code.slice(0, 500))
        const result = patchEs5(code, resolvedPatchModulePath)
        log("patchEs5 result:", result ? "SUCCESS" : "FAILED (null)")
        if (result) {
          log("patched code preview:", result.code.slice(0, 800))
        }
        return result
      }

      // dist/esm/internal/Observable.js - ES2015 class style
      if (cleanId.includes("/rxjs/dist/esm/") && cleanId.endsWith("/Observable.js")) {
        log("MATCHED esm Observable.js")
        log("patchPath:", resolvedPatchModulePath)
        const result = patchEsm(code, resolvedPatchModulePath)
        log("patchEsm result:", result ? "SUCCESS" : "FAILED (null)")
        if (result) {
          log("patched code preview:", result.code.slice(0, 800))
        }
        return result
      }

      // src/internal/Observable.ts - TypeScript source
      if (cleanId.includes("/rxjs/src/internal/Observable.ts")) {
        log("MATCHED src Observable.ts")
        log("patchPath:", resolvedPatchModulePath)
        const result = patchTs(code, resolvedPatchModulePath)
        log("patchTs result:", result ? "SUCCESS" : "FAILED (null)")
        return result
      }

      // dist/esm5/internal/operators/*.js or dist/esm/internal/operators/*.js
      const isEsm5Operator = cleanId.includes("/rxjs/dist/esm5/internal/operators/") && cleanId.endsWith(".js")
      const isEsmOperator = cleanId.includes("/rxjs/dist/esm/internal/operators/") && cleanId.endsWith(".js")
      if (isEsm5Operator || isEsmOperator) {
        const fileName = path.basename(cleanId, ".js")
        // Skip index files and internal helpers
        if (fileName === "index" || fileName === "OperatorSubscriber") {
          return null
        }
        log("MATCHED operator:", fileName, isEsm5Operator ? "(esm5)" : "(esm)")
        const result = patchOperator(code, resolvedPatchModulePath, fileName)
        if (result) {
          log("patchOperator result: SUCCESS for", fileName)
        }
        return result
      }

      // dist/esm5/internal/observable/*.js or dist/esm/internal/observable/*.js
      // Skip unless patchCreation is explicitly enabled (we use proxy.* wrappers instead)
      if (enablePatchCreation) {
        const isEsm5Observable = cleanId.includes("/rxjs/dist/esm5/internal/observable/") && cleanId.endsWith(".js")
        const isEsmObservable = cleanId.includes("/rxjs/dist/esm/internal/observable/") && cleanId.endsWith(".js")
        if (isEsm5Observable || isEsmObservable) {
          const fileName = path.basename(cleanId, ".js")
          // Skip index files and classes (not creation functions)
          if (fileName === "index" || fileName === "ConnectableObservable") {
            return null
          }
          log("MATCHED observable:", fileName, isEsm5Observable ? "(esm5)" : "(esm)")
          const result = patchCreation(code, resolvedPatchModulePath, fileName)
          if (result) {
            log("patchCreation result: SUCCESS for", fileName)
          }
          return result
        }
      }

      // src/internal/operators/*.ts - TypeScript source operators
      if (cleanId.includes("/rxjs/src/internal/operators/") && cleanId.endsWith(".ts")) {
        const fileName = path.basename(cleanId, ".ts")
        if (fileName === "index" || fileName === "OperatorSubscriber") {
          return null
        }
        log("MATCHED TS operator:", fileName)
        const result = patchOperatorTs(code, resolvedPatchModulePath, fileName)
        if (result) {
          log("patchOperatorTs result: SUCCESS for", fileName)
        }
        return result
      }

      // src/internal/observable/*.ts - TypeScript source creation operators
      // Skip unless patchCreation is explicitly enabled (we use proxy.* wrappers instead)
      if (enablePatchCreation && cleanId.includes("/rxjs/src/internal/observable/") && cleanId.endsWith(".ts")) {
        const fileName = path.basename(cleanId, ".ts")
        // Skip index files and classes (not creation functions)
        if (fileName === "index" || fileName === "ConnectableObservable") {
          return null
        }
        log("MATCHED TS observable:", fileName)
        const result = patchCreationTs(code, resolvedPatchModulePath, fileName)
        if (result) {
          log("patchCreationTs result: SUCCESS for", fileName)
        }
        return result
      }

      // User code transform - wrap observables and subscriptions
      if (enableUserTransform && parseSync && shouldTransformUserCode(cleanId)) {
        const result = transformUserCode(code, cleanId, parseSync, {
          hmrImport: resolvedHmrModulePath,
        })
        if (result) {
          log("USER CODE transformed:", cleanId)
          return result
        }
      }

      return null
    },
  }
}

// Regex patterns for matching constructor bodies across all formats
// Matches: function Observable(subscribe) { if (subscribe) { this._subscribe = subscribe; } }
// or:      constructor(subscribe) { if (subscribe) { this._subscribe = subscribe; } }
// or:      constructor(subscribe?: ...) { if (subscribe) { this._subscribe = subscribe; } }

const ES5_PATTERN =
  /(function\s+Observable\s*\(\s*subscribe\s*\)\s*\{)(\s*)(if\s*\(\s*subscribe\s*\)\s*\{\s*this\._subscribe\s*=\s*subscribe;\s*\})(\s*)(\})/

const ESM_PATTERN =
  /(constructor\s*\(\s*subscribe\s*\)\s*\{)(\s*)(if\s*\(\s*subscribe\s*\)\s*\{\s*this\._subscribe\s*=\s*subscribe;\s*\})(\s*)(\})/

const TS_PATTERN =
  /(constructor\s*\(\s*subscribe\?\s*:\s*\([^)]+\)\s*=>\s*TeardownLogic\s*\)\s*\{)(\s*)(if\s*\(\s*subscribe\s*\)\s*\{\s*this\._subscribe\s*=\s*subscribe;\s*\})(\s*)(\})/

function patchWithRegex(code: string, patchPath: string, pattern: RegExp, iifeEndPattern?: RegExp) {
  const patched = code.replace(pattern, (_match, open, ws1, body, ws2, close) => {
    return `${open}${CONSTRUCTOR_START}${ws1}${body}${CONSTRUCTOR_END}${ws2}${close}`
  })

  if (patched === code) {
    console.warn("[rxjs-debugger] WARNING: Pattern did not match! Constructor not patched.")
    return null
  }

  // Insert PATCH_CALL right after Observable class definition (IIFE end)
  // This ensures patchObservable runs immediately when the class is defined
  let withPatch: string
  if (iifeEndPattern) {
    // For IIFE style (esm5): insert after }());
    withPatch = patched.replace(iifeEndPattern, `$&${PATCH_CALL}`)
  } else {
    // For class style (esm/ts): append at end
    withPatch = patched + PATCH_CALL
  }

  const result = IMPORT_PATCH(patchPath) + withPatch
  return { code: result, map: null }
}

// Pattern to find end of Observable IIFE: }());
// This is where we insert PATCH_CALL so it runs immediately after class definition
const ES5_IIFE_END = /(\}\(\)\);)/

function patchEs5(code: string, patchPath: string) {
  return patchWithRegex(code, patchPath, ES5_PATTERN, ES5_IIFE_END)
}

function patchEsm(code: string, patchPath: string) {
  return patchWithRegex(code, patchPath, ESM_PATTERN)
}

function patchTs(code: string, patchPath: string) {
  return patchWithRegex(code, patchPath, TS_PATTERN)
}

/**
 * Patch an ES5 operator file to wrap the main export with decorateOperatorFun.
 *
 * Transform:
 *   export function map(project, thisArg) { ... }
 * To:
 *   function __map__(project, thisArg) { ... }
 *   export var map = __decorateOp__(__map__, "map");
 *
 * Also handles files with aliases like:
 *   export var onErrorResumeNext = onErrorResumeNextWith;
 * By replacing references to the original function name.
 */
function patchOperator(code: string, patchPath: string, operatorName: string, options?: { tags?: string[] }) {
  // Match: export function NAME(
  const pattern = new RegExp(`export function (${operatorName})\\(`)
  const match = code.match(pattern)

  if (!match) {
    // No matching export - might be a re-export file
    return null
  }

  // Rename the function: export function NAME → function __NAME__
  let patched = code.replace(new RegExp(`export function ${operatorName}\\(`), `function __${operatorName}__(`)

  // Also replace any other references to the function name (e.g., in aliases)
  // Match: = NAME; or = NAME) but not __NAME__
  patched = patched.replace(new RegExp(`= ${operatorName}([;)])`, "g"), `= __${operatorName}__$1`)

  // Add import at top and decorated export at bottom
  const result =
    IMPORT_DECORATE_OP(patchPath) +
    patched +
    `\nexport var ${operatorName} = __decorateOp__(__${operatorName}__, "${operatorName}", ${JSON.stringify({ tags: operatorName.startsWith("inner") ? ["rxjs", "internal"] : ["rxjs"] })});\n`

  return { code: result, map: null }
}

/**
 * Patch an ES5 creation operator file to wrap the main export with decorateCreate.
 *
 * Transform:
 *   export function of() { ... }
 * To:
 *   function __of__() { ... }
 *   export var of = __decorateCreate__(__of__, "of");
 */
function patchCreation(code: string, patchPath: string, operatorName: string) {
  // Match: export function NAME(
  const pattern = new RegExp(`export function (${operatorName})\\(`)
  const match = code.match(pattern)

  if (!match) {
    // No matching export - might be a re-export file
    return null
  }

  // Rename the function: export function NAME → function __NAME__
  let patched = code.replace(new RegExp(`export function ${operatorName}\\(`), `function __${operatorName}__(`)

  // Also replace any other references to the function name (e.g., in aliases)
  patched = patched.replace(new RegExp(`= ${operatorName}([;)])`, "g"), `= __${operatorName}__$1`)

  // Add import at top and decorated export at bottom
  const result =
    IMPORT_DECORATE_CREATE(patchPath) +
    patched +
    `\nexport var ${operatorName} = __decorateCreate__(__${operatorName}__, "${operatorName}", ${JSON.stringify({ tags: operatorName.startsWith("inner") ? ["rxjs", "internal"] : ["rxjs"] })});\n`

  return { code: result, map: null }
}

/**
 * Patch a TypeScript operator file. Similar to patchOperator but handles
 * overload signatures by matching only the implementation (has `{`, not `;`).
 *
 * Overloads look like: export function map<T, R>(...): ReturnType;
 * Implementation looks like: export function map<T, R>(...): ReturnType {
 */
function patchOperatorTs(code: string, patchPath: string, operatorName: string) {
  // Match implementation: export function NAME followed by { (not ;)
  // This skips overload signatures which end with ;
  const pattern = new RegExp(`export function (${operatorName})\\b([^;]*?)\\{`)
  const match = code.match(pattern)

  if (!match) {
    return null
  }

  // Replace implementation: export function NAME... → function __NAME__...
  let patched = code.replace(pattern, `function __${operatorName}__$2{`)

  // Also replace any other references to the function name (e.g., in aliases)
  patched = patched.replace(new RegExp(`= ${operatorName}([;)])`, "g"), `= __${operatorName}__$1`)

  const result =
    IMPORT_DECORATE_OP(patchPath) +
    patched +
    `\nexport const ${operatorName} = __decorateOp__(__${operatorName}__, "${operatorName}", ${JSON.stringify({ tags: operatorName.startsWith("inner") ? ["rxjs", "internal"] : ["rxjs"] })});\n`

  return { code: result, map: null }
}

/**
 * Patch a TypeScript creation operator file. Similar to patchCreation but handles
 * overload signatures.
 */
function patchCreationTs(code: string, patchPath: string, operatorName: string) {
  // Match implementation: export function NAME followed by { (not ;)
  const pattern = new RegExp(`export function (${operatorName})\\b([^;]*?)\\{`)
  const match = code.match(pattern)

  if (!match) {
    return null
  }

  // Replace implementation: export function NAME... → function __NAME__...
  let patched = code.replace(pattern, `function __${operatorName}__$2{`)

  // Also replace any other references to the function name (e.g., in aliases)
  patched = patched.replace(new RegExp(`= ${operatorName}([;)])`, "g"), `= __${operatorName}__$1`)

  const result =
    IMPORT_DECORATE_CREATE(patchPath) +
    patched +
    `\nexport const ${operatorName} = __decorateCreate__(__${operatorName}__, "${operatorName}", ${JSON.stringify({ tags: operatorName.startsWith("inner") ? ["rxjs", "internal"] : ["rxjs"] })});\n`

  return { code: result, map: null }
}

export default rxjsDebuggerPlugin
