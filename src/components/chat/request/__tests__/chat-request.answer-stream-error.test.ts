import { ChatRequest } from '../chat-request';

jest.mock('@/components/chat/lib/requets', () => ({
  createInitialInstance: () => ({ defaults: { baseURL: 'https://cloud.example' }, interceptors: { request: { use: jest.fn() } } }),
  getAccessToken: () => 'test-token',
  requestInterceptor: jest.fn(),
}));

describe('ChatRequest.fetchAnswerStream failures', () => {
  const originalFetch = global.fetch;
  const payload = { question_id: 1, format: { output_layout: 1, output_content: 0 } } as never;

  afterEach(() => { global.fetch = originalFetch; });

  const request = () => new ChatRequest('workspace', 'chat', { defaults: { baseURL: 'https://cloud.example' } } as never);

  it('surfaces the server message (for example a missing AI key) instead of a bare HTTP status', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ code: 400, message: 'AI is not configured. Ask a workspace owner to add an API key in Settings > AI.' }),
    })) as unknown as typeof fetch;

    await expect(request().fetchAnswerStream(payload, jest.fn())).rejects.toMatchObject({
      message: 'AI is not configured. Ask a workspace owner to add an API key in Settings > AI.',
      status: 400,
    });
  });

  it('falls back to the HTTP status when the error body is not JSON', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new Error('not json'); },
    })) as unknown as typeof fetch;

    await expect(request().fetchAnswerStream(payload, jest.fn())).rejects.toMatchObject({
      message: 'HTTP error! status: 502',
      status: 502,
    });
  });
});
