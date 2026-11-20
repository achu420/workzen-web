// eslint-disable-next-line import/no-unresolved
import '@testing-library/jest-dom';
import { expect } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as Y from 'yjs';

import { DocumentHistoryModal } from '../DocumentHistoryModal';

/**
 * Task 57: covers the previously-missing UI controls for named snapshot
 * creation and tombstone-delete, wired to the already-existing
 * `createCollabVersion` / `deleteCollabVersion` collab-api.ts client methods.
 * No new backend endpoint is invented here; these tests assert the modal
 * calls exactly the existing hook methods with the right arguments.
 */

jest.mock('@/components/editor', () => ({
  Editor: () => null,
}));

jest.mock('@/components/_shared/progress/ComponentLoading', () => () => null);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const loadView = jest.fn();
const bindViewSync = jest.fn();
const loadViewMeta = jest.fn();
const createRow = jest.fn();
const getViewIdFromDatabaseId = jest.fn();
const getMentionUser = jest.fn();
const loadDatabaseRelations = jest.fn();

const getCollabHistory = jest.fn();
const previewCollabVersion = jest.fn();
const revertCollabVersion = jest.fn();
const createCollabVersion = jest.fn();
const deleteCollabVersion = jest.fn();

const notifySuccess = jest.fn();
const notifyError = jest.fn();

jest.mock('@/components/_shared/notify', () => ({
  notify: {
    success: (...args: unknown[]) => notifySuccess(...args),
    error: (...args: unknown[]) => notifyError(...args),
    warning: jest.fn(),
  },
}));

jest.mock('@/components/app/app.hooks', () => ({
  useAppOperations: () => ({
    loadViewMeta,
    createRow,
    getViewIdFromDatabaseId,
    loadView,
    bindViewSync,
  }),
  useCollabHistory: () => ({
    getCollabHistory,
    previewCollabVersion,
    revertCollabVersion,
    createCollabVersion,
    deleteCollabVersion,
  }),
  useGetSubscriptions: () => jest.fn(),
  useCurrentWorkspaceId: () => 'workspace-1',
  useEventEmitter: () => ({ on: jest.fn(), off: jest.fn() }),
  useGetMentionUser: () => getMentionUser,
  useLoadDatabaseRelations: () => loadDatabaseRelations,
}));

jest.mock('@/components/app/hooks/useSubscriptionPlan', () => ({
  useSubscriptionPlan: () => ({ isPro: false }),
}));

jest.mock('@/components/main/app.hooks', () => ({
  useCurrentUser: () => ({ uid: '1' }),
}));

function renderModal(onOpenChange = jest.fn()) {
  return render(
    <DocumentHistoryModal open onOpenChange={onOpenChange} viewId='view-1' view={{ name: 'Doc', icon: null }} />
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  getCollabHistory.mockResolvedValue([
    {
      versionId: 'version-1',
      parentId: null,
      name: 'Version 1',
      createdAt: new Date('2026-05-21T09:38:06Z'),
      deletedAt: null,
      editors: [1],
    },
  ]);
  previewCollabVersion.mockResolvedValue(new Y.Doc());
  loadView.mockResolvedValue(new Y.Doc());
});

test('creating a snapshot encodes the current live doc and refreshes history on success', async () => {
  createCollabVersion.mockResolvedValue('new-version-id');
  renderModal();

  await screen.findByTestId('version-history-create-snapshot-button');
  fireEvent.click(screen.getByTestId('version-history-create-snapshot-button'));
  fireEvent.change(screen.getByTestId('version-history-create-snapshot-name-input'), {
    target: { value: 'Milestone 1' },
  });

  getCollabHistory.mockClear();
  fireEvent.click(screen.getByTestId('version-history-create-snapshot-confirm'));

  await waitFor(() => expect(createCollabVersion).toHaveBeenCalledTimes(1));
  expect(createCollabVersion.mock.calls[0][0]).toBe('view-1');
  expect(createCollabVersion.mock.calls[0][1]).toBe('Milestone 1');
  expect(createCollabVersion.mock.calls[0][2]).toBeInstanceOf(Uint8Array);
  expect(loadView).toHaveBeenCalledWith('view-1');

  await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('versionHistory.createSnapshotSuccess'));
  // History must be re-fetched after a successful create so the new snapshot appears.
  await waitFor(() => expect(getCollabHistory).toHaveBeenCalledTimes(1));
});

test('create-snapshot API failure surfaces an error and leaves the modal usable', async () => {
  createCollabVersion.mockRejectedValue(new Error('server exploded'));
  renderModal();

  await screen.findByTestId('version-history-create-snapshot-button');
  fireEvent.click(screen.getByTestId('version-history-create-snapshot-button'));
  fireEvent.change(screen.getByTestId('version-history-create-snapshot-name-input'), {
    target: { value: 'Will fail' },
  });
  fireEvent.click(screen.getByTestId('version-history-create-snapshot-confirm'));

  await waitFor(() => expect(notifyError).toHaveBeenCalled());
  expect(String(notifyError.mock.calls[0][0])).toContain('server exploded');
  // Modal remains interactive: the create button is still present and enabled.
  expect(screen.getByTestId('version-history-create-snapshot-button')).toBeEnabled();
});

test('deleting a version calls the tombstone-delete API and refreshes history', async () => {
  deleteCollabVersion.mockResolvedValue(undefined);
  renderModal();

  await screen.findByTestId('version-history-delete-button-version-1');
  getCollabHistory.mockClear();
  fireEvent.click(screen.getByTestId('version-history-delete-button-version-1'));
  fireEvent.click(screen.getByTestId('version-history-delete-confirm'));

  await waitFor(() => expect(deleteCollabVersion).toHaveBeenCalledWith('view-1', 'version-1'));
  await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('versionHistory.deleteVersionSuccess'));
  await waitFor(() => expect(getCollabHistory).toHaveBeenCalledTimes(1));
});

test('delete API failure surfaces an error without crashing the modal', async () => {
  deleteCollabVersion.mockRejectedValue(new Error('cannot delete'));
  renderModal();

  await screen.findByTestId('version-history-delete-button-version-1');
  fireEvent.click(screen.getByTestId('version-history-delete-button-version-1'));
  fireEvent.click(screen.getByTestId('version-history-delete-confirm'));

  await waitFor(() => expect(notifyError).toHaveBeenCalled());
  expect(String(notifyError.mock.calls[0][0])).toContain('cannot delete');
  expect(screen.getByTestId('version-history-modal')).toBeInTheDocument();
});

test('a tombstoned version disappears from the next refreshed listing', async () => {
  deleteCollabVersion.mockResolvedValue(undefined);
  renderModal();

  await screen.findByTestId('version-history-item-version-1');

  // After deletion, the server-side refetch returns the version marked deleted.
  getCollabHistory.mockResolvedValue([
    {
      versionId: 'version-1',
      parentId: null,
      name: 'Version 1',
      createdAt: new Date('2026-05-21T09:38:06Z'),
      deletedAt: new Date('2026-05-22T00:00:00Z'),
      editors: [1],
    },
  ]);

  fireEvent.click(screen.getByTestId('version-history-delete-button-version-1'));
  fireEvent.click(screen.getByTestId('version-history-delete-confirm'));

  await waitFor(() => {
    expect(screen.queryByTestId('version-history-item-version-1')).not.toBeInTheDocument();
  });
});
