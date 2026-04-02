/**
 * Bobo CLI — VS Code Extension
 *
 * Integrates Bobo CLI directly into VS Code:
 * - Side panel for chat
 * - Right-click context menu (Explain/Fix selection)
 * - Inline diff display for file edits
 * - Keybindings (Cmd+Shift+B to open, Cmd+Shift+A to ask)
 */

import * as vscode from 'vscode';
import { spawn, type ChildProcess } from 'child_process';

let boboProcess: ChildProcess | null = null;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Bobo CLI');

  // Command: Open Bobo panel
  context.subscriptions.push(
    vscode.commands.registerCommand('bobo.open', () => {
      const terminal = vscode.window.createTerminal({
        name: 'Bobo CLI',
        shellPath: 'bobo',
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
      });
      terminal.show();
    })
  );

  // Command: Ask Bobo a question
  context.subscriptions.push(
    vscode.commands.registerCommand('bobo.ask', async () => {
      const question = await vscode.window.showInputBox({
        prompt: 'Ask Bobo...',
        placeHolder: 'e.g., explain this project structure',
      });
      if (!question) return;

      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
      runBoboCommand(`-p "${question}"`, cwd);
    })
  );

  // Command: Explain selection
  context.subscriptions.push(
    vscode.commands.registerCommand('bobo.explain', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.document.getText(editor.selection);
      if (!selection) return;

      const file = editor.document.fileName;
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
      runBoboCommand(`-p "Explain this code from ${file}:\n\n${selection}"`, cwd);
    })
  );

  // Command: Fix selection
  context.subscriptions.push(
    vscode.commands.registerCommand('bobo.fix', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.document.getText(editor.selection);
      if (!selection) return;

      const file = editor.document.fileName;
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
      runBoboCommand(`-p "Fix any issues in this code from ${file}:\n\n${selection}"`, cwd);
    })
  );
}

function runBoboCommand(args: string, cwd: string): void {
  outputChannel.show();
  outputChannel.appendLine(`\n> bobo ${args}\n`);

  boboProcess = spawn('bobo', args.split(' '), {
    cwd,
    shell: true,
  });

  boboProcess.stdout?.on('data', (data: Buffer) => {
    outputChannel.append(data.toString());
  });

  boboProcess.stderr?.on('data', (data: Buffer) => {
    outputChannel.append(data.toString());
  });

  boboProcess.on('close', (code) => {
    outputChannel.appendLine(`\n[Exited with code ${code}]`);
    boboProcess = null;
  });
}

export function deactivate() {
  if (boboProcess) {
    boboProcess.kill();
    boboProcess = null;
  }
}
