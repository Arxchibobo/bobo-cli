/**
 * MCP Client — connect to external MCP (Model Context Protocol) servers.
 * Supports stdio and HTTP transports.
 *
 * MCP servers provide additional tools that Bobo can use dynamically.
 * Config in ~/.bobo/mcp.json:
 * {
 *   "servers": [
 *     { "name": "my-server", "transport": "stdio", "command": "npx my-mcp-server" },
 *     { "name": "remote", "transport": "http", "url": "http://localhost:3001/mcp" }
 *   ]
 * }
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config.js';
import type { ChatCompletionTool } from 'openai/resources/index.js';

/**
 * Newline-delimited JSON-RPC buffer.
 * Handles TCP chunks that may not align with message boundaries.
 */
class JsonRpcBuffer {
  private buffer = '';

  feed(chunk: string): object[] {
    this.buffer += chunk;
    const messages: object[] = [];
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // keep incomplete line
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        messages.push(JSON.parse(trimmed));
      } catch (_) { /* intentionally ignored: skip non-JSON lines */ }
    }
    return messages;
  }
}

interface McpServerConfig {
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverName: string;
}

interface McpServer {
  config: McpServerConfig;
  process?: ChildProcess;
  tools: McpTool[];
  ready: boolean;
}

const servers: Map<string, McpServer> = new Map();

/**
 * Load MCP server configs from ~/.bobo/mcp.json
 */
function loadMcpConfig(): McpServerConfig[] {
  const configPath = join(getConfigDir(), 'mcp.json');
  if (!existsSync(configPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
    return raw.servers || [];
  } catch (_) {
    /* intentionally ignored: malformed mcp.json config */
    return [];
  }
}

/**
 * Initialize all configured MCP servers.
 */
export async function initMcpServers(): Promise<void> {
  const configs = loadMcpConfig();
  for (const config of configs) {
    if (config.transport === 'stdio' && config.command) {
      await connectStdioServer(config);
    }
    // HTTP transport: tools are fetched on-demand
    if (config.transport === 'http' && config.url) {
      await connectHttpServer(config);
    }
  }
}

/**
 * Connect to a stdio MCP server.
 */
async function connectStdioServer(config: McpServerConfig): Promise<void> {
  const server: McpServer = { config, tools: [], ready: false };

  try {
    const child = spawn(config.command!, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    server.process = child;
    const buffer = new JsonRpcBuffer();

    // Send initialize request
    const initRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'bobo-cli', version: '1.5.0' },
      },
    }) + '\n';

    child.stdin?.write(initRequest);

    // Read init response with timeout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 10000);
      const handler = (chunk: Buffer) => {
        const messages = buffer.feed(chunk.toString());
        for (const msg of messages) {
          if ((msg as { id?: number }).id === 1) {
            clearTimeout(timeout);
            child.stdout?.removeListener('data', handler);
            resolve();
            return;
          }
        }
      };
      child.stdout?.on('data', handler);
      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Request tools list
    const toolsRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }) + '\n';

    child.stdin?.write(toolsRequest);

    const toolsResponse = await new Promise<object>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 10000);
      const handler = (chunk: Buffer) => {
        const messages = buffer.feed(chunk.toString());
        for (const msg of messages) {
          if ((msg as { id?: number }).id === 2) {
            clearTimeout(timeout);
            child.stdout?.removeListener('data', handler);
            resolve(msg);
            return;
          }
        }
      };
      child.stdout?.on('data', handler);
    });

    try {
      const parsed = toolsResponse as { result?: { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> } };
      if (parsed.result?.tools) {
        server.tools = parsed.result.tools.map((t) => ({
          name: t.name,
          description: t.description || '',
          inputSchema: t.inputSchema || { type: 'object', properties: {} },
          serverName: config.name,
        }));
      }
    } catch (_) { /* intentionally ignored: no tools in response */ }

    server.ready = true;
    servers.set(config.name, server);
  } catch (_) {
    /* intentionally ignored: server failed to connect, skip it */
  }
}

/**
 * Connect to an HTTP MCP server.
 */
