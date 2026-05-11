import type { ChatCompletionTool } from 'openai/resources/index.js';
import { runProgram } from './tools/safety.js';

// ─── Tool Definitions ────────────────────────────────────────

export const webToolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web using DuckDuckGo. Returns titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          count: { type: 'number', description: 'Number of results (default: 5, max: 10)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch a URL and extract readable text content (HTML → plain text).',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
          maxChars: { type: 'number', description: 'Max characters to return (default: 5000)' },
        },
        required: ['url'],
      },
    },
  },
];

// ─── Tool Execution ──────────────────────────────────────────

export function executeWebTool(name: string, args: Record<string, unknown>): string | Promise<string> {
  switch (name) {
    case 'web_search': return webSearch(args);
    case 'web_fetch': return webFetch(args);
    default: return `Unknown web tool: ${name}`;
  }
}

export function isWebTool(name: string): boolean {
  return ['web_search', 'web_fetch'].includes(name);
}

const USER_AGENT = 'Mozilla/5.0 (compatible; BoboCLI/1.0)';
const FETCH_TIMEOUT_MS = 15000;
const MAX_FETCH_BYTES = 1024 * 1024;

function abortableTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(timer) };
}

async function safeFetch(url: string, opts: { timeoutMs?: number } = {}): Promise<string> {
  const { signal, cancel } = abortableTimeout(opts.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal,
    });
    if (!response.ok) {
      return '';
    }

    // Stream-and-truncate so we never load >1 MB into memory even if the
    // server lies about Content-Length.
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      return text.slice(0, MAX_FETCH_BYTES);
    }
    const decoder = new TextDecoder('utf-8');
    let collected = '';
    let total = 0;
    while (total < MAX_FETCH_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      collected += decoder.decode(value, { stream: true });
    }
    collected += decoder.decode();
    return collected.slice(0, MAX_FETCH_BYTES);
  } finally {
    cancel();
  }
}

async function webSearch(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string;
  if (typeof query !== 'string' || query.length === 0) {
    return 'Missing or empty "query"';
  }
  const count = Math.min(Math.max((args.count as number) || 5, 1), 10);

  // Primary: scrape DuckDuckGo lite HTML via native fetch.
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  let html = '';
  try {
    html = await safeFetch(url);
  } catch (_) {
    /* fall through to ddgr fallback */
  }

  if (html) {
    const results: string[] = [];
    const re = /<a rel="nofollow"\s+href="([^"]+)"\s+class="result-link">([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null && results.length < count) {
      const href = match[1].replace(/&amp;/g, '&');
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      if (href && title) {
        results.push(`${title} | ${href}`);
      }
    }
    if (results.length > 0) {
      return results.join('\n');
    }
  }

  // Fallback: ddgr if installed locally. Pass query as an arg, never as
  // part of a shell string.
  const ddgr = runProgram('ddgr', ['--json', '-n', String(count), query], { timeout: 15000 });
  if (ddgr.ok && ddgr.output) {
    try {
      const parsed = JSON.parse(ddgr.output) as Array<{ title: string; url: string; abstract: string }>;
      return parsed
        .map(r => `${r.title}\n${r.url}\n${r.abstract}`)
        .join('\n\n');
    } catch (_) {
      /* ddgr returned non-JSON; ignore */
    }
  }

  return `No results found for: "${query}". Try a different query or use web_fetch with a direct URL.`;
}

async function webFetch(args: Record<string, unknown>): Promise<string> {
  const url = args.url as string;
  const maxChars = (args.maxChars as number) || 5000;

  if (typeof url !== 'string' || url.length === 0) {
    return 'Missing or empty "url"';
  }

  // Restrict to http(s) and reject anything that parses to a non-public
  // shape (file://, javascript:, data:, etc.).
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (_) {
    return 'Invalid URL';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'URL must use http:// or https://';
  }

  let raw: string;
  try {
    raw = await safeFetch(parsed.toString(), { timeoutMs: 20000 });
  } catch (e) {
    return `Fetch error: ${(e as Error).message}`;
  }

  if (!raw) {
    return '(empty page or could not extract text)';
  }

  // Strip HTML to plain text (same logic as before).
  let text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + '\n\n... (truncated)';
  }

  return text || '(empty page or could not extract text)';
}
