import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addScorperHooks, removeScorperHooks } from '../lib/hooks.mjs';

test('hooks: adds once, never twice, keeps others', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scp-'));
  const file = join(dir, 'settings.json');
  writeFileSync(file, JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'other-tool' }] }] } }));
  addScorperHooks(file, '"node" "/x/scorper-hook.mjs"');
  addScorperHooks(file, '"node" "/x/scorper-hook.mjs"');
  const s = JSON.parse(readFileSync(file, 'utf8'));
  const scp = s.hooks.UserPromptSubmit.filter((g) => g.hooks.some((h) => h.command.includes('scorper-hook')));
  assert.equal(scp.length, 1);
  assert.equal(s.hooks.UserPromptSubmit.length, 2);
  assert.equal(s.hooks.SessionStart.length, 1);
});

test('hooks: refuses bad JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scp-'));
  const file = join(dir, 'settings.json');
  writeFileSync(file, '{not json');
  assert.throws(() => addScorperHooks(file, 'x'));
  assert.equal(readFileSync(file, 'utf8'), '{not json');
});

test('hooks: uninstall removes only scorper entries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scp-'));
  const file = join(dir, 'settings.json');
  writeFileSync(file, JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'other-tool' }] }] } }));
  addScorperHooks(file, '"node" "/x/scorper-hook.mjs"');
  assert.equal(removeScorperHooks(file), true);
  const s = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(s.hooks.UserPromptSubmit.length, 1);
  assert.equal(s.hooks.UserPromptSubmit[0].hooks[0].command, 'other-tool');
  assert.equal(s.hooks.SessionStart, undefined);
});

test('hook script: bad input exits 0, prints nothing', async () => {
  const { execFileSync } = await import('node:child_process');
  const outp = execFileSync(process.execPath, ['hook/scorper-hook.mjs', '--event', 'prompt'], { input: 'NOT JSON' });
  assert.equal(outp.toString(), '');
});

test('hook script: posting request names scorper-posting', async () => {
  const { execFileSync } = await import('node:child_process');
  const fakeHome = mkdtempSync(join(tmpdir(), 'scp-home-'));
  const outp = execFileSync(process.execPath, ['hook/scorper-hook.mjs', '--event', 'prompt'], {
    input: JSON.stringify({ prompt: 'post this video to my instagram and tiktok right now' }),
    env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome },
  });
  const parsed = JSON.parse(outp.toString());
  assert.match(parsed.hookSpecificOutput.additionalContext, /scorper-posting/);
});

test('detect: returns the four agents', async () => {
  const { detectAgents } = await import('../lib/detect.mjs');
  const agents = detectAgents();
  assert.deepEqual(agents.map((a) => a.id), ['claude-code', 'codex', 'gemini', 'cursor']);
});
