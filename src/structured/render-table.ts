import chalk from "chalk";

export function renderTable(headers: string[], rows: string[][]) {
  const colWidths = headers.map((h, i) => {
    const maxRowLen = Math.max(...rows.map(r => r[i]?.length || 0));
    return Math.max(h.length, maxRowLen);
  });

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join("  ");
  console.log(chalk.bold(headerLine));
  console.log(chalk.dim("─".repeat(headerLine.length)));

  for (const row of rows) {
    const line = row.map((cell, i) => (cell || "").padEnd(colWidths[i])).join("  ");
    console.log(line);
  }
}
