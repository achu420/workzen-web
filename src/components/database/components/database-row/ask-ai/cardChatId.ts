import { v5 as uuidv5 } from 'uuid';

/** Must match the backend's card chat namespace (ai-card-chat.js). */
export const CARD_CHAT_NAMESPACE = '6f1c2f1e-7a52-4c3e-9d2b-3d5a8c0b9e41';

/** One private chat per (workspace, card, user); the server derives and checks the same id. */
export function cardChatId(workspaceId: string, rowId: string, userId: string): string {
  return uuidv5(`${workspaceId}:${rowId}:${userId}`, CARD_CHAT_NAMESPACE);
}
