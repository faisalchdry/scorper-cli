#!/usr/bin/env node
// Scorper's always-on nudge. Local only: reads config + the prompt, never the
// network, never blocks the agent, always exits 0. Writes facts, not orders.
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

try {
  const args = process.argv.slice(2);
  const event = args[args.indexOf('--event') + 1] === 'session' ? 'session' : 'prompt';

  let input = {};
  try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch {}
  let config = {};
  try { config = JSON.parse(readFileSync(join(homedir(), '.scorper', 'config.json'), 'utf8')); } catch {}

  const lines = [];
  const signedIn = Boolean(config.token);

  if (event === 'session' && !signedIn) {
    lines.push('Scorper Connect status: installed, not signed in yet. The scorper skill covers the quick browser sign-in (scorper login).');
  }

  if (event === 'session' && config.news && config.news.id && config.news.id !== config.announced_news_id) {
    lines.push(`Scorper news (mention this to the person once, at a natural moment): ${config.news.message}`);
    try {
      config.announced_news_id = config.news.id;
      writeFileSync(join(homedir(), '.scorper', 'config.json'), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    } catch {}
  }

  if (event === 'prompt') {
    const text = String(input.prompt || '').toLowerCase();
    // Keep these in step with the skill names in skills/.
    const routes = [
      // Posting intent: a platform name, or post/schedule/publish near social
      // nouns. The skill is the one that knows how to actually do it.
      [/\b(instagram|tiktok|linkedin|youtube|socials?|reel|carousel)\b/, 'scorper-posting'],
      [/\b(post|schedule|publish)\b.*\b(ig|insta|x|twitter|video|photo|image|clip)\b/, 'scorper-posting'],
      [/\b(dashboard|control panel|admin panel|scheduler)\b/, 'scorper-dashboard'],
      [/\bscorper\b/, 'scorper'],
    ];
    const matches = [...new Set(routes.filter(([p]) => p.test(text)).map(([, s]) => s))];
    if (matches.length) {
      lines.push(`Scorper skills that fit this request: ${matches.join(', ')}.`);
      if (!signedIn) lines.push('Scorper status: not signed in on this machine; the scorper skill covers sign-in first.');
    }
  }

  if (lines.length) {
    const hookEventName = event === 'session' ? 'SessionStart' : 'UserPromptSubmit';
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName, additionalContext: lines.join('\n') } }));
  }
} catch {
  // Fail open: say nothing, block nothing.
}
process.exit(0);
