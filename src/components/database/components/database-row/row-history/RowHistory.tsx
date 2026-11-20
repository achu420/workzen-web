import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useDatabaseContextOptional } from '@/application/database-yjs';
import { CardHistoryService } from '@/application/services/domains';
import type { CardHistoryChange, CardHistoryEntry } from '@/application/services/domains/card-history';
import { UIVariant } from '@/application/types';
import { ReactComponent as ChevronIcon } from '@/assets/icons/alt_arrow_right.svg';
import { ConfirmModal } from '@/components/_shared/modal/ConfirmModal';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/errors';
import { getServerInfoSnapshot, subscribeToServerInfo } from '@/utils/server-info';

const PAGE_SIZE = 10;
const NO_ESCAPE = { escapeValue: false } as const;
// Expanded state is remembered per card for the life of the page only.
const expandedCards = new Map<string, boolean>();

/** Prefer the server's own explanation (for example "was changed after this edit") over the generic mapping. */
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

export function formatHistoryValue(value: unknown, empty: string): string {
  if (value === null || value === undefined || value === '') return empty;
  if (Array.isArray(value)) return value.length ? value.join(', ') : empty;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function ChangeLine({ change }: { change: CardHistoryChange }) {
  const { t } = useTranslation();
  const empty = t('rowHistory.empty', { defaultValue: '(empty)' });

  if (change.kind === 'archived') {
    return (
      <span>
        {change.after ? t('rowHistory.archived', { defaultValue: 'Archived the card' }) : t('rowHistory.unarchived', { defaultValue: 'Brought the card back from the archive' })}
      </span>
    );
  }
  return (
    <span>
      <span className='font-medium'>{change.field}</span>
      {': '}
      <span className='text-text-tertiary line-through'>{formatHistoryValue(change.before, empty)}</span>
      {' → '}
      <span>{formatHistoryValue(change.after, empty)}</span>
    </span>
  );
}

export function CardHistoryPanel({ workspaceId, rowId }: { workspaceId: string; rowId: string }) {
  const { t } = useTranslation();
  const tRef = useRef(t);

  tRef.current = t;
  const cardKey = `${workspaceId}:${rowId}`;
  const [open, setOpen] = useState(() => expandedCards.get(cardKey) ?? false);
  const [entries, setEntries] = useState<CardHistoryEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [target, setTarget] = useState<CardHistoryEntry | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const page = await CardHistoryService.list(workspaceId, rowId, { limit: PAGE_SIZE });

      setEntries(page.entries);
      setNextBefore(page.has_more ? page.next_before : null);
      setState('ready');
    } catch (failure) {
      setError(readableError(failure, tRef.current('rowHistory.loadFailed', { defaultValue: 'Could not load the history' })));
      setState('error');
    }
  }, [workspaceId, rowId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const toggle = () => {
    setOpen((current) => {
      expandedCards.set(cardKey, !current);
      return !current;
    });
  };

  const loadMore = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await CardHistoryService.list(workspaceId, rowId, { limit: PAGE_SIZE, before: nextBefore });

      setEntries((current) => [...current, ...page.entries]);
      setNextBefore(page.has_more ? page.next_before : null);
    } catch (failure) {
      toast.error(readableError(failure, t('rowHistory.loadFailed', { defaultValue: 'Could not load the history' })));
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmRestore = async () => {
    if (!target) return;
    setRestoring(true);
    try {
      await CardHistoryService.restore(workspaceId, rowId, target.id);
      toast.success(t('rowHistory.restored', { defaultValue: 'Previous values restored' }));
      setTarget(null);
      void load();
    } catch (failure) {
      toast.error(readableError(failure, t('rowHistory.restoreFailed', { defaultValue: 'Could not restore this change' })));
      setTarget(null);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className='row-history px-[var(--row-page-inset,96px)] max-sm:px-6' data-testid='row-history'>
      <button
        type='button'
        className='flex w-full items-center gap-2 py-1 text-left text-sm font-medium text-text-primary'
        aria-expanded={open}
        data-testid='row-history-toggle'
        onClick={toggle}
      >
        <ChevronIcon className={cn('h-4 w-4 text-icon-secondary transition-transform', open && 'rotate-90')} />
        {t('rowHistory.title', { defaultValue: 'History' })}
      </button>
      {open && (
        <div className='mt-2 flex flex-col gap-2' data-testid='row-history-panel'>
          <div className='flex items-center justify-between gap-3'>
            <p className='text-xs text-text-tertiary'>
              {t('rowHistory.intro', { defaultValue: 'Who changed this card and what the values were before. Changes show up a few seconds after someone stops editing.' })}
            </p>
            <Button variant='ghost' size='sm' className='shrink-0 text-xs' data-testid='row-history-refresh' onClick={() => void load()}>
              {t('rowHistory.refresh', { defaultValue: 'Refresh' })}
            </Button>
          </div>
          {state === 'loading' && entries.length === 0 && (
            <div role='status' className='flex justify-center py-3'>
              <Progress variant='primary' />
            </div>
          )}
          {state === 'error' && (
            <div className='flex items-center gap-3 text-sm text-text-error' data-testid='row-history-error'>
              <span>{error}</span>
              <Button variant='outline' size='sm' onClick={() => void load()}>
                {t('button.retry', { defaultValue: 'Retry' })}
              </Button>
            </div>
          )}
          {state === 'ready' && entries.length === 0 && (
            <p className='text-sm text-text-tertiary' data-testid='row-history-empty'>
              {t('rowHistory.none', { defaultValue: 'No changes recorded yet.' })}
            </p>
          )}
          {entries.length > 0 && (
            <ul className='flex flex-col gap-2' data-testid='row-history-list'>
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  data-testid={`row-history-entry-${entry.id}`}
                  className={cn('flex items-start justify-between gap-4 rounded-300 border border-border-primary px-3 py-2', entry.restored && 'opacity-60')}
                >
                  <div className='flex min-w-0 flex-col gap-1'>
                    <div className='flex flex-wrap items-center gap-2 text-sm'>
                      <span className='font-medium text-text-primary' data-testid={`row-history-who-${entry.id}`}>
                        {entry.actors.length
                          ? entry.actors.map((actor) => actor.name).join(', ')
                          : t('rowHistory.someone', { defaultValue: 'Someone' })}
                      </span>
                      {entry.via && (
                        <span className='rounded-300 bg-fill-theme-select px-1.5 py-0.5 text-xs text-text-primary' data-testid={`row-history-via-${entry.id}`}>
                          {t('rowHistory.via', { defaultValue: 'via {{agent}}', agent: entry.via, interpolation: NO_ESCAPE })}
                        </span>
                      )}
                      <span className='text-xs text-text-tertiary' title={new Date(entry.created_at).toLocaleString()}>{ago(entry.created_at)}</span>
                      {entry.restored && (
                        <span className='text-xs text-text-tertiary' data-testid={`row-history-restored-${entry.id}`}>
                          {t('rowHistory.restoredTag', { defaultValue: 'Restored' })}
                        </span>
                      )}
                    </div>
                    <ul className='flex flex-col gap-0.5 text-sm text-text-primary'>
                      {entry.changes.map((change) => (
                        <li key={`${change.kind}:${change.field}`} className='break-words'><ChangeLine change={change} /></li>
                      ))}
                    </ul>
                  </div>
                  {entry.can_restore && (
                    <Button variant='outline' size='sm' className='shrink-0' data-testid={`row-history-restore-${entry.id}`} onClick={() => setTarget(entry)}>
                      {t('rowHistory.restore', { defaultValue: 'Restore' })}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {nextBefore && (
            <div>
              <Button variant='outline' size='sm' data-testid='row-history-more' loading={loadingMore} onClick={() => void loadMore()}>
                {t('rowHistory.older', { defaultValue: 'Show older' })}
              </Button>
            </div>
          )}
        </div>
      )}
      <ConfirmModal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={() => void confirmRestore()}
        loading={restoring}
        title={t('rowHistory.restoreTitle', { defaultValue: 'Restore the previous values?' })}
        description={t('rowHistory.restoreDescription', {
          defaultValue: 'The values from before this change are put back. If anyone changed those fields after this edit, nothing is touched.',
        })}
        confirmText={t('rowHistory.restore', { defaultValue: 'Restore' })}
        confirmTestId='row-history-restore-confirm'
        dialogTestId='row-history-restore-dialog'
      />
    </div>
  );
}

/** "History" section of a card: who changed what, with a way back. Not shown on published (public) pages. */
export function RowHistory({ rowId }: { rowId: string }) {
  const context = useDatabaseContextOptional();
  const serverInfo = useSyncExternalStore(subscribeToServerInfo, () => getServerInfoSnapshot());

  // Only servers that say they keep card history get the section (AppFlowy Cloud has no such endpoint).
  if (serverInfo.status !== 'available' || serverInfo.info.enable_card_history !== true) return null;
  if (!context?.workspaceId || context.variant === UIVariant.Publish || !rowId) return null;
  return <CardHistoryPanel workspaceId={context.workspaceId} rowId={rowId} />;
}

export default RowHistory;
