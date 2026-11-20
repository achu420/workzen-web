import { format } from 'date-fns';
import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CollabVersionRecord } from '@/application/collab-version.type';
import { ReactComponent as CrownIcon } from '@/assets/icons/crown.svg';
import { ReactComponent as DeleteIcon } from '@/assets/icons/delete.svg';
import { ReactComponent as PlusIcon } from '@/assets/icons/plus.svg';
import { ReactComponent as UserIcon } from '@/assets/icons/user.svg';
import { useIsOfficialHosted } from '@/components/app/hooks/useServerInfo';
import {
  VersionHistoryDateFilter,
  VersionHistoryEmptyState,
  VersionHistoryFooter,
  VersionHistoryHeader,
  VersionHistoryItem,
  type HistoryDateFilter,
} from '@/components/_shared/version-history';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';

const SNAPSHOT_NAME_MAX_LENGTH = 200;

export const VersionList = memo(function VersionList({
  versions,
  selectedVersionId,
  onSelect,
  isPro,
  dateFilter = 'all',
  onlyShowMine,
  onDateFilterChange,
  onOnlyShowMineChange,
  onRestoreClicked,
  isRestoring = false,
  onClose,
  onCreateSnapshot,
  isCreatingSnapshot = false,
  onDeleteVersion,
  isDeletingVersion = false,
}: {
  versions: CollabVersionRecord[];
  selectedVersionId: string;
  onSelect: (versionId: string) => void;
  isPro: boolean;
  dateFilter: HistoryDateFilter;
  onlyShowMine: boolean;
  onDateFilterChange: (filter: HistoryDateFilter) => void;
  onOnlyShowMineChange: (onlyShowMine: boolean) => void;
  onRestoreClicked?: () => void;
  isRestoring?: boolean;
  onClose?: () => void;
  /** Create a named snapshot of the document's current live state. Resolves true on success. */
  onCreateSnapshot?: (name: string) => Promise<boolean>;
  isCreatingSnapshot?: boolean;
  /** Tombstone-delete a version from history. */
  onDeleteVersion?: (versionId: string) => void;
  isDeletingVersion?: boolean;
}) {
  const { t } = useTranslation();
  const isHosted = useIsOfficialHosted();
  const [pendingDeleteVersionId, setPendingDeleteVersionId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotNameError, setSnapshotNameError] = useState<string | null>(null);
  // The parent's `isCreatingSnapshot` prop may not have re-rendered yet by the
  // time a second click lands in the same tick; guard duplicate submissions
  // locally and synchronously instead of relying solely on that prop.
  const creatingSnapshotRef = useRef(false);
  const handleToggleOnlyMine = useCallback((event: Event) => {
    event.preventDefault();
    onOnlyShowMineChange(!onlyShowMine);
  }, [onOnlyShowMineChange, onlyShowMine]);

  const handleOpenCreateDialog = useCallback(() => {
    setSnapshotName('');
    setSnapshotNameError(null);
    setCreateDialogOpen(true);
  }, []);

  const handleCreateDialogOpenChange = useCallback((openValue: boolean) => {
    if (!openValue) {
      if (isCreatingSnapshot) return;
      setCreateDialogOpen(false);
      return;
    }

    setCreateDialogOpen(true);
  }, [isCreatingSnapshot]);

  const handleConfirmCreateSnapshot = useCallback((event?: { preventDefault: () => void }) => {
    // AlertDialogAction auto-closes the controlled dialog on click; prevent
    // that so validation errors and in-flight submissions keep it open.
    event?.preventDefault();
    const trimmed = snapshotName.trim();

    if (!trimmed) {
      setSnapshotNameError(t('versionHistory.createSnapshotNameEmpty'));
      return;
    }

    if (trimmed.length > SNAPSHOT_NAME_MAX_LENGTH) {
      setSnapshotNameError(t('versionHistory.createSnapshotNameTooLong'));
      return;
    }

    if (!onCreateSnapshot || isCreatingSnapshot || creatingSnapshotRef.current) return;
    setSnapshotNameError(null);
    creatingSnapshotRef.current = true;
    void onCreateSnapshot(trimmed)
      .then((success) => {
        if (success) setCreateDialogOpen(false);
      })
      .finally(() => {
        creatingSnapshotRef.current = false;
      });
  }, [isCreatingSnapshot, onCreateSnapshot, snapshotName, t]);

  const handleRequestDelete = useCallback((versionId: string) => {
    setPendingDeleteVersionId(versionId);
  }, []);

  const handleCancelDelete = useCallback(() => {
    if (isDeletingVersion) return;
    setPendingDeleteVersionId(null);
  }, [isDeletingVersion]);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteVersionId || !onDeleteVersion || isDeletingVersion) return;
    onDeleteVersion(pendingDeleteVersionId);
    // The deletion itself is async (handled by the parent); closing here is
    // safe because the parent surfaces success/failure via toast and refreshes
    // the list, which removes the row regardless of dialog state.
    setPendingDeleteVersionId(null);
  }, [isDeletingVersion, onDeleteVersion, pendingDeleteVersionId]);

  return (
    <div className='flex h-full flex-col'>
      <VersionHistoryHeader onClose={onClose} closeTestId='version-history-close-button'>
        <VersionHistoryDateFilter value={dateFilter} onChange={onDateFilterChange} showDateRanges={isPro} />
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className='flex items-center justify-items-center'
            onSelect={handleToggleOnlyMine}
          >
            <UserIcon className='h-5 w-5' />
            <span className='flex-1'>{t('versionHistory.onlyYours')}</span>
            <Switch checked={onlyShowMine} className='pointer-events-none' tabIndex={-1} aria-hidden />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </VersionHistoryHeader>
      <div className='px-3 pt-2'>
        <Button
          data-testid='version-history-create-snapshot-button'
          type='button'
          variant='outline'
          size='sm'
          className='w-full justify-center gap-1.5 font-medium'
          onClick={handleOpenCreateDialog}
          disabled={!onCreateSnapshot}
          aria-label={t('versionHistory.createSnapshot')}
        >
          <PlusIcon className='h-4 w-4' />
          {t('versionHistory.createSnapshot')}
        </Button>
      </div>
      <AlertDialog open={createDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('versionHistory.createSnapshot')}</AlertDialogTitle>
          </AlertDialogHeader>
          <Input
            data-testid='version-history-create-snapshot-name-input'
            autoFocus
            value={snapshotName}
            placeholder={t('versionHistory.createSnapshotNamePlaceholder')}
            aria-label={t('versionHistory.createSnapshotNamePlaceholder')}
            aria-invalid={Boolean(snapshotNameError)}
            disabled={isCreatingSnapshot}
            onChange={(event) => {
              setSnapshotName(event.target.value);
              if (snapshotNameError) setSnapshotNameError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleConfirmCreateSnapshot();
              }
            }}
          />
          {snapshotNameError && (
            <p role='alert' className='text-xs text-text-error'>{snapshotNameError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid='version-history-create-snapshot-cancel'
              onClick={() => setCreateDialogOpen(false)}
              disabled={isCreatingSnapshot}
            >
              {t('button.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid='version-history-create-snapshot-confirm'
              onClick={handleConfirmCreateSnapshot}
              disabled={isCreatingSnapshot}
            >
              {isCreatingSnapshot && <Progress variant='primary' />}
              {t('versionHistory.createSnapshot')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div data-testid="version-history-list" className='flex-1 overflow-y-auto p-3'>
        {versions.length === 0 && (
          <VersionHistoryEmptyState>{t('versionHistory.noVersions')}</VersionHistoryEmptyState>
        )}
        {versions.map((version, index) => {
          const createdAt = version.createdAt;
          const title = version.name || format(createdAt, 'PPpp');

          return (
            <div key={version.versionId} className='group/version-item relative flex items-center'>
              <div className='min-w-0 flex-1'>
                <VersionHistoryItem
                  id={version.versionId}
                  testId={`version-history-item-${version.versionId}`}
                  title={title}
                  selected={selectedVersionId === version.versionId}
                  isFirst={index === 0}
                  isLast={index === versions.length - 1}
                  onSelect={onSelect}
                />
              </div>
              {onDeleteVersion && (
                <Button
                  data-testid={`version-history-delete-button-${version.versionId}`}
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='absolute right-1 top-2 shrink-0 text-icon-secondary opacity-0 focus-visible:opacity-100 group-hover/version-item:opacity-100'
                  aria-label={`${t('versionHistory.deleteVersion')}: ${title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRequestDelete(version.versionId);
                  }}
                  disabled={isDeletingVersion}
                >
                  <DeleteIcon className='h-4 w-4' />
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <AlertDialog open={pendingDeleteVersionId !== null} onOpenChange={(openValue) => {
        if (!openValue) handleCancelDelete();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('versionHistory.deleteVersionConfirmTitle')}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            {t('versionHistory.deleteVersionConfirmDescription')}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid='version-history-delete-cancel'
              onClick={handleCancelDelete}
              disabled={isDeletingVersion}
            >
              {t('button.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid='version-history-delete-confirm'
              className='bg-fill-error-thick text-text-on-fill hover:bg-fill-error-thick-hover'
              onClick={handleConfirmDelete}
              disabled={isDeletingVersion}
            >
              {isDeletingVersion && <Progress variant='primary' />}
              {t('versionHistory.deleteVersion')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isHosted && !isPro && (
        <div className='m-3 flex items-center gap-2 rounded-300 bg-fill-featured-light p-3'>
          <CrownIcon className='h-5 w-5' />
          <span className='text-xs text-text-featured'>
            <span className='font-medium'>{t('versionHistory.upgrade')}</span>
            <span> </span>
            <span>{t('versionHistory.forLongerVersionHistory')}</span>
          </span>
        </div>
      )}
      <VersionHistoryFooter
        testId='version-history-restore-button'
        onRestore={onRestoreClicked}
        disabled={!selectedVersionId || !onRestoreClicked || isRestoring}
        loading={isRestoring}
      />
    </div>
  );
});
