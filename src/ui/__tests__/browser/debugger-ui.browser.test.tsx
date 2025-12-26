/**
 * Browser test for RxJS Debugger UI
 *
 * Uses Playwright to render the test app and capture screenshots.
 */

import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { page } from 'vitest/browser';
import { TestApp } from './TestApp';

describe('RxJS Debugger UI', () => {
  it('renders the debugger visualization', async () => {
    // Render the test app
    const { container } = render(<TestApp />);

    // Wait for initial render
    await new Promise(r => setTimeout(r, 300));

    // Take screenshot of initial state
    await page.screenshot({
      path: './__snapshots__/debugger-initial.png',
    });

    // Wait for graph to populate
    await new Promise(r => setTimeout(r, 1200));

    // Take screenshot after data flows
    await page.screenshot({
      path: './__snapshots__/debugger-with-data.png',
    });

    // Verify the app rendered
    expect(container.querySelector('h1')?.textContent).toBe('RxJS Debugger Test App');

    cleanup();
  }, 30000);
});