async function connectHttpServer(config: McpServerConfig): Promise<void> {
  const server: McpServer = { config, tools: [], ready: false };

  try {
    const response = await fetch(config.url!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    });

    const data = await response.json() as { result?: { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> } };
    if (data.result?.tools) {
      server.tools = data.result.tools.map(t => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || { type: 'object', properties: {} },
        serverName: config.name,
      }));
    }

    server.ready = true;
    servers.set(config.name, server);
  } catch (_) {
    /* intentionally ignored: HTTP server unavailable, skip it */
  }
}

/**
 * Get OpenAI-compatible tool definitions from all MCP servers.
 */
export function getMcpToolDefinitions(): ChatCompletionTool[] {
  const tools: ChatCompletionTool[] = [];
  for (const server of servers.values()) {
    if (!server.ready) continue;
    for (const tool of server.tools) {
      tools.push({
        type: 'function',
        function: {
          name: `mcp__${server.config.name}__${tool.name}`,
          description: `[MCP: ${server.config.name}] ${tool.description}`,
          parameters: tool.inputSchema as Record<string, unknown>,
        },
      });
    }
  }
  return tools;
}

/**
 * Execute an MCP tool call.
 */
export async function executeMcpTool(
  fullName: string,
  args: Record<string, unknown>,
): Promise<string> {
  // Parse: mcp__serverName__toolName
  const parts = fullName.split('__');
  if (parts.length < 3) return `Error: Invalid MCP tool name: ${fullName}`;

  const serverName = parts[1];
  const toolName = parts.slice(2).join('__');
  const server = servers.get(serverName);

  if (!server || !server.ready) {
    return `Error: MCP server "${serverName}" not available`;
  }

  try {
    if (server.config.transport === 'stdio' && server.process) {
      const request = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }) + '\n';

      server.process.stdin?.write(request);

      const execBuffer = new JsonRpcBuffer();
      const response = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('MCP tool timeout')), 30000);
        const handler = (chunk: Buffer) => {
          const messages = execBuffer.feed(chunk.toString());
          for (const msg of messages) {
            const parsed = msg as { result?: unknown; error?: { message: string } };
            if (parsed.result || parsed.error) {
              clearTimeout(timeout);
              server.process?.stdout?.removeListener('data', handler);
              resolve(JSON.stringify(msg));
              return;
            }
          }
        };
        server.process?.stdout?.on('data', handler);
      });

      const parsed = JSON.parse(response);
      if (parsed.error) return `MCP Error: ${parsed.error.message}`;
      if (parsed.result?.content) {
        return parsed.result.content
          .map((c: { type: string; text?: string }) => c.text || '')
          .join('\n');
      }
      return JSON.stringify(parsed.result);
    }

    if (server.config.transport === 'http') {
      const response = await fetch(server.config.url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        }),
      });

      const data = await response.json() as { result?: { content?: Array<{ text?: string }> }; error?: { message: string } };
      if (data.error) return `MCP Error: ${data.error.message}`;
      if (data.result?.content) {
        return data.result.content.map(c => c.text || '').join('\n');
      }
      return JSON.stringify(data.result);
    }

    return 'Error: Unknown MCP transport';
  } catch (e) {
    return `MCP Error: ${(e as Error).message}`;
  }
}

/**
 * Shut down all MCP servers.
 */
export function shutdownMcpServers(): void {
  for (const server of servers.values()) {
    if (server.process) {
      try { server.process.kill(); } catch (_) { /* intentionally ignored: process may already be dead */ }
    }
  }
  servers.clear();
}

/**
 * Get status of all MCP servers.
 */
export function getMcpStatus(): Array<{ name: string; ready: boolean; toolCount: number; transport: string }> {
  return Array.from(servers.values()).map(s => ({
    name: s.config.name,
    ready: s.ready,
    toolCount: s.tools.length,
    transport: s.config.transport,
  }));
}

/**
 * Check if a tool name is an MCP tool.
 */
export function isMcpTool(name: string): boolean {
  return name.startsWith('mcp__');
}
