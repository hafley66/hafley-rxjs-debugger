import { describe, it } from 'vitest';
import { interval } from '../rxjs-patched';
import { share } from '../operators';
import { patchPipe, unpatchPipe } from '../pipe-patch';
import { patchSubscribe, unpatchSubscribe } from '../subscribe-patch';
import { getMetadata, activeSubscriptions, archivedSubscriptions, clearArchivedSubscriptions } from '../registry';

describe('share debug', () => {
  it('logs subscription structure', () => {
    activeSubscriptions.clear();
    clearArchivedSubscriptions();
    // Constructor proxy already patched on module load
    unpatchSubscribe();
    unpatchPipe();
    patchPipe();
    patchSubscribe();

    const source$ = interval(1000);
    const shared$ = source$.pipe(share());
    const sourceId = getMetadata(source$)?.id;

    console.log('source$ id:', sourceId);
    console.log('shared$ id:', getMetadata(shared$)?.id);

    const sub1 = shared$.subscribe();
    const sub2 = shared$.subscribe();

    console.log('\nAfter sub1+sub2 - active:', activeSubscriptions.size);

    sub1.unsubscribe();
    console.log('After sub1.unsubscribe - active:', activeSubscriptions.size, 'archived:', archivedSubscriptions.size);

    sub2.unsubscribe();
    console.log('After sub2.unsubscribe - active:', activeSubscriptions.size, 'archived:', archivedSubscriptions.size);

    const sourceSubs = [...activeSubscriptions.values()].filter(s => s.observableId === sourceId);
    console.log('Source subs still active:', sourceSubs.length);

    // Debug: what ARE those orphan subs?
    console.log('\n=== ORPHAN SUBS ===');
    for (const [id, meta] of activeSubscriptions.entries()) {
      console.log(`${id}: obsId=${meta.observableId}, parent=${meta.parentSubscriptionId || 'none'}`);
    }

    unpatchSubscribe();
    unpatchPipe();
    // Don't unpatch constructors - they stay patched for all tests
  });
});
