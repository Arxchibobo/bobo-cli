/**
 * Browser automation — headless browser for visual verification.
 * Solves: "没有浏览器/Playwright"
 *
 * Uses Node.js built-in fetch + system browser for:
 * - URL screenshots (via Puppeteer if available, fallback to text)
 * - HTTP endpoint testing
 * - HTML rendering preview
 */

import { execSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatCompletionTool } from 'openai/resources/index.js';

export const browserToolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: 'Take a screenshot of a URL. Requires Puppeteer/Playwright installed. Saves to a file.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to screenshot' },
          output: { type: 'string', description: 'Output file path (default: screenshot.png)' },
          width: { type: 'number', description: 'Viewport width (default: 1280)' },
          height: { type: 'number', description: 'Viewport height (default: 720)' },
          fullPage: { type: 'boolean', description: 'Capture full page (default: false)' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_fetch',
      description: 'Fetch a URL and return the HTML/text content. Like curl but with better output formatting.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
          selector: { type: 'string', description: 'CSS selector to extract (requires cheerio)' },
          headers: { type: 'object', description: 'Custom headers' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_preview',
      description: 'Render HTML content to a file and optionally take a screenshot of it.',
      parameters: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'HTML content to render' },
          output: { type: 'string', description: 'Output HTML file path' },
          screenshot: { type: 'boolean', description: 'Also take a screenshot (default: false)' },
        },
        required: ['html'],
      },
    },
  },
];

// ─── Implementations ─────────────────────────────────────────

function hasPuppeteer(): boolean {
  try {
    execSync('node -e "require(\'puppeteer\')"', { encoding: 'utf-8', timeout: 5000 });
    return true;
  } catch { return false; }
}

function hasPlaywright(): boolean {
  try {
    execSync('node -e "require(\'playwright\')"', { encoding: 'utf-8', timeout: 5000 });
    return true;
  } catch { return false; }
}

function screenshotWithPuppeteer(url: string, output: string, width: number, height: number, fullPage: boolean): string {
  const script = `
    const puppeteer = require('puppeteer');
    (async () => {
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setViewport({ width: ${width}, height: ${height} });
      await page.goto('${url.replace(/'/g, "\\'")}', { waitUntil: 'networkidle2', timeout: 30000 });
      await page.screenshot({ path: '${output.replace(/'/g, "\\'")}', fullPage: ${fullPage} });
      await browser.close();
      console.log('OK');
    })().catch(e => { console.error(e.message); process.exit(1); });
  `;
  try {
    execSync(`node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf-8',
      timeout: 45000,
    });
    return `Screenshot saved to ${output}`;
  } catch (e) {
    return `Screenshot failed: ${(e as Error).message}`;
  }
}

function screenshotWithPlaywright(url: string, output: string, width: number, height: number, fullPage: boolean): string {
  const script = `
    const { chromium } = require('playwright');
    (async () => {
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: ${width}, height: ${height} } });
      await page.goto('${url.replace(/'/g, "\\'")}', { waitUntil: 'networkidle', timeout: 30000 });
      await page.screenshot({ path: '${output.replace(/'/g, "\\'")}', fullPage: ${fullPage} });
      await browser.close();
      console.log('OK');
    })().catch(e => { console.error(e.message); process.exit(1); });
  `;
  try {
    execSync(`node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf-8',
      timeout: 45000,
    });
    return `Screenshot saved to ${output}`;
  } catch (e) {
    return `Screenshot failed: ${(e as Error).message}`;
  }
}

function browserScreenshot(args: Record<string, unknown>): string {
  const url = args.url as string;
  const output = (args.output as string) || 'screenshot.png';
  const width = (args.width as number) || 1280;
  const height = (args.height as number) || 720;
  const fullPage = (args.fullPage as boolean) || false;

  if (hasPuppeteer()) {
    return screenshotWithPuppeteer(url, output, width, height, fullPage);
  }
  if (hasPlaywright()) {
    return screenshotWithPlaywright(url, output, width, height, fullPage);
  }

  return 'No browser automation library found. Install puppeteer or playwright:\n  npm install -g puppeteer\n  # or\n  npm install -g playwright';
}

async function browserFetch(args: Record<string, unknown>): Promise<string> {
  const url = args.url as string;
  const headers = (args.headers || {}) as Record<string, string>;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Bobo-CLI/1.6.0', ...headers },
    });

    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    let body = await response.text();

    // Truncate large responses
    if (body.length > 8000) {
      body = body.slice(0, 8000) + '\n\n... (truncated at 8000 chars)';
    }

    return `HTTP ${status} (${contentType})\n\n${body}`;
  } catch (e) {
    return `Fetch error: ${(e as Error).message}`;
  }
}

function browserPreview(args: Record<string, unknown>): string {
  const html = args.html as string;
  const output = (args.output as string) || 'preview.html';
  const screenshot = args.screenshot as boolean || false;

  writeFileSync(output, html);
  let result = `HTML written to ${output} (${html.length} bytes)`;

  if (screenshot) {
    const screenshotPath = output.replace(/\.html?$/, '.png');
    const screenshotResult = browserScreenshot({
      url: `file://${join(process.cwd(), output)}`,
      output: screenshotPath,
    });
    result += '\n' + screenshotResult;
  }

  return result;
}

// ─── Executor ────────────────────────────────────────────────

export function isBrowserTool(name: string): boolean {
  return ['browser_screenshot', 'browser_fetch', 'browser_preview'].includes(name);
}

export async function executeBrowserTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'browser_screenshot': return browserScreenshot(args);
    case 'browser_fetch': return await browserFetch(args);
    case 'browser_preview': return browserPreview(args);
    default: return `Unknown browser tool: ${name}`;
  }
}
