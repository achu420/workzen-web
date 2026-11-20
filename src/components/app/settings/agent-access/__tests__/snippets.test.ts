import { buildMcpUrl, buildSnippets, STDIO_SHIM_PATH, TOKEN_ENV_NAME } from '../snippets';

const URL = 'http://localhost:8787/mcp';
const TOKEN = 'afmcp_tok1_abcdef';

describe('buildMcpUrl', () => {
  it('appends /mcp to the configured base URL and ignores trailing slashes', () => {
    expect(buildMcpUrl('http://localhost:8787')).toBe(URL);
    expect(buildMcpUrl('http://localhost:8787///')).toBe(URL);
    expect(buildMcpUrl('https://example.com/')).toBe('https://example.com/mcp');
  });
});

describe('buildSnippets', () => {
  const snippets = buildSnippets(URL, TOKEN);
  const find = (client: keyof typeof snippets, id: string) => snippets[client].find((snippet) => snippet.id === id)!;

  it('gives Claude Code the claude mcp add command with the real URL and token', () => {
    expect(find('claude-code', 'cli').code).toBe(
      `claude mcp add --transport http workzen ${URL} --header "Authorization: Bearer ${TOKEN}"`
    );
  });

  it('keeps the token out of the .mcp.json form and reads it from an environment variable', () => {
    const config = JSON.parse(find('claude-code', 'mcp-json').code);

    expect(config.mcpServers.workzen).toEqual({
      type: 'http',
      url: URL,
      headers: { Authorization: `Bearer \${${TOKEN_ENV_NAME}}` },
    });
    expect(find('claude-code', 'mcp-json').code).not.toContain(TOKEN);
    expect(find('claude-code', 'export').code).toBe(`export ${TOKEN_ENV_NAME}=${TOKEN}`);
  });

  it('gives Cursor url + headers with the ${env:NAME} expansion and the export line', () => {
    const config = JSON.parse(find('cursor', 'mcp-json').code);

    expect(config.mcpServers.workzen.url).toBe(URL);
    expect(config.mcpServers.workzen.headers.Authorization).toBe(`Bearer \${env:${TOKEN_ENV_NAME}}`);
    expect(find('cursor', 'mcp-json').code).not.toContain(TOKEN);
    expect(find('cursor', 'export').code).toContain(TOKEN);
  });

  it('gives Claude Desktop a stdio entry that runs the shim with MCP_URL and MCP_TOKEN', () => {
    const config = JSON.parse(find('claude-desktop', 'config').code);

    expect(config.mcpServers.workzen).toEqual({
      command: 'node',
      args: [STDIO_SHIM_PATH],
      env: { MCP_URL: URL, MCP_TOKEN: TOKEN },
    });
    expect(STDIO_SHIM_PATH).toContain('mcp-stdio-shim.mjs');
  });

  it('produces valid JSON for every json snippet', () => {
    for (const list of Object.values(snippets)) {
      for (const snippet of list.filter((item) => item.language === 'json')) {
        expect(() => JSON.parse(snippet.code)).not.toThrow();
      }
    }
  });
});
