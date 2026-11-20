import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

import { AgentActivityService, AgentTokensService } from '@/application/services/domains';

import { AgentAccessPanel } from '../AgentAccessPanel';

// Like real i18next, escape interpolated values unless the caller turns that off.
const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\//g, '&#x2F;');

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> & { interpolation?: { escapeValue?: boolean } }) =>
      String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => {
        const value = String(options?.[name] ?? '');

        return options?.interpolation?.escapeValue === false ? value : escapeHtml(value);
      }),
  }),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock('@/application/services/js-services/http/cloud-config', () => ({
  defaultConfig: { baseURL: 'http://localhost:8787/' },
}));
jest.mock('@/application/services/domains', () => ({
  AgentTokensService: { list: jest.fn(), create: jest.fn(), revoke: jest.fn() },
  AgentActivityService: { list: jest.fn(), undo: jest.fn() },
}));

const api = jest.mocked(AgentTokensService);
const activityApi = jest.mocked(AgentActivityService);
const SECRET = 'afmcp_tok-new_s3cr3tvalue';
const MCP_URL = 'http://localhost:8787/mcp';
const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();

const tokens = [
  { id: 'active-1', name: 'Claude Code laptop', scope: 'write', created_at: '2026-11-01T10:00:00.000Z', last_used_at: hourAgo, expires_at: null, revoked: false, expired: false, owner: { user_id: 'u1', name: 'Achal', email: 'a@x.io' }, owned_by_me: true },
  { id: 'expired-1', name: 'Old Cursor', scope: 'read', created_at: '2026-01-01T10:00:00.000Z', last_used_at: null, expires_at: '2026-02-01T10:00:00.000Z', revoked: false, expired: true, owner: { user_id: 'u1', name: 'Achal', email: 'a@x.io' }, owned_by_me: true },
  { id: 'revoked-1', name: 'Stolen laptop', scope: 'read', created_at: '2026-03-01T10:00:00.000Z', last_used_at: null, expires_at: null, revoked: true, expired: false, owner: { user_id: 'u2', name: 'Mia', email: 'm@x.io' }, owned_by_me: false },
] as const;

const writeText = jest.fn().mockResolvedValue(undefined);

async function renderPanel() {
  const view = render(<AgentAccessPanel workspaceId='ws-1' />);

  await screen.findByTestId('agent-access-panel');
  return view;
}

function created(overrides: Record<string, unknown> = {}) {
  return { id: 'tok-new', name: 'My agent', scope: 'read', token: SECRET, created_at: '2026-11-13T10:00:00.000Z', expires_at: null, ...overrides };
}

