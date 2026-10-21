// ~/.scorper/config.json — who this install is. Owner-only permissions.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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
