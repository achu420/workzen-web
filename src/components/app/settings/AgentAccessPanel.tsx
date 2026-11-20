import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { AgentTokensService } from '@/application/services/domains';
import type { AgentToken, AgentTokenScope, CreatedAgentToken } from '@/application/services/domains/agent-tokens';
import { defaultConfig } from '@/application/services/js-services/http/cloud-config';
import { ConfirmModal } from '@/components/_shared/modal/ConfirmModal';
import { AgentActivityList } from '@/components/app/settings/agent-access/AgentActivityList';
import { buildMcpUrl, buildSnippets } from '@/components/app/settings/agent-access/snippets';
import type { ClientId, Snippet } from '@/components/app/settings/agent-access/snippets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/errors';

const SCOPES: { id: AgentTokenScope; label: string; labelKey: string; help: string; helpKey: string }[] = [
  {
    id: 'read',
    label: 'Read-only',
    labelKey: 'settings.agentAccess.scopeRead',
    help: 'Search and read pages, databases and cards.',
    helpKey: 'settings.agentAccess.scopeReadHelp',
  },
  {
    id: 'write',
    label: 'Read & write',
    labelKey: 'settings.agentAccess.scopeWrite',
    help: 'Also create and change pages and cards.',
    helpKey: 'settings.agentAccess.scopeWriteHelp',
  },
];

/** React escapes rendered text already; i18next's own escaping would show entities like &#x2F; and &#39;. */
const NO_ESCAPE = { escapeValue: false } as const;

const EXPIRY_DAYS = [7, 30, 90, 365];

const CLIENTS: { id: ClientId; label: string }[] = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'claude-desktop', label: 'Claude Desktop' },
];

