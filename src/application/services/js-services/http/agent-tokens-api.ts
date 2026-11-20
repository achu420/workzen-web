import { APIResponse, executeAPIRequest, getAxios } from './core';

export type AgentTokenScope = 'read' | 'write';

export interface AgentToken {
  id: string;
  name: string;
  scope: AgentTokenScope;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked: boolean;
  expired: boolean;
  /** Whose access this token carries (the person who created it). */
  owner: { user_id: string; name: string; email: string | null };
  owned_by_me: boolean;
}

export interface CreateAgentTokenPayload {
  name: string;
  scope: AgentTokenScope;
  /** 1-365, or null/omitted for a token that never expires. */
  expires_in_days?: number | null;
}

/** The only response that ever contains the token secret. */
export interface CreatedAgentToken {
  id: string;
  name: string;
  scope: AgentTokenScope;
  token: string;
  created_at: string;
  expires_at: string | null;
}

const tokensUrl = (workspaceId: string) => `/api/workspace/${workspaceId}/agent-tokens`;

export async function listAgentTokens(workspaceId: string): Promise<AgentToken[]> {
  const data = await executeAPIRequest<{ tokens: AgentToken[] }>(() =>
    getAxios()?.get<APIResponse<{ tokens: AgentToken[] }>>(tokensUrl(workspaceId))
  );

  return data.tokens;
}

export async function createAgentToken(workspaceId: string, payload: CreateAgentTokenPayload): Promise<CreatedAgentToken> {
  return executeAPIRequest<CreatedAgentToken>(() =>
    getAxios()?.post<APIResponse<CreatedAgentToken>>(tokensUrl(workspaceId), payload)
  );
}

export async function revokeAgentToken(workspaceId: string, tokenId: string): Promise<{ id: string; revoked: true }> {
  return executeAPIRequest<{ id: string; revoked: true }>(() =>
    getAxios()?.delete<APIResponse<{ id: string; revoked: true }>>(`${tokensUrl(workspaceId)}/${encodeURIComponent(tokenId)}`)
  );
}
