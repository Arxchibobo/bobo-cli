import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import {
  initWiki,
  ingestSource,
  queryWiki,
  lintWiki,
  rebuildIndex,
  searchWiki,
  getWikiStats,
  getRecentLogs,
} from './wiki.js';
import { printSuccess, printError, printLine, printWarning } from './ui.js';

export function registerWikiCommand(program: Command): void {
  const wiki = program
    .command('wiki')
    .description('LLM-maintained knowledge wiki (Karpathy pattern)');

  wiki
    .command('init')
    .description('Initialize .bobo/wiki/ directory structure')
    .action(() => {
      try {
        const wikiDir = initWiki(process.cwd());
        printSuccess('Wiki initialized!');
        printLine(chalk.dim(`  Location: ${wikiDir}`));
        printLine(chalk.dim('  Files: index.md, log.md, schema.md'));
        printLine(chalk.dim('  Directories: sources/, pages/'));
        printLine(chalk.dim('\n  Next: bobo wiki ingest <file-or-url>'));
      } catch (e) {
        printError((e as Error).message);
        process.exit(1);
      }
    });

  wiki
    .command('ingest <source>')
    .description('Ingest a file or URL into the wiki')
    .option('-v, --verbose', 'Verbose output')
    .action(async (source: string, opts: { verbose?: boolean }) => {
      try {
        const wikiDir = join(process.cwd(), '.bobo', 'wiki');
        if (!existsSync(wikiDir)) {
          printError('Wiki not initialized. Run: bobo wiki init');
          process.exit(1);
        }

        printLine(chalk.cyan.bold('\n📖 Ingesting source...\n'));
        if (opts.verbose) {
          printLine(chalk.dim(`Source: ${source}`));
        }

        const result = await ingestSource(source, { wikiDir, verbose: opts.verbose });

        printSuccess('Ingestion complete!');
        printLine(chalk.dim(`  Source page: ${result.sourcePage}`));
        if (result.pagesCreated.length > 0) {
          printLine(chalk.green(`  Created: ${result.pagesCreated.length} pages`));
          if (opts.verbose) {
            result.pagesCreated.forEach(p => printLine(chalk.dim(`    • ${p}`)));
          }
        }
        if (result.pagesUpdated.length > 0) {
          printLine(chalk.yellow(`  Updated: ${result.pagesUpdated.length} pages`));
          if (opts.verbose) {
            result.pagesUpdated.forEach(p => printLine(chalk.dim(`    • ${p}`)));
          }
        }
      } catch (e) {
        printError((e as Error).message);
        process.exit(1);
      }
    });

  wiki
    .command('query <question>')
    .description('Query the wiki with LLM synthesis')
    .option('-v, --verbose', 'Verbose output')
    .action(async (question: string, opts: { verbose?: boolean }) => {
      try {
        const wikiDir = join(process.cwd(), '.bobo', 'wiki');
        if (!existsSync(wikiDir)) {
          printError('Wiki not initialized. Run: bobo wiki init');
          process.exit(1);
        }

        printLine(chalk.cyan.bold('\n🔍 Querying wiki...\n'));

        const result = await queryWiki(question, { wikiDir, verbose: opts.verbose });

        printLine(chalk.bold('Answer:'));
        printLine(result.answer);

        if (result.sources.length > 0) {
          printLine(chalk.dim('\nSources:'));
          result.sources.forEach(s => printLine(chalk.dim(`  • [[${s}]]`)));
        }

        if (result.suggestedPageTitle) {
          printLine(chalk.yellow(`\n💡 Tip: Save this as: ${result.suggestedPageTitle}`));
        }
      } catch (e) {
        printError((e as Error).message);
        process.exit(1);
      }
    });

  wiki
    .command('lint')
    .description('Health-check the wiki')
    .action(async () => {
      try {
        const wikiDir = join(process.cwd(), '.bobo', 'wiki');
        if (!existsSync(wikiDir)) {
          printError('Wiki not initialized. Run: bobo wiki init');
          process.exit(1);
        }

        printLine(chalk.cyan.bold('\n🔧 Linting wiki...\n'));

        const result = await lintWiki(wikiDir);

        if (result.issues.length === 0) {
          printSuccess('Wiki health check passed! No issues found.');
        } else {
          printWarning(`Found ${result.issues.length} issues:`);
          printLine();

          const issuesByType = new Map<string, string[]>();
          for (const issue of result.issues) {
            if (!issuesByType.has(issue.type)) {
              issuesByType.set(issue.type, []);
            }
            issuesByType.get(issue.type)!.push(`${issue.page}: ${issue.description}`);
          }

          for (const [type, issues] of issuesByType.entries()) {
            printLine(chalk.bold(`  ${type.toUpperCase()}:`));
            issues.forEach(i => printLine(chalk.dim(`    • ${i}`)));
            printLine();
          }
        }

        if (result.orphanPages.length > 0) {
          printLine(chalk.yellow(`Orphan pages: ${result.orphanPages.length}`));
        }

        if (result.missingLinks.length > 0) {
          printLine(chalk.yellow(`Broken links: ${result.missingLinks.length}`));
        }
      } catch (e) {
        printError((e as Error).message);
        process.exit(1);
      }
    });

  wiki
    .command('index')
    .description('Rebuild index.md from all pages')
    .action(async () => {
      try {
        const wikiDir = join(process.cwd(), '.bobo', 'wiki');
        if (!existsSync(wikiDir)) {
          printError('Wiki not initialized. Run: bobo wiki init');
          process.exit(1);
        }

        await rebuildIndex(wikiDir);
        printSuccess('Index rebuilt!');
        printLine(chalk.dim(`  Location: ${join(wikiDir, 'index.md')}`));
      } catch (e) {
        printError((e as Error).message);
        process.exit(1);
      }
    });

  wiki
    .command('stats')
    .description('Show wiki statistics')
    .action(() => {
      try {
        const wikiDir = join(process.cwd(), '.bobo', 'wiki');
        if (!existsSync(wikiDir)) {
          printError('Wiki not initialized. Run: bobo wiki init');
          process.exit(1);
        }

        const stats = getWikiStats(wikiDir);

        printLine(chalk.cyan.bold('\n📊 Wiki Statistics\n'));
        printLine(`  Total pages:   ${chalk.bold(String(stats.totalPages))}`);
        printLine(`  Total sources: ${chalk.bold(String(stats.totalSources))}`);
        printLine(`  Last updated:  ${chalk.dim(stats.lastUpdated)}`);
        printLine();

        if (Object.keys(stats.byType).length > 0) {
          printLine(chalk.bold('  Pages by type:'));
          for (const [type, count] of Object.entries(stats.byType)) {
            const icon = getTypeIcon(type);
            printLine(`    ${icon} ${type.padEnd(12)} ${chalk.cyan(String(count))}`);
          }
        }
        printLine();
      } catch (e) {
        printError((e as Error).message);
        process.exit(1);
      }
    });

  wiki
    .command('search <keyword>')
    .description('Search wiki pages by keyword')
    .action((keyword: string) => {
      try {
        const wikiDir = join(process.cwd(), '.bobo', 'wiki');
        if (!existsSync(wikiDir)) {
          printError('Wiki not initialized. Run: bobo wiki init');
          process.exit(1);
        }

        const results = searchWiki(keyword, wikiDir);

        if (results.length === 0) {
          printLine(chalk.dim(`No results found for: "${keyword}"`));
          return;
        }

        printLine(chalk.cyan.bold(`\n🔍 Search results for "${keyword}":\n`));

        for (const result of results) {
          printLine(chalk.bold(`  ${result.page}`));
          result.matches.forEach(match => {
            const highlighted = match.replace(
              new RegExp(keyword, 'gi'),
              (m) => chalk.yellow(m)
            );
            printLine(chalk.dim(`    ${highlighted}`));
          });
          printLine();
        }

        printLine(chalk.dim(`Found ${results.length} pages`));
      } catch (e) {
        printError((e as Error).message);
        process.exit(1);
      }
    });

  wiki
    .command('log [n]')
    .description('Show recent N log entries (default: 10)')
    .action((n?: string) => {
      try {
        const wikiDir = join(process.cwd(), '.bobo', 'wiki');
        if (!existsSync(wikiDir)) {
          printError('Wiki not initialized. Run: bobo wiki init');
          process.exit(1);
        }

        const count = n ? parseInt(n, 10) : 10;
        const logs = getRecentLogs(wikiDir, count);

        if (logs.length === 0) {
          printLine(chalk.dim('No log entries yet.'));
          return;
        }

        printLine(chalk.cyan.bold('\n📝 Wiki Log\n'));
        logs.forEach(entry => printLine(entry + '\n'));
      } catch (e) {
        printError((e as Error).message);
        process.exit(1);
      }
    });
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'entity': return '👤';
    case 'concept': return '💡';
    case 'source': return '📄';
    case 'comparison': return '⚖️';
    case 'analysis': return '🔬';
    default: return '📌';
  }
}
