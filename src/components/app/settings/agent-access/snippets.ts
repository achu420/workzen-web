export type ClientId = 'claude-code' | 'cursor' | 'claude-desktop';

export interface Snippet {
  id: string;
  label: string;
  language: 'bash' | 'json';
  code: string;
}

export const TOKEN_ENV_NAME = 'APPFLOWY_MCP_TOKEN';
export const STDIO_SHIM_PATH = '/path/to/scripts/mcp-stdio-shim.mjs';

/** The MCP endpoint lives next to the API, so it uses the same configured base URL. */
export function buildMcpUrl(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, '')}/mcp`;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Ready-to-paste configuration for each supported client, generated from the real URL and token. */
export function buildSnippets(url: string, token: string): Record<ClientId, Snippet[]> {
  return {
    'claude-code': [
      {
        id: 'cli',
        label: 'Run once in your terminal',
        language: 'bash',
        code: `claude mcp add --transport http workzen ${url} --header "Authorization: Bearer ${token}"`,
      },
      {
        id: 'mcp-json',
        label: 'Or commit a .mcp.json that reads the token from an environment variable',
        language: 'json',
        code: json({
          mcpServers: {
            workzen: {
              type: 'http',
              url,
              headers: { Authorization: `Bearer \${${TOKEN_ENV_NAME}}` },
            },
          },
        }),
      },
      {
        id: 'export',
        label: 'Environment variable for the .mcp.json form',
        language: 'bash',
        code: `export ${TOKEN_ENV_NAME}=${token}`,
      },
    ],
    cursor: [
      {
        id: 'mcp-json',
        label: 'Add to ~/.cursor/mcp.json (or .cursor/mcp.json in a project)',
        language: 'json',
        code: json({
          mcpServers: {
            workzen: {
              url,
              headers: { Authorization: `Bearer \${env:${TOKEN_ENV_NAME}}` },
            },
          },
        }),
      },
      {
        id: 'export',
        label: 'Environment variable Cursor reads the token from',
        language: 'bash',
        code: `export ${TOKEN_ENV_NAME}=${token}`,
      },
    ],
    'claude-desktop': [
      {
        id: 'config',
        label: 'Add to claude_desktop_config.json (Settings > Developer > Edit Config)',
        language: 'json',
        code: json({
          mcpServers: {
            workzen: {
              command: 'node',
              args: [STDIO_SHIM_PATH],
              env: { MCP_URL: url, MCP_TOKEN: token },
            },
          },
        }),
      },
    ],
  };
}
