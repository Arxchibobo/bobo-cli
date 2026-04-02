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
  { name: '/rename', description: 'Rename current session' },
  { name: '/quit', description: 'Exit' },
  { name: '/exit', description: 'Exit' },
];

/**
 * Readline completer function.
 */
export function slashCompleter(line: string): [string[], string] {
  if (!line.startsWith('/')) {
    return [[], line];
  }

  const input = line.toLowerCase();
  const matches = COMMANDS
    .filter(c => c.name.startsWith(input))
    .map(c => c.name);

  return [matches, line];
}

/**
 * Get all commands for /help display.
 */
export function getAllCommands(): CommandDef[] {
  return [...COMMANDS];
}
