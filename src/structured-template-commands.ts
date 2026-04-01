import { Command } from 'commander';
import chalk from 'chalk';
import { registerTemplateProjectSubcommand } from './structured-skills-commands.js';

export function registerStructuredTemplateCommand(program: Command) {
  const template = program.command('template').description('结构化模板生成');

  template
    .command('skill')
    .description('生成结构化技能模板')
    .option('-n, --name <name>', '技能名称')
    .action((opts: { name?: string }) => {
      const name = opts.name || 'my-new-skill';
      const title = name.replace(/-/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
      console.log(chalk.green('Skill scaffold:'));
      console.log(chalk.dim('─'.repeat(40)));
      console.log(`---\nid: ${name}\ntitle: "${title}"\ncategory: other\ntags: []\ntriggers: []\ndependencies: []\n---\n\n# ${title}\n\nDescribe what this skill does and when to trigger it.\n`);
      console.log(chalk.dim('─'.repeat(40)));
      console.log(chalk.dim(`Save to: .claude/skills/${name}/SKILL.md`));
    });

  template
    .command('rule')
    .description('生成结构化规则模板')
    .option('-n, --name <name>', '规则名称')
    .action((opts: { name?: string }) => {
      const name = opts.name || 'my-new-rule';
      const title = name.replace(/-/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
      console.log(chalk.green('Rule scaffold:'));
      console.log(chalk.dim('─'.repeat(40)));
      console.log(`---\nid: ${name}\ntitle: "${title}"\ncategory: domain\ntags: []\n---\n\n# ${title}\n\nDescribe the rule and when it applies.\n`);
      console.log(chalk.dim('─'.repeat(40)));
      console.log(chalk.dim(`Save to: .claude/rules/domain/${name}.md`));
    });

  registerTemplateProjectSubcommand(template);

  return template;
}
