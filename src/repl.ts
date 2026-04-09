/**
 * REPL mode — interactive conversation loop with slash commands.
 */

import { createInterface } from 'node:readline';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { ChatCompletionMessageParam } from 'openai/resources/index.js';
import { loadConfig, getConfigDir, type EffortLevel, type PermissionMode } from './config.js';
import { runAgent } from './agent.js';
import { listKnowledgeFiles } from './knowledge.js';
import { listSkills } from './skills.js';
import { getCurrentPlan, resetPlan } from './planner.js';
import { toolDefinitions } from './tools/index.js';
import { printWelcome, printError, printSuccess, printLine, printWarning } from './ui.js';
import { saveSession, listSessions, loadSession, getRecentSession } from './sessions.js';
import { generateInsight } from './insight.js';
import { spawnSubAgent, listSubAgents, getSubAgent } from './sub-agents.js';
import { enableStatusBar, disableStatusBar, updateStatusBar, setupResizeHandler, renderStatusBar } from './statusbar.js';
import { slashCompleter } from './completer.js';
import { runHooks, initHooksTemplate } from './hooks.js';
import { initMcpServers, shutdownMcpServers, getMcpStatus } from './mcp-client.js';
import { killAllProcesses } from './tools/process-manager.js';
import { cleanupClaudeSessions } from './tools/claude-code.js';
import { getCompactStatus, compressHistory } from './compactor.js';
import { getRouterStats, debugRoute } from './skill-router.js';
import { formatCostReport } from './cost-tracker.js';
import { getPreset, listPresets } from './providers.js';
import { runDream, formatDreamResult, shouldAutoDream } from './dream.js';
import { runVerification, formatVerificationResult } from './verification-agent.js';
import chalk from 'chalk';

export interface ReplOptions {
  continueSession?: boolean;
  resumeId?: string;
  model?: string;
  effort?: EffortLevel;
  permissionMode?: PermissionMode;
  version: string;
}

/**
 * Start interactive REPL mode.
 */
