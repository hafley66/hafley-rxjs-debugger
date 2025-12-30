import MagicString from "magic-string"
import { createRequire } from "module"
import { parseSync } from "oxc-parser"
import path from "path"
import type { Plugin, ResolvedConfig } from "rolldown-vite"

const require = createRequire(import.meta.url)

export interface RxjsDebuggerPluginOptions {
  /** Enable verbose logging */
  debug?: boolean
  /** Path to the class-proxy module (defaults to @hafley-rxjs-debugger/src/tracking/v2/00.class-proxy) */
  classProxyPath?: string
}

/**
 * Vite plugin that forces RxJS to be compiled from source and transforms
 * the Observable class to use the debugger's proxy system.
 *
 * This allows us to intercept Observable construction, pipe, subscribe, etc.
 */
export function rxjsDebuggerPlugin(options: RxjsDebuggerPluginOptions = {}): Plugin {
  const { debug = false, classProxyPath } = options
  let config: ResolvedConfig
  let resolvedClassProxyPath: string

  const log = (...args: unknown[]) => {
    if (debug) console.log("[rxjs-debugger]", ...args)
  }

  return {
    name: "rxjs-debugger-v2",
    enforce: "pre",

    configResolved(resolvedConfig) {
      config = resolvedConfig
      resolvedClassProxyPath = classProxyPath ?? path.resolve(config.root, "src/tracking/v2/00.class-proxy")
      log("Class proxy path:", resolvedClassProxyPath)
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

      const classesToTransform = [
        { file: "internal/Observable.ts", className: "Observable" },
        { file: "internal/Subject.ts", className: "Subject" },
        { file: "internal/BehaviorSubject.ts", className: "BehaviorSubject" },
      ]

      for (const { file, className } of classesToTransform) {
        if (id.endsWith(file)) {
          log(`Transforming ${className}`)
          return transformClass(code, className, resolvedClassProxyPath, id)
        }
      }

      return null
    },
  }
}

function transformClass(code: string, className: string, classProxyPath: string, filename: string) {
  const ms = new MagicString(code)
  const result = parseSync(filename, code, { lang: "ts" })
  const privateName = `__${className}__`

  ms.prepend(`import { proxyClass as __proxyClass__ } from "${classProxyPath}";\n`)

  // Find the class declaration using the AST
  for (const node of result.program.body) {
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "ClassDeclaration" &&
      node.declaration.id?.name === className
    ) {
      const classDecl = node.declaration
      const classId = classDecl.id!
      const classEnd = classDecl.end

      // Transform: "export class Observable<T> implements Subscribable<T> { ... }"
      // Into:
      //   class __Observable__<T> implements Subscribable<T> { ... }
      //   export class Observable<T> extends __proxyClass__(__Observable__)<T> {}
      //
      // The exported class extends the proxied version - class declarations are hoisted so no TDZ

      // Rename original: "export class Observable" -> "class __Observable__"
      ms.overwrite(node.start, classId.end, `class ${privateName}`)

      // After the class body, add the exported wrapper class
      ms.appendRight(classEnd, `\nexport class ${className}<T> extends (__proxyClass__(${privateName}) as typeof ${privateName})<T> {}`)

      break
    }
  }

  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true }),
  }
}

export default rxjsDebuggerPlugin
