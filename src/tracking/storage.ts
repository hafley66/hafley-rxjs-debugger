/**
 * Storage layer for RxJS devtools using localforage
 * Simple, battle-tested, with RxJS batching
 */

import localforage from 'localforage';
import { Subject } from 'rxjs';
import { bufferTime, filter, mergeMap } from 'rxjs/operators';
import type {
  ObservableMetadata,
  SubscriptionMetadata,
  Emission,
  ErrorEvent,
  ArgumentRelationship,
} from './types';

/**
 * Write operation for batching
 */
export interface WriteOp {
  store: 'observables' | 'subscriptions' | 'emissions' | 'errors' | 'relationships';
  key: string;
  data: any;
}

// === Typed localforage instances ===

export const observablesStore = localforage.createInstance({
  name: 'rxjs-devtools',
  storeName: 'observables',
  driver: localforage.INDEXEDDB,
});

export const subscriptionsStore = localforage.createInstance({
  name: 'rxjs-devtools',
  storeName: 'subscriptions',
  driver: localforage.INDEXEDDB,
});

export const emissionsStore = localforage.createInstance({
  name: 'rxjs-devtools',
  storeName: 'emissions',
  driver: localforage.INDEXEDDB,
});

export const errorsStore = localforage.createInstance({
  name: 'rxjs-devtools',
  storeName: 'errors',
  driver: localforage.INDEXEDDB,
});

export const relationshipsStore = localforage.createInstance({
  name: 'rxjs-devtools',
  storeName: 'relationships',
  driver: localforage.INDEXEDDB,
});

/**
 * Store map for dynamic access
 */
export const stores = {
  observables: observablesStore,
  subscriptions: subscriptionsStore,
  emissions: emissionsStore,
  errors: errorsStore,
  relationships: relationshipsStore,
};

// === RxJS Batching ===

/**
 * Write queue - call .next() directly to queue writes
 * Subject (not ReplaySubject) to avoid flooding late subscribers
 */
export const writeQueue$ = new Subject<WriteOp>();

/**
 * Batch writes every 100ms for efficiency
 */
writeQueue$
  .pipe(
    bufferTime(100),
    filter((batch) => batch.length > 0),
    mergeMap(async (batch) => {
      // Write all items in parallel
      await Promise.all(
        batch.map(({ store, key, data }) => stores[store].setItem(key, data))
      );
    })
  )
  .subscribe({
    error: (err) => console.error('[RxJS Devtools] Batch write failed:', err),
  });

// === Typed helper functions ===

export async function getObservable(id: string): Promise<ObservableMetadata | null> {
  return observablesStore.getItem<ObservableMetadata>(id);
}

export async function getSubscription(id: string): Promise<SubscriptionMetadata | null> {
  return subscriptionsStore.getItem<SubscriptionMetadata>(id);
}

export async function getEmission(id: string): Promise<Emission | null> {
  return emissionsStore.getItem<Emission>(id);
}

export async function getError(id: string): Promise<ErrorEvent | null> {
  return errorsStore.getItem<ErrorEvent>(id);
}

export async function getRelationship(id: string): Promise<ArgumentRelationship | null> {
  return relationshipsStore.getItem<ArgumentRelationship>(id);
}

/**
 * Clear all data (useful for testing/reset)
 */
export async function clearAll(): Promise<void> {
  await Promise.all(Object.values(stores).map((store) => store.clear()));
}
