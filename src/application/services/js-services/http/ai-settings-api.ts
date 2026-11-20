import { APIResponse, executeAPIRequest, executeAPIVoidRequest, getAxios } from './core';

export type AIProvider = 'openrouter' | 'openai' | 'anthropic';

export const AI_PROVIDERS: AIProvider[] = ['openrouter', 'openai', 'anthropic'];

export interface AISettings {
  provider: AIProvider | null;
  has_key: boolean;
  /** Masked tail of the stored key, e.g. "...abcd". The key itself is never returned. */
  key_hint: string | null;
  model: string | null;
  enabled_models: string[];
}

export interface UpdateAISettingsPayload {
  provider: AIProvider;
  /** Omit to keep the stored key (only valid while the provider is unchanged). */
  api_key?: string;
  model?: string;
  enabled_models?: string[];
}

export interface TestAIKeyPayload {
  provider?: AIProvider;
  /** Omit to test the stored key. */
  api_key?: string;
}

export interface TestAIKeyResult {
  ok: boolean;
  model_count: number;
}

export interface AIProviderModel {
  id: string;
  name: string;
  context_length?: number;
  supports_vision?: boolean;
  prompt_price?: number | string;
}

const settingsUrl = (workspaceId: string) => `/api/workspace/${workspaceId}/ai-settings`;

export async function getAISettings(workspaceId: string): Promise<AISettings> {
  return executeAPIRequest<AISettings>(() => getAxios()?.get<APIResponse<AISettings>>(settingsUrl(workspaceId)));
}

export async function updateAISettings(workspaceId: string, payload: UpdateAISettingsPayload): Promise<AISettings> {
  return executeAPIRequest<AISettings>(() =>
    getAxios()?.put<APIResponse<AISettings>>(settingsUrl(workspaceId), payload)
  );
}

export async function deleteAISettings(workspaceId: string): Promise<void> {
  return executeAPIVoidRequest(() => getAxios()?.delete<APIResponse>(settingsUrl(workspaceId)));
}

export async function testAIKey(workspaceId: string, payload: TestAIKeyPayload): Promise<TestAIKeyResult> {
  return executeAPIRequest<TestAIKeyResult>(() =>
    getAxios()?.post<APIResponse<TestAIKeyResult>>(`${settingsUrl(workspaceId)}/test`, payload)
  );
}

export async function listAIProviderModels(workspaceId: string): Promise<AIProviderModel[]> {
  const data = await executeAPIRequest<{ models: AIProviderModel[] }>(() =>
    getAxios()?.get<APIResponse<{ models: AIProviderModel[] }>>(`${settingsUrl(workspaceId)}/models`)
  );

  return data.models;
}

/** Lists models with a key typed into the panel (or the stored one when omitted), before anything is saved. */
export async function listAIProviderModelsWithKey(workspaceId: string, payload: TestAIKeyPayload): Promise<AIProviderModel[]> {
  const data = await executeAPIRequest<{ models: AIProviderModel[] }>(() =>
    getAxios()?.post<APIResponse<{ models: AIProviderModel[] }>>(`${settingsUrl(workspaceId)}/models`, payload)
  );

  return data.models;
}