describe('AgentAccessPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    api.list.mockResolvedValue([...tokens]);
    activityApi.list.mockResolvedValue({ entries: [], has_more: false, next_before: null });
  });

  it('shows whose token it is when it is not yours, and switches to the activity trail', async () => {
    await renderPanel();
    await screen.findByTestId('agent-tokens-list');

    expect(screen.getByTestId('agent-token-owner-revoked-1').textContent).toBe('For Mia');
    expect(screen.queryByTestId('agent-token-owner-active-1')).toBeNull();
    expect(screen.getByText("Everyone's tokens")).toBeTruthy();
    fireEvent.click(screen.getByTestId('agent-tab-activity-panel'));
    expect(await screen.findByTestId('agent-activity')).toBeTruthy();
    expect(activityApi.list).toHaveBeenCalled();
  });

  it('explains what agents can do and warns that a token is like a password', async () => {
    await renderPanel();

    expect(screen.getAllByText(/search and read pages and cards/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('agent-access-warning').textContent).toMatch(/under its name and yours/i);
    expect(screen.getByTestId('agent-access-warning').textContent).toMatch(/like a password/i);
  });

  it('lists tokens with scope, status, last used and expiry, and mutes the dead ones', async () => {
    await renderPanel();
    await screen.findByTestId('agent-tokens-list');

    expect(screen.getByTestId('agent-token-scope-active-1').textContent).toBe('Read & write');
    expect(screen.getByTestId('agent-token-scope-expired-1').textContent).toBe('Read-only');
    expect(screen.getByTestId('agent-token-status-active-1').textContent).toBe('Active');
    expect(screen.getByTestId('agent-token-status-expired-1').textContent).toBe('Expired');
    expect(screen.getByTestId('agent-token-status-revoked-1').textContent).toBe('Revoked');
    expect(screen.getByTestId('agent-token-meta-active-1').textContent).toMatch(/Last used .*hour/);
    expect(screen.getByTestId('agent-token-meta-active-1').textContent).toContain('No expiry');
    expect(screen.getByTestId('agent-token-meta-expired-1').textContent).toContain('Never used');
    expect(screen.getByTestId('agent-token-meta-expired-1').textContent).toMatch(/Expires /);

    expect(screen.getByTestId('agent-token-row-active-1').className).not.toContain('opacity-60');
    expect(screen.getByTestId('agent-token-row-expired-1').className).toContain('opacity-60');
    expect(screen.getByTestId('agent-token-row-revoked-1').className).toContain('opacity-60');
    expect(screen.getByTestId('agent-revoke-active-1')).toBeTruthy();
    expect(screen.getByTestId('agent-revoke-expired-1')).toBeTruthy();
    expect(screen.queryByTestId('agent-revoke-revoked-1')).toBeNull();
  });

  it('shows an empty state', async () => {
    api.list.mockResolvedValue([]);
    await renderPanel();

    expect(await screen.findByTestId('agent-tokens-empty')).toBeTruthy();
  });

  it('shows a retryable error when the list cannot be loaded', async () => {
    api.list.mockRejectedValueOnce({ code: 500, message: 'Request failed', diagnosticMessage: 'database offline' });
    await renderPanel();

    expect((await screen.findByTestId('agent-tokens-error')).textContent).toContain('database offline');
    fireEvent.click(screen.getByTestId('agent-tokens-retry'));
    expect(await screen.findByTestId('agent-tokens-list')).toBeTruthy();
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('needs a name before it can create a token', async () => {
    await renderPanel();

    expect((screen.getByTestId('agent-create-token')).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('agent-token-name'), { target: { value: '   ' } });
    expect((screen.getByTestId('agent-create-token')).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('agent-token-name'), { target: { value: 'My agent' } });
    expect((screen.getByTestId('agent-create-token')).disabled).toBe(false);
  });

  it('creates a read-only token that never expires by default, with a trimmed name', async () => {
    api.create.mockResolvedValue(created() as never);
    await renderPanel();

    expect(screen.getByTestId('agent-scope-read').getAttribute('aria-checked')).toBe('true');
    fireEvent.change(screen.getByTestId('agent-token-name'), { target: { value: '  My agent  ' } });
    fireEvent.click(screen.getByTestId('agent-create-token'));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith('ws-1', { name: 'My agent', scope: 'read', expires_in_days: null }));
  });

  it('sends the chosen scope and expiry', async () => {
    api.create.mockResolvedValue(created({ scope: 'write' }) as never);
    await renderPanel();

    fireEvent.change(screen.getByTestId('agent-token-name'), { target: { value: 'Writer' } });
    fireEvent.click(screen.getByTestId('agent-scope-write'));
    fireEvent.change(screen.getByTestId('agent-token-expiry'), { target: { value: '30' } });
    fireEvent.click(screen.getByTestId('agent-create-token'));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith('ws-1', { name: 'Writer', scope: 'write', expires_in_days: 30 }));
  });

  it('shows the secret once with a copy button and configuration snippets built from the real URL and token', async () => {
    api.create.mockResolvedValue(created() as never);
    await renderPanel();

    fireEvent.change(screen.getByTestId('agent-token-name'), { target: { value: 'My agent' } });
    fireEvent.click(screen.getByTestId('agent-create-token'));

    const result = await screen.findByTestId('agent-token-result');

    expect((within(result).getByTestId('agent-token-secret')).value).toBe(SECRET);
    expect(within(result).getByTestId('agent-token-secret').getAttribute('readonly')).not.toBeNull();
    expect(within(result).getByTestId('agent-token-once').textContent).toMatch(/not be shown again/i);
    expect(within(result).getByTestId('agent-verifying-note').textContent).toContain(MCP_URL);

    fireEvent.click(within(result).getByTestId('agent-copy-token'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SECRET));
    expect(toast.success).toHaveBeenCalledWith('Token copied');

    // Claude Code is the default tab.
    expect(within(result).getByTestId('agent-snippet-cli').textContent).toBe(
      `claude mcp add --transport http workzen ${MCP_URL} --header "Authorization: Bearer ${SECRET}"`
    );
    fireEvent.click(within(result).getByTestId('agent-copy-snippet-cli'));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('claude mcp add --transport http')));
    expect(within(result).getByTestId('agent-snippet-mcp-json').textContent).not.toContain(SECRET);
    expect(within(result).getByTestId('agent-snippet-export').textContent).toBe(`export APPFLOWY_MCP_TOKEN=${SECRET}`);

    fireEvent.mouseDown(within(result).getByTestId('agent-tab-cursor'), { button: 0 });
    expect(within(await screen.findByTestId('agent-snippet-mcp-json')).getByText(/\$\{env:APPFLOWY_MCP_TOKEN\}/)).toBeTruthy();

    fireEvent.mouseDown(within(result).getByTestId('agent-tab-claude-desktop'), { button: 0 });
    const desktop = JSON.parse((await screen.findByTestId('agent-snippet-config')).textContent ?? '{}');

    expect(desktop.mcpServers.workzen.args[0]).toContain('mcp-stdio-shim.mjs');
    expect(desktop.mcpServers.workzen.env).toEqual({ MCP_URL: MCP_URL, MCP_TOKEN: SECRET });
    expect(screen.getByTestId('agent-shim-note').textContent).toContain('scripts/mcp-stdio-shim.mjs');
  });

  it('renders names, URLs and dates literally instead of as HTML entities', async () => {
    api.list.mockResolvedValue([{ ...tokens[0], id: 'q-1', name: `Bob's "laptop" <dev> & co` }] as never);
    api.create.mockResolvedValue(created({ name: `Bob's laptop` }) as never);
    await renderPanel();
    await screen.findByTestId('agent-tokens-list');

    expect(screen.getByTestId('agent-token-row-q-1').textContent).toContain(`Bob's "laptop" <dev> & co`);
    fireEvent.change(screen.getByTestId('agent-token-name'), { target: { value: `Bob's laptop` } });
    fireEvent.click(screen.getByTestId('agent-create-token'));
    const result = await screen.findByTestId('agent-token-result');

    expect(result.textContent).toContain(`Your new token: Bob's laptop`);
    expect(within(result).getByTestId('agent-verifying-note').textContent).toContain('http://localhost:8787/mcp');
    expect(within(result).getByTestId('agent-verifying-note').textContent).not.toContain('&#x2F;');

    fireEvent.click(screen.getByTestId('agent-revoke-q-1'));
    expect(await screen.findByText(`Revoke "Bob's "laptop" <dev> & co"?`)).toBeTruthy();
  });

  it('removes the secret when the result is dismissed, and the refreshed list never contains it', async () => {
    api.create.mockResolvedValue(created() as never);
    await renderPanel();

    fireEvent.change(screen.getByTestId('agent-token-name'), { target: { value: 'My agent' } });
    fireEvent.click(screen.getByTestId('agent-create-token'));
    await screen.findByTestId('agent-token-result');
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByTestId('agent-token-done'));
    expect(screen.queryByTestId('agent-token-result')).toBeNull();
    expect(screen.queryByTestId('agent-token-secret')).toBeNull();
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it('forgets the secret when the panel is left and reopened', async () => {
    api.create.mockResolvedValue(created() as never);
    const first = await renderPanel();

    fireEvent.change(screen.getByTestId('agent-token-name'), { target: { value: 'My agent' } });
    fireEvent.click(screen.getByTestId('agent-create-token'));
    await screen.findByTestId('agent-token-result');
    first.unmount();

    await renderPanel();
    expect(screen.queryByTestId('agent-token-result')).toBeNull();
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it('never writes the secret to storage or the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => jest.spyOn(console, method).mockImplementation(() => undefined));

    api.create.mockResolvedValue(created() as never);
    await renderPanel();
    fireEvent.change(screen.getByTestId('agent-token-name'), { target: { value: 'My agent' } });
    fireEvent.click(screen.getByTestId('agent-create-token'));
    await screen.findByTestId('agent-token-result');

    const logged = spies.flatMap((spy) => spy.mock.calls.flat()).map(String).join(' ');

    expect(logged).not.toContain(SECRET);
    expect(JSON.stringify({ ...localStorage })).not.toContain(SECRET);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(SECRET);
    spies.forEach((spy) => spy.mockRestore());
  });

  it('shows the server explanation when creating fails and keeps no result card', async () => {
    api.create.mockRejectedValue({ code: 403, message: 'Request failed', diagnosticMessage: 'Only owners can create tokens' });
    await renderPanel();

    fireEvent.change(screen.getByTestId('agent-token-name'), { target: { value: 'My agent' } });
    fireEvent.click(screen.getByTestId('agent-create-token'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Only owners can create tokens'));
    expect(screen.queryByTestId('agent-token-result')).toBeNull();
  });

  it('revokes a token only after confirmation and then refreshes the list', async () => {
    api.revoke.mockResolvedValue({ id: 'active-1', revoked: true });
    await renderPanel();
    await screen.findByTestId('agent-tokens-list');

    fireEvent.click(screen.getByTestId('agent-revoke-active-1'));
    expect(api.revoke).not.toHaveBeenCalled();
    expect(await screen.findByText(/Revoke "Claude Code laptop"\?/)).toBeTruthy();

    fireEvent.click(await screen.findByTestId('agent-revoke-confirm'));
    await waitFor(() => expect(api.revoke).toHaveBeenCalledWith('ws-1', 'active-1'));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalledWith('Token revoked');
  });

  it('does not revoke when the confirmation is cancelled', async () => {
    await renderPanel();
    await screen.findByTestId('agent-tokens-list');

    fireEvent.click(screen.getByTestId('agent-revoke-active-1'));
    fireEvent.click(await screen.findByText('button.cancel'));
    await waitFor(() => expect(screen.queryByTestId('agent-revoke-confirm')).toBeNull());
    expect(api.revoke).not.toHaveBeenCalled();
  });

  it('reports a failed revocation', async () => {
    api.revoke.mockRejectedValue({ code: 500, message: 'Request failed', diagnosticMessage: 'Could not reach the database' });
    await renderPanel();
    await screen.findByTestId('agent-tokens-list');

    fireEvent.click(screen.getByTestId('agent-revoke-active-1'));
    fireEvent.click(await screen.findByTestId('agent-revoke-confirm'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not reach the database'));
  });
});
