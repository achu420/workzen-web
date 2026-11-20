import { act, renderHook } from '@testing-library/react';
import * as Y from 'yjs';

import { bindSyncContext, SyncContext } from '@/application/services/js-services/sync-protocol';
import { Types, YDoc } from '@/application/types';

import { useSyncRefs } from '../syncRefs';
import { useSyncContextLifecycle } from '../useSyncContextLifecycle';

// Task 76.1: direct regression coverage for the Task 76 ordering contract
// ("a dependent collaboration update must not be transmitted before its
// required SyncRequest") and the Task 76.1 fix for the denial path Task 76
// missed (see docs/TASK76_1_ORDERING_REGRESSION_REPORT.md).
//
// `registerSyncContext` itself triggers an initial manifest `emit` via
// `initSync`, which consumes one `beforeSend`/`send` call before any test
// gets to exercise its own scenario. Every test below registers first with
// a `beforeSend` that resolves `true` by default (so registration's own
// bind succeeds uneventfully), then clears mock call history and swaps in
// the scenario-specific behaviour for the deliberate `emit` call under test.

jest.mock('@/application/sync-outbox', () => ({
  waitForDrain: async () => true,
  deleteOutboxByObjectId: async () => undefined,
  enqueueOutboxUpdate: jest.fn(async () => true),
  shouldRouteUpdateThroughOutbox: () => false,
}));

const objectId = '22222222-2222-4222-8222-222222222222';
const otherObjectId = '33333333-3333-4333-8333-333333333333';

let send: jest.Mock;
let broadcast: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  send = jest.fn();
  broadcast = jest.fn();
});

const renderLifecycle = (beforeSend: jest.Mock) =>
  renderHook(() => {
    const refs = useSyncRefs();

    return { refs, lifecycle: useSyncContextLifecycle(refs, send, broadcast, undefined, undefined, beforeSend) };
  });

/**
 * Registers a context whose own initial bind succeeds, then flushes the
 * microtasks that bind's `beforeSend(...).then(...)` chain needs to actually
 * call `sendMessage` before clearing mock history. Without the flush, the
 * registration's own deferred send can land *after* this helper returns and
 * get misattributed to the test's own deliberate `emit` call below.
 */
