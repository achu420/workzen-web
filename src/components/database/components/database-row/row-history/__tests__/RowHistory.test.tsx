import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { CardHistoryService } from '@/application/services/domains';
import { SERVER_INFO_LOADING, updateServerInfo } from '@/utils/server-info';

import { CardHistoryPanel, formatHistoryValue, RowHistory } from '../RowHistory';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? '')),
  }),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock('@/application/services/domains', () => ({ CardHistoryService: { list: jest.fn(), restore: jest.fn() } }));
jest.mock('@/application/database-yjs', () => ({ useDatabaseContextOptional: () => ({ workspaceId: 'ws-1', variant: 'app' }) }));

const api = jest.mocked(CardHistoryService);
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 'h1', created_at: minutesAgo(3), title: 'Fix login', actors: [{ user_id: 'u1', name: 'Mia', email: 'mia@x.io' }], via: null,
  changes: [{ kind: 'field', field: 'Status', before: 'Todo', after: 'Done', restorable: true }],
  can_restore: true, restored: false, restored_at: null, ...overrides,
});

const open = async () => {
  render(<CardHistoryPanel workspaceId='ws-1' rowId={`row-${Math.random()}`} />);
  fireEvent.click(screen.getByTestId('row-history-toggle'));
};

describe('CardHistoryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.list.mockResolvedValue({ entries: [entry()], has_more: false, next_before: null } as never);
  });

  it('is collapsed until opened, then shows who changed what from which value to which', async () => {
    render(<CardHistoryPanel workspaceId='ws-1' rowId='row-a' />);
    expect(api.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('row-history-toggle'));

    expect(await screen.findByTestId('row-history-entry-h1')).toBeTruthy();
    expect(screen.getByTestId('row-history-who-h1').textContent).toBe('Mia');
    expect(screen.getByTestId('row-history-entry-h1').textContent).toContain('Status: Todo → Done');
    expect(api.list).toHaveBeenCalledWith('ws-1', 'row-a', { limit: 10 });
  });

  it('shows the agent that did it, several people, archive changes and empty values readably', async () => {
    api.list.mockResolvedValue({
      entries: [
        entry({ id: 'a1', via: "Mia's Claude Code" }),
        entry({ id: 'p1', actors: [{ user_id: 'u1', name: 'Mia', email: null }, { user_id: 'u2', name: 'Omar', email: null }] }),
        entry({ id: 'x1', changes: [{ kind: 'archived', field: 'Archived', before: false, after: true, restorable: true }] }),
        entry({ id: 'e1', changes: [{ kind: 'field', field: 'Notes', before: null, after: ['a', 'b'], restorable: true }, { kind: 'field', field: 'Done', before: false, after: true, restorable: false }] }),
      ],
      has_more: false, next_before: null,
    } as never);
    await open();

    expect((await screen.findByTestId('row-history-via-a1')).textContent).toBe("via Mia's Claude Code");
    expect(screen.getByTestId('row-history-who-p1').textContent).toBe('Mia, Omar');
    expect(screen.getByTestId('row-history-entry-x1').textContent).toContain('Archived the card');
    expect(screen.getByTestId('row-history-entry-e1').textContent).toContain('Notes: (empty) → a, b');
    expect(screen.getByTestId('row-history-entry-e1').textContent).toContain('Done: No → Yes');
    expect(formatHistoryValue('', '(empty)')).toBe('(empty)');
  });

  it('offers Restore only where it can work, asks first, then restores and reloads', async () => {
    api.list.mockResolvedValue({ entries: [entry({ id: 'ok' }), entry({ id: 'done', restored: true, can_restore: false }), entry({ id: 'nope', can_restore: false })], has_more: false, next_before: null } as never);
    api.restore.mockResolvedValue({ id: 'ok', restored: true });
    await open();
    await screen.findByTestId('row-history-list');

    expect(screen.queryByTestId('row-history-restore-done')).toBeNull();
    expect(screen.queryByTestId('row-history-restore-nope')).toBeNull();
    expect(screen.getByTestId('row-history-restored-done').textContent).toBe('Restored');
    fireEvent.click(screen.getByTestId('row-history-restore-ok'));
    expect(await screen.findByTestId('row-history-restore-dialog')).toBeTruthy();
    expect(api.restore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('row-history-restore-confirm'));
    await waitFor(() => expect(api.restore).toHaveBeenCalledWith('ws-1', expect.stringMatching(/^row-/), 'ok'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Previous values restored'));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });

  it('shows the server\'s reason when a restore is refused because the card moved on', async () => {
    api.restore.mockRejectedValue({ diagnosticMessage: '"Notes" was changed after this edit, so nothing was touched.' });
    await open();
    fireEvent.click(await screen.findByTestId('row-history-restore-h1'));
    fireEvent.click(await screen.findByTestId('row-history-restore-confirm'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('"Notes" was changed after this edit, so nothing was touched.'));
  });

  it('pages with the server cursor, and handles empty and failing loads', async () => {
    api.list
      .mockResolvedValueOnce({ entries: [entry({ id: 'a' })], has_more: true, next_before: '2026-11-14T10:00:00.000Z|abc' } as never)
      .mockResolvedValueOnce({ entries: [entry({ id: 'b' })], has_more: false, next_before: null } as never);
    await open();
    fireEvent.click(await screen.findByTestId('row-history-more'));

    expect(await screen.findByTestId('row-history-entry-b')).toBeTruthy();
    expect(api.list).toHaveBeenLastCalledWith('ws-1', expect.any(String), { limit: 10, before: '2026-11-14T10:00:00.000Z|abc' });
    expect(screen.queryByTestId('row-history-more')).toBeNull();
    api.list.mockResolvedValueOnce({ entries: [], has_more: false, next_before: null } as never);
    fireEvent.click(screen.getByTestId('row-history-refresh'));
    expect(await screen.findByTestId('row-history-empty')).toBeTruthy();
    api.list.mockRejectedValueOnce(new Error('down'));
    fireEvent.click(screen.getByTestId('row-history-refresh'));
    expect(await screen.findByTestId('row-history-error')).toBeTruthy();
  });
});

describe('RowHistory visibility', () => {
  afterEach(() => updateServerInfo('https://test.appflowy.cloud', SERVER_INFO_LOADING));

  it('appears only on servers that say they keep card history', () => {
    const { container, rerender } = render(<RowHistory rowId='row-1' />);

    expect(container.querySelector('[data-testid="row-history"]')).toBeNull();
    updateServerInfo('https://test.appflowy.cloud', { status: 'available', info: { enable_page_history: true } });
    rerender(<RowHistory rowId='row-1' />);
    expect(container.querySelector('[data-testid="row-history"]')).toBeNull();
    updateServerInfo('https://test.appflowy.cloud', { status: 'available', info: { enable_page_history: true, enable_card_history: true } });
    rerender(<RowHistory rowId='row-1' />);
    expect(screen.getByTestId('row-history')).toBeTruthy();
  });
});
