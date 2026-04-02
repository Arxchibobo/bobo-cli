/**
 * Tab completion for REPL slash commands.
 */

export interface CommandDef {
  name: string;
  description: string;
}

const COMMANDS: CommandDef[] = [
  { name: '/help', description: 'Show available commands' },
  { name: '/new', description: 'Start new conversation' },
  { name: '/clear', description: 'Clear conversation history' },
  { name: '/compact', description: 'Compress context (nine-section)' },
  { name: '/resume', description: 'Restore a previous session' },
  { name: '/insight', description: 'Session analytics' },
  { name: '/context', description: 'Context usage analysis' },
  { name: '/status', description: 'Session status' },
  { name: '/model', description: 'Switch model' },
  { name: '/effort', description: 'Set thinking effort (low/medium/high)' },
  { name: '/plan', description: 'Show current task plan' },
  { name: '/spawn', description: 'Run task in background sub-agent' },
  { name: '/agents', description: 'List sub-agents' },
  { name: '/copy', description: 'Copy last response to clipboard' },
  { name: '/knowledge', description: 'List knowledge files' },
  { name: '/skills', description: 'List skills' },
  { name: '/dream', description: 'Memory consolidation' },
  { name: '/mcp', description: 'MCP server status' },
  { name: '/bg', description: 'Background processes' },
  { name: '/rename', description: 'Rename current session' },
  { name: '/quit', description: 'Exit' },
  { name: '/exit', description: 'Exit' },
];

/**
 * Readline completer function.
 * Shows matching commands when user types / and presses Tab.
 * Also shows description next to each match.
 */
export function slashCompleter(line: string): [string[], string] {
  if (!line.startsWith('/')) {
    return [[], line];
  }

  const input = line.toLowerCase();
  const matches = COMMANDS
    .filter(c => c.name.startsWith(input));

  if (matches.length === 1) {
    // Exact single match — complete it
    return [[matches[0].name], line];
  }

  if (matches.length > 1) {
    // Show commands with descriptions
    const display = matches.map(c => `${c.name.padEnd(16)} ${c.description}`);
    // Print hints, but return just the names for completion
    console.log('\n' + display.join('\n'));
    return [matches.map(c => c.name), line];
  }

  return [[], line];
}

/**
 * Get all commands for /help display.
 */
export function getAllCommands(): CommandDef[] {
  return [...COMMANDS];
}
