import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { UIVariant } from '@/application/types';

import { RowAskAI } from '../RowAskAI';

const deleteChat = jest.fn();
const chatMounts = jest.fn();
let aiEnabled = true;
let variant: UIVariant | undefined = UIVariant.App;
let currentUser: { uuid: string; name: string; email: string; avatar: string } | undefined = {
  uuid: 'user-1',
  name: 'Ada',
  email: 'ada@example.test',
  avatar: '',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key }),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('@/application/database-yjs', () => ({
  useDatabase: () => ({ get: () => 'db-1' }),
  useDatabaseContextOptional: () => ({ workspaceId: 'ws-1', variant }),
}));
jest.mock('@/application/services/js-services/http', () => ({ getAxiosInstance: () => ({}) }));
jest.mock('@/components/app/app.hooks', () => ({ useAIEnabled: () => aiEnabled }));
jest.mock('@/components/main/app.hooks', () => ({ useCurrentUserOptional: () => currentUser }));
jest.mock('@/assets/icons/alt_arrow_right.svg', () => ({ ReactComponent: () => <span /> }));
jest.mock('@/components/_shared/modal/ConfirmModal', () => ({
  ConfirmModal: ({ open, onConfirm, confirmTestId }: { open: boolean; onConfirm: () => void; confirmTestId: string }) =>
    open ? <button data-testid={confirmTestId} onClick={onConfirm} /> : null,
}));
jest.mock('@/components/chat/request/chat-request', () => ({
  ChatRequest: jest.fn().mockImplementation((workspaceId: string, chatId: string) => ({ workspaceId, chatId, deleteChat })),
}));
jest.mock('@/components/chat/chat', () => ({
  Chat: ({ chatId, scope, compact }: { chatId: string; scope: unknown; compact?: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useEffect } = require('react');

    // Counts mounts, not renders, so a remount after "Clear history" is observable.
    useEffect(() => {
      chatMounts(chatId, scope, compact);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid='mock-chat' />;
  },
}));

describe('RowAskAI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    aiEnabled = true;
    variant = UIVariant.App;
    currentUser = { uuid: 'user-1', name: 'Ada', email: 'ada@example.test', avatar: '' };
    deleteChat.mockResolvedValue(undefined);
  });

  it.each<[string, () => void]>([
    ['AI is disabled', () => { aiEnabled = false; }],
    ['the page is published', () => { variant = UIVariant.Publish; }],
    ['nobody is logged in', () => { currentUser = undefined; }],
  ])('renders nothing when %s', (_name, arrange) => {
    arrange();
    const { container } = render(<RowAskAI rowId='row-1' />);

    expect(container.innerHTML).toBe('');
  });

  it('starts collapsed without mounting the chat, then mounts it scoped to the card on first open', () => {
    render(<RowAskAI rowId='row-open' />);

    expect(screen.getByTestId('row-ask-ai-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('mock-chat')).toBeNull();

    fireEvent.click(screen.getByTestId('row-ask-ai-toggle'));
    expect(screen.getByTestId('mock-chat')).toBeTruthy();
    expect(chatMounts).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      { type: 'card', databaseId: 'db-1', rowId: 'row-open' },
      true
    );
    expect(screen.getByText('Only this card is shared with the AI. Your chat history is private to you.')).toBeTruthy();
  });

  it('keeps the chat mounted while collapsed so a draft is not lost, and remembers the state per card', () => {
    const { unmount } = render(<RowAskAI rowId='row-remember' />);

    fireEvent.click(screen.getByTestId('row-ask-ai-toggle'));
    fireEvent.click(screen.getByTestId('row-ask-ai-toggle'));
    expect(screen.getByTestId('mock-chat')).toBeTruthy();
    fireEvent.click(screen.getByTestId('row-ask-ai-toggle'));
    unmount();

    render(<RowAskAI rowId='row-remember' />);
    expect(screen.getByTestId('row-ask-ai-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('clears the history through the API and then remounts the chat', async () => {
    render(<RowAskAI rowId='row-clear' />);
    fireEvent.click(screen.getByTestId('row-ask-ai-toggle'));
    expect(chatMounts).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('row-ask-ai-clear'));
    fireEvent.click(screen.getByTestId('row-ask-ai-clear-confirm'));

    await waitFor(() => expect(deleteChat).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(chatMounts.mock.calls.length).toBeGreaterThan(1));
  });

  it('keeps the chat when clearing fails', async () => {
    deleteChat.mockRejectedValueOnce('nope');
    render(<RowAskAI rowId='row-clear-fail' />);
    fireEvent.click(screen.getByTestId('row-ask-ai-toggle'));
    const mountsBefore = chatMounts.mock.calls.length;

    fireEvent.click(screen.getByTestId('row-ask-ai-clear'));
    fireEvent.click(screen.getByTestId('row-ask-ai-clear-confirm'));

    await waitFor(() => expect(deleteChat).toHaveBeenCalled());
    expect(chatMounts.mock.calls.length).toBe(mountsBefore);
  });
});
