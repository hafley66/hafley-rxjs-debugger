/**
 * Test App - Simulates API caching patterns with RxJS
 *
 * Uses REAL tracking - imports from rxjs-patched to track all observables.
 */

import { useEffect, useState } from 'react';
// Normal rxjs imports - aliased to tracking/rxjs-patched by vite
import { BehaviorSubject, from, interval } from 'rxjs';
import { switchMap, take, shareReplay, filter } from 'rxjs/operators';
import { PipeTree } from '@ui/3_components/PipeTree';
import { InlineProvider } from '@ui/1_data/inline';
import { activeOnly$, type PipeTreeState } from '@ui/1_data/pipe-tree';

// ============ Fake API Layer ============

interface User {
  id: number;
  name: string;
  email: string;
}

interface Post {
  id: number;
  userId: number;
  title: string;
}

// Fake fetch that returns mock data after a delay
function fakeFetch<T>(_url: string, data: T, delayMs = 300): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(data), delayMs));
}

// ============ RxJS Service Layer (TRACKED) ============

// Session state - null means not logged in
const session$ = new BehaviorSubject<User | null>(null);

// User profile - cached with shareReplay, re-fetches when session changes
const userProfile$ = session$.pipe(
  filter((user): user is User => user !== null),
  switchMap(user =>
    from(fakeFetch(`/api/users/${user.id}`, {
      ...user,
      avatar: `https://i.pravatar.cc/150?u=${user.id}`,
      joinedAt: '2024-01-15',
    }))
  ),
  shareReplay(1)
);

// User's posts - switchMap from session, cached
const userPosts$ = session$.pipe(
  filter((user): user is User => user !== null),
  switchMap(user =>
    from(fakeFetch<Post[]>(`/api/users/${user.id}/posts`, [
      { id: 1, userId: user.id, title: 'Getting Started with RxJS' },
      { id: 2, userId: user.id, title: 'Understanding switchMap' },
      { id: 3, userId: user.id, title: 'shareReplay Deep Dive' },
    ], 500))
  ),
  shareReplay(1)
);

// Live notifications - polls every 2 seconds
const notifications$ = interval(2000).pipe(
  switchMap(() =>
    from(fakeFetch(`/api/notifications`, {
      count: Math.floor(Math.random() * 5),
      timestamp: new Date().toLocaleTimeString(),
    }, 100))
  )
);

// ============ Data Provider (reads from actual tracking registry) ============

const provider = new InlineProvider();

// ============ React Hooks ============

function usePipeTree() {
  const [state, setState] = useState<PipeTreeState>({ roots: [], activeCount: 0, totalCount: 0 });

  useEffect(() => {
    const sub = provider.pipeTree$.subscribe(setState);
    return () => sub.unsubscribe();
  }, []);

  return state;
}

function useActiveOnly() {
  const [active, setActive] = useState(activeOnly$.getValue());

  useEffect(() => {
    const sub = activeOnly$.subscribe(setActive);
    return () => sub.unsubscribe();
  }, []);

  return active;
}

function useApiData() {
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [notifications, setNotifications] = useState<{ count: number; timestamp: string } | null>(null);

  useEffect(() => {
    // "Login" after 500ms
    const loginTimer = setTimeout(() => {
      session$.next({ id: 1, name: 'Alice', email: 'alice@example.com' });
    }, 500);

    const profileSub = userProfile$.subscribe(setProfile);
    const postsSub = userPosts$.subscribe(setPosts);
    const notifSub = notifications$.pipe(take(10)).subscribe(setNotifications);

    return () => {
      clearTimeout(loginTimer);
      profileSub.unsubscribe();
      postsSub.unsubscribe();
      notifSub.unsubscribe();
    };
  }, []);

  return { profile, posts, notifications };
}

export function TestApp() {
  const { profile, posts, notifications } = useApiData();
  const pipeTree = usePipeTree();
  const activeOnly = useActiveOnly();

  return (
    <div style={{ fontFamily: 'system-ui', padding: 20, background: '#0f172a', color: '#e2e8f0', width: '90vw', minHeight: '90vh' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: 24 }}>RxJS Debugger Test App</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* User Profile - from session$ -> switchMap -> from(fetch) -> shareReplay */}
        <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', color: '#60a5fa' }}>User Profile (shareReplay)</h3>
          <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>
            {profile ? JSON.stringify(profile, null, 2) : 'Waiting for login...'}
          </pre>
        </div>

        {/* User Posts - also switchMap from session$ */}
        <div style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 12px', color: '#22c55e' }}>User Posts (switchMap)</h3>
          <div style={{ fontSize: 12 }}>
            {posts.length === 0 ? 'Loading posts...' : posts.map(post => (
              <div key={post.id} style={{ marginBottom: 4 }}>• {post.title}</div>
            ))}
          </div>
        </div>

        {/* Live Notifications - interval -> switchMap -> from(fetch) */}
        <div style={{ background: '#1e293b', padding: 16, borderRadius: 8, gridColumn: 'span 2' }}>
          <h3 style={{ margin: '0 0 12px', color: '#a78bfa' }}>Notifications (interval polling)</h3>
          <div style={{ fontSize: 14 }}>
            {notifications
              ? `${notifications.count} new notifications @ ${notifications.timestamp}`
              : 'Starting poll...'}
          </div>
        </div>
      </div>

      {/* Pipe Tree visualization */}
      <div style={{ background: '#1e293b', borderRadius: 8, overflow: 'hidden', padding: 16 }}>
        <div style={{ marginBottom: 12, fontSize: 14, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Observable Pipe Tree ({pipeTree.activeCount} active / {pipeTree.totalCount} total)</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => activeOnly$.next(e.target.checked)}
            />
            Active only
          </label>
        </div>
        <PipeTree state={pipeTree} />
      </div>
    </div>
  );
}
