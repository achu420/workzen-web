import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { useDatabase, useDatabaseContextOptional } from '@/application/database-yjs';
import { getAxiosInstance } from '@/application/services/js-services/http';
import { UIVariant, YjsDatabaseKey } from '@/application/types';
import { ReactComponent as ChevronIcon } from '@/assets/icons/alt_arrow_right.svg';
import { ConfirmModal } from '@/components/_shared/modal/ConfirmModal';
import { useAIEnabled } from '@/components/app/app.hooks';
import { Chat } from '@/components/chat/chat';
import { ChatRequest } from '@/components/chat/request/chat-request';
import { CardChatScope } from '@/components/chat/types';
import { useCurrentUserOptional } from '@/components/main/app.hooks';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { cardChatId } from './cardChatId';

// Expanded state is remembered per card for the life of the page only.
const expandedCards = new Map<string, boolean>();

const inertRequest = async () => undefined;

function CardChatPanel({ workspaceId, databaseId, rowId, userId }: {
  workspaceId: string;
  databaseId: string;
  rowId: string;
  userId: string;
}) {
  const { t } = useTranslation();
  const currentUser = useCurrentUserOptional();
  const chatId = useMemo(() => cardChatId(workspaceId, rowId, userId), [workspaceId, rowId, userId]);
  const cardKey = `${workspaceId}:${rowId}:${userId}`;
  const [open, setOpen] = useState(() => expandedCards.get(cardKey) ?? false);
  // The chat is only mounted once it was opened, so closed cards cost nothing.
  const [everOpened, setEverOpened] = useState(open);
  const [chatVersion, setChatVersion] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const scope = useMemo<CardChatScope>(() => ({ type: 'card', databaseId, rowId }), [databaseId, rowId]);
  const chatUser = useMemo(
    () => (currentUser ? { uuid: currentUser.uuid, name: currentUser.name || '', email: currentUser.email || '', avatar: currentUser.avatar || '' } : undefined),
    [currentUser]
  );
  const requestInstance = useMemo(() => {
    const axiosInstance = getAxiosInstance();

    if (!axiosInstance) return undefined;
    const request = new ChatRequest(workspaceId, chatId, axiosInstance);

    // A card chat is not a page: nothing to rename, insert into or create.
    request.getCurrentView = () => Promise.reject(new Error('Not available in a card chat'));
    request.updateViewName = inertRequest as typeof request.updateViewName;
    request.insertContentToView = inertRequest as typeof request.insertContentToView;
    request.createViewWithContent = (() => Promise.reject(new Error('Not available in a card chat'))) as typeof request.createViewWithContent;
    return request;
  }, [workspaceId, chatId]);

  const toggle = useCallback(() => {
    setOpen((current) => {
      expandedCards.set(cardKey, !current);
      return !current;
    });
    setEverOpened(true);
  }, [cardKey]);

  const handleClear = async () => {
    if (!requestInstance) return;
    setClearing(true);
    try {
      await requestInstance.deleteChat();
      setChatVersion((version) => version + 1);
      setConfirmClear(false);
      toast.success(t('cardChat.cleared', { defaultValue: 'Chat history cleared' }));
    } catch (error) {
      toast.error(typeof error === 'string' ? error : t('cardChat.clearFailed', { defaultValue: 'Could not clear the chat history' }));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className='row-ask-ai px-[var(--row-page-inset,96px)] max-sm:px-6' data-testid='row-ask-ai'>
      <button
        type='button'
        className='flex w-full items-center gap-2 py-1 text-left text-sm font-medium text-text-primary'
        aria-expanded={open}
        data-testid='row-ask-ai-toggle'
        onClick={toggle}
      >
        <ChevronIcon className={cn('h-4 w-4 text-icon-secondary transition-transform', open && 'rotate-90')} />
        {t('cardChat.title', { defaultValue: 'Ask AI about this card' })}
      </button>
      {open && (
        <div className='mt-2 flex flex-col gap-2' data-testid='row-ask-ai-panel'>
          <div className='flex items-center justify-between gap-3'>
            <p className='text-xs text-text-tertiary'>
              {t('cardChat.privacy', { defaultValue: 'Only this card is shared with the AI. Your chat history is private to you.' })}
            </p>
            <Button variant='ghost' size='sm' className='shrink-0 text-xs' data-testid='row-ask-ai-clear' onClick={() => setConfirmClear(true)}>
              {t('cardChat.clear', { defaultValue: 'Clear history' })}
            </Button>
          </div>
        </div>
      )}
      {everOpened && requestInstance && (
        <div className={cn('mt-2 h-[420px] w-full overflow-hidden rounded-300 border border-border-primary', !open && 'hidden')} data-testid='row-ask-ai-chat'>
          <Chat key={`${chatId}:${chatVersion}`} workspaceId={workspaceId} chatId={chatId} requestInstance={requestInstance} currentUser={chatUser} scope={scope} compact />
        </div>
      )}
      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title={t('cardChat.clearTitle', { defaultValue: 'Clear chat history?' })}
        description={t('cardChat.clearDescription', { defaultValue: 'This deletes your conversation with the AI about this card. Other people keep their own conversations.' })}
        cancelText={t('button.cancel', { defaultValue: 'Cancel' })}
        confirmText={t('cardChat.clear', { defaultValue: 'Clear history' })}
        loading={clearing}
        confirmTestId='row-ask-ai-clear-confirm'
        onConfirm={() => void handleClear()}
      />
    </div>
  );
}

/** "Ask AI about this card": a per-user chat that only knows this card. */
export function RowAskAI({ rowId }: { rowId: string }) {
  const aiEnabled = useAIEnabled();
  const context = useDatabaseContextOptional();
  const database = useDatabase();
  const currentUser = useCurrentUserOptional();
  const databaseId = database?.get(YjsDatabaseKey.id) as string | undefined;

  if (!aiEnabled || context?.variant === UIVariant.Publish || !context?.workspaceId || !currentUser?.uuid || !databaseId) return null;

  return <CardChatPanel workspaceId={context.workspaceId} databaseId={databaseId} rowId={rowId} userId={currentUser.uuid} />;
}

export default RowAskAI;
