import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, delimiter } from 'node:path';

const home = homedir();

function onPath(command) {
  const dirs = (process.env.PATH || '').split(delimiter);
  const exts = process.platform === 'win32' ? ['.cmd', '.exe', ''] : [''];
  return dirs.some((dir) => dir && exts.some((ext) => existsSync(join(dir, command + ext))));
}

export function detectAgents() {
  const codexHome = process.env.CODEX_HOME || join(home, '.codex');
  return [
    {
      id: 'claude-code',
      name: 'Claude Code',
      found: existsSync(join(home, '.claude')) || onPath('claude') || process.env.CLAUDECODE === '1',
      runningInside: process.env.CLAUDECODE === '1',
      skillsDir: join(home, '.claude', 'skills'),
      settingsFile: join(home, '.claude', 'settings.json'),
    },
    {
      id: 'codex',
      name: 'Codex',
      found: existsSync(codexHome) || onPath('codex'),
      skillsDir: join(home, '.agents', 'skills'),
      settingsFile: join(codexHome, 'hooks.json'),
      codexHome,
    },
    {
      id: 'gemini',
      name: 'Gemini CLI',
      found: existsSync(join(home, '.gemini')) || onPath('gemini'),
      skillsDir: join(home, '.agents', 'skills'),
    },
    {
      id: 'cursor',
      name: 'Cursor',
      found: existsSync(join(home, '.cursor')),
      skillsDir: join(home, '.agents', 'skills'),
    },
  ];
}
