/**
 * Test App - Simulates API caching patterns with RxJS
 *
 * Uses mock data to avoid tracking feedback loops in tests.
 */

import { useEffect, useState, useRef } from 'react';
import { BehaviorSubject, interval, of } from 'rxjs';
import { map, take, delay } from 'rxjs/operators';
import { Graph } from '../../3_components/Graph';
import type { GraphState, GraphNode, GraphEdge } from '../../0_types';

// Mock graph state that simulates what the debugger would show
const mockGraphState: GraphState = {
  nodes: [
    { id: 'obs#0', type: 'observable', label: 'obs#0 interval', isActive: true, isRoot: true },
    { id: 'obs#1', type: 'observable', label: 'obs#1 share', isActive: true, isRoot: false },
    { id: 'obs#2', type: 'observable', label: 'obs#2 shareReplay', isActive: true, isRoot: false },
    { id: 'sub#0', type: 'subscription', label: 'sub#0 (1/2)', isActive: true, isRoot: false },
    { id: 'sub#1', type: 'subscription', label: 'sub#1 (2/2)', isActive: true, isRoot: false },
    { id: 'sub#2', type: 'subscription', label: 'sub#2 (1/1)', isActive: false, isRoot: false },
  ],
  edges: [
    { id: 'pipe-0-1', type: 'pipe', source: 'obs#0', target: 'obs#1', isActive: true },
    { id: 'pipe-1-2', type: 'pipe', source: 'obs#1', target: 'obs#2', isActive: true },
    { id: 'sub-1-0', type: 'subscribe', source: 'obs#1', target: 'sub#0', isActive: true },
    { id: 'sub-1-1', type: 'subscribe', source: 'obs#1', target: 'sub#1', isActive: true },
    { id: 'sub-2-2', type: 'subscribe', source: 'obs#2', target: 'sub#2', isActive: false },
  ],
};

// Simulate data loading
function useSimulatedData() {
  const [user, setUser] = useState<{ id: number; name: string } | null>(null);
  const [pollData, setPollData] = useState<string[]>([]);
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    // Simulated cached user fetch
    const userSub = of({ id: 1, name: 'Alice' }).pipe(delay(100)).subscribe(setUser);

    // Simulated polling
    const pollSub = interval(800).pipe(
      take(5),
      map(() => new Date().toLocaleTimeString())
    ).subscribe(ts => {
      setPollData(prev => [...prev.slice(-4), ts]);
    });

    // Simulated counter
    const counterSub = interval(500).pipe(take(10)).subscribe(setCounter);

    return () => {
      userSub.unsubscribe();
      pollSub.unsubscribe();
      counterSub.unsubscribe();
    };
  }, []);

  return { user, pollData, counter };
}

export function TestApp() {
  const { user, pollData, counter } = useSimulatedData();
  const [graphState, setGraphState] = useState<GraphState>({ nodes: [], edges: [] });

  // Animate graph state appearing
  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // Gradually add nodes/edges to simulate real tracking
    timeouts.push(setTimeout(() => {
      setGraphState({
        nodes: mockGraphState.nodes.slice(0, 2),
        edges: mockGraphState.edges.slice(0, 1),
      });
    }, 200));

    timeouts.push(setTimeout(() => {
      setGraphState({
        nodes: mockGraphState.nodes.slice(0, 4),
        edges: mockGraphState.edges.slice(0, 3),
      });
    }, 600));

    timeouts.push(setTimeout(() => {
      setGraphState(mockGraphState);
    }, 1000));

    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui', padding: 20, background: '#0f172a', color: '#e2e8f0', minHeight: '100vh' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 24 }}>RxJS Debugger Test App</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Cached User */}
        <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', color: '#60a5fa' }}>Cached User (shareReplay)</h3>
          <pre style={{ margin: 0, fontSize: 12 }}>
            {user ? JSON.stringify(user, null, 2) : 'Loading...'}
          </pre>
        </div>

        {/* Polling Data */}
        <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', color: '#22c55e' }}>Polling Data (repeat)</h3>
          <div style={{ fontSize: 12 }}>
            {pollData.length === 0 ? 'Waiting...' : pollData.map((ts, i) => (
              <div key={i}>Poll {i + 1}: {ts}</div>
            ))}
          </div>
        </div>

        {/* Shared Counter */}
        <div style={{ background: '#1e293b', padding: 16, borderRadius: 8, gridColumn: 'span 2' }}>
          <h3 style={{ margin: '0 0 12px', color: '#a78bfa' }}>Shared Counter (share)</h3>
          <div style={{ fontSize: 14 }}>
            Count: {counter} | 2 subscribers active
          </div>
        </div>
      </div>

      {/* Debugger visualization */}
      <div style={{ background: '#1e293b', borderRadius: 8, overflow: 'hidden', padding: 8 }}>
        <div style={{ marginBottom: 8, fontSize: 14, color: '#9ca3af' }}>
          Observable Graph ({graphState.nodes.length} nodes, {graphState.edges.length} edges)
        </div>
        <Graph state={graphState} width={700} height={350} />
      </div>
    </div>
  );
}