const registerAndReset = async (beforeSend: jest.Mock, collabType: Types = Types.Database) => {
  const { result } = renderLifecycle(beforeSend);
  const doc: YDoc = new Y.Doc({ guid: objectId });
  let context!: SyncContext;

  await act(async () => {
    context = result.current.lifecycle.registerSyncContext({ doc, collabType });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  send.mockClear();
  beforeSend.mockClear();

  return { result, doc, context };
};

// ── Scenario A — successful binding order ──────────────────────────────
test('A: a rebind transmits the SyncRequest before the dependent update, in that exact order', async () => {
  const beforeSend = jest.fn(async () => true);
  const { result, doc, context } = await registerAndReset(beforeSend);

  let resolveSyncRequest!: (allowed: boolean) => void;

  beforeSend
    .mockImplementationOnce(() => new Promise<boolean>((resolve) => { resolveSyncRequest = resolve; }))
    .mockResolvedValueOnce(true);

  // Force a rebind: pretend a DIFFERENT object currently owns the shared slot.
  result.current.refs.lastBoundObjectId.current = otherObjectId;

  const emitResult = context.emit({ collabMessage: { objectId, collabType: Types.Database, update: {} } });

  // The SyncRequest's `beforeSend` call is still pending — nothing may have
  // reached the wire yet, including the SyncRequest itself (it is also
  // gated behind `beforeSend` for Database/DatabaseRow).
  expect(send).not.toHaveBeenCalled();

  await act(async () => {
    resolveSyncRequest(true);
    await emitResult;
  });

  // Exactly two frames went out: the SyncRequest, then the dependent update,
  // and the dependent update's `beforeSend` call only starts once the
  // SyncRequest's own promise has settled (proven by it being gated behind
  // `await` above rather than firing immediately).
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[0][0].collabMessage.syncRequest).toBeDefined();
  expect(send.mock.calls[1][0].collabMessage.update).toBeDefined();
  doc.destroy();
});

// ── Scenario B — no rebind required ─────────────────────────────────────
test('B: an already-bound object sends its update directly, without an extra SyncRequest', async () => {
  const beforeSend = jest.fn(async () => true);
  const { result, doc, context } = await registerAndReset(beforeSend);

  result.current.refs.lastBoundObjectId.current = objectId;

  await act(async () => {
    await context.emit({ collabMessage: { objectId, collabType: Types.Database, update: {} } });
  });

  expect(beforeSend).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledTimes(1);
  expect(send.mock.calls[0][0].collabMessage.update).toBeDefined();
  doc.destroy();
});

// ── Scenario C — binding failure (rejected Promise) ─────────────────────
test('C: a rejected SyncRequest check prevents the dependent update from being transmitted', async () => {
  const beforeSend = jest.fn(async () => true);
  const { result, doc, context } = await registerAndReset(beforeSend);

  beforeSend
    .mockRejectedValueOnce(new Error('restore-state unavailable')) // the SyncRequest's own rawEmit
    .mockResolvedValueOnce(true); // would (wrongly) allow the dependent update if it were attempted

  result.current.refs.lastBoundObjectId.current = otherObjectId;

  await act(async () => {
    await context.emit({ collabMessage: { objectId, collabType: Types.Database, update: {} } });
  });

  // Only the (failed) SyncRequest attempt's `beforeSend` call happened --
  // the dependent update's rawEmit must never have been invoked at all.
  expect(beforeSend).toHaveBeenCalledTimes(1);
  expect(send).not.toHaveBeenCalled();

  // The optimistic `lastBoundObjectId` write must have been reverted, so a
  // later emit retries the rebind instead of wrongly believing this object
  // is already bound (the exact mechanism that left Task 75's Document
  // retry loop permanently stuck).
  expect(result.current.refs.lastBoundObjectId.current).toBeNull();
  doc.destroy();
});

// ── Scenario D — explicit denial (`allowed: false`) ──────────────────────
test('D: a denied SyncRequest (allowed: false) prevents the dependent update from being transmitted', async () => {
  const beforeSend = jest.fn(async () => true);
  const { result, doc, context } = await registerAndReset(beforeSend);

  beforeSend
    .mockResolvedValueOnce(false) // the SyncRequest's own rawEmit is denied
    .mockResolvedValueOnce(true); // the dependent update's own independent check would allow it

  result.current.refs.lastBoundObjectId.current = otherObjectId;

  await act(async () => {
    await context.emit({ collabMessage: { objectId, collabType: Types.Database, update: {} } });
  });

  // Without the Task 76.1 fix, this would call `beforeSend` a second time
  // for the dependent update (which resolves `true` above) and transmit it
  // despite the required SyncRequest never having been sent -- reproducing
  // the exact defect Task 76 was meant to fix, via the denial path.
  expect(beforeSend).toHaveBeenCalledTimes(1);
  expect(send).not.toHaveBeenCalled();
  expect(result.current.refs.lastBoundObjectId.current).toBeNull();
  doc.destroy();
});

// ── bindSyncContext / ensureObjectBoundForSend propagate the same outcome ──
test('bindSyncContext resolves only once the manifest SyncRequest actually transmits', async () => {
  const beforeSend = jest.fn(async () => true);
  const { doc, context } = await registerAndReset(beforeSend, Types.DatabaseRow);

  let resolveBeforeSend!: (allowed: boolean) => void;

  beforeSend.mockImplementationOnce(() => new Promise<boolean>((resolve) => { resolveBeforeSend = resolve; }));

  let settled = false;
  const pending = bindSyncContext(context);

  if (pending) {
    void pending.then(() => { settled = true; });
  }

  expect(settled).toBe(false);
  expect(send).not.toHaveBeenCalled();

  await act(async () => {
    resolveBeforeSend(true);
    await pending;
  });

  expect(settled).toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
  doc.destroy();
});
