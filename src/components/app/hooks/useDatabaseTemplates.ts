import { useEffect, useState } from 'react';

import { DatabaseTemplateSummary, listDatabaseTemplates } from '@/application/services/js-services/http/database-template-api';

let cachedTemplates: Promise<DatabaseTemplateSummary[]> | null = null;

/** Loads the server's database template catalog once per session; an empty list on any failure. */
export function useDatabaseTemplates(enabled = true): DatabaseTemplateSummary[] {
  const [templates, setTemplates] = useState<DatabaseTemplateSummary[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    cachedTemplates ??= listDatabaseTemplates().catch(() => {
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
