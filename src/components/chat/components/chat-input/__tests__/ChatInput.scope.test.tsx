import { render, screen } from '@testing-library/react';

import { ChatInput } from '../index';

let scope: { type: 'card'; databaseId: string; rowId: string } | undefined;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  // The editor package pulled in through the chat types registers itself with i18next.
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));
jest.mock('framer-motion', () => ({ motion: { div: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div> } }));
jest.mock('@/components/chat/chat/context', () => ({ useChatContext: () => ({ chatId: 'chat-1', scope }) }));
jest.mock('@/components/chat/provider/messages-handler-provider', () => ({
  useMessagesHandlerContext: () => ({
    submitQuestion: jest.fn(),
    cancelAnswerStream: jest.fn(),
    answerApplying: false,
    questionSending: false,
    chatSettings: { web_search_enabled: false },
    updateChatSettings: jest.fn(),
    ragScopeState: { status: 'ready' },
  }),
}));
jest.mock('@/components/chat/provider/response-format-provider', () => ({
  useResponseFormatContext: () => ({
    responseFormat: { output_layout: 0, output_content: 0 },
    responseMode: 0,
    setResponseFormat: jest.fn(),
    setResponseMode: jest.fn(),
  }),
}));
jest.mock('@/components/chat/provider/prompt-modal-provider', () => ({
  usePromptModal: () => ({ openModal: jest.fn(), currentPromptId: null, updateCurrentPromptId: jest.fn(), reloadDatabasePrompts: jest.fn() }),
}));
jest.mock('@/components/chat/components/ui/format-group', () => ({ FormatGroup: () => null }));
jest.mock('@/components/chat/components/ui/loading-dots', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/chat/components/ui/textarea', () => ({
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Textarea: require('react').forwardRef((props: object, ref: React.Ref<HTMLTextAreaElement>) => <textarea ref={ref} {...props} />),
}));
jest.mock('@/components/chat/components/chat-input/model-selector', () => ({ ModelSelector: () => <div data-testid='model-selector' /> }));
jest.mock('@/components/chat/components/chat-input/prompt-modal', () => ({ PromptModal: () => <div data-testid='prompt-modal' /> }));
jest.mock('@/components/chat/components/chat-input/related-views', () => ({ RelatedViews: () => <div data-testid='related-views' /> }));
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}));
jest.mock('@/assets/icons/ai_stop_answering.svg', () => ({ ReactComponent: () => null }));
jest.mock('@/assets/icons/earth.svg', () => ({ ReactComponent: () => null }));
jest.mock('@/assets/icons/filled_round_arrow_up.svg', () => ({ ReactComponent: () => null }));
jest.mock('@/assets/icons/text.svg', () => ({ ReactComponent: () => null }));
jest.mock('@/assets/icons/text_image.svg', () => ({ ReactComponent: () => null }));

describe('ChatInput controls', () => {
  it('shows the page-oriented controls for a normal AI chat', () => {
    scope = undefined;
    render(<ChatInput />);

    expect(screen.getByTestId('chat-input-web-search-toggle')).toBeTruthy();
    expect(screen.getByTestId('chat-input-browse-prompts')).toBeTruthy();
    expect(screen.getByTestId('chat-input-format-toggle')).toBeTruthy();
    expect(screen.getByTestId('related-views')).toBeTruthy();
    expect(screen.getByTestId('model-selector')).toBeTruthy();
  });

  it('hides them for a card chat but keeps the model picker and the send button', () => {
    scope = { type: 'card', databaseId: 'db', rowId: 'row' };
    render(<ChatInput />);

    expect(screen.queryByTestId('chat-input-web-search-toggle')).toBeNull();
    expect(screen.queryByTestId('chat-input-browse-prompts')).toBeNull();
    expect(screen.queryByTestId('chat-input-format-toggle')).toBeNull();
    expect(screen.queryByTestId('related-views')).toBeNull();
    expect(screen.getByTestId('model-selector')).toBeTruthy();
    expect(screen.getByTestId('chat-input-send')).toBeTruthy();
  });
});
