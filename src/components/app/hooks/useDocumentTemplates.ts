import { useEffect, useState } from 'react';

import { DocumentTemplateSummary, listDocumentTemplates } from '@/application/services/js-services/http/document-template-api';

let cachedTemplates: Promise<DocumentTemplateSummary[]> | null = null;

/** Loads the server's document template catalog once per session; an empty list on any failure. */
export function useDocumentTemplates(enabled = true): DocumentTemplateSummary[] {
  const [templates, setTemplates] = useState<DocumentTemplateSummary[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    cachedTemplates ??= listDocumentTemplates().catch(() => {
      cachedTemplates = null;
      return [];
    });
    void cachedTemplates.then((loaded) => {
      if (!cancelled) setTemplates(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return templates;
}
