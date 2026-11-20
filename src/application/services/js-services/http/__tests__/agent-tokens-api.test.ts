import { createAgentToken, listAgentTokens, revokeAgentToken } from '../agent-tokens-api';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();

jest.mock('../core', () => ({
  getAxios: () => ({
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  }),
  executeAPIRequest: async (request: () => Promise<{ data: { data: unknown } }>) => {
    const response = await request();

    return response.data.data;
  },
}));

describe('agent-tokens-api', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists the tokens of one workspace and unwraps them', async () => {
    const tokens = [{ id: 't1', name: 'Laptop', scope: 'read', created_at: 'x', last_used_at: null, expires_at: null, revoked: false, expired: false }];

    mockGet.mockResolvedValue({ data: { data: { tokens } } });
    await expect(listAgentTokens('ws-1')).resolves.toEqual(tokens);
    expect(mockGet).toHaveBeenCalledWith('/api/workspace/ws-1/agent-tokens');
  });

  it('creates a token with exactly the submitted fields', async () => {
    const created = { id: 't1', name: 'Laptop', scope: 'write', token: 'afmcp_t1_secret', created_at: 'x', expires_at: null };

    mockPost.mockResolvedValue({ data: { data: created } });
    await expect(createAgentToken('ws-1', { name: 'Laptop', scope: 'write', expires_in_days: 30 })).resolves.toEqual(created);
    expect(mockPost).toHaveBeenCalledWith('/api/workspace/ws-1/agent-tokens', { name: 'Laptop', scope: 'write', expires_in_days: 30 });
  });

  it('sends a null expiry for a token that never expires', async () => {
    mockPost.mockResolvedValue({ data: { data: {} } });
    await createAgentToken('ws-1', { name: 'n', scope: 'read', expires_in_days: null });
    expect(mockPost.mock.calls[0][1]).toEqual({ name: 'n', scope: 'read', expires_in_days: null });
  });

  it('revokes one token by id', async () => {
    mockDelete.mockResolvedValue({ data: { data: { id: 't1', revoked: true } } });
    await expect(revokeAgentToken('ws-1', 't1')).resolves.toEqual({ id: 't1', revoked: true });
    expect(mockDelete).toHaveBeenCalledWith('/api/workspace/ws-1/agent-tokens/t1');
  });
});
