import { existsSync, readFileSync } from 'node:fs';
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

// Does this agent live on a machine the person keeps, or in a cloud workspace
// that is handed back when the task ends?
//
// It matters because `init` writes into the home directory. On a kept machine
// that is permanent. In a cloud workspace (Codex cloud, Claude Code on the
// web) the whole container is destroyed afterwards, so the install, the skills
// and the signed-in key all go with it and the person starts over every time.
// Those users want the hosted connector instead, which needs no install.
//
// Deliberately conservative and signal-based rather than a list of brand env
// vars we would have to guess at and keep current. Returns the reason so the
// message can say WHY, instead of asserting something the person cannot check.
export function detectEphemeral() {
  // Anything the platforms do tell us, checked first and cheaply.
  for (const key of ['CODEX_SANDBOX', 'CODEX_SANDBOX_NETWORK_DISABLED', 'CLAUDE_CODE_CLOUD', 'ANTHROPIC_CLOUD_WORKSPACE']) {
    if (process.env[key]) return { ephemeral: true, reason: `${key} is set` };
  }
  // Containers. Covers both cloud agents today without naming either.
  if (process.platform === 'linux') {
    if (existsSync('/.dockerenv')) return { ephemeral: true, reason: 'running inside a container' };
    try {
      const cg = readFileSync('/proc/1/cgroup', 'utf8');
      if (/docker|containerd|kubepods|lxc/.test(cg)) return { ephemeral: true, reason: 'running inside a container' };
    } catch {
      // /proc unreadable: fall through, this is a hint not a gate
    }
    if (process.getuid?.() === 0 && home === '/root') {
      return { ephemeral: true, reason: 'running as root in a throwaway home directory' };
    }
  }
  return { ephemeral: false, reason: null };
}
