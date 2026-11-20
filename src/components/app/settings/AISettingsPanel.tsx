import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { AISettingsService } from '@/application/services/domains';
import type { AIProvider, AIProviderModel, AISettings } from '@/application/services/domains/ai-settings';
import { ConfirmModal } from '@/components/_shared/modal/ConfirmModal';
import { ModelCombobox } from '@/components/app/settings/ai/ModelCombobox';
import { ModelMultiSelect } from '@/components/app/settings/ai/ModelMultiSelect';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/errors';

const PROVIDERS: { id: AIProvider; label: string; helpKey: string; helpDefault: string }[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    helpKey: 'settings.aiProvider.helpOpenRouter',
    helpDefault: 'One key for hundreds of models. Create it on the Keys page of your OpenRouter account.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    helpKey: 'settings.aiProvider.helpOpenAI',
    helpDefault: 'Create an API key in the API keys section of your OpenAI platform account.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    helpKey: 'settings.aiProvider.helpAnthropic',
    helpDefault: 'Create an API key in the Console of your Anthropic account.',
  },
];

/** Prefer the server's own explanation (e.g. "Invalid API key") over the client's generic mapping. */
function readableError(error: unknown, fallback: string): string {
  const diagnostic = typeof error === 'object' && error !== null ? (error as { diagnosticMessage?: unknown }).diagnosticMessage : undefined;

  if (typeof diagnostic === 'string' && diagnostic.trim() && diagnostic !== 'Request failed') return diagnostic;
  return getErrorMessage(error, fallback);
}

const EMPTY_SETTINGS: AISettings = { provider: null, has_key: false, key_hint: null, model: null, enabled_models: [] };

type ModelsState = { status: 'idle' | 'loading' | 'ready' | 'error'; models: AIProviderModel[]; error?: string };
type TestState = { status: 'idle' | 'testing' | 'ok' | 'error'; message?: string };

