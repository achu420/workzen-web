import { PromptDatabaseConfiguration } from '@/components/chat/provider/prompt-modal-provider';
import { ChatRequest } from '@/components/chat/request/chat-request';

import { RawPromptData, PromptDatabaseField } from './prompt';
import { User } from './request';

export * from './ai-model';
export * from './checkbox';
export * from './prompt';
export * from './request';
export * from './writer';
export * from '@/components/chat/request';
export * from '@/components/chat/writer';

/** A chat that is bound to a single database card instead of a page in the sidebar. */
export interface CardChatScope {
  type: 'card';
  databaseId: string;
  rowId: string;
  rowDocumentId?: string;
}

export interface ChatProps {
  /** When set, the chat only talks about this card and never touches pages, rag scope or the outline. */
  scope?: CardChatScope;
  /** Tighter paddings for use inside a card. */
  compact?: boolean;
  workspaceId: string;
  chatId: string;
  requestInstance: ChatRequest;
  currentUser?: User;
  openingViewId?: string;
  onOpenView?: (viewId: string, rowId?: string) => void;
  onCloseView?: () => void;
  selectionMode?: boolean;
  onOpenSelectionMode?: () => void;
  onCloseSelectionMode?: () => void;
  loadDatabasePrompts?: (config: PromptDatabaseConfiguration) => Promise<{
    rawDatabasePrompts: RawPromptData[];
    fields: PromptDatabaseField[];
  }>;
  testDatabasePromptConfig?: (databaseViewId: string) => Promise<{
    config: PromptDatabaseConfiguration;
    fields: PromptDatabaseField[];
  }>;
}
