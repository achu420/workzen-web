import { APIResponse, executeAPIRequest, getAxios } from './core';

export interface CardHistoryActor {
  user_id: string;
  name: string;
  email: string | null;
}

export interface CardHistoryChange {
  kind: 'title' | 'field' | 'archived';
  field: string;
  before: unknown;
  after: unknown;
  restorable: boolean;
}

export interface CardHistoryEntry {
  id: string;
  created_at: string;
  title: string;
  /** Everyone who edited in this burst, the last one last. */
  actors: CardHistoryActor[];
  /** The agent's name when an agent made the change. */
  via: string | null;
  changes: CardHistoryChange[];
  can_restore: boolean;
  restored: boolean;
  restored_at: string | null;
}

export interface CardHistoryPage {
  entries: CardHistoryEntry[];
  has_more: boolean;
  next_before: string | null;
}

const historyUrl = (workspaceId: string, rowId: string) => `/api/workspace/${workspaceId}/card-history/${rowId}`;

export async function listCardHistory(
  workspaceId: string,
  rowId: string,
  query: { limit?: number; before?: string | null } = {}
): Promise<CardHistoryPage> {
  const params: Record<string, string | number> = {};

  if (query.limit) params.limit = query.limit;
  if (query.before) params.before = query.before;
  return executeAPIRequest<CardHistoryPage>(() =>
    getAxios()?.get<APIResponse<CardHistoryPage>>(historyUrl(workspaceId, rowId), { params })
  );
}

export async function restoreCardHistory(workspaceId: string, rowId: string, entryId: string): Promise<{ id: string; restored: true }> {
  return executeAPIRequest<{ id: string; restored: true }>(() =>
    getAxios()?.post<APIResponse<{ id: string; restored: true }>>(`${historyUrl(workspaceId, rowId)}/${encodeURIComponent(entryId)}/restore`)
  );
}
