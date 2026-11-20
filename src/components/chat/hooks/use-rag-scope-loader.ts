import { useCallback, useEffect, useRef, useState } from 'react';

import { ERROR_CODE } from '@/application/constants';
import {
  areSameRagIds,
  areSameRagSourceOwners,
  collectScopedRagIds,
  getRagSourceOwners,
  isSpaceView,
  RAG_SOURCE_OWNERS_METADATA_KEY,
  resolveScopedRagState,
  ScopedRagState,
} from '@/components/ai-chat/rag-scope';
import { findAncestors } from '@/components/chat/lib/views';
import { ChatRequest } from '@/components/chat/request/chat-request';
import { CardChatScope, ChatSettings, View, ViewLayout } from '@/components/chat/types';

export type RagScopeStatus = 'loading' | 'ready' | 'error';

export interface RagScopeLoadState {
  status: RagScopeStatus;
  parentView: View | null;
  scopedSettings: ScopedRagState | null;
  error?: unknown;
}

interface ReadinessBarrier {
  promise: Promise<boolean>;
  resolve: (ready: boolean) => void;
  isSettled: () => boolean;
}

function createReadinessBarrier(): ReadinessBarrier {
  let settled = false;
  let resolvePromise: (ready: boolean) => void = () => undefined;
  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    isSettled: () => settled,
    resolve: (ready) => {
      if (settled) return;
      settled = true;
      resolvePromise(ready);
    },
  };
}

function isMissingViewError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const value = error as {
    code?: unknown;
    response?: { status?: unknown };
  };

  return value.code === ERROR_CODE.RECORD_NOT_FOUND || value.code === 404 || value.response?.status === 404;
}

async function findKnownOutsideViewIds(
  requestInstance: ChatRequest,
  parentView: View,
  settings: ChatSettings
): Promise<Set<string>> {
  if (settings.full_workspace) return new Set();

  const preliminary = resolveScopedRagState([parentView], settings);
  const sourceOwners = getRagSourceOwners(settings.metadata);
  const opaqueIds = preliminary.preservedRagIds.filter((id) => !sourceOwners[id]);

  if (opaqueIds.length === 0) return new Set();

  const selectableIds = new Set(collectScopedRagIds([parentView]));
  const knownOutsideIds = new Set<string>();

  await Promise.all(
    opaqueIds.map(async (id) => {
      try {
        const navigation = await requestInstance.getViewNavigation(id);
        const path = findAncestors([navigation], id);

        if (!path) throw new Error('Unable to resolve a saved RAG source');

        const parentIndex = path.findIndex((view) => view.view_id === parentView.view_id);
        const target = path[path.length - 1];
        const isSelectablePath =
          parentIndex >= 0 &&
          !isSpaceView(target) &&
          path.slice(parentIndex).every((view) => view.layout === ViewLayout.Document);

        if (isSelectablePath) {
          // A complete parent subtree must contain every selectable descendant.
          // If navigation finds one that is missing, fail closed instead of
          // treating the incomplete response as authoritative.
          if (!selectableIds.has(id)) {
            throw new Error('The AI chat scope is incomplete');
          }

          return;
        }

        knownOutsideIds.add(id);
      } catch (error) {
        // A record-not-found response means this is an opaque source such as a
        // database row or file. Preserve legacy opaque sources; other failures
        // make scope validation unavailable and must remain fail-closed.
        if (!isMissingViewError(error)) throw error;
      }
    })
  );

  return knownOutsideIds;
}

function buildScopedSettingsUpdate(settings: ChatSettings, scoped: ScopedRagState): Partial<ChatSettings> | null {
  const currentOwners = getRagSourceOwners(settings.metadata);
  const ragIdsChanged = !areSameRagIds(settings.rag_ids || [], scoped.ragIds);
  const ownersChanged = !areSameRagSourceOwners(currentOwners, scoped.sourceOwners);

  if (!settings.full_workspace && !ragIdsChanged && !ownersChanged) return null;

  return {
    full_workspace: false,
    rag_ids: scoped.ragIds,
    ...(ownersChanged
      ? {
          metadata: {
            [RAG_SOURCE_OWNERS_METADATA_KEY]: scoped.sourceOwners,
          },
        }
      : {}),
  };
}

