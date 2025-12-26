/**
 * Stack Trace Parser
 *
 * Parses JavaScript stack traces to extract file location and context information.
 * Used for automatic tracking and debugging of Observable instances.
 */

/**
 * Information extracted from a stack trace frame
 */
export interface StackInfo {
  filePath: string;      // '/path/to/file.ts'
  line: number;          // 42
  column: number;        // 15
  context?: string;      // 'myObservable$' or 'MyComponent.method'
}

/**
 * Parses a JavaScript stack trace string and extracts location information
 * from the first relevant frame (excluding internal tracking code).
 *
 * Currently supports V8 format (Chrome/Node.js):
 *   at functionName (file:///path/to/file.ts:42:15)
 *   at file:///path/to/file.ts:42:15
 *
 * TODO: Add support for other engines:
 * - SpiderMonkey (Firefox): functionName@file:///path/to/file.ts:42:15
 * - JavaScriptCore (Safari): functionName@file:///path/to/file.ts:42:15
 *
 * @param stack - The stack trace string (typically from Error().stack)
 * @returns Parsed stack information, or null if parsing fails
 */
export function parseStackTrace(stack: string): StackInfo | null {
  if (!stack || typeof stack !== 'string') {
    return null;
  }

  const lines = stack.split('\n');

  // Skip the first line (usually "Error" or error message)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();

    // Skip empty lines
    if (!line) {
      continue;
    }

    // Skip internal frames from our tracking code or node internals
    // This helps avoid recursion and focuses on user code
    // Note: Don't skip test files (they contain __tests__)
    if (
      (line.includes('/tracking/') && !line.includes('__tests__')) ||
      line.includes('node_modules') ||
      line.includes('node:internal')
    ) {
      continue;
    }

    // Try to parse V8 format: at functionName (file:///path/to/file.ts:42:15)
    // Regex breakdown:
    // - at\s+ : matches "at " followed by whitespace
    // - (?:(.+?)\s+\()? : optional non-capturing group for function name + opening paren
    // - (.+?) : captures file path (group 1 or 2 depending on whether function name exists)
    // - :(\d+) : colon followed by line number
    // - :(\d+) : colon followed by column number
    const v8WithFunction = /at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/;
    const v8WithoutFunction = /at\s+(.+?):(\d+):(\d+)/;

    let match = line.match(v8WithFunction);
    let context: string | undefined;
    let filePath: string;
    let lineNum: number;
    let column: number;

    if (match && match[1] && match[2] && match[3] && match[4]) {
      // Format: at functionName (filePath:line:column)
      context = match[1];
      filePath = match[2];
      lineNum = parseInt(match[3], 10);
      column = parseInt(match[4], 10);
    } else {
      match = line.match(v8WithoutFunction);
      if (match && match[1] && match[2] && match[3]) {
        // Format: at filePath:line:column
        filePath = match[1];
        lineNum = parseInt(match[2], 10);
        column = parseInt(match[3], 10);
      } else {
        // Can't parse this line, try next one
        continue;
      }
    }

    // Clean up file path: remove file:// protocol and URL encoding
    filePath = filePath.replace(/^file:\/\//, '');
    filePath = decodeURIComponent(filePath);

    // Clean up context if present
    // Remove generic context names that don't provide useful information
    if (context) {
      // Remove 'Object.<anonymous>' and similar generic names
      if (
        context === 'Object.<anonymous>' ||
        context === '<anonymous>' ||
        context === 'eval'
      ) {
        context = undefined;
      } else {
        // Clean up context (remove extra spaces, etc.)
        context = context.trim();
      }
    }

    return {
      filePath,
      line: lineNum,
      column,
      context,
    };
  }

  // Couldn't find a parseable frame
  return null;
}

/**
 * Convenience function to get information about the caller.
 *
 * Creates a new Error to capture the current stack trace, then parses it
 * to extract information about where this function was called from.
 *
 * This is useful for automatically tracking Observable creation without
 * requiring explicit metadata from the user.
 *
 * @returns Stack information about the caller, or null if unavailable
 *
 * @example
 * ```typescript
 * function createObservable() {
 *   const callerInfo = getCallerInfo();
 *   console.log(`Observable created at ${callerInfo?.filePath}:${callerInfo?.line}`);
 *   // ...
 * }
 * ```
 */
export function getCallerInfo(): StackInfo | null {
  try {
    // Create an error to capture the stack trace
    const error = new Error();

    // Some environments might not populate stack until the error is thrown
    if (!error.stack) {
      return null;
    }

    return parseStackTrace(error.stack);
  } catch (err) {
    // Never throw - return null on any error
    return null;
  }
}

// TODO: Alternative approach using oxc/rolldown plugin to inject
// __track(observable, 'file.ts:42:variableName') at build time
// would be more reliable than stack parsing and faster at runtime.
// Build-time injection would:
// - Avoid runtime stack parsing overhead
// - Provide accurate variable names via AST analysis
// - Work consistently across all JavaScript engines
// - Enable source map integration without runtime cost
