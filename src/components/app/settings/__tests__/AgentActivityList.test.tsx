import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import { AgentActivityService } from '@/application/services/domains';

import { AgentActivityList } from '../agent-access/AgentActivityList';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? '')),
  }),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock('@/application/services/domains', () => ({ AgentActivityService: { list: jest.fn(), undo: jest.fn() } }));

const api = jest.mocked(AgentActivityService);
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 'e1', token_id: 't1', agent: "Mia's Claude Code", owner: { user_id: 'u1', name: 'Mia', email: 'mia@x.io' }, tool: 'update_card', kind: 'write',
  target_type: 'card', target_id: 'c1', target_title: 'Fix login', summary: 'Updated Status on “Fix login”', ok: true, error_code: null,
  created_at: minutesAgo(5), can_undo: true, undone: false, undone_at: null, ...overrides,
});

describe('AgentActivityList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.list.mockResolvedValue({ entries: [entry()], has_more: false, next_before: null } as never);
  });

  it('shows whose agent did what, starting with changes only', async () => {
    render(<AgentActivityList workspaceId='ws-1' />);

    expect(await screen.findByTestId('agent-activity-row-e1')).toBeTruthy();
    expect(screen.getByTestId('agent-activity-agent-e1').textContent).toBe("Mia's Claude Code");
    expect(screen.getByTestId('agent-activity-owner-e1').textContent).toBe('for Mia');
    expect(screen.getByTestId('agent-activity-summary-e1').textContent).toBe('Updated Status on “Fix login”');
    expect(screen.getByTestId('agent-activity-kind-e1').textContent).toBe('Change');
    expect(api.list).toHaveBeenCalledWith('ws-1', { limit: 25, kind: 'write' });
  });

  it('switches filters and asks the server for exactly that', async () => {
    render(<AgentActivityList workspaceId='ws-1' />);
    await screen.findByTestId('agent-activity-list');

    fireEvent.click(screen.getByTestId('agent-activity-filter-all'));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith('ws-1', { limit: 25 }));
    fireEvent.click(screen.getByTestId('agent-activity-filter-failed'));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith('ws-1', { limit: 25, ok: false }));
  });

  it('marks reads and failures differently and offers undo only where it can work', async () => {
    api.list.mockResolvedValue({
      entries: [
        entry({ id: 'r1', kind: 'read', can_undo: false, summary: 'Read card x' }),
        entry({ id: 'f1', ok: false, can_undo: false, summary: 'Failed: archive_card (FORBIDDEN)' }),
        entry({ id: 'd1', undone: true, can_undo: false }),
        entry({ id: 'w1' }),
      ],
      has_more: false, next_before: null,
    } as never);
    render(<AgentActivityList workspaceId='ws-1' />);
    await screen.findByTestId('agent-activity-list');

    expect(screen.getByTestId('agent-activity-kind-r1').textContent).toBe('Read');
    expect(screen.getByTestId('agent-activity-kind-f1').textContent).toBe('Failed');
    expect(screen.getByTestId('agent-activity-undone-d1').textContent).toBe('Undone');
    expect(screen.queryByTestId('agent-activity-undo-r1')).toBeNull();
    expect(screen.queryByTestId('agent-activity-undo-f1')).toBeNull();
    expect(screen.queryByTestId('agent-activity-undo-d1')).toBeNull();
    expect(screen.getByTestId('agent-activity-undo-w1')).toBeTruthy();
  });

  it('asks before undoing, then undoes and reloads', async () => {
    api.undo.mockResolvedValue({ id: 'e1', undone: true });
    render(<AgentActivityList workspaceId='ws-1' />);
    fireEvent.click(await screen.findByTestId('agent-activity-undo-e1'));

    expect(await screen.findByTestId('agent-undo-dialog')).toBeTruthy();
    expect(api.undo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('agent-undo-confirm'));
    await waitFor(() => expect(api.undo).toHaveBeenCalledWith('ws-1', 'e1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Change undone'));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });

  it('shows the server\'s reason when an undo is refused because the card changed', async () => {
    api.undo.mockRejectedValue({ diagnosticMessage: "\"Owner\" was changed after the agent's edit, so it was left alone." });
    render(<AgentActivityList workspaceId='ws-1' />);
    fireEvent.click(await screen.findByTestId('agent-activity-undo-e1'));
    fireEvent.click(await screen.findByTestId('agent-undo-confirm'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("\"Owner\" was changed after the agent's edit, so it was left alone."));
  });

  it('pages with "Show older" using the server cursor, without repeating rows', async () => {
    api.list
      .mockResolvedValueOnce({ entries: [entry({ id: 'a' })], has_more: true, next_before: '2026-11-14T10:00:00.000Z' } as never)
      .mockResolvedValueOnce({ entries: [entry({ id: 'b' })], has_more: false, next_before: null } as never);
    render(<AgentActivityList workspaceId='ws-1' />);
    fireEvent.click(await screen.findByTestId('agent-activity-more'));

    expect(await screen.findByTestId('agent-activity-row-b')).toBeTruthy();
    expect(api.list).toHaveBeenLastCalledWith('ws-1', { limit: 25, before: '2026-11-14T10:00:00.000Z', kind: 'write' });
    expect(screen.getAllByTestId(/agent-activity-row-/)).toHaveLength(2);
    expect(screen.queryByTestId('agent-activity-more')).toBeNull();
  });

  it('says so when there is nothing, and offers a retry when loading fails', async () => {
    api.list.mockResolvedValueOnce({ entries: [], has_more: false, next_before: null } as never);
    const { unmount } = render(<AgentActivityList workspaceId='ws-1' />);

    expect((await screen.findByTestId('agent-activity-empty')).textContent).toBe('No agent activity yet.');
    unmount();
    api.list.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce({ entries: [entry()], has_more: false, next_before: null } as never);
    render(<AgentActivityList workspaceId='ws-1' />);
    expect(await screen.findByTestId('agent-activity-error')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('agent-activity-row-e1')).toBeTruthy();
  });
});