export async function startRepl(opts: ReplOptions): Promise<void> {
  const config = loadConfig();
  const skills = listSkills();
  const knowledgeFiles = listKnowledgeFiles();
  const sessionStartTime = Date.now();
  const matchedSkills: string[] = [];

  // Initialize MCP servers in background
  initMcpServers().catch(() => { /* MCP init failures are non-fatal */ });

  // Runtime overrides
  let currentModel = opts.model || config.model;
  let currentEffort: EffortLevel = opts.effort || config.effort;
  let currentPermissionMode: PermissionMode = opts.permissionMode || config.permissionMode;
  let sessionName = '';

  printWelcome({
    version: opts.version,
    model: currentModel,
    toolCount: toolDefinitions.length,
    skillsActive: skills.filter(s => s.enabled).length,
    skillsTotal: skills.length,
    knowledgeCount: knowledgeFiles.length,
    cwd: process.cwd(),
  });

  // Check BOBO.md
  const boboMdExists = existsSync(join(process.cwd(), 'BOBO.md'));
  if (boboMdExists) {
    printLine(chalk.dim('  📋 BOBO.md loaded'));
  }

  if (!config.apiKey) {
    printWarning('API key not configured. Run: bobo config set apiKey <your-key>');
    printLine();
  }

  // Restore session
  let history: ChatCompletionMessageParam[] = [];

  if (opts.continueSession) {
    // -c flag: continue most recent session
    const recent = getRecentSession(86400000); // 24 hours
    if (recent && recent.messages.length > 0) {
      history = recent.messages;
      printSuccess(`Continuing session (${history.length} messages, "${recent.firstUserMessage.slice(0, 40)}...")`);
    } else {
      printWarning('No recent session found.');
    }
  } else if (opts.resumeId) {
    // -r flag: resume specific session
    const session = loadSession(opts.resumeId);
    if (session) {
      history = session.messages;
      printSuccess(`Resumed session ${opts.resumeId} (${history.length} messages)`);
    } else {
      printWarning(`Session not found: ${opts.resumeId}`);
    }
  } else {
    // Auto-resume prompt
    const recentSession = getRecentSession(3600000);
    if (recentSession && recentSession.messages.length > 0) {
      printLine(chalk.yellow(`💾 Found recent session (${recentSession.messageCount} messages, ${recentSession.firstUserMessage.slice(0, 50)}...)`));
      printLine(chalk.dim('   Resume? (y/n)'));

      const answer = await new Promise<string>((resolve) => {
        const tmpRl = createInterface({ input: process.stdin, output: process.stdout });
        tmpRl.question(chalk.green('> '), (ans) => {
          tmpRl.close();
          resolve(ans.trim().toLowerCase());
        });
      });

      if (answer === 'y' || answer === 'yes') {
        history = recentSession.messages;
        printSuccess(`Resumed session (${history.length} messages)`);
      }
    }
  }

  // Enable status bar
  if (process.stdout.isTTY) {
    setupResizeHandler();
    enableStatusBar({
      model: currentModel,
      thinkingLevel: currentEffort,
      skillsCount: skills.filter(s => s.enabled).length,
      cwd: process.cwd(),
      permissionMode: currentPermissionMode,
    });
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('> '),
    completer: slashCompleter,
  });

  let abortController: AbortController | null = null;
  let lastResponse = '';
  let autoCompactTriggered = false;

  // Wrapper that renders status bar before prompt
  const showPrompt = () => {
    const bar = renderStatusBar();
    if (bar) printLine(bar);
    rl.prompt();
  };

  const autoSave = () => {
    if (history.length > 0) {
      const id = saveSession(history, process.cwd());
      printLine(chalk.dim(`\n💾 Session saved: ${id}`));
    }
  };

  rl.on('SIGINT', () => {
    if (abortController) {
      abortController.abort();
      abortController = null;
      printLine(chalk.dim('\n(cancelled)'));
      showPrompt();
    } else {
      printLine(chalk.dim('\n(press Ctrl+C again or Ctrl+D to exit)'));
      showPrompt();
    }
  });

  rl.on('close', async () => {
    autoSave();

    // Auto-dream on session end if needed
    if (shouldAutoDream()) {
      printLine(chalk.dim('\n🌙 Consolidating memories...'));
      try {
        const dreamResult = await runDream({ verbose: false });
        if (dreamResult.insights.length > 0) {
          printLine(chalk.green(`✨ Extracted ${dreamResult.insights.length} insights during shutdown`));
        }
      } catch (_) {
        /* intentionally ignored: resume session unavailable */
        // Silent failure on shutdown
      }
    }

    runHooks('session-end');
    shutdownMcpServers();
    killAllProcesses();
    cleanupClaudeSessions();
    disableStatusBar();
    printLine(chalk.dim('\nGoodbye! 🐕'));
    process.exit(0);
  });

  showPrompt();

  for await (const line of rl) {
    const input = line.trim();

    if (!input) {
      showPrompt();
      continue;
    }

    // ─── Exit ───
    if (input === '/quit' || input === '/exit') {
      autoSave();
      runHooks('session-end');
      shutdownMcpServers();
      killAllProcesses();
      disableStatusBar();
      printLine(chalk.dim('Goodbye! 🐕'));
      process.exit(0);
    }

    // ─── /new, /clear ───
    if (input === '/clear' || input === '/new') {
      history = [];
      matchedSkills.length = 0;
      lastResponse = '';
      autoCompactTriggered = false;
      resetPlan();
      printSuccess('Conversation cleared');
      showPrompt();
      continue;
    }

    // ─── /model [name] ───
    if (input.startsWith('/model')) {
      const newModel = input.replace('/model', '').trim();
      if (!newModel) {
        printLine(chalk.cyan('Current model: ') + currentModel);
        printLine(chalk.dim('Usage: /model <model-name>'));
        printLine(chalk.dim('  Examples: claude-sonnet-4-20250514, gpt-4o, deepseek-chat'));
      } else {
        currentModel = newModel;
        updateStatusBar({ model: currentModel });
        printSuccess(`Model switched to: ${currentModel}`);
      }
      showPrompt();
      continue;
    }

    // ─── /effort [level] ───
    if (input.startsWith('/effort')) {
      const level = input.replace('/effort', '').trim().toLowerCase();
      if (!level) {
        printLine(chalk.cyan('Current effort: ') + currentEffort);
        printLine(chalk.dim('  /effort low    — Quick, concise answers'));
        printLine(chalk.dim('  /effort medium — Balanced (default)'));
        printLine(chalk.dim('  /effort high   — Deep analysis, thorough'));
      } else if (['low', 'medium', 'high'].includes(level)) {
        currentEffort = level as EffortLevel;
        updateStatusBar({ thinkingLevel: currentEffort });
        printSuccess(`Effort level: ${currentEffort}`);
      } else {
        printError('Invalid effort level. Use: low, medium, high');
      }
      showPrompt();
      continue;
    }

    // ─── /copy [n] ───
    if (input.startsWith('/copy')) {
      const indexStr = input.replace('/copy', '').trim();
      let textToCopy = lastResponse;

      if (indexStr) {
        const idx = parseInt(indexStr, 10);
        const assistantMsgs = history.filter(m => m.role === 'assistant' && typeof m.content === 'string');
        if (idx > 0 && idx <= assistantMsgs.length) {
          textToCopy = (assistantMsgs[assistantMsgs.length - idx] as { content: string }).content;
        }
      }

      if (!textToCopy) {
        printWarning('Nothing to copy.');
      } else {
        // Try platform clipboard
        try {
          const clipCmd = process.platform === 'darwin' ? 'pbcopy'
            : process.platform === 'win32' ? 'clip'
            : 'xclip -selection clipboard';
          execSync(clipCmd, { input: textToCopy, timeout: 3000 });
          printSuccess('Copied to clipboard!');
        } catch (_) {
          /* intentionally ignored: compact state parse failure */
          // Fallback: write to file
          const copyPath = join(getConfigDir(), 'last-copy.txt');
          writeFileSync(copyPath, textToCopy);
          printWarning(`Clipboard unavailable. Saved to ${copyPath}`);
        }
      }
      showPrompt();
      continue;
    }

    // ─── /context ───
    if (input === '/context') {
      const msgCount = history.length;
      let totalChars = 0;
      let toolResultChars = 0;
      const roleCounts: Record<string, number> = {};

      for (const msg of history) {
        const content = typeof msg.content === 'string' ? msg.content : '';
        totalChars += content.length;
        roleCounts[msg.role] = (roleCounts[msg.role] || 0) + 1;
        if (msg.role === 'tool') toolResultChars += content.length;
      }

      const estTokens = Math.ceil(totalChars / 3.5);
      const maxContext = 200000; // approximate
      const usage = (estTokens / maxContext * 100).toFixed(1);

      printLine(chalk.cyan.bold('\n📊 Context Analysis\n'));
      printLine(`  Messages:     ${msgCount}`);
      printLine(`  Est. Tokens:  ~${estTokens.toLocaleString()} / ${maxContext.toLocaleString()} (${usage}%)`);
      printLine('');
      for (const [role, count] of Object.entries(roleCounts)) {
        printLine(`  ${role.padEnd(12)} ${count} messages`);
      }

      if (toolResultChars > totalChars * 0.6) {
        printLine(chalk.yellow('\n  ⚠ Tool results are >60% of context. Consider /compact to free space.'));
      }
      if (estTokens > maxContext * 0.75) {
        printLine(chalk.red('\n  🔴 Context usage >75%. Run /compact soon!'));
      } else if (estTokens > maxContext * 0.5) {
        printLine(chalk.yellow('\n  🟡 Context usage >50%. Keep an eye on it.'));
      } else {
        printLine(chalk.green('\n  🟢 Context usage healthy.'));
      }
      printLine();
      showPrompt();
      continue;
    }

    // ─── /rename <name> ───
    if (input.startsWith('/rename')) {
      const name = input.replace('/rename', '').trim();
      if (!name) {
        printLine(chalk.dim(`Current name: ${sessionName || '(unnamed)'}`));
        printLine(chalk.dim('Usage: /rename <name>'));
      } else {
        sessionName = name;
        printSuccess(`Session renamed: ${sessionName}`);
      }
      showPrompt();
      continue;
    }

    // ─── /history ───
    if (input === '/history') {
      printLine(`Turns: ${history.filter(m => m.role === 'user').length}`);
      showPrompt();
      continue;
    }

    // ─── /resume ───
    if (input === '/resume') {
      const sessions = listSessions(10);
      if (sessions.length === 0) {
        printWarning('No saved sessions.');
        showPrompt();
        continue;
      }
      printLine(chalk.cyan.bold('\n💾 Recent Sessions:\n'));
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        const date = s.startedAt ? new Date(s.startedAt).toLocaleString() : 'unknown';
        printLine(`  ${chalk.bold(String(i + 1).padStart(2))} ${chalk.dim(date)} — ${s.firstUserMessage.slice(0, 50)} (${s.messageCount} msgs)`);
      }
      printLine(chalk.dim('\n  Enter number to restore, or press Enter to cancel:'));

      const pick = await new Promise<string>((resolve) => {
        const tmpRl = createInterface({ input: process.stdin, output: process.stdout });
        tmpRl.question(chalk.green('> '), (ans) => {
          tmpRl.close();
          resolve(ans.trim());
        });
      });

      const idx = parseInt(pick, 10) - 1;
      if (idx >= 0 && idx < sessions.length) {
        const session = loadSession(sessions[idx].id);
        if (session) {
          history = session.messages;
          printSuccess(`Restored session (${history.length} messages)`);
        } else {
          printError('Failed to load session.');
        }
      }
      showPrompt();
      continue;
    }

    // ─── /insight ───
    if (input === '/insight') {
      printLine(generateInsight(history, sessionStartTime, [...new Set(matchedSkills)]));
      showPrompt();
      continue;
    }

    // ─── /agents, /bg ───
    if (input === '/agents' || input === '/bg') {
      const agents = listSubAgents(10);
      if (agents.length === 0) {
        printLine(chalk.dim('No sub-agents. Use: /spawn <task>'));
      } else {
        printLine(chalk.cyan.bold('\n🤖 Sub-Agents:\n'));
        for (const a of agents) {
          const icon = a.status === 'completed' ? '✅' : a.status === 'failed' ? '❌' : '⏳';
          const task = a.task.slice(0, 60) + (a.task.length > 60 ? '...' : '');
          printLine(`  ${icon} ${chalk.bold(a.id)} — ${task} ${chalk.dim(`[${a.status}]`)}`);
        }
      }
      printLine();
      showPrompt();
      continue;
    }

    if (input.startsWith('/agents show ')) {
      const id = input.replace('/agents show ', '').trim();
      const agent = getSubAgent(id);
      if (!agent) {
        printError(`Sub-agent not found: ${id}`);
      } else {
        printLine(chalk.cyan.bold(`\n🤖 ${agent.id} [${agent.status}]`));
        printLine(chalk.dim(`Task: ${agent.task}`));
        if (agent.result) printLine(`\n${agent.result}`);
        if (agent.error) printLine(chalk.red(`Error: ${agent.error}`));
      }
      printLine();
      showPrompt();
      continue;
    }

    if (input.startsWith('/spawn ')) {
      const task = input.replace('/spawn ', '').trim();
      if (!task) {
        printWarning('Usage: /spawn <task description>');
      } else {
        const result = spawnSubAgent(task);
        if (result.error) {
          printError(result.error);
        } else {
          printSuccess(`Sub-agent ${result.id} spawned! Check with /agents`);
        }
      }
      showPrompt();
      continue;
    }

    // ─── /compact ───
    if (input === '/compact') {
      const userCount = history.filter(m => m.role === 'user').length;
      if (userCount > 4) {
        printLine(chalk.dim('Compacting context...'));
        abortController = new AbortController();
        try {
          const compactResult = await runAgent(
            'Perform a nine-section context compression. Analyze the conversation so far and produce a structured summary covering: ' +
            '1. Main requests/intent 2. Key technical concepts 3. Files and code 4. Errors and fixes 5. Problem resolution ' +
            '6. All user messages 7. Pending tasks 8. Current work state 9. Next steps (with citations). ' +
            'Output the summary directly, do not call any tools.',
            history,
            { signal: abortController.signal, model: currentModel, effort: currentEffort },
          );
          history = [
            { role: 'user', content: 'Below is a compressed summary of our prior conversation. Continue from here.' },
            { role: 'assistant', content: compactResult.response },
          ];
          autoCompactTriggered = false;
          printSuccess('Context compacted (nine-section summary)');
        } catch (e) {
          if ((e as Error).message !== 'Aborted') {
            history = history.slice(-8);
            printSuccess('Context compacted (truncated)');
          }
        }
        abortController = null;
      } else {
        printWarning('Conversation too short to compact');
      }
      showPrompt();
      continue;
    }

    // ─── /dream (KAIROS memory consolidation) ───
    if (input === '/dream') {
      printLine(chalk.dim('🌙 Running KAIROS dream mode...'));
      try {
        const dreamResult = await runDream({ verbose: true });
        printLine(formatDreamResult(dreamResult));
      } catch (e) {
        printError(`Dream mode failed: ${(e as Error).message}`);
      }
      showPrompt();
      continue;
    }

    // ─── /verify (verification agent) ───
    if (input.startsWith('/verify')) {
      const task = input.replace('/verify', '').trim() || 'Verify current project state';
      printLine(chalk.dim('🔍 Running verification agent...'));
      try {
        const verifyResult = await runVerification(task, lastResponse || '', {
          cwd: process.cwd(),
        });
        printLine(formatVerificationResult(verifyResult));

        // If verification failed, suggest fixes
        if (verifyResult.verdict === 'FAIL' && verifyResult.suggestedFixes) {
          printLine(chalk.yellow('\n💡 Suggested next steps:'));
          for (const fix of verifyResult.suggestedFixes) {
            printLine(chalk.dim(`   • ${fix}`));
          }
        }
      } catch (e) {
        printError(`Verification failed: ${(e as Error).message}`);
      }
      showPrompt();
      continue;
    }

    // ─── /status ───
    if (input === '/status') {
      const turns = history.filter(m => m.role === 'user').length;
      const mcpServers = getMcpStatus();
      const compactInfo = getCompactStatus(history);
      printLine(chalk.cyan('📊 Session Status:'));
      printLine(`  Model:      ${currentModel}`);
      printLine(`  Effort:     ${currentEffort}`);
      printLine(`  Permission: ${currentPermissionMode}`);
      printLine(`  Turns:      ${turns}`);
      printLine(`  Messages:   ${history.length}`);
      printLine(`  Tokens:     ~${compactInfo.tokens.toLocaleString()} (${compactInfo.urgency})`);
      printLine(`  CWD:        ${process.cwd()}`);
      if (sessionName) printLine(`  Name:       ${sessionName}`);
      if (mcpServers.length > 0) {
        printLine(`  MCP:        ${mcpServers.filter(s => s.ready).length}/${mcpServers.length} servers (${mcpServers.reduce((a, s) => a + s.toolCount, 0)} tools)`);
      }
      printLine(chalk.dim('  ── Cost ──'));
      printLine(`  ${formatCostReport(currentModel).split('\n').join('\n  ')}`);
      showPrompt();
      continue;
    }

    if (input === '/plan') {
      printLine(getCurrentPlan());
      showPrompt();
      continue;
    }

    if (input === '/knowledge') {
      const files = listKnowledgeFiles();
      for (const f of files) {
        const icon = f.type === 'always' ? '🔵' : f.type === 'on-demand' ? '🟡' : '🟢';
        printLine(`  ${icon} ${f.file} (${f.type})`);
      }
      showPrompt();
      continue;
    }

    if (input === '/skills') {
      const sklls = listSkills();
      for (const s of sklls) {
        const icon = s.enabled ? '✅' : '❌';
        printLine(`  ${icon} ${s.name} — ${s.description}`);
      }
      showPrompt();
      continue;
    }

    // ─── /mcp ───
    if (input === '/mcp') {
      const mcpServers = getMcpStatus();
      if (mcpServers.length === 0) {
        printLine(chalk.dim('No MCP servers. Configure in ~/.bobo/mcp.json'));
        printLine(chalk.dim('Run: bobo mcp init'));
      } else {
        printLine(chalk.cyan.bold('\n🔌 MCP Servers:\n'));
        for (const s of mcpServers) {
          const icon = s.ready ? chalk.green('●') : chalk.red('●');
          printLine(`  ${icon} ${chalk.bold(s.name)} [${s.transport}] — ${s.toolCount} tools`);
        }
      }
      printLine();
      showPrompt();
      continue;
    }

    // ─── /cost ───
    if (input === '/cost') {
      printLine(chalk.cyan('💰 API Cost:'));
      printLine(`  ${formatCostReport(currentModel).split('\n').join('\n  ')}`);
      showPrompt();
      continue;
    }

    // ─── /route (skill router debug) ───
    if (input.startsWith('/route ')) {
      const query = input.slice(7).trim();
      if (query) {
        printLine(chalk.cyan('🔀 Skill Route Debug:'));
        printLine(debugRoute(query));
      } else {
        const stats = getRouterStats();
        printLine(chalk.cyan('🔀 Skill Router Stats:'));
        printLine(`  Total: ${stats.totalSkills} | Kernel: ${stats.kernel} | Auto: ${stats.auto} | Manual: ${stats.manual}`);
        printLine(`  Intent categories: ${stats.intents}`);
      }
      showPrompt();
      continue;
    }

    // ─── /provider ───
    if (input.startsWith('/provider')) {
      const arg = input.slice(9).trim();
      if (!arg) {
        printLine(chalk.cyan('🌐 Available Providers:'));
        printLine(listPresets());
        printLine(chalk.dim('\n  Usage: /provider <name> — switch to provider'));
      } else {
        const preset = getPreset(arg);
        if (!preset) {
          printError(`Unknown provider: ${arg}`);
        } else {
          currentModel = preset.defaultModel;
          // Note: baseUrl and apiKey require config set
          printSuccess(`Switched model to ${preset.defaultModel}`);
          printLine(chalk.dim(`  Base URL: ${preset.baseUrl}`));
          printLine(chalk.dim(`  Set API key: bobo config set apiKey <key>`));
          printLine(chalk.dim(`  Set base URL: bobo config set baseUrl ${preset.baseUrl}`));
        }
      }
      showPrompt();
      continue;
    }

    // ─── /help ───
    if (input === '/help') {
      printLine(chalk.cyan.bold('Commands:'));
      printLine('');
      printLine(chalk.dim('  Session'));
      printLine('  /new         Start new conversation');
      printLine('  /clear       Clear conversation history');
      printLine('  /compact     Compress context (nine-section)');
      printLine('  /resume      Restore a previous session');
      printLine('  /rename <n>  Rename current session');
      printLine('  /quit        Exit');
      printLine('');
      printLine(chalk.dim('  Model & Effort'));
      printLine('  /model <n>   Switch model');
      printLine('  /effort <l>  Set thinking effort (low/medium/high)');
      printLine('');
      printLine(chalk.dim('  Analysis'));
      printLine('  /insight     Session analytics (tokens, tools, skills)');
      printLine('  /context     Context usage analysis');
      printLine('  /status      Session status');
      printLine('  /copy [n]    Copy last response to clipboard');
      printLine('  /plan        Show current task plan');
      printLine('  /verify      Run verification agent');
      printLine('  /history     Show conversation turns');
      printLine('');
      printLine(chalk.dim('  Sub-Agents'));
      printLine('  /spawn <t>   Run task in background sub-agent');
      printLine('  /agents      List sub-agents');
      printLine('  /agents show <id>  Show sub-agent result');
      printLine('');
      printLine(chalk.dim('  Knowledge & Integrations'));
      printLine('  /knowledge   List knowledge files');
      printLine('  /skills      List skills');
      printLine('  /mcp         MCP server status');
      printLine('  /bg          Background process list');
      printLine('  /dream       Memory consolidation');
      printLine('');
      printLine(chalk.dim('  CLI Commands'));
      printLine('  bobo -p "q"  Non-interactive (supports piping)');
      printLine('  bobo -c      Continue last conversation');
      printLine('  bobo -r <id> Resume specific session');
      printLine('  bobo --full-auto  Auto-approve tool calls');
      printLine('  bobo --yolo  No sandbox, no approvals');
      printLine('  bobo watch   File watcher (daemon mode)');
      printLine('  bobo run     Autonomous agent loop');
      printLine('  bobo mcp     MCP server management');
      printLine('  bobo hooks   Lifecycle hook management');
      printLine('  bobo doctor  Environment check');
      printLine('');
      printLine(chalk.dim('  Debug'));
      printLine('  /cost        API cost this session');
      printLine('  /route <msg> Skill router debug');
      printLine('  /provider    Switch AI provider');
      showPrompt();
      continue;
    }

    // ─── Run agent ───
    abortController = new AbortController();
    try {
      const result = await runAgent(input, history, {
        signal: abortController.signal,
        matchedSkills,
        model: currentModel,
        effort: currentEffort,
        permissionMode: currentPermissionMode,
        onAutoCompact: () => {
          if (!autoCompactTriggered) {
            autoCompactTriggered = true;
            printLine(chalk.yellow('\n⚠ Context is getting large. Consider running /compact to free space.\n'));
          }
        },
      });
      history = result.history;
      lastResponse = result.response;

      // Auto-compact check
      const compactInfo = getCompactStatus(history);
      if (compactInfo.urgency === 'critical') {
        printWarning(`Context at ${compactInfo.tokens} tokens — auto-compressing...`);
        history = compressHistory(history, 8);
        printSuccess(`Compressed to ${getCompactStatus(history).tokens} tokens`);
      } else if (compactInfo.urgency === 'high') {
        printWarning(`⚠ Context at ${compactInfo.tokens} tokens. Run /compact to compress.`);
      }
    } catch (e) {
      if ((e as Error).message !== 'Aborted') {
        printError((e as Error).message);
      }
    }
    abortController = null;

    printLine();
    showPrompt();
  }
}
