import { execSync } from 'node:child_process';
import type { ChatCompletionTool } from 'openai/resources/index.js';

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

export function executeWebTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'web_search': return webSearch(args);
    case 'web_fetch': return webFetch(args);
    default: return `Unknown web tool: ${name}`;
  }
}

export function isWebTool(name: string): boolean {
  return ['web_search', 'web_fetch'].includes(name);
}

function webSearch(args: Record<string, unknown>): string {
  const query = args.query as string;
  const count = Math.min((args.count as number) || 5, 10);

  // Use curl + DuckDuckGo lite HTML (no API key needed)
  try {
    const encoded = encodeURIComponent(query);
    const result = execSync(
      `curl -sL "https://lite.duckduckgo.com/lite/?q=${encoded}" \
       -H "User-Agent: Mozilla/5.0" \
       --max-time 10 2>/dev/null | \
       sed -n 's/.*<a rel="nofollow" href="\\([^"]*\\)" class=.result-link.>\\(.*\\)<\\/a>.*/\\2 | \\1/p' | \
       head -${count}`,
      { encoding: 'utf-8', timeout: 15000 }
    ).trim();

    if (!result) {
      // Fallback: try ddgr if available
      try {
        const ddgr = execSync(
          `ddgr --json -n ${count} "${query}" 2>/dev/null`,
          { encoding: 'utf-8', timeout: 15000 }
        ).trim();
        if (ddgr) {
          const results = JSON.parse(ddgr);
          return results.map((r: { title: string; url: string; abstract: string }) =>
            `${r.title}\n${r.url}\n${r.abstract}`
          ).join('\n\n');
        }
      } catch { /* fallback failed */ }

      return `No results found for: "${query}". Try a different query or use web_fetch with a direct URL.`;
    }

    return result;
  } catch (e) {
    return `Search error: ${(e as Error).message}. Try using web_fetch with a direct URL instead.`;
  }
}

function webFetch(args: Record<string, unknown>): string {
  const url = args.url as string;
  const maxChars = (args.maxChars as number) || 5000;

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'URL must start with http:// or https://';
  }

  try {
    // Fetch and extract text, strip HTML tags
    const raw = execSync(
      `curl -sL "${url}" \
       -H "User-Agent: Mozilla/5.0 (compatible; BoboCLI/1.0)" \
       --max-time 15 \
       --max-filesize 1048576 2>/dev/null`,
      { encoding: 'utf-8', timeout: 20000, maxBuffer: 2 * 1024 * 1024 }
    );

    // Strip HTML to plain text
    let text = raw
      // Remove script and style blocks
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      // Convert common elements
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      // Strip remaining tags
      .replace(/<[^>]+>/g, '')
      // Decode entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // Clean whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    if (text.length > maxChars) {
      text = text.slice(0, maxChars) + '\n\n... (truncated)';
    }

    return text || '(empty page or could not extract text)';
  } catch (e) {
    return `Fetch error: ${(e as Error).message}`;
  }
}
