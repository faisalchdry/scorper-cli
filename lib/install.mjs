// Copies skills, the hook and the CLI itself into place, and wires hooks.
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectAgents } from './detect.mjs';
import { addScorperHooks } from './hooks.mjs';
import { SCORPER_DIR, readConfig, writeConfig, ensureInstallId } from './config.mjs';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function packageVersion() {
  try { return JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')).version; } catch { return '0.0.0'; }
}

export function installAll({ dryRun = false, log = console.log } = {}) {
  const agents = detectAgents().filter((a) => a.found);
  const actions = [];
  const cliHome = join(SCORPER_DIR, 'cli');
  const hookFile = join(SCORPER_DIR, 'scorper-hook.mjs');
  const cliEntry = join(cliHome, 'bin', 'scorper.mjs');
  const hookCommand = `"${process.execPath}" "${hookFile}"`;

  actions.push(['copy', `${PKG_ROOT} -> ${cliHome}`]);
  actions.push(['copy', `hook -> ${hookFile}`]);

  const skillNames = readdirSync(join(PKG_ROOT, 'skills'));
  const skillDirs = [...new Set(agents.map((a) => a.skillsDir).filter(Boolean))];
  // Always install to the shared standard folder too.
  const shared = join(homedir(), '.agents', 'skills');
  if (!skillDirs.includes(shared)) skillDirs.push(shared);
  for (const dir of skillDirs) {
    for (const name of skillNames) actions.push(['skill', join(dir, name)]);
  }
  for (const a of agents) {
    if (a.settingsFile) actions.push(['hooks', a.settingsFile]);
  }

  if (dryRun) {
    for (const [kind, what] of actions) log(`[dry-run] ${kind}: ${what}`);
    return { agents, actions, dryRun: true };
  }

  mkdirSync(SCORPER_DIR, { recursive: true, mode: 0o700 });
  cpSync(PKG_ROOT, cliHome, {
    recursive: true,
    // Filter on the path RELATIVE to the package root: when run via npx the
    // package itself sits inside a node_modules directory.
    filter: (src) => !/node_modules|\.git\b|\.tgz$/.test(src.slice(PKG_ROOT.length)),
  });
  cpSync(join(PKG_ROOT, 'hook', 'scorper-hook.mjs'), hookFile);

  for (const dir of skillDirs) {
    for (const name of skillNames) {
      const dest = join(dir, name);
      mkdirSync(dest, { recursive: true });
      cpSync(join(PKG_ROOT, 'skills', name), dest, { recursive: true });
      // Fill in the absolute CLI path so skills work on every platform.
      const skillFile = join(dest, 'SKILL.md');
      if (existsSync(skillFile)) {
        const content = readFileSync(skillFile, 'utf8').replaceAll('{{SCORPER_CLI}}', `"${process.execPath}" "${cliEntry}"`);
        writeFileSync(skillFile, content);
      }
    }
  }

  const hookResults = [];
  for (const a of agents) {
    if (!a.settingsFile) continue;
    try {
      mkdirSync(dirname(a.settingsFile), { recursive: true });
      addScorperHooks(a.settingsFile, hookCommand);
      hookResults.push({ agent: a.id, ok: true });
    } catch (err) {
      hookResults.push({ agent: a.id, ok: false, error: String(err.message || err) });
    }
  }

  ensureInstallId();
  const config = readConfig();
  config.cli_version = packageVersion();
  config.agents = agents.map((a) => a.id);
  writeConfig(config);

  return { agents, actions, hookResults, cliEntry };
}
