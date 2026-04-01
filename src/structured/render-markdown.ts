import chalk from "chalk";
import pkg from "../../package.json" with { type: "json" };

const badgeColors = {
  rule: chalk.cyan,
  skill: chalk.green,
  workflow: chalk.magenta,
  memory: chalk.yellow,
} as const;

export function getCliVersion(): string {
  return pkg.version;
}

export function renderRule(rule: { id: string; title: string; category: string; tags: string[]; content: string }) {
  console.log(chalk.bold.cyan(`\n# ${rule.title}`));
  console.log(chalk.dim(`ID: ${rule.id} | Category: ${rule.category} | Tags: ${rule.tags.join(", ")}`));
  console.log(chalk.dim("─".repeat(60)));
  console.log(rule.content);
}

export function renderSkill(skill: { id: string; title: string; category: string; tags: string[]; triggers: string[]; content: string }) {
  console.log(chalk.bold.green(`\n# ${skill.title}`));
  console.log(chalk.dim(`ID: ${skill.id} | Category: ${skill.category} | Tags: ${skill.tags.join(", ")}`));
  if (skill.triggers?.length) {
    console.log(chalk.dim(`Triggers: ${skill.triggers.join(", ")}`));
  }
  console.log(chalk.dim("─".repeat(60)));
  console.log(skill.content);
}

export function renderWorkflow(wf: { id: string; title: string; type: string; triggers: string[]; steps: Array<{ name: string; description: string; action: string; dependsOn: string[] }>; checklist: string[] }) {
  console.log(chalk.bold.magenta(`\n# ${wf.title}`));
  console.log(chalk.dim(`ID: ${wf.id} | Type: ${wf.type} | Triggers: ${wf.triggers.join(", ")}`));
  console.log(chalk.dim("─".repeat(60)));
  wf.steps.forEach((step, i) => {
    const deps = step.dependsOn.length > 0 ? chalk.dim(` (after: ${step.dependsOn.join(", ")})`) : "";
    console.log(`  ${chalk.bold(i + 1)}. ${step.name}${deps}`);
    console.log(`     ${chalk.dim(step.description)}`);
  });
  if (wf.checklist?.length) {
    console.log(chalk.dim("\nChecklist:"));
    wf.checklist.forEach(item => console.log(`  ${chalk.dim("[ ]")} ${item}`));
  }
}

export function renderSearchResult(result: { id: string; type: string; title: string; score: number; snippet: string; category: string }) {
  const badgeColor = badgeColors[result.type as keyof typeof badgeColors] ?? chalk.white;
  const badge = badgeColor(`[${result.type}]`);
  console.log(`  ${badge} ${chalk.bold(result.title)} ${chalk.dim(`(${result.category})`)}`);
  console.log(`    ${chalk.dim(result.snippet)}`);
}
