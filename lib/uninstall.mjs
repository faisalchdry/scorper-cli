// Remove everything Scorper added, and only that.
import { rmSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { detectAgents } from './detect.mjs';
import { removeScorperHooks } from './hooks.mjs';
import { SCORPER_DIR } from './config.mjs';

export function uninstallAll({ dryRun = false, log = console.log } = {}) {
  const agents = detectAgents();
  const skillDirs = [...new Set(agents.map((a) => a.skillsDir).filter(Boolean))];
  const shared = join(homedir(), '.agents', 'skills');
  if (!skillDirs.includes(shared)) skillDirs.push(shared);

  const targets = [];
  for (const dir of skillDirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name === 'scorper' || name.startsWith('scorper-')) targets.push(join(dir, name));
    }
  }
  targets.push(SCORPER_DIR);

  if (dryRun) {
    for (const t of targets) log(`[dry-run] remove: ${t}`);
    for (const a of agents) if (a.settingsFile) log(`[dry-run] strip scorper hooks from: ${a.settingsFile}`);
    return { targets, dryRun: true };
  }

  for (const t of targets) rmSync(t, { recursive: true, force: true });
  const hookResults = [];
  for (const a of agents) {
    if (a.settingsFile) hookResults.push({ agent: a.id, changed: removeScorperHooks(a.settingsFile) });
  }
  return { targets, hookResults };
}
