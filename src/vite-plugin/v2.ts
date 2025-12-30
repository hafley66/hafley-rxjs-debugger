import MagicString from "magic-string"
import { createRequire } from "module"
import { parseSync } from "oxc-parser"
import path from "path"
import type { Plugin, ResolvedConfig } from "rolldown-vite"

const require = createRequire(import.meta.url)

export interface RxjsDebuggerPluginOptions {
  /** Enable verbose logging */
  debug?: boolean
  /** Path to the patch module (defaults to src/tracking/v2/00b.patch-observable) */
  patchModulePath?: string
}

/**
 * Vite plugin that forces RxJS to be compiled from source and transforms
 * the Observable class to use the debugger's proxy system.
 *
 * This allows us to intercept Observable construction, pipe, subscribe, etc.
 */
export function rxjsDebuggerPlugin(options: RxjsDebuggerPluginOptions = {}): Plugin {
  const { debug = false, patchModulePath } = options
  let config: ResolvedConfig
  let resolvedPatchModulePath: string

  const log = (...args: unknown[]) => {
    if (debug) console.log("[rxjs-debugger]", ...args)
  }

  return {
    name: "rxjs-debugger-v2",
    enforce: "pre",

    configResolved(resolvedConfig) {
      config = resolvedConfig
      resolvedPatchModulePath = patchModulePath ?? path.resolve(config.root, "src/tracking/v2/00b.patch-observable")
      log("Patch module path:", resolvedPatchModulePath)
    },

    resolveId(source) {
      // Force rxjs imports to resolve to source files instead of dist
      if (source === "rxjs" || source.startsWith("rxjs/")) {
        const rxjsPath = path.dirname(require.resolve("rxjs/package.json"))

        if (source === "rxjs") {
          const resolved = path.join(rxjsPath, "src/index.ts")
          log("Resolving rxjs ->", resolved)
          return resolved
        }

        const subpath = source.slice("rxjs/".length)
        let resolved: string

        if (subpath === "operators") {
          resolved = path.join(rxjsPath, "src/operators/index.ts")
        } else if (subpath.startsWith("internal/")) {
          resolved = path.join(rxjsPath, `src/${subpath}.ts`)
        } else {
          resolved = path.join(rxjsPath, "src", subpath, "index.ts")
        }

        log(`Resolving ${source} ->`, resolved)
        return resolved
      }

      return null
    },

    transform(code, id) {
      console.log(id)
      if (!id.includes("node_modules/rxjs/src")) {
        return null
      }

      // Default to just Observable - Subject/BehaviorSubject extend it and get patched via inheritance
      // But we keep the array in case we want to patch them directly later
      const classesToTransform = [
        { file: "internal/Observable.ts", className: "Observable" },
        // { file: "internal/Subject.ts", className: "Subject" },
        // { file: "internal/BehaviorSubject.ts", className: "BehaviorSubject" },
      ]

      for (const { file, className } of classesToTransform) {
        if (id.endsWith(file)) {
          log(`Transforming ${className}`)
          return transformObservable(code, className, resolvedPatchModulePath, id)
        }
      }

      return null
    },
  }
}

function transformObservable(code: string, className: string, patchModulePath: string, filename: string) {
  const ms = new MagicString(code)
  const result = parseSync(filename, code, { lang: "ts" })

  // Import the patch module
  ms.prepend(
    `import { patchObservable as __patchObservable__, emit as __emit__, createId as __createId__, observableIdMap as __observableIdMap__ } from "${patchModulePath}";\n`,
  )

  // Find the class and its constructor
  for (const node of result.program.body) {
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "ClassDeclaration" &&
      node.declaration.id?.name === className
    ) {
      const classDecl = node.declaration
      const classBody = classDecl.body

      // Find constructor method
      for (const member of classBody.body) {
        if (member.type === "MethodDefinition" && member.kind === "constructor") {
          const constructorBody = member.value.body
          if (constructorBody) {
            // Inject at start of constructor: emit constructor-call, create id
            const constructorStart = constructorBody.start + 1 // after {
            ms.appendRight(
              constructorStart,
              `
const __id__ = __createId__();
`,
            )
            // Inject at end of constructor: register in map, emit constructor-call-return
            const constructorEnd = constructorBody.end - 1 // before }
            ms.appendLeft(
              constructorEnd,
              `
__observableIdMap__.set(this, __id__);
__emit__({ type: "constructor-call-return", id: __id__, observable: this });
`,
            )
          }
          break
        }
      }

      // After class definition, call patchObservable
      const classEnd = classDecl.end
      ms.appendRight(classEnd, `\n__patchObservable__(${className});\n`)

      break
    }
  }

  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true }),
  }
}

export default rxjsDebuggerPlugin
