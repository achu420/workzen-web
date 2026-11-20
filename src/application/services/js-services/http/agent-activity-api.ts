import { APIResponse, executeAPIRequest, getAxios } from './core';

export interface AgentActivityOwner {
  user_id: string;
  name: string;
  email: string | null;
}

export interface AgentActivityEntry {
  id: string;
  token_id: string;
  /** The token's name when it acted, e.g. "Achal's Claude Code". */
  agent: string;
  owner: AgentActivityOwner;
  tool: string;
  kind: 'read' | 'write';
  target_type: string | null;
  target_id: string | null;
  target_title: string | null;
  summary: string;
  ok: boolean;
  error_code: string | null;
  created_at: string;
  can_undo: boolean;
  undone: boolean;
  undone_at: string | null;
}

export interface AgentActivityPage {
  entries: AgentActivityEntry[];
  has_more: boolean;
  next_before: string | null;
}

export interface AgentActivityQuery {
  limit?: number;
  before?: string | null;
  kind?: 'read' | 'write';
  ok?: boolean;
  tokenId?: string;
}

const activityUrl = (workspaceId: string) => `/api/workspace/${workspaceId}/agent-activity`;

export async function listAgentActivity(workspaceId: string, query: AgentActivityQuery = {}): Promise<AgentActivityPage> {
  const params: Record<string, string | number> = {};

  if (query.limit) params.limit = query.limit;
  if (query.before) params.before = query.before;
  if (query.kind) params.kind = query.kind;
  if (query.ok !== undefined) params.ok = String(query.ok);
  if (query.tokenId) params.token_id = query.tokenId;
  return executeAPIRequest<AgentActivityPage>(() =>
    getAxios()?.get<APIResponse<AgentActivityPage>>(activityUrl(workspaceId), { params })
  );
}

export async function undoAgentActivity(workspaceId: string, entryId: string): Promise<{ id: string; undone: true }> {
  return executeAPIRequest<{ id: string; undone: true }>(() =>
    getAxios()?.post<APIResponse<{ id: string; undone: true }>>(`${activityUrl(workspaceId)}/${encodeURIComponent(entryId)}/undo`)
  );
}