export function AISettingsPanel({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  // Loaders must not re-run just because the translate function changed identity.
  const tRef = useRef(t);

  tRef.current = t;
  const [saved, setSaved] = useState<AISettings | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [model, setModel] = useState('');
  const [enabledModels, setEnabledModels] = useState<string[]>([]);
  const [models, setModels] = useState<ModelsState>({ status: 'idle', models: [] });
  const [test, setTest] = useState<TestState>({ status: 'idle' });
  // True once the models were listed with the key typed into the panel (before it is saved).
  const [typedModelsReady, setTypedModelsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Keep popovers inside the MUI dialog's focus trap and stacking context.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  const applySettings = useCallback((settings: AISettings) => {
    setSaved(settings);
    setProvider(settings.provider);
    setModel(settings.model ?? '');
    setEnabledModels(settings.enabled_models ?? []);
    setApiKey('');
    setReplacing(false);
    setTypedModelsReady(false);
  }, []);

  const loadSettings = useCallback(async () => {
    setLoadError(undefined);
    try {
      applySettings(await AISettingsService.get(workspaceId));
    } catch (error) {
      setLoadError(getErrorMessage(error, tRef.current('settings.aiProvider.loadFailed', { defaultValue: 'Could not load AI settings' })));
    }
  }, [applySettings, workspaceId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const loadModels = useCallback(async (typed?: { provider: AIProvider; apiKey: string }) => {
    setModels((current) => ({ ...current, status: 'loading', error: undefined }));
    try {
      const list = typed
        ? await AISettingsService.listModelsWithKey(workspaceId, { provider: typed.provider, api_key: typed.apiKey })
        : await AISettingsService.listModels(workspaceId);

      setModels({ status: 'ready', models: list });
      if (typed) setTypedModelsReady(true);
    } catch (error) {
      setModels({
        status: 'error',
        models: [],
        error: readableError(error, tRef.current('settings.aiProvider.modelsFailed', { defaultValue: 'Could not load models' })),
      });
    }
  }, [workspaceId]);

  const savedProvider = saved?.provider ?? null;
  const hasStoredKey = Boolean(saved?.has_key);

  useEffect(() => {
    if (hasStoredKey && savedProvider) void loadModels();
    else setModels({ status: 'idle', models: [] });
  }, [hasStoredKey, savedProvider, loadModels]);

  if (loadError) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3 px-8' data-testid='ai-settings-error'>
        <p className='text-sm text-text-secondary'>{loadError}</p>
        <Button variant='outline' onClick={() => void loadSettings()}>
          {t('button.retry', { defaultValue: 'Retry' })}
        </Button>
      </div>
    );
  }

  if (!saved) {
    return (
      <div role='status' className='flex h-full items-center justify-center'>
        <Progress variant='primary' />
      </div>
    );
  }

  const providerChanged = provider !== savedProvider;
  const needsKey = !hasStoredKey || providerChanged || replacing;
  const keyReady = !needsKey || apiKey.trim().length > 0;
  const canTest = Boolean(provider) && keyReady && test.status !== 'testing';
  const canSave = Boolean(provider) && keyReady && !saving;
  // Models are listed with the stored key (saved provider), or with the typed key once it has been tested.
  const modelsAvailable = (hasStoredKey && !providerChanged && !replacing) || typedModelsReady;

  const handleProviderChange = (next: AIProvider) => {
    setProvider(next);
    setTest({ status: 'idle' });
    setTypedModelsReady(false);
    if (next !== savedProvider) setModels({ status: 'idle', models: [] });
    else if (hasStoredKey) void loadModels();
    if (next !== savedProvider) {
      setModel('');
      setEnabledModels([]);
    } else {
      setModel(saved.model ?? '');
      setEnabledModels(saved.enabled_models ?? []);
    }
  };

  const handleTest = async () => {
    if (!provider) return;
    setTest({ status: 'testing' });
    try {
      const typedKey = needsKey ? apiKey.trim() : '';
      const result = await AISettingsService.testKey(workspaceId, needsKey ? { provider, api_key: typedKey } : { provider });

      setTest({
        status: 'ok',
        message: t('settings.aiProvider.testOk', {
          defaultValue: 'Key works. {{count}} models available.',
          count: result.model_count,
        }),
      });
      // The key works, so fill the model pickers now instead of making the user save first.
      if (needsKey) void loadModels({ provider, apiKey: typedKey });
    } catch (error) {
      setTest({ status: 'error', message: readableError(error, t('settings.aiProvider.testFailed', { defaultValue: 'The key was rejected' })) });
    }
  };

  const handleSave = async () => {
    if (!provider) return;
    setSaving(true);
    try {
      const result = await AISettingsService.update(workspaceId, {
        provider,
        ...(needsKey ? { api_key: apiKey.trim() } : {}),
        ...(model ? { model } : {}),
        enabled_models: enabledModels,
      });

      applySettings(result);
      setTest({ status: 'idle' });
      toast.success(t('settings.aiProvider.saved', { defaultValue: 'AI settings saved' }));
    } catch (error) {
      toast.error(readableError(error, t('settings.aiProvider.saveFailed', { defaultValue: 'Could not save AI settings' })));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await AISettingsService.remove(workspaceId);
      applySettings(EMPTY_SETTINGS);
      setTest({ status: 'idle' });
      setConfirmRemove(false);
      toast.success(t('settings.aiProvider.removed', { defaultValue: 'AI key removed' }));
    } catch (error) {
      toast.error(getErrorMessage(error, t('settings.aiProvider.removeFailed', { defaultValue: 'Could not remove the key' })));
    } finally {
      setRemoving(false);
    }
  };

  const activeProvider = PROVIDERS.find((item) => item.id === provider);

  return (
    <div className='flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden' data-testid='ai-settings-panel' ref={setContainer}>
      <div className='border-b border-border-primary px-8 py-5'>
        <h2 className='text-xl font-semibold text-text-primary'>
          {t('settings.aiProvider.menuLabel', { defaultValue: 'AI' })}
        </h2>
        <p className='mt-1 text-sm text-text-secondary'>
          {t('settings.aiProvider.description', {
            defaultValue:
              "Use your own API key to power AI in this workspace: editor 'Ask AI', AI chat and AI database fields. The key is stored encrypted on your server and is never shown again.",
          })}
        </p>
      </div>
      <div className='appflowy-scroller flex-1 overflow-y-auto px-8 py-6'>
        {!hasStoredKey && (
          <div
            data-testid='ai-unconfigured'
            className='mb-6 rounded-300 border border-border-primary bg-fill-content-hover px-4 py-3 text-sm text-text-secondary'
          >
            {t('settings.aiProvider.unconfigured', {
              defaultValue: 'AI is not set up yet. Choose a provider and add an API key to turn it on for everyone in this workspace.',
            })}
          </div>
        )}

        <section className='flex flex-col gap-2'>
          <h3 className='text-sm font-medium text-text-primary'>{t('settings.aiProvider.provider', { defaultValue: 'Provider' })}</h3>
          <div className='flex flex-wrap gap-2' role='radiogroup' aria-label='Provider'>
            {PROVIDERS.map((item) => (
              <button
                key={item.id}
                type='button'
                role='radio'
                aria-checked={provider === item.id}
                data-testid={`ai-provider-${item.id}`}
                onClick={() => handleProviderChange(item.id)}
                className={cn(
                  'rounded-300 border px-3 py-1.5 text-sm text-text-primary hover:bg-fill-content-hover',
                  provider === item.id ? 'border-fill-theme-thick bg-fill-content-hover' : 'border-border-primary'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {activeProvider && <p className='text-xs text-text-tertiary'>{t(activeProvider.helpKey, { defaultValue: activeProvider.helpDefault })}</p>}
        </section>

        <section className='mt-6 flex flex-col gap-2'>
          <h3 className='text-sm font-medium text-text-primary'>{t('settings.aiProvider.apiKey', { defaultValue: 'API key' })}</h3>
          {hasStoredKey && !needsKey ? (
            <div className='flex items-center justify-between gap-3 rounded-300 border border-border-primary px-3 py-2'>
              <span className='text-sm text-text-primary' data-testid='ai-key-hint'>
                {t('settings.aiProvider.keySaved', { defaultValue: 'Key saved {{hint}}', hint: saved.key_hint ?? '' })}
              </span>
              <Button variant='outline' size='sm' data-testid='ai-replace-key' onClick={() => setReplacing(true)}>
                {t('settings.aiProvider.replaceKey', { defaultValue: 'Replace key' })}
              </Button>
            </div>
          ) : (
            <div className='flex flex-col gap-1'>
              <PasswordInput
                value={apiKey}
                placeholder={t('settings.aiProvider.keyPlaceholder', { defaultValue: 'Paste your API key' })}
                inputProps={{
                  'aria-label': 'API key',
                  autoComplete: 'new-password',
                  onChange: (event) => {
                    setApiKey(event.target.value);
                    setTest({ status: 'idle' });
                    setTypedModelsReady(false);
                  },
                }}
                data-testid='ai-key-input'
              />
              {hasStoredKey && providerChanged && (
                <p className='text-xs text-text-tertiary' data-testid='ai-key-required-hint'>
                  {t('settings.aiProvider.newKeyRequired', { defaultValue: 'Changing the provider needs a new key.' })}
                </p>
              )}
              {replacing && (
                <button type='button' className='self-start text-xs text-text-action hover:text-text-action-hover' onClick={() => { setReplacing(false); setApiKey(''); }}>
                  {t('button.cancel', { defaultValue: 'Cancel' })}
                </button>
              )}
            </div>
          )}
          <div className='flex flex-wrap items-center gap-3'>
            <Button variant='outline' size='sm' disabled={!canTest} loading={test.status === 'testing'} data-testid='ai-test-key' onClick={() => void handleTest()}>
              {t('settings.aiProvider.testKey', { defaultValue: 'Test key' })}
            </Button>
            {test.status === 'ok' && <span className='text-sm text-text-success' data-testid='ai-test-result'>{test.message}</span>}
            {test.status === 'error' && <span className='text-sm text-text-error' data-testid='ai-test-result'>{test.message}</span>}
          </div>
        </section>

        <section className='mt-6 flex flex-col gap-2'>
          <h3 className='text-sm font-medium text-text-primary'>{t('settings.aiProvider.defaultModel', { defaultValue: 'Default model' })}</h3>
          <ModelCombobox models={models.models} value={model} onChange={setModel} loading={models.status === 'loading'} container={container} />
          {!modelsAvailable && (
            <p className='text-xs text-text-tertiary'>
              {t('settings.aiProvider.saveToLoadModels', { defaultValue: 'Test your key to load the provider\'s model list. You can also type a model id.' })}
            </p>
          )}
          {models.status === 'error' && modelsAvailable && (
            <p className='text-xs text-text-error' data-testid='ai-models-error'>
              {models.error}{' '}
              <button type='button' className='text-text-action hover:text-text-action-hover' onClick={() => void loadModels()}>
                {t('button.retry', { defaultValue: 'Retry' })}
              </button>
            </p>
          )}
          <p className='text-xs text-text-tertiary'>
            {t('settings.aiProvider.defaultModelHelp', { defaultValue: "Used when a feature is set to 'Auto', and for AI database fields and search summaries." })}
          </p>
        </section>

        <section className='mt-6 flex flex-col gap-2'>
          <h3 className='text-sm font-medium text-text-primary'>{t('settings.aiProvider.pickerModels', { defaultValue: 'Models shown in pickers' })}</h3>
          <ModelMultiSelect models={models.models} value={enabledModels} onChange={setEnabledModels} loading={models.status === 'loading'} container={container} />
        </section>

        <div className='mt-8 flex items-center justify-between gap-3 border-t border-border-primary pt-5'>
          <Button disabled={!canSave} loading={saving} data-testid='ai-save' onClick={() => void handleSave()}>
            {t('button.save', { defaultValue: 'Save' })}
          </Button>
          {hasStoredKey && (
            <Button variant='destructive-outline' data-testid='ai-remove-key' onClick={() => setConfirmRemove(true)}>
              {t('settings.aiProvider.removeKey', { defaultValue: 'Remove key' })}
            </Button>
          )}
        </div>
      </div>
      <ConfirmModal
        open={confirmRemove}
        loading={removing}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => void handleRemove()}
        title={t('settings.aiProvider.removeTitle', { defaultValue: 'Remove the AI key?' })}
        description={t('settings.aiProvider.removeDescription', {
          defaultValue: 'AI features stop working for everyone in this workspace until a new key is added.',
        })}
        confirmText={t('settings.aiProvider.removeKey', { defaultValue: 'Remove key' })}
        confirmTestId='ai-remove-confirm'
      />
    </div>
  );
}

export default AISettingsPanel;
