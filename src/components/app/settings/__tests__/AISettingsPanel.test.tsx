import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AISettingsService } from '@/application/services/domains';

import { AISettingsPanel } from '../AISettingsPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options?.[name] ?? '')),
  }),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock('@/application/services/domains', () => ({
  AISettingsService: { get: jest.fn(), update: jest.fn(), remove: jest.fn(), testKey: jest.fn(), listModels: jest.fn(), listModelsWithKey: jest.fn() },
}));

const api = jest.mocked(AISettingsService);
const configured = { provider: 'openrouter', has_key: true, key_hint: '...abcd', model: 'openai/gpt-4o', enabled_models: [] } as const;
const models = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', context_length: 128000, supports_vision: true },
  { id: 'anthropic/claude-sonnet', name: 'Claude Sonnet', context_length: 200000 },
];

async function renderPanel() {
  const view = render(<AISettingsPanel workspaceId='ws-1' />);

  await screen.findByTestId('ai-settings-panel');
  return view;
}

describe('AISettingsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ ...configured, enabled_models: [] });
    api.listModels.mockResolvedValue(models);
    api.listModelsWithKey.mockResolvedValue(models);
    api.update.mockImplementation(async (_ws, payload) => ({
      provider: payload.provider,
      has_key: true,
      key_hint: '...wxyz',
      model: payload.model ?? null,
      enabled_models: payload.enabled_models ?? [],
    }));
  });

  it('explains the empty state and asks for a key when nothing is configured', async () => {
    api.get.mockResolvedValue({ provider: null, has_key: false, key_hint: null, model: null, enabled_models: [] });
    await renderPanel();

    expect(screen.getByTestId('ai-unconfigured')).toBeTruthy();
    expect(screen.getByTestId('ai-key-input')).toBeTruthy();
    expect(api.listModels).not.toHaveBeenCalled();
    expect((screen.getByTestId('ai-save')).disabled).toBe(true);
    expect(screen.queryByTestId('ai-remove-key')).toBeNull();
  });

  it('shows only the masked hint for a stored key and never an input value', async () => {
    await renderPanel();

    expect(screen.getByTestId('ai-key-hint').textContent).toContain('...abcd');
    expect(screen.queryByTestId('ai-key-input')).toBeNull();
    await waitFor(() => expect(api.listModels).toHaveBeenCalledWith('ws-1'));
  });

  it('omits the key from the save request when it is not being replaced', async () => {
    await renderPanel();

    fireEvent.click(screen.getByTestId('ai-save'));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    const payload = api.update.mock.calls[0][1];

    expect(payload).toEqual({ provider: 'openrouter', model: 'openai/gpt-4o', enabled_models: [] });
    expect(payload).not.toHaveProperty('api_key');
  });

  it('sends the new key after Replace key and clears the field afterwards', async () => {
    await renderPanel();

    fireEvent.click(screen.getByTestId('ai-replace-key'));
    const input = screen.getByLabelText('API key');

    expect((screen.getByTestId('ai-save')).disabled).toBe(true);
    fireEvent.change(input, { target: { value: '  sk-new  ' } });
    fireEvent.click(screen.getByTestId('ai-save'));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0][1]).toMatchObject({ provider: 'openrouter', api_key: 'sk-new' });
    await waitFor(() => expect(screen.getByTestId('ai-key-hint').textContent).toContain('...wxyz'));
  });

  it('requires a new key when the provider changes and drops the old provider models', async () => {
    await renderPanel();

    fireEvent.click(screen.getByTestId('ai-provider-openai'));
    expect(screen.getByTestId('ai-key-required-hint')).toBeTruthy();
    expect((screen.getByTestId('ai-save')).disabled).toBe(true);
    expect((screen.getByTestId('ai-test-key')).disabled).toBe(true);
    expect(screen.getByTestId('ai-model-trigger').textContent).not.toContain('openai/gpt-4o');

    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-openai' } });
    fireEvent.click(screen.getByTestId('ai-save'));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0][1]).toMatchObject({ provider: 'openai', api_key: 'sk-openai' });
  });

  it('tests the stored key without sending it, and shows the failure message inline', async () => {
    api.testKey.mockRejectedValueOnce({ code: 400, message: 'Request failed', diagnosticMessage: 'Invalid API key' });
    await renderPanel();

    fireEvent.click(screen.getByTestId('ai-test-key'));
    await waitFor(() => expect(screen.getByTestId('ai-test-result').textContent).toContain('Invalid API key'));
    expect(api.testKey).toHaveBeenCalledWith('ws-1', { provider: 'openrouter' });

    api.testKey.mockResolvedValueOnce({ ok: true, model_count: 3 });
    fireEvent.click(screen.getByTestId('ai-test-key'));
    await waitFor(() => expect(screen.getByTestId('ai-test-result').textContent).toContain('3'));
  });

  it('loads the model list with the typed key right after a successful test, before saving', async () => {
    api.get.mockResolvedValue({ provider: null, has_key: false, key_hint: null, model: null, enabled_models: [] });
    api.testKey.mockResolvedValue({ ok: true, model_count: 3 });
    await renderPanel();

    fireEvent.click(screen.getByTestId('ai-provider-openrouter'));
    fireEvent.change(screen.getByTestId('ai-key-input').querySelector('input') ?? screen.getByTestId('ai-key-input'), { target: { value: 'sk-or-typed' } });
    expect(api.listModelsWithKey).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('ai-test-key'));
    await waitFor(() => expect(api.listModelsWithKey).toHaveBeenCalledWith('ws-1', { provider: 'openrouter', api_key: 'sk-or-typed' }));
    expect(api.listModels).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('lets a model id be typed when it is not in the provider list', async () => {
    await renderPanel();
    await waitFor(() => expect(api.listModels).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('ai-model-trigger'));
    fireEvent.change(await screen.findByTestId('ai-model-search'), { target: { value: 'my/custom-model' } });
    fireEvent.click(screen.getByTestId('ai-model-use-typed'));
    fireEvent.click(screen.getByTestId('ai-save'));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0][1]).toMatchObject({ model: 'my/custom-model' });
  });

  it('searches the list, shows the vision badge, and picks models for the pickers as chips', async () => {
    await renderPanel();
    await waitFor(() => expect(api.listModels).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('ai-model-trigger'));
    fireEvent.change(await screen.findByTestId('ai-model-search'), { target: { value: 'sonnet' } });
    expect(screen.queryByTestId('ai-model-option-openai/gpt-4o')).toBeNull();
    expect(screen.getByTestId('ai-model-option-anthropic/claude-sonnet')).toBeTruthy();
    fireEvent.change(screen.getByTestId('ai-model-search'), { target: { value: 'gpt' } });
    expect(screen.getByTestId('model-vision-badge')).toBeTruthy();
    fireEvent.keyDown(screen.getByTestId('ai-model-search'), { key: 'Escape' });

    expect(screen.getByTestId('ai-all-models')).toBeTruthy();
    fireEvent.click(screen.getByTestId('ai-enabled-models-add'));
    fireEvent.click(await screen.findByTestId('ai-enabled-option-anthropic/claude-sonnet'));
    expect(screen.getByTestId('ai-model-chip-anthropic/claude-sonnet')).toBeTruthy();
    expect(screen.queryByTestId('ai-all-models')).toBeNull();
    fireEvent.click(screen.getByLabelText('Remove anthropic/claude-sonnet'));
    expect(screen.getByTestId('ai-all-models')).toBeTruthy();
  });

  it('shows a retryable error when the model list cannot be loaded', async () => {
    api.listModels.mockRejectedValueOnce({ code: 502, message: 'Request failed', diagnosticMessage: 'upstream down' });
    await renderPanel();

    expect((await screen.findByTestId('ai-models-error')).textContent).toContain('upstream down');
    api.listModels.mockResolvedValueOnce(models);
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(screen.queryByTestId('ai-models-error')).toBeNull());
  });

  it('removes the key only after confirmation', async () => {
    api.remove.mockResolvedValue(undefined);
    await renderPanel();

    fireEvent.click(screen.getByTestId('ai-remove-key'));
    expect(api.remove).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByTestId('ai-remove-confirm'));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('ws-1'));
    await waitFor(() => expect(screen.getByTestId('ai-unconfigured')).toBeTruthy());
  });
});
