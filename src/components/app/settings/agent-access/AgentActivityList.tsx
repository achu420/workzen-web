import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { AgentActivityService } from '@/application/services/domains';
import type { AgentActivityEntry } from '@/application/services/domains/agent-activity';
import { ConfirmModal } from '@/components/_shared/modal/ConfirmModal';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/errors';

type Filter = 'all' | 'changes' | 'failed';

const PAGE_SIZE = 25;
const NO_ESCAPE = { escapeValue: false } as const;

/** Prefer the server's own explanation (for example "was changed after the agent's edit") over the generic mapping. */
function readableError(error: unknown, fallback: string): string {
  const diagnostic = typeof error === 'object' && error !== null ? (error as { diagnosticMessage?: unknown }).diagnosticMessage : undefined;

  if (typeof diagnostic === 'string' && diagnostic.trim() && diagnostic !== 'Request failed') return diagnostic;
  return getErrorMessage(error, fallback);
}

function ago(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]];
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return formatter.format(0, 'second');
}

const queryFor = (filter: Filter) => (filter === 'changes' ? { kind: 'write' as const } : filter === 'failed' ? { ok: false } : {});

/** Who did what: every call an agent made, newest first, with the agent's name and its owner. */
export function AgentActivityList({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const tRef = useRef(t);

  tRef.current = t;
  const [filter, setFilter] = useState<Filter>('changes');
  const [entries, setEntries] = useState<AgentActivityEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [undoTarget, setUndoTarget] = useState<AgentActivityEntry | null>(null);
  const [undoing, setUndoing] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const page = await AgentActivityService.list(workspaceId, { limit: PAGE_SIZE, ...queryFor(filter) });

      setEntries(page.entries);
      setNextBefore(page.has_more ? page.next_before : null);
      setState('ready');
    } catch (failure) {
      setError(readableError(failure, tRef.current('settings.agentAccess.activityLoadFailed', { defaultValue: 'Could not load agent activity' })));
      setState('error');
    }
  }, [workspaceId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await AgentActivityService.list(workspaceId, { limit: PAGE_SIZE, before: nextBefore, ...queryFor(filter) });

      setEntries((current) => [...current, ...page.entries]);
      setNextBefore(page.has_more ? page.next_before : null);
    } catch (failure) {
      toast.error(readableError(failure, t('settings.agentAccess.activityLoadFailed', { defaultValue: 'Could not load agent activity' })));
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmUndo = async () => {
    if (!undoTarget) return;
    setUndoing(true);
    try {
      await AgentActivityService.undo(workspaceId, undoTarget.id);
      toast.success(t('settings.agentAccess.undone', { defaultValue: 'Change undone' }));
      setUndoTarget(null);
      void load();
    } catch (failure) {
      toast.error(readableError(failure, t('settings.agentAccess.undoFailed', { defaultValue: 'Could not undo this change' })));
      setUndoTarget(null);
    } finally {
      setUndoing(false);
    }
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'changes', label: t('settings.agentAccess.filterChanges', { defaultValue: 'Changes' }) },
    { id: 'all', label: t('settings.agentAccess.filterAll', { defaultValue: 'Everything' }) },
    { id: 'failed', label: t('settings.agentAccess.filterFailed', { defaultValue: 'Failed' }) },
  ];

  return (
    <section className='flex flex-col gap-4' data-testid='agent-activity'>
      <p className='text-sm text-text-secondary'>
        {t('settings.agentAccess.activityIntro', {
          defaultValue: 'Everything an agent reads or changes is recorded here under the agent\'s name and the person it belongs to. Anyone in the workspace can see this and undo an agent\'s change.',
        })}
      </p>
      <div className='flex items-center gap-2' role='radiogroup' aria-label='Filter'>
        {filters.map((item) => (
          <button
            key={item.id}
            type='button'
            role='radio'
            aria-checked={filter === item.id}
            data-testid={`agent-activity-filter-${item.id}`}
            onClick={() => setFilter(item.id)}
            className={cn('rounded-300 border px-3 py-1 text-sm hover:bg-fill-content-hover', filter === item.id ? 'border-fill-theme-thick bg-fill-content-hover' : 'border-border-primary')}
          >
            {item.label}
          </button>
        ))}
        <Button variant='outline' size='sm' className='ml-auto' data-testid='agent-activity-refresh' onClick={() => void load()}>
          {t('settings.agentAccess.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      {state === 'loading' && (
        <div role='status' className='flex justify-center py-6'>
          <Progress variant='primary' />
        </div>
      )}
      {state === 'error' && (
        <div className='flex items-center gap-3 text-sm text-text-error' data-testid='agent-activity-error'>
          <span>{error}</span>
          <Button variant='outline' size='sm' onClick={() => void load()}>
            {t('button.retry', { defaultValue: 'Retry' })}
          </Button>
        </div>
      )}
      {state === 'ready' && entries.length === 0 && (
        <p className='text-sm text-text-tertiary' data-testid='agent-activity-empty'>
          {filter === 'failed'
            ? t('settings.agentAccess.activityNoFailures', { defaultValue: 'No failed agent calls.' })
            : t('settings.agentAccess.activityEmpty', { defaultValue: 'No agent activity yet.' })}
        </p>
      )}
      {state === 'ready' && entries.length > 0 && (
        <ul className='flex flex-col gap-2' data-testid='agent-activity-list'>
          {entries.map((entry) => (
            <li
              key={entry.id}
              data-testid={`agent-activity-row-${entry.id}`}
              className={cn('flex items-start justify-between gap-4 rounded-300 border border-border-primary px-4 py-3', entry.undone && 'opacity-60')}
            >
              <div className='flex min-w-0 flex-col gap-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <span className='truncate text-sm font-medium text-text-primary' data-testid={`agent-activity-agent-${entry.id}`}>{entry.agent}</span>
                  <span className='text-xs text-text-tertiary' data-testid={`agent-activity-owner-${entry.id}`}>
                    {t('settings.agentAccess.activityOwner', { defaultValue: 'for {{name}}', name: entry.owner.name, interpolation: NO_ESCAPE })}
                  </span>
                  <span
                    data-testid={`agent-activity-kind-${entry.id}`}
                    className={cn('rounded-300 px-1.5 py-0.5 text-xs', !entry.ok ? 'bg-fill-error-select text-text-error' : entry.kind === 'write' ? 'bg-fill-theme-select text-text-primary' : 'bg-fill-content-hover text-text-secondary')}
                  >
                    {!entry.ok
                      ? t('settings.agentAccess.kindFailed', { defaultValue: 'Failed' })
                      : entry.kind === 'write'
                        ? t('settings.agentAccess.kindChange', { defaultValue: 'Change' })
                        : t('settings.agentAccess.kindRead', { defaultValue: 'Read' })}
                  </span>
                  {entry.undone && (
                    <span className='text-xs text-text-tertiary' data-testid={`agent-activity-undone-${entry.id}`}>
                      {t('settings.agentAccess.undoneTag', { defaultValue: 'Undone' })}
                    </span>
                  )}
                </div>
                <span className='break-words text-sm text-text-primary' data-testid={`agent-activity-summary-${entry.id}`}>{entry.summary}</span>
                <span className='text-xs text-text-tertiary' title={new Date(entry.created_at).toLocaleString()}>{ago(entry.created_at)}</span>
              </div>
              {entry.can_undo && (
                <Button variant='outline' size='sm' data-testid={`agent-activity-undo-${entry.id}`} onClick={() => setUndoTarget(entry)}>
                  {t('settings.agentAccess.undo', { defaultValue: 'Undo' })}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {state === 'ready' && nextBefore && (
        <div>
          <Button variant='outline' size='sm' data-testid='agent-activity-more' loading={loadingMore} onClick={() => void loadMore()}>
            {t('settings.agentAccess.loadMore', { defaultValue: 'Show older' })}
          </Button>
        </div>
      )}

      <ConfirmModal
        open={Boolean(undoTarget)}
        onClose={() => setUndoTarget(null)}
        onConfirm={() => void confirmUndo()}
        loading={undoing}
        title={t('settings.agentAccess.undoTitle', { defaultValue: 'Undo this change?' })}
        description={t('settings.agentAccess.undoDescription', {
          defaultValue: '{{summary}}. The previous values are put back (a created page goes to the trash), unless someone changed the card or page after the agent did, in which case nothing is touched.',
          summary: undoTarget?.summary ?? '',
          interpolation: NO_ESCAPE,
        })}
        confirmText={t('settings.agentAccess.undo', { defaultValue: 'Undo' })}
        confirmTestId='agent-undo-confirm'
        dialogTestId='agent-undo-dialog'
      />
    </section>
  );
}

export default AgentActivityList;
