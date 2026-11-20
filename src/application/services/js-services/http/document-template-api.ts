import { v4 as uuidv4 } from 'uuid';

import { APIResponse, executeAPIRequest, getAxios } from './core';

export interface DocumentTemplateSummary {
  template_id: string;
  name: string;
  description: string;
  icon: { ty: number; value: string } | null;
  page_count: number;
  /** Set on templates imported from appflowy.com/templates. */
  category?: string | null;
  author?: string | null;
}

export interface CreateDocumentFromTemplateResponse {
  request_id: string;
  outcome: 'applied' | 'already_applied';
  result: {
    view_id: string;
    database_id: null;
    view_ids: string[];
  };
}

export async function listDocumentTemplates(): Promise<DocumentTemplateSummary[]> {
  const data = await executeAPIRequest<{ templates: DocumentTemplateSummary[] }>(() =>
    getAxios()?.get<APIResponse<{ templates: DocumentTemplateSummary[] }>>('/api/template-catalog/document')
  );

  return data.templates;
}

export async function createDocumentFromTemplate(
  workspaceId: string,
  payload: { templateId: string; parentViewId: string; name?: string }
): Promise<CreateDocumentFromTemplateResponse> {
  return executeAPIRequest<CreateDocumentFromTemplateResponse>(() =>
    getAxios()?.post<APIResponse<CreateDocumentFromTemplateResponse>>(
      `/api/workspace/${workspaceId}/v2/page-view/document/from-template`,
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
