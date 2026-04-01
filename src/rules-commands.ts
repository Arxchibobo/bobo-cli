import { Command } from 'commander';
import chalk from 'chalk';
import { KnowledgeLoader } from './structured/loader.js';
import { KnowledgeSearch } from './structured/search.js';
import { getStructuredKnowledgePath } from './structured/paths.js';
import { renderRule, renderSearchResult } from './structured/render-markdown.js';
import { renderTable } from './structured/render-table.js';

export function registerRulesCommand(program: Command) {
  const rules = program.command('rules').description('结构化规则浏览');

  rules
    .command('list')
    .description('列出所有规则')
    .option('-c, --category <cat>', '按分类过滤')
    .action(async (opts: { category?: string }) => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const all = await loader.listRules();
      const filtered = opts.category ? all.filter((rule) => rule.category === opts.category) : all;
      if (filtered.length === 0) {
        console.log(chalk.dim('No rules found.'));
        return;
      }
      renderTable(
        ['ID', 'Title', 'Category', 'Tags'],
        filtered.map((rule) => [rule.id, rule.title, rule.category, rule.tags.join(', ')])
      );
      console.log(chalk.dim(`\n${filtered.length} rules`));
    });

  rules
    .command('show <id>')
    .description('显示规则全文')
    .action(async (id: string) => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const rule = await loader.loadRule(id);
      if (!rule) {
        console.log(chalk.red(`Rule not found: ${id}`));
        process.exit(1);
      }
      renderRule(rule);
    });

  rules
    .command('search <query>')
    .description('搜索规则')
    .action(async (query: string) => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const search = new KnowledgeSearch(loader);
      const results = await search.searchByType(query, 'rule');
      if (results.length === 0) {
        console.log(chalk.dim('No matching rules.'));
        return;
      }
      results.forEach(renderSearchResult);
    });

  return rules;
}
