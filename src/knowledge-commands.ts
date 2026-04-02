import { Command } from 'commander';
import chalk from 'chalk';
import { KnowledgeLoader } from './structured/loader.js';
import { KnowledgeSearch } from './structured/search.js';
import { getStructuredKnowledgePath } from './structured/paths.js';
import { renderSearchResult } from './structured/render-markdown.js';

export function registerKnowledgeCommand(program: Command) {
  const kb = program.command('kb').description('Structured knowledge base operations');

  kb
    .command('search <query>')
    .description('Search structured knowledge base')
    .action(async (query: string) => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const search = new KnowledgeSearch(loader);
      const results = await search.search(query);
      if (results.length === 0) {
        console.log(chalk.dim('No results found.'));
        return;
      }
      results.forEach(renderSearchResult);
      console.log(chalk.dim(`\n${results.length} results`));
    });

  kb
    .command('stats')
    .description('Show structured knowledge base stats')
    .action(async () => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const index = await loader.loadIndex();
      console.log(chalk.bold('\nKnowledge Base Statistics'));
      console.log(chalk.dim('─'.repeat(30)));
      console.log(`  Version:     ${index.version}`);
      console.log(`  Extracted:   ${index.extractedAt}`);
      console.log(`  Rules:       ${chalk.cyan(String(index.stats.totalRules))}`);
      console.log(`  Skills:      ${chalk.green(String(index.stats.totalSkills))}`);
      console.log(`  Workflows:   ${chalk.magenta(String(index.stats.totalWorkflows))}`);
      console.log(`  Memory:      ${chalk.yellow(String(index.stats.totalMemory))}`);
      console.log(`  Total Size:  ${index.stats.totalSize}`);
    });

  return kb;
}
