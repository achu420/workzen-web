import { v4 as uuidv4 } from 'uuid';

import { APIResponse, executeAPIRequest, getAxios } from './core';

export interface DatabaseTemplateSummary {
  template_id: string;
  name: string;
  description: string;
  icon: { ty: number; value: string } | null;
  primary_layout: number;
  field_count: number;
  row_count: number;
  view_count: number;
  /** Set on templates imported from appflowy.com/templates. */
  category?: string | null;
  author?: string | null;
}

export interface CreateDatabaseFromTemplateResponse {
  request_id: string;
  outcome: 'applied' | 'already_applied';
  result: {
    view_id: string;
    database_id: string;
    view_ids: string[];
    row_ids: string[];
  };
}

export async function listDatabaseTemplates(): Promise<DatabaseTemplateSummary[]> {
  const data = await executeAPIRequest<{ templates: DatabaseTemplateSummary[] }>(() =>
    getAxios()?.get<APIResponse<{ templates: DatabaseTemplateSummary[] }>>('/api/template-catalog/database')
  );

  return data.templates;
}

export async function createDatabaseFromTemplate(
  workspaceId: string,
  payload: { templateId: string; parentViewId: string; name?: string }
): Promise<CreateDatabaseFromTemplateResponse> {
  return executeAPIRequest<CreateDatabaseFromTemplateResponse>(() =>
    getAxios()?.post<APIResponse<CreateDatabaseFromTemplateResponse>>(
      `/api/workspace/${workspaceId}/v2/page-view/database/from-template`,
      {
        schema_version: 'v1',
        request_id: uuidv4(),
        template_id: payload.templateId,
        parent_view_id: payload.parentViewId,
        position: { kind: 'end' },
        ...(payload.name ? { name: payload.name } : {}),
      }
    )
  );
}
