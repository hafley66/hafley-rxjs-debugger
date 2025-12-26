/**
 * Root Application Component
 *
 * Renders the RxJS debugger visualization.
 * Uses a DataProvider to access tracking data.
 */

import { useState, useEffect, useMemo } from 'react';
import type { DataProvider } from './1_data/provider';
import { InlineProvider } from './1_data/inline';
import { use$ } from './2_hooks/use$';
import { Graph } from './3_components/Graph';
import type { GraphState } from './0_types';

interface AppProps {
  provider?: DataProvider;
  width?: number;
  height?: number;
}

/**
 * Main visualization app.
 * If no provider is given, creates an InlineProvider.
 */
export function App({ provider: externalProvider, width = 800, height = 600 }: AppProps) {
  // Create provider if not provided
  const [internalProvider] = useState(() => externalProvider ?? new InlineProvider());
  const provider = externalProvider ?? internalProvider;

  // Clean up provider on unmount
  useEffect(() => {
    if (!externalProvider) {
      return () => internalProvider.dispose();
    }
    return undefined;
  }, [externalProvider, internalProvider]);

  // Subscribe to graph state
  const graphState = use$<GraphState>(provider.graph$, { nodes: [], edges: [] });

  // Stats
  const stats = useMemo(() => {
    const observables = graphState.nodes.filter((n) => n.type === 'observable').length;
    const subscriptions = graphState.nodes.filter((n) => n.type === 'subscription').length;
    const activeSubscriptions = graphState.nodes.filter(
      (n) => n.type === 'subscription' && n.isActive
    ).length;
    return { observables, subscriptions, activeSubscriptions };
  }, [graphState]);

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        color: '#e5e7eb',
        padding: 16,
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>RxJS Debugger</h2>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          <span style={{ marginRight: 12 }}>
            <span style={{ color: '#3b82f6' }}>●</span> {stats.observables} observables
          </span>
          <span>
            <span style={{ color: '#22c55e' }}>■</span> {stats.activeSubscriptions}/
            {stats.subscriptions} subscriptions
          </span>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          fontSize: 11,
          color: '#9ca3af',
          marginBottom: 8,
        }}
      >
        <span>
          <span style={{ color: '#60a5fa' }}>━━</span> pipe
        </span>
        <span>
          <span style={{ color: '#22c55e' }}>- -</span> subscribe
        </span>
        <span>
          <span style={{ color: '#a78bfa' }}>··</span> trigger
        </span>
        <span>
          <span style={{ color: '#f59e0b' }}>●</span> root
        </span>
      </div>

      {/* Graph */}
      <Graph state={graphState} width={width} height={height} />

      {/* Empty state */}
      {graphState.nodes.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#6b7280',
            fontSize: 14,
          }}
        >
          No observables tracked yet. Create some observables to see them here.
        </div>
      )}
    </div>
  );
}