/** A card chat has no page behind it: it is ready once its settings carry the card scope marker. */
async function prepareCardChat(
  scope: CardChatScope,
  fetchChatSettings: () => Promise<ChatSettings | undefined>,
  persistChatSettings: (payload: Partial<ChatSettings>) => Promise<void>
): Promise<void> {
  const settings = await fetchChatSettings();
  const metadata = settings?.metadata ?? {};
  const marked = metadata.scope === 'card' && metadata.row_id === scope.rowId && metadata.database_id === scope.databaseId;

  if (settings && marked) return;

  await persistChatSettings({ metadata: { scope: 'card', database_id: scope.databaseId, row_id: scope.rowId } });
  if (!settings && !(await fetchChatSettings())) throw new Error('Unable to load AI chat settings');
}

export function useRagScopeLoader({
  chatId,
  scope,
  requestInstance,
  fetchChatSettings,
  persistChatSettings,
}: {
  chatId: string;
  scope?: CardChatScope;
  requestInstance: ChatRequest;
  fetchChatSettings: () => Promise<ChatSettings | undefined>;
  persistChatSettings: (payload: Partial<ChatSettings>) => Promise<void>;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RagScopeLoadState>({
    status: 'loading',
    parentView: null,
    scopedSettings: null,
  });
  const [initialBarrier] = useState(createReadinessBarrier);
  const cardScopeRef = useRef(scope);
  const scopeKey = scope ? `${scope.databaseId}:${scope.rowId}` : '';

  cardScopeRef.current = scope;
  const attemptRef = useRef(0);
  const barrierRef = useRef({ attempt: 0, barrier: initialBarrier });

  useEffect(() => {
    let active = true;
    let barrierEntry = barrierRef.current;

    // A refresh installs its barrier synchronously so submissions cannot see
    // the previous ready result before this passive effect runs. Strict Mode's
    // second setup replaces the barrier rejected by its cleanup replay.
    if (barrierEntry.attempt !== attempt || barrierEntry.barrier.isSettled()) {
      barrierEntry = { attempt, barrier: createReadinessBarrier() };
      barrierRef.current = barrierEntry;
    }

    const { barrier } = barrierEntry;

    setState({ status: 'loading', parentView: null, scopedSettings: null });

    void (async () => {
      try {
        if (scopeKey) {
          await prepareCardChat(cardScopeRef.current as CardChatScope, fetchChatSettings, persistChatSettings);
          if (!active) return;

          setState({ status: 'ready', parentView: null, scopedSettings: null });
          barrier.resolve(true);
          return;
        }

        const [settings, parentView] = await Promise.all([
          fetchChatSettings(),
          requestInstance.fetchCurrentChatParentScope(attempt > 0),
        ]);

        if (!settings) throw new Error('Unable to load AI chat settings');

        const knownOutsideViewIds = await findKnownOutsideViewIds(requestInstance, parentView, settings);
        const scopedSettings = resolveScopedRagState([parentView], settings, knownOutsideViewIds);
        const update = buildScopedSettingsUpdate(settings, scopedSettings);

        if (!active) return;
        if (update) await persistChatSettings(update);
        if (!active) return;

        setState({ status: 'ready', parentView, scopedSettings });
        barrier.resolve(true);
      } catch (error) {
        if (!active) return;

        setState({ status: 'error', parentView: null, scopedSettings: null, error });
        barrier.resolve(false);
      }
    })();

    return () => {
      active = false;
      barrier.resolve(false);
    };
  }, [attempt, chatId, scopeKey, fetchChatSettings, persistChatSettings, requestInstance]);

  const waitUntilReady = useCallback(() => barrierRef.current.barrier.promise, []);
  const refresh = useCallback(() => {
    const nextAttempt = attemptRef.current + 1;

    attemptRef.current = nextAttempt;
    barrierRef.current.barrier.resolve(false);
    barrierRef.current = { attempt: nextAttempt, barrier: createReadinessBarrier() };
    setState({ status: 'loading', parentView: null, scopedSettings: null });
    setAttempt(nextAttempt);
  }, []);

  return { state, waitUntilReady, refresh };
}
