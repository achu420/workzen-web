import {
  deleteAISettings,
  getAISettings,
  listAIProviderModels,
  testAIKey,
  updateAISettings,
} from '../ai-settings-api';

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();

jest.mock('../core', () => ({
  getAxios: () => ({
    get: (...args: unknown[]) => mockGet(...args),
    put: (...args: unknown[]) => mockPut(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  }),
  executeAPIRequest: async (request: () => Promise<{ data: { data: unknown } }>) => {
    const response = await request();

    return response.data.data;
  },
  executeAPIVoidRequest: async (request: () => Promise<unknown>) => {
    await request();
  },
}));

const settings = { provider: 'openrouter', has_key: true, key_hint: '...abcd', model: 'm', enabled_models: ['m'] };

describe('ai-settings-api', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads the settings of one workspace', async () => {
    mockGet.mockResolvedValue({ data: { data: settings } });

    await expect(getAISettings('ws-1')).resolves.toEqual(settings);
    expect(mockGet).toHaveBeenCalledWith('/api/workspace/ws-1/ai-settings');
  });

  it('puts exactly the fields it is given, so an omitted key keeps the stored one', async () => {
    mockPut.mockResolvedValue({ data: { data: settings } });

    await updateAISettings('ws-1', { provider: 'openai', model: 'gpt', enabled_models: [] });
    expect(mockPut).toHaveBeenCalledWith('/api/workspace/ws-1/ai-settings', {
      provider: 'openai',
      model: 'gpt',
      enabled_models: [],
    });
    expect(mockPut.mock.calls[0][1]).not.toHaveProperty('api_key');
  });

  it('sends a new key only when one is provided', async () => {
    mockPut.mockResolvedValue({ data: { data: settings } });

    await updateAISettings('ws-1', { provider: 'anthropic', api_key: 'sk-test' });
    expect(mockPut.mock.calls[0][1]).toEqual({ provider: 'anthropic', api_key: 'sk-test' });
  });

  it('deletes the settings', async () => {
    mockDelete.mockResolvedValue({ data: {} });

    await deleteAISettings('ws-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/workspace/ws-1/ai-settings');
  });

  it('tests a key through the test route', async () => {
    mockPost.mockResolvedValue({ data: { data: { ok: true, model_count: 12 } } });

    await expect(testAIKey('ws-1', { provider: 'openai', api_key: 'sk-test' })).resolves.toEqual({ ok: true, model_count: 12 });
    expect(mockPost).toHaveBeenCalledWith('/api/workspace/ws-1/ai-settings/test', { provider: 'openai', api_key: 'sk-test' });
  });

  it('unwraps the model list', async () => {
    mockGet.mockResolvedValue({ data: { data: { models: [{ id: 'a', name: 'A' }] } } });

    await expect(listAIProviderModels('ws-1')).resolves.toEqual([{ id: 'a', name: 'A' }]);
    expect(mockGet).toHaveBeenCalledWith('/api/workspace/ws-1/ai-settings/models');
  });
});
