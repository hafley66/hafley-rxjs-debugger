/**
 * Tests for stack-parser.ts
 */

import { parseStackTrace, getCallerInfo, StackInfo } from '../stack-parser';

describe('parseStackTrace', () => {
  describe('V8 format parsing', () => {
    it('should parse V8 stack trace with function name', () => {
      const stack = `Error
    at createObservable (/home/user/project/src/app.ts:42:15)
    at main (/home/user/project/src/index.ts:10:5)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/app.ts',
        line: 42,
        column: 15,
        context: 'createObservable',
      });
    });

    it('should parse V8 stack trace without function name', () => {
      const stack = `Error
    at /home/user/project/src/app.ts:42:15
    at main (/home/user/project/src/index.ts:10:5)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/app.ts',
        line: 42,
        column: 15,
        context: undefined,
      });
    });

    it('should parse stack trace with file:// protocol', () => {
      const stack = `Error
    at createObservable (file:///home/user/project/src/app.ts:42:15)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/app.ts',
        line: 42,
        column: 15,
        context: 'createObservable',
      });
    });

    it('should parse stack trace with URL-encoded paths', () => {
      const stack = `Error
    at handler (file:///home/user/my%20project/src/app.ts:42:15)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/my project/src/app.ts',
        line: 42,
        column: 15,
        context: 'handler',
      });
    });

    it('should parse stack trace with class method context', () => {
      const stack = `Error
    at MyComponent.handleClick (/home/user/project/src/component.ts:100:20)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/component.ts',
        line: 100,
        column: 20,
        context: 'MyComponent.handleClick',
      });
    });
  });

  describe('edge cases', () => {
    it('should return null for undefined stack', () => {
      const result = parseStackTrace(undefined as any);
      expect(result).toBeNull();
    });

    it('should return null for null stack', () => {
      const result = parseStackTrace(null as any);
      expect(result).toBeNull();
    });

    it('should return null for empty stack', () => {
      const result = parseStackTrace('');
      expect(result).toBeNull();
    });

    it('should return null for malformed stack', () => {
      const stack = `Error
    some random text
    more random text`;

      const result = parseStackTrace(stack);
      expect(result).toBeNull();
    });

    it('should handle stack with only error message', () => {
      const stack = 'Error: Something went wrong';
      const result = parseStackTrace(stack);
      expect(result).toBeNull();
    });

    it('should handle non-string input', () => {
      const result = parseStackTrace(123 as any);
      expect(result).toBeNull();
    });
  });

  describe('internal frame skipping', () => {
    it('should skip internal tracking frames', () => {
      const stack = `Error
    at parseStackTrace (/home/user/project/src/tracking/stack-parser.ts:50:10)
    at getCallerInfo (/home/user/project/src/tracking/stack-parser.ts:120:15)
    at Observable (/home/user/project/src/app.ts:42:15)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/app.ts',
        line: 42,
        column: 15,
        context: 'Observable',
      });
    });

    it('should skip node_modules frames', () => {
      const stack = `Error
    at module.exports (/home/user/project/node_modules/some-lib/index.js:10:5)
    at createObservable (/home/user/project/src/app.ts:42:15)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/app.ts',
        line: 42,
        column: 15,
        context: 'createObservable',
      });
    });

    it('should skip node internal frames', () => {
      const stack = `Error
    at Module._compile (node:internal/modules/cjs/loader:1120:14)
    at createObservable (/home/user/project/src/app.ts:42:15)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/app.ts',
        line: 42,
        column: 15,
        context: 'createObservable',
      });
    });

    it('should return null if only internal frames exist', () => {
      const stack = `Error
    at parseStackTrace (/home/user/project/src/tracking/stack-parser.ts:50:10)
    at getCallerInfo (/home/user/project/src/tracking/stack-parser.ts:120:15)`;

      const result = parseStackTrace(stack);
      expect(result).toBeNull();
    });
  });

  describe('context filtering', () => {
    it('should remove Object.<anonymous> context', () => {
      const stack = `Error
    at Object.<anonymous> (/home/user/project/src/app.ts:42:15)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/app.ts',
        line: 42,
        column: 15,
        context: undefined,
      });
    });

    it('should remove <anonymous> context', () => {
      const stack = `Error
    at <anonymous> (/home/user/project/src/app.ts:42:15)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/app.ts',
        line: 42,
        column: 15,
        context: undefined,
      });
    });

    it('should remove eval context', () => {
      const stack = `Error
    at eval (/home/user/project/src/app.ts:42:15)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/app.ts',
        line: 42,
        column: 15,
        context: undefined,
      });
    });

    it('should preserve meaningful context', () => {
      const stack = `Error
    at clicks$ (/home/user/project/src/app.ts:42:15)`;

      const result = parseStackTrace(stack);

      expect(result).toEqual({
        filePath: '/home/user/project/src/app.ts',
        line: 42,
        column: 15,
        context: 'clicks$',
      });
    });
  });
});

describe('getCallerInfo', () => {
  it('should return stack info for the caller', () => {
    // This function will be in the stack
    function testFunction() {
      return getCallerInfo();
    }

    const result = testFunction();

    expect(result).not.toBeNull();
    expect(result?.filePath).toContain('stack-parser.test.ts');
    expect(result?.line).toBeGreaterThan(0);
    expect(result?.column).toBeGreaterThan(0);
  });

  it('should not throw on error', () => {
    // Even if something goes wrong internally, it should return null
    expect(() => getCallerInfo()).not.toThrow();
  });

  it('should skip internal tracking frames', () => {
    const result = getCallerInfo();

    // Should not point to stack-parser.ts (internal)
    // Should point to this test file (caller)
    expect(result?.filePath).not.toContain('/tracking/stack-parser.ts');
  });

  it('should work when called from nested functions', () => {
    function level3() {
      return getCallerInfo();
    }

    function level2() {
      return level3();
    }

    function level1() {
      return level2();
    }

    const result = level1();

    expect(result).not.toBeNull();
    expect(result?.filePath).toContain('stack-parser.test.ts');
  });
});

describe('real-world scenarios', () => {
  it('should handle Observable constructor pattern', () => {
    // Simulating how this would be used in Observable constructor
    class MockObservable {
      private creationInfo: StackInfo | null;

      constructor() {
        this.creationInfo = getCallerInfo();
      }

      getCreationInfo() {
        return this.creationInfo;
      }
    }

    // User code creating an observable
    const clicks$ = new MockObservable();
    const info = clicks$.getCreationInfo();

    expect(info).not.toBeNull();
    expect(info?.filePath).toContain('stack-parser.test.ts');
    expect(info?.line).toBeGreaterThan(0);
  });

  it('should extract variable name context when available', () => {
    // In real scenarios, the variable name might be captured
    const stack = `Error
    at new Observable (/home/user/project/src/observable.ts:10:5)
    at clicks$ (/home/user/project/src/app.ts:42:15)
    at Module._compile (node:internal/modules/cjs/loader:1120:14)`;

    const result = parseStackTrace(stack);

    expect(result).toEqual({
      filePath: '/home/user/project/src/observable.ts',
      line: 10,
      column: 5,
      context: 'new Observable',
    });
  });
});
