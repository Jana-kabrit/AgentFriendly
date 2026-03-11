/**
 * CLI output helpers using picocolors for consistent, color-coded output.
 */
import pc from "picocolors";

export function header(text: string): void {
  console.log("");
  console.log(pc.bold(pc.cyan(`  🤖 ${text}`)));
  console.log(pc.dim("  " + "─".repeat(Math.min(text.length + 4, 60))));
}

export function success(text: string): void {
  console.log(`  ${pc.green("✓")} ${text}`);
}

export function warn(text: string): void {
  console.log(`  ${pc.yellow("⚠")} ${text}`);
}

export function error(text: string): void {
  console.log(`  ${pc.red("✗")} ${text}`);
}

export function info(text: string): void {
  console.log(`  ${pc.blue("·")} ${text}`);
}

export function label(key: string, value: string): void {
  console.log(`    ${pc.dim(key.padEnd(22))} ${pc.white(value)}`);
}

export function divider(): void {
  console.log("");
}

export function badge(tier: string): string {
  const colors: Record<string, (s: string) => string> = {
    "human": pc.dim,
    "suspected-agent": pc.yellow,
    "known-agent": pc.cyan,
    "verified-agent": pc.green,
  };
  const colorFn = colors[tier] ?? pc.white;
  return colorFn(`[${tier}]`);
}