/** Prefer the server's own explanation over the client's generic mapping. */
function readableError(error: unknown, fallback: string): string {
  const diagnostic = typeof error === 'object' && error !== null ? (error as { diagnosticMessage?: unknown }).diagnosticMessage : undefined;

  if (typeof diagnostic === 'string' && diagnostic.trim() && diagnostic !== 'Request failed') return diagnostic;
  return getErrorMessage(error, fallback);
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diffSeconds = Math.round((Date.parse(iso) - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) return formatter.format(Math.round(diffSeconds / seconds), unit);
  }

  return formatter.format(0, 'second');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

type TokenStatus = 'active' | 'expired' | 'revoked';

function tokenStatus(token: AgentToken): TokenStatus {
  if (token.revoked) return 'revoked';
  return token.expired ? 'expired' : 'active';
}

type ListState = { status: 'loading' | 'ready' | 'error'; tokens: AgentToken[]; error?: string };

function CodeBlock({ snippet, onCopy }: { snippet: Snippet; onCopy: (text: string) => void }) {
  const { t } = useTranslation();

  return (
    <div className='flex flex-col gap-1.5'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-xs text-text-secondary'>{snippet.label}</span>
        <Button variant='outline' size='sm' data-testid={`agent-copy-snippet-${snippet.id}`} onClick={() => onCopy(snippet.code)}>
          {t('button.copy', { defaultValue: 'Copy' })}
        </Button>
      </div>
      <pre
        data-testid={`agent-snippet-${snippet.id}`}
        className='appflowy-scroller overflow-x-auto whitespace-pre rounded-300 border border-border-primary bg-fill-content-hover px-3 py-2 font-mono text-xs text-text-primary'
      >
        {snippet.code}
      </pre>
    </div>
  );
}

export function AgentAccessPanel({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  // Loaders must not re-run just because the translate function changed identity.
  const tRef = useRef(t);

  tRef.current = t;
  const [list, setList] = useState<ListState>({ status: 'loading', tokens: [] });
  const [name, setName] = useState('');
  const [scope, setScope] = useState<AgentTokenScope>('read');
  const [expiryDays, setExpiryDays] = useState('');
  const [creating, setCreating] = useState(false);
  // The secret lives only here, only until the user dismisses the result card or leaves the panel.
  const [created, setCreated] = useState<CreatedAgentToken | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AgentToken | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [tab, setTab] = useState<'tokens' | 'activity'>('tokens');

  const mcpUrl = buildMcpUrl(defaultConfig.baseURL);

  const loadTokens = useCallback(async () => {
    setList((current) => ({ ...current, status: current.tokens.length ? 'ready' : 'loading', error: undefined }));
    try {
      setList({ status: 'ready', tokens: await AgentTokensService.list(workspaceId) });
    } catch (error) {
      setList({
        status: 'error',
        tokens: [],
        error: readableError(error, tRef.current('settings.agentAccess.loadFailed', { defaultValue: 'Could not load agent tokens' })),
      });
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  const copyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error(t('settings.agentAccess.copyFailed', { defaultValue: 'Could not copy. Select the text and copy it manually.' }));
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();

    if (!trimmed) return;
    setCreating(true);
    try {
      const result = await AgentTokensService.create(workspaceId, {
        name: trimmed,
        scope,
        expires_in_days: expiryDays ? Number(expiryDays) : null,
      });

      setCreated(result);
      setName('');
      toast.success(t('settings.agentAccess.created', { defaultValue: 'Agent token created' }));
      void loadTokens();
    } catch (error) {
      toast.error(readableError(error, t('settings.agentAccess.createFailed', { defaultValue: 'Could not create the token' })));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await AgentTokensService.revoke(workspaceId, revokeTarget.id);
      setRevokeTarget(null);
      toast.success(t('settings.agentAccess.revoked', { defaultValue: 'Token revoked' }));
      void loadTokens();
    } catch (error) {
      toast.error(readableError(error, t('settings.agentAccess.revokeFailed', { defaultValue: 'Could not revoke the token' })));
    } finally {
      setRevoking(false);
    }
  };

  const snippets = created ? buildSnippets(mcpUrl, created.token) : null;
  const statusLabel: Record<TokenStatus, string> = {
    active: t('settings.agentAccess.statusActive', { defaultValue: 'Active' }),
    expired: t('settings.agentAccess.statusExpired', { defaultValue: 'Expired' }),
    revoked: t('settings.agentAccess.statusRevoked', { defaultValue: 'Revoked' }),
  };

  return (
    <div className='flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden' data-testid='agent-access-panel'>
      <div className='border-b border-border-primary px-8 py-5'>
        <h2 className='text-xl font-semibold text-text-primary'>
          {t('settings.agentAccess.menuLabel', { defaultValue: 'Agent access (MCP)' })}
        </h2>
        <p className='mt-1 text-sm text-text-secondary'>
          {t('settings.agentAccess.description', {
            defaultValue:
              'Let your own AI agent (Claude Code, Cursor, Claude Desktop) work with this workspace over MCP: search and read pages and cards and, with write access, create and change them. Name each token after the agent, for example "Achal\'s Claude Code": everything it does is recorded under that name and yours.',
          })}
        </p>
      </div>
      <div className='flex gap-2 border-b border-border-primary px-8 pt-3' role='tablist'>
        {([['tokens', t('settings.agentAccess.tabTokens', { defaultValue: 'Tokens' })], ['activity', t('settings.agentAccess.tabActivity', { defaultValue: 'Activity' })]] as const).map(([id, label]) => (
          <button
            key={id}
            type='button'
            role='tab'
            aria-selected={tab === id}
            data-testid={`agent-tab-${id}-panel`}
            onClick={() => setTab(id)}
            className={cn('-mb-px border-b-2 px-3 pb-2 text-sm', tab === id ? 'border-fill-theme-thick text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary')}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'activity' && (
        <div className='appflowy-scroller flex-1 overflow-y-auto px-8 py-6' role='tabpanel'>
          <AgentActivityList workspaceId={workspaceId} />
        </div>
      )}
      <div className={cn('appflowy-scroller flex-1 overflow-y-auto px-8 py-6', tab !== 'tokens' && 'hidden')} role='tabpanel'>
        <div
          data-testid='agent-access-warning'
          className='mb-6 rounded-300 border border-border-primary bg-fill-content-hover px-4 py-3 text-sm text-text-secondary'
        >
          {t('settings.agentAccess.warning', {
            defaultValue:
              'A token gives an agent the same access to this workspace\'s data as you have. Treat it like a password: never share it, give it the lowest access that works, and revoke it when you no longer need it. Anything an agent does is recorded in Activity under its name and yours, and its changes can be undone there. Page and card text is untrusted content that an agent may read.',
          })}
        </div>

        {created && snippets && (
          <section
            data-testid='agent-token-result'
            className='mb-8 flex flex-col gap-4 rounded-300 border border-border-primary p-4'
          >
            <div>
              <h3 className='text-sm font-semibold text-text-primary'>
                {t('settings.agentAccess.resultTitle', { defaultValue: 'Your new token: {{name}}', name: created.name, interpolation: NO_ESCAPE })}
              </h3>
              <p className='mt-1 text-sm text-text-error' data-testid='agent-token-once'>
                {t('settings.agentAccess.resultOnce', {
                  defaultValue: 'Copy it now. It will not be shown again; if you lose it, revoke it and create a new one.',
                })}
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Input
                readOnly
                value={created.token}
                aria-label={t('settings.agentAccess.tokenLabel', { defaultValue: 'Agent token' })}
                data-testid='agent-token-secret'
                className='min-w-0 flex-1 font-mono'
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                variant='outline'
                data-testid='agent-copy-token'
                onClick={() => void copyText(created.token, t('settings.agentAccess.tokenCopied', { defaultValue: 'Token copied' }))}
              >
                {t('button.copy', { defaultValue: 'Copy' })}
              </Button>
            </div>

            <div className='flex flex-col gap-2'>
              <h4 className='text-sm font-medium text-text-primary'>
                {t('settings.agentAccess.connectTitle', { defaultValue: 'Connect a client' })}
              </h4>
              <p className='text-xs text-text-tertiary' data-testid='agent-verifying-note'>
                {t('settings.agentAccess.verifyingNote', {
                  defaultValue: 'Compatibility with each client is still being verified. The endpoint is {{url}}.',
                  url: mcpUrl, interpolation: NO_ESCAPE,
                })}
              </p>
              <Tabs defaultValue='claude-code' data-testid='agent-snippet-tabs'>
                <TabsList className='border-b border-border-primary'>
                  {CLIENTS.map((client) => (
                    <TabsTrigger key={client.id} value={client.id} data-testid={`agent-tab-${client.id}`}>
                      {client.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {CLIENTS.map((client) => (
                  <TabsContent key={client.id} value={client.id} className='flex flex-col gap-4 pt-3'>
                    {snippets[client.id].map((snippet) => (
                      <CodeBlock
                        key={snippet.id}
                        snippet={snippet}
                        onCopy={(text) => void copyText(text, t('settings.agentAccess.snippetCopied', { defaultValue: 'Copied' }))}
                      />
                    ))}
                    {client.id === 'claude-desktop' && (
                      <p className='text-xs text-text-tertiary' data-testid='agent-shim-note'>
                        {t('settings.agentAccess.shimNote', {
                          defaultValue:
                            'Claude Desktop starts local commands, so it connects through a small shim that lives in the backend repository at scripts/mcp-stdio-shim.mjs. Replace the path with its location on your machine.',
                        })}
                      </p>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <div>
              <Button size='sm' data-testid='agent-token-done' onClick={() => setCreated(null)}>
                {t('settings.agentAccess.done', { defaultValue: 'Done, I have saved it' })}
              </Button>
            </div>
          </section>
        )}

        <section className='flex flex-col gap-4'>
          <h3 className='text-sm font-medium text-text-primary'>
            {t('settings.agentAccess.createTitle', { defaultValue: 'Create token' })}
          </h3>
          <form
            className='flex flex-col gap-4'
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <div className='flex flex-col gap-1.5'>
              <label className='text-xs text-text-secondary' htmlFor='agent-token-name'>
                {t('settings.agentAccess.name', { defaultValue: 'Name' })}
              </label>
              <Input
                id='agent-token-name'
                value={name}
                maxLength={80}
                placeholder={t('settings.agentAccess.namePlaceholder', { defaultValue: 'e.g. My Claude Code' })}
                data-testid='agent-token-name'
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className='flex flex-col gap-1.5'>
              <span className='text-xs text-text-secondary'>{t('settings.agentAccess.access', { defaultValue: 'Access' })}</span>
              <div className='flex flex-wrap gap-2' role='radiogroup' aria-label='Access'>
                {SCOPES.map((item) => (
                  <button
                    key={item.id}
                    type='button'
                    role='radio'
                    aria-checked={scope === item.id}
                    data-testid={`agent-scope-${item.id}`}
                    onClick={() => setScope(item.id)}
                    className={cn(
                      'flex flex-col items-start rounded-300 border px-3 py-2 text-left hover:bg-fill-content-hover',
                      scope === item.id ? 'border-fill-theme-thick bg-fill-content-hover' : 'border-border-primary'
                    )}
                  >
                    <span className='text-sm text-text-primary'>{t(item.labelKey, { defaultValue: item.label })}</span>
                    <span className='text-xs text-text-tertiary'>{t(item.helpKey, { defaultValue: item.help })}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className='flex flex-col gap-1.5'>
              <label className='text-xs text-text-secondary' htmlFor='agent-token-expiry'>
                {t('settings.agentAccess.expiry', { defaultValue: 'Expires' })}
              </label>
              <select
                id='agent-token-expiry'
                value={expiryDays}
                data-testid='agent-token-expiry'
                onChange={(event) => setExpiryDays(event.target.value)}
                className='h-9 w-fit rounded-300 border border-border-primary bg-fill-content px-2 text-sm text-text-primary'
              >
                <option value=''>{t('settings.agentAccess.expiryNever', { defaultValue: 'Never' })}</option>
                {EXPIRY_DAYS.map((days) => (
                  <option key={days} value={String(days)}>
                    {t('settings.agentAccess.expiryDays', { defaultValue: 'In {{count}} days', count: days })}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Button type='submit' data-testid='agent-create-token' disabled={!name.trim() || creating} loading={creating}>
                {t('settings.agentAccess.create', { defaultValue: 'Create token' })}
              </Button>
            </div>
          </form>
        </section>

        <section className='mt-8 flex flex-col gap-2'>
          <h3 className='text-sm font-medium text-text-primary'>
            {list.tokens.some((token) => !token.owned_by_me)
              ? t('settings.agentAccess.listTitleAll', { defaultValue: 'Everyone\'s tokens' })
              : t('settings.agentAccess.listTitle', { defaultValue: 'Your tokens' })}
          </h3>
          {list.status === 'loading' && (
            <div role='status' className='flex justify-center py-6'>
              <Progress variant='primary' />
            </div>
          )}
          {list.status === 'error' && (
            <div className='flex items-center gap-3 text-sm text-text-error' data-testid='agent-tokens-error'>
              <span>{list.error}</span>
              <Button variant='outline' size='sm' data-testid='agent-tokens-retry' onClick={() => void loadTokens()}>
                {t('button.retry', { defaultValue: 'Retry' })}
              </Button>
            </div>
          )}
          {list.status === 'ready' && list.tokens.length === 0 && (
            <p className='text-sm text-text-tertiary' data-testid='agent-tokens-empty'>
              {t('settings.agentAccess.empty', { defaultValue: 'No agent tokens yet.' })}
            </p>
          )}
          {list.status === 'ready' && list.tokens.length > 0 && (
            <ul className='flex flex-col gap-2' data-testid='agent-tokens-list'>
              {list.tokens.map((token) => {
                const status = tokenStatus(token);

                return (
                  <li
                    key={token.id}
                    data-testid={`agent-token-row-${token.id}`}
                    className={cn(
                      'flex items-center justify-between gap-4 rounded-300 border border-border-primary px-4 py-3',
                      status !== 'active' && 'opacity-60'
                    )}
                  >
                    <div className='flex min-w-0 flex-col gap-1'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='truncate text-sm font-medium text-text-primary'>{token.name}</span>
                        <span
                          data-testid={`agent-token-scope-${token.id}`}
                          className='rounded-300 bg-fill-theme-select px-1.5 py-0.5 text-xs text-text-primary'
                        >
                          {token.scope === 'write'
                            ? t('settings.agentAccess.scopeWrite', { defaultValue: 'Read & write' })
                            : t('settings.agentAccess.scopeRead', { defaultValue: 'Read-only' })}
                        </span>
                        <span
                          data-testid={`agent-token-status-${token.id}`}
                          className={cn('text-xs', status === 'active' ? 'text-text-success' : 'text-text-tertiary')}
                        >
                          {statusLabel[status]}
                        </span>
                      </div>
                      <span className='text-xs text-text-tertiary' data-testid={`agent-token-meta-${token.id}`}>
                        {!token.owned_by_me && (
                          <>
                            <span data-testid={`agent-token-owner-${token.id}`}>
                              {t('settings.agentAccess.ownedBy', { defaultValue: 'For {{name}}', name: token.owner.name, interpolation: NO_ESCAPE })}
                            </span>
                            {' · '}
                          </>
                        )}
                        {t('settings.agentAccess.createdOn', { defaultValue: 'Created {{date}}', date: formatDate(token.created_at), interpolation: NO_ESCAPE })}
                        {' · '}
                        {token.last_used_at
                          ? t('settings.agentAccess.lastUsed', { defaultValue: 'Last used {{when}}', when: relativeTime(token.last_used_at), interpolation: NO_ESCAPE })
                          : t('settings.agentAccess.neverUsed', { defaultValue: 'Never used' })}
                        {' · '}
                        {token.expires_at
                          ? t('settings.agentAccess.expiresOn', { defaultValue: 'Expires {{date}}', date: formatDate(token.expires_at), interpolation: NO_ESCAPE })
                          : t('settings.agentAccess.noExpiry', { defaultValue: 'No expiry' })}
                      </span>
                    </div>
                    {status !== 'revoked' && (
                      <Button
                        variant='outline'
                        size='sm'
                        data-testid={`agent-revoke-${token.id}`}
                        onClick={() => setRevokeTarget(token)}
                      >
                        {t('settings.agentAccess.revoke', { defaultValue: 'Revoke' })}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <ConfirmModal
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => void handleRevoke()}
        loading={revoking}
        title={t('settings.agentAccess.revokeTitle', { defaultValue: 'Revoke "{{name}}"?', name: revokeTarget?.name ?? '', interpolation: NO_ESCAPE })}
        description={t('settings.agentAccess.revokeDescription', {
          defaultValue: 'Anything using this token stops working immediately. This cannot be undone.',
        })}
        confirmText={t('settings.agentAccess.revoke', { defaultValue: 'Revoke' })}
        confirmTestId='agent-revoke-confirm'
        dialogTestId='agent-revoke-dialog'
      />
    </div>
  );
}

export default AgentAccessPanel;
