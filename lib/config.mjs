// ~/.scorper/config.json, who this install is. Owner-only permissions.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const SCORPER_DIR = join(homedir(), '.scorper');
const CONFIG = join(SCORPER_DIR, 'config.json');

export function readConfig() {
  try { return JSON.parse(readFileSync(CONFIG, 'utf8')); } catch { return {}; }
}

export function writeConfig(config) {
  mkdirSync(SCORPER_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

export function ensureInstallId() {
  const config = readConfig();
  if (!config.install_id) {
    config.install_id = randomUUID();
    writeConfig(config);
  }
  return config.install_id;
}

// Which copy of the CLI is actually running, and when it was put there.
// `npx scorper@latest init` copies the package into ~/.scorper/cli and agents
// then run THAT copy directly. So when a later `npx` fails (no network in an
// agent sandbox) the old copy stays and keeps being used, silently. Faisal hit
// exactly this on 2026-11-06: a 0.2.2 install from 13 days earlier kept
// answering while `npx scorper@latest` could not reach npm at all.
export function installInfo() {
  const config = readConfig();
  let version = null;
  try {
    version = JSON.parse(readFileSync(join(SCORPER_DIR, 'cli', 'package.json'), 'utf8')).version;
  } catch {
    // not installed via init (running straight from npx), nothing to report
  }
  let installedAt = config.installed_at || null;
  if (!installedAt) {
    try { installedAt = statSync(join(SCORPER_DIR, 'cli')).mtime.toISOString(); } catch {}
  }
  return { version, installedAt };
}

export function stampInstall(version) {
  const config = readConfig();
  config.installed_at = new Date().toISOString();
  config.installed_version = version;
  writeConfig(config);
}

/** Cached once a day so no command pays for this more than that. */
export function readUpdateCheck() {
  const { update_check } = readConfig();
  if (!update_check?.at) return null;
  if (Date.now() - new Date(update_check.at).getTime() > 86400000) return null;
  return update_check.latest || null;
}

export function writeUpdateCheck(latest) {
  const config = readConfig();
  config.update_check = { at: new Date().toISOString(), latest };
  writeConfig(config);
}
