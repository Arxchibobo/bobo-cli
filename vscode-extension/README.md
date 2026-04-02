# Bobo CLI — VS Code Extension

VS Code integration for [Bobo CLI](https://github.com/Arxchibobo/bobo-cli).

## Features

- **Side Panel** — Open Bobo in an integrated terminal (`Cmd+Shift+B`)
- **Quick Ask** — Ask a question without opening terminal (`Cmd+Shift+A`)
- **Context Menu** — Right-click selected code → "Explain" or "Fix"
- **Output Channel** — See Bobo's responses in the Output panel

## Requirements

Install Bobo CLI globally first:

```bash
npm install -g bobo-ai-cli
bobo init
bobo config set apiKey <your-api-key>
```

## Building

```bash
cd vscode-extension
npm install
npm run build
```

## Installing locally

```bash
npx vsce package
code --install-extension bobo-vscode-0.1.0.vsix
```
