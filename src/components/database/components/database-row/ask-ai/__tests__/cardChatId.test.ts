import { existsSync, readFileSync } from 'fs';

import { CARD_CHAT_NAMESPACE, cardChatId } from '../cardChatId';

const VECTOR_FILE =
  '/private/tmp/claude-501/-Volumes-work-disk-Codes-Tracker/4b89062d-6752-4f90-b9cf-02a3355ce209/scratchpad/card-chat-vector.json';

describe('cardChatId', () => {
  it('is stable, per workspace, card and user, and a valid v5 UUID', () => {
    const id = cardChatId('ws', 'row', 'user');

    expect(id).toBe(cardChatId('ws', 'row', 'user'));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set([id, cardChatId('ws2', 'row', 'user'), cardChatId('ws', 'row2', 'user'), cardChatId('ws', 'row', 'user2')]).size).toBe(4);
  });

  it('uses the namespace the backend uses', () => {
    expect(CARD_CHAT_NAMESPACE).toBe('6f1c2f1e-7a52-4c3e-9d2b-3d5a8c0b9e41');
  });

  (existsSync(VECTOR_FILE) ? it : it.skip)('matches the backend test vector', () => {
    const vector = JSON.parse(readFileSync(VECTOR_FILE, 'utf8')) as {
      workspaceId: string;
      rowId: string;
      userId: string;
      chatId: string;
    };

    expect(cardChatId(vector.workspaceId, vector.rowId, vector.userId)).toBe(vector.chatId);
  });
});
