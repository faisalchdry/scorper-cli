// Merge Scorper's hooks into an agent's settings file. Backup first, merge
// never replace, find our entries by the marker 'scorper-hook'.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';

const MARK = 'scorper-hook';

export function addScorperHooks(file, hookCommand) {
  let settings = {};
  if (existsSync(file)) {
    settings = JSON.parse(readFileSync(file, 'utf8')); // throws on bad JSON: caller stops, never overwrites
    const stamp = new Date().toISOString().slice(0, 10);
    copyFileSync(file, `${file}.scorper-backup-${stamp}`);
  }
  settings.hooks ??= {};
  const add = (event, args, extra = {}) => {
    const list = (settings.hooks[event] ??= []);
    const already = list.some((group) => (group.hooks || []).some((h) => String(h.command || '').includes(MARK)));
    if (!already) list.push({ ...extra, hooks: [{ type: 'command', command: `${hookCommand} ${args}`, timeout: 5 }] });
  };
  add('SessionStart', '--event session', { matcher: 'startup|resume' });
  add('UserPromptSubmit', '--event prompt');
  writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
}

export function removeScorperHooks(file) {
  if (!existsSync(file)) return false;
  let settings;
  try { settings = JSON.parse(readFileSync(file, 'utf8')); } catch { return false; }
  if (!settings.hooks) return false;
  let changed = false;
  for (const event of Object.keys(settings.hooks)) {
    const before = settings.hooks[event].length;
    settings.hooks[event] = settings.hooks[event].filter(
      (group) => !(group.hooks || []).some((h) => String(h.command || '').includes(MARK))
    );
    if (settings.hooks[event].length !== before) changed = true;
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  if (changed) writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return changed;
}
