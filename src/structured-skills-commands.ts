import { Command } from 'commander';
import chalk from 'chalk';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { KnowledgeLoader } from './structured/loader.js';
import { KnowledgeSearch } from './structured/search.js';
import { SkillRunner } from './structured/skill-runner.js';
import { createProjectScaffold } from './structured/project-scaffold.js';
import { getStructuredKnowledgePath } from './structured/paths.js';
import { renderSearchResult, renderSkill } from './structured/render-markdown.js';
import { renderTable } from './structured/render-table.js';

export function registerStructuredSkillsCommand(program: Command) {
  const skills = program.command('skills').description('Browse and compose structured skills');

  skills
    .command('list')
    .description('List structured skills')
    .option('-c, --category <cat>', '按分类过滤')
    .action(async (opts: { category?: string }) => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const all = await loader.listSkills();
      const filtered = opts.category ? all.filter((skill) => skill.category === opts.category) : all;
      if (filtered.length === 0) {
        console.log(chalk.dim('No skills found.'));
        return;
      }
      renderTable(
        ['ID', 'Title', 'Category', 'Tags'],
        filtered.map((skill) => [skill.id, skill.title, skill.category, skill.tags.join(', ')])
      );
      console.log(chalk.dim(`\n${filtered.length} skills`));
    });

  skills
    .command('show <id>')
    .description('Show full skill content')
    .action(async (id: string) => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const skill = await loader.loadSkill(id);
      if (!skill) {
        console.log(chalk.red(`Skill not found: ${id}`));
        process.exit(1);
      }
      renderSkill(skill);
    });

  skills
    .command('search <query>')
    .description('Search structured skills')
    .action(async (query: string) => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const search = new KnowledgeSearch(loader);
      const results = await search.searchByType(query, 'skill');
      if (results.length === 0) {
        console.log(chalk.dim('No matching skills.'));
        return;
      }
      results.forEach(renderSearchResult);
    });

  skills
    .command('deps <id>')
    .description('Show skill dependency order')
    .action(async (id: string) => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const runner = new SkillRunner(loader);
      const resolved = await runner.resolveDependencies(id);
      console.log(chalk.bold(`\nDependency order for ${id}`));
      resolved.forEach((skill, index) => {
        console.log(`  ${index + 1}. ${skill.id}`);
      });
    });

  skills
    .command('bundle <id>')
    .description('构建技能依赖 bundle')
    .action(async (id: string) => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const runner = new SkillRunner(loader);
      const bundle = await runner.buildBundle(id);
      console.log(chalk.bold(`\nRoot: ${bundle.root.id}`));
      console.log(chalk.dim(`Dependencies: ${bundle.dependencies.map((skill) => skill.id).join(', ') || 'none'}`));
      console.log(chalk.dim('─'.repeat(60)));
      console.log(bundle.combinedContent);
    });

  skills
    .command('export <id>')
    .description('Export structured skill as markdown')
    .option('-o, --output <file>', '输出文件路径')
    .action(async (id: string, opts: { output?: string }) => {
      const loader = new KnowledgeLoader(getStructuredKnowledgePath());
      const runner = new SkillRunner(loader);
      const markdown = await runner.exportSkill(id);

      if (!opts.output) {
        console.log(markdown);
        return;
      }

      await mkdir(dirname(opts.output), { recursive: true });
      await writeFile(opts.output, markdown, 'utf-8');
      console.log(chalk.green(`Exported ${id} to ${opts.output}`));
    });

  skills
    .command('import <file>')
    .description('Import skill markdown into knowledge base')
    .action(async (file: string) => {
      const raw = await readFile(file, 'utf-8');
      const parsed = matter(raw);
      const skillId = parsed.data.id;

      if (!skillId) {
        console.log(chalk.red('Imported skill is missing frontmatter id.'));
        process.exit(1);
      }

      const outputPath = join(getStructuredKnowledgePath(), 'skills', `${skillId}.md`);
      await writeFile(outputPath, raw, 'utf-8');
      console.log(chalk.green(`Imported skill ${skillId} to ${outputPath}`));
    });

  return skills;
}

export function registerTemplateProjectSubcommand(template: Command) {
  template
    .command('project')
    .description('生成 .claude 项目脚手架')
    .requiredOption('-d, --dir <dir>', '目标项目目录')
    .option('-n, --name <name>', '项目名称', 'My Project')
    .action(async (opts: { dir: string; name: string }) => {
      const created = await createProjectScaffold({
        targetDir: opts.dir,
        projectName: opts.name,
      });

      console.log(chalk.green(`Generated project scaffold in ${opts.dir}`));
      created.forEach((file) => console.log(chalk.dim(`  - ${file}`)));
    });
}
