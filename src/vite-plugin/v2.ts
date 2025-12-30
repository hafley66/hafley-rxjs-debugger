import { createRequire } from "module"
import path from "path"
import type { Plugin, ResolvedConfig } from "rolldown-vite"

type VitestConfig = ResolvedConfig & {
  test?: {
    browser?: {
      enabled?: boolean
    }
  }
}

const require = createRequire(import.meta.url)

export interface RxjsDebuggerPluginOptions {
  debug?: boolean
  patchModulePath?: string
}

const IMPORT_PATCH = (patchPath: string) =>
  `import { patchObservable as __patchObservable__, emit as __emit__, createId as __createId__, observableIdMap as __observableIdMap__ } from "${patchPath}";\n`

const CONSTRUCTOR_START = `\nconst __id__ = __createId__();\n`
const CONSTRUCTOR_END = `\n__observableIdMap__.set(this, __id__);\n__emit__({ type: "constructor-call-return", id: __id__, observable: this });\n`
const PATCH_CALL = `\n__patchObservable__(Observable);\n`

export function rxjsDebuggerPlugin(options: RxjsDebuggerPluginOptions = {}): Plugin {
  const { debug = false, patchModulePath } = options
  let config: VitestConfig
  let resolvedPatchModulePath: string

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
      log("configResolved:", {
        command: config.command,
        isProduction: config.isProduction,
        isBrowser: config.test?.browser?.enabled,
        resolvedPatchModulePath,
      })
    },

    resolveId(source) {
      if (config.command === "serve" && !config.isProduction) {
        const isBrowser = config.test?.browser?.enabled
        if (!isBrowser && (source === "rxjs" || source.startsWith("rxjs/"))) {
          const rxjsPath = path.dirname(require.resolve("rxjs/package.json"))
          log("resolveId redirecting:", source)

          if (source === "rxjs") {
            return path.join(rxjsPath, "src/index.ts")
          }

          const subpath = source.slice("rxjs/".length)
          if (subpath === "operators") {
            return path.join(rxjsPath, "src/operators/index.ts")
          } else if (subpath.startsWith("internal/")) {
            return path.join(rxjsPath, `src/${subpath}.ts`)
          } else {
            return path.join(rxjsPath, "src", subpath, "index.ts")
          }
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

function patchWithRegex(code: string, patchPath: string, pattern: RegExp) {
  const patched = code.replace(pattern, (_match, open, ws1, body, ws2, close) => {
    return `${open}${CONSTRUCTOR_START}${ws1}${body}${CONSTRUCTOR_END}${ws2}${close}`
  })

  if (patched === code) {
    console.warn("[rxjs-debugger] WARNING: Pattern did not match! Constructor not patched.")
    return null
  }

  const result = IMPORT_PATCH(patchPath) + patched + PATCH_CALL
  return { code: result, map: null }
}

function patchEs5(code: string, patchPath: string) {
  return patchWithRegex(code, patchPath, ES5_PATTERN)
}

function patchEsm(code: string, patchPath: string) {
  return patchWithRegex(code, patchPath, ESM_PATTERN)
}

function patchTs(code: string, patchPath: string) {
  return patchWithRegex(code, patchPath, TS_PATTERN)
}

export default rxjsDebuggerPlugin
