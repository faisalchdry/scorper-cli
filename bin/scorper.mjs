#!/usr/bin/env node
// scorper, Scorper Connect inside any AI agent. Post and schedule to your
// connected socials from Claude Code, Codex, Cursor and friends.
import { parseArgs } from 'node:util';
import { createReadStream, statSync } from 'node:fs';
import { basename, resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { api, API_BASE } from '../lib/api.mjs';
import { readConfig, writeConfig, ensureInstallId } from '../lib/config.mjs';
import { installAll, installCliDeps, packageVersion } from '../lib/install.mjs';
import { uninstallAll } from '../lib/uninstall.mjs';
import { detectAgents } from '../lib/detect.mjs';
import { openUrl } from '../lib/open.mjs';

const [, , command = 'help', ...rest] = process.argv;
const { values: flags, positionals } = parseArgs({
  args: rest,
  options: {
    'dry-run': { type: 'boolean', default: false },
    json: { type: 'boolean', default: false },
    tool: { type: 'string' },
    args: { type: 'string' },
    account: { type: 'string' },
    workspace: { type: 'string' },
    'no-wait': { type: 'boolean', default: false },
  },
  allowPositionals: true,
  strict: false,
});

const out = (s) => process.stdout.write(s + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cacheServerExtras(s) {
  try {
    const config = readConfig();
    let changed = false;
    if (s.news && s.news.id !== (config.news && config.news.id)) { config.news = s.news; changed = true; }
    if (!s.news && config.news) { delete config.news; changed = true; }
    if (changed) writeConfig(config);
  } catch {}
}

async function fetchStatus() {
  const s = await api('/api/cli/status');
  cacheServerExtras(s);
  return s;
}

async function pollUntil(until, { label, intervalMs = 4000, timeoutMs = 10 * 60 * 1000 }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(intervalMs);
    try {
      const result = await until();
      if (result) return result;
      process.stdout.write('.');
    } catch { process.stdout.write('.'); }
  }
  throw new Error(`Timed out waiting for ${label}. Run "scorper status" to check manually.`);
}

function accountsLine(s) {
  if (!s.accounts.length) {
    return 'No socials connected yet, connect them at ' + API_BASE + '/connect and every one becomes postable from here.';
  }
  return 'Connected: ' + s.accounts.map((a) => `${a.handle} (${a.platform}${a.workspace !== 'default' ? `, ${a.workspace}` : ''})`).join(', ');
}

async function cmdInit() {
  const dryRun = Boolean(flags['dry-run']);
  const result = installAll({ dryRun });
  if (dryRun) return;
  const found = result.agents.map((a) => a.name).join(', ') || 'none detected';
  out(`Scorper Connect installed. Agents found: ${found}.`);
  out(`Skills + hooks are in place. Version ${packageVersion()}.`);
  if (result.depsOk === false) {
    out('One optional piece (upload support) could not finish installing, it will finish itself on your first upload.');
  }
  if (result.agents.some((a) => a.id === 'codex')) {
    out('Codex users: open Codex and run /hooks once to switch Scorper\'s hooks on.');
  }
  ensureInstallId();
  const config = readConfig();
  if (config.token) {
    try {
      const s = await fetchStatus();
      out(`Signed in as ${s.email}. ${accountsLine(s)}`);
      return;
    } catch {
      out('Signed in, but the saved key no longer works, run: scorper login');
      return;
    }
  }
  if (process.stdin.isTTY && process.stdout.isTTY) {
    out('\nNext: scorper login, it opens your browser so you can approve this terminal.');
  } else {
    // Launched by an agent: hand the conversation to it.
    out('AGENT NOTE: Scorper Connect is installed. Now get the person signed in, following the scorper skill, and keep it WARM and conversational, wave emoji hello, excited to have them, short messages, founder-welcoming energy, never formal. Their Scorper account already knows their name and email, so NEVER ask for either, just run scorper login (it opens their browser to approve this terminal) and greet them by name from the status that follows. If status says studio=false, the skill covers the friendly Studio step.');
  }
}

async function cmdLogin() {
  const config = readConfig();
  const agents = detectAgents().filter((a) => a.found).map((a) => a.id);
  const start = await api('/api/cli/link-start', {
    method: 'POST',
    auth: false,
    body: { agent: agents[0] || 'terminal' },
  });
  const opened = openUrl(start.url);
  out(opened ? 'I\'ve opened Scorper in your browser, log in there and approve this terminal. If nothing opened, use this link:' : 'Open this link in your browser to approve this terminal:');
  out(`  ${start.url}`);
  out('Waiting for the approval…');
  const token = await pollUntil(async () => {
    const res = await api('/api/cli/link-poll', { method: 'POST', auth: false, body: { code: start.code } });
    return res.pending ? null : res.token;
  }, { label: 'browser approval', intervalMs: (start.pollSeconds || 3) * 1000 });
  config.token = token;
  writeConfig(config);
  const s = await fetchStatus();
  config.email = s.email;
  config.name = s.name;
  writeConfig(config);
  out(`\nSigned in as ${s.email}${s.name ? ` (${s.name})` : ''}.`);
  out(s.studio
    ? accountsLine(s)
    : 'Scorper Connect needs the Studio plan, next: scorper pay (it opens the upgrade page and verifies for you).');
}

async function cmdPay() {
  const res = await api('/api/cli/checkout', { method: 'POST' });
  if (res.alreadyStudio) { out('You\'re already on Studio, Connect is unlocked. Nothing to pay.'); return; }
  const opened = openUrl(res.url);
  out(opened ? 'Upgrade page opened in your browser, pick monthly or yearly there. If nothing opened, use this link:' : 'Open this link in your browser:');
  out(`  ${res.url}`);
  if (flags['no-wait']) return;
  out('Waiting for the upgrade to land (I check every few seconds)…');
  await pollUntil(async () => {
    const s = await fetchStatus();
    return s.studio ? s : null;
  }, { label: 'Studio upgrade', intervalMs: (res.pollSeconds || 5) * 1000 });
  out('\nStudio verified. Connect is unlocked, you can post from here now.');
}

async function cmdConnect() {
  const before = await fetchStatus();
  const opened = openUrl(`${API_BASE}/connect`);
  out(opened ? 'Scorper Connect opened in your browser, connect a platform there. If nothing opened, use this link:' : 'Open this link in your browser:');
  out(`  ${API_BASE}/connect`);
  if (flags['no-wait']) return;
  out('Waiting for a new connection…');
  const after = await pollUntil(async () => {
    const s = await fetchStatus();
    return s.accounts.length > before.accounts.length ? s : null;
  }, { label: 'social connection' });
  const fresh = after.accounts.filter((a) => !before.accounts.some((b) => b.platform === a.platform && b.handle === a.handle));
  out(`\nConnected: ${fresh.map((a) => `${a.handle} (${a.platform})`).join(', ') || 'done'}.`);
}

async function cmdStatus() {
  const config = readConfig();
  if (!config.token) {
    const payload = { installed: true, signed_in: false, version: packageVersion() };
    out(flags.json ? JSON.stringify(payload) : 'Installed, but not signed in yet. Run: scorper login');
    return;
  }
  const s = await fetchStatus();
  if (flags.json) { out(JSON.stringify({ ...s, version: packageVersion() })); return; }
  out(`Signed in: ${s.email}${s.name ? ` (${s.name})` : ''}`);
  out(`Plan: ${s.tier}${s.studio ? ' · Connect unlocked' : ' · Connect needs Studio (scorper pay)'}`);
  out(accountsLine(s));
  if (s.workspaces.length > 1) out(`Workspaces: ${s.workspaces.map((w) => w.name).join(', ')}`);
  if (s.news) out(`Scorper news: ${s.news.message}`);
}

async function cmdUpload() {
  const file = positionals[0];
  if (!file) { out('Usage: scorper upload ./photo.jpg [--account @handle]'); process.exitCode = 1; return; }
  const path = resolve(String(file));
  let size = 0;
  try { size = statSync(path).size; } catch { out(`Can't read ${path}`); process.exitCode = 1; return; }
  if (size > 300 * 1024 * 1024) { out('File is over the 300 MB limit.'); process.exitCode = 1; return; }

  const name = basename(path);
  const ext = name.toLowerCase().split('.').pop();
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime' };
  const contentType = types[ext];
  if (!contentType) { out('Supported: jpg, jpeg, png, webp, mp4, mov'); process.exitCode = 1; return; }

  const { token } = readConfig();
  if (!token) { out('Not signed in. Run: scorper login'); process.exitCode = 1; return; }

  const clientPayload = JSON.stringify({
    ...(flags.account ? { account: String(flags.account) } : {}),
    ...(flags.workspace ? { workspaceId: String(flags.workspace) } : {}),
  });

  // Mint the client-upload token ourselves (bearer-authenticated), then push
  // the bytes straight to Vercel Blob, they never pass through Scorper.
  const mintRes = await fetch(`${API_BASE}/api/schedule/upload-media`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: {
        pathname: `connect-cli/${name}`,
        callbackUrl: `${API_BASE}/api/schedule/upload-media`,
        clientPayload,
        multipart: size > 50 * 1024 * 1024,
      },
    }),
  });
  const mint = await mintRes.json().catch(() => ({}));
  if (!mintRes.ok || !mint.clientToken) {
    out(`Upload refused: ${mint.error || mintRes.status}`);
    process.exitCode = 1;
    return;
  }

  // Older installs (0.1.1) copied the CLI without its dependencies. Install
  // them in place once, then re-run this same command in a fresh process so
  // the import resolves cleanly.
  let put;
  try {
    ({ put } = await import('@vercel/blob'));
  } catch {
    if (process.env.SCORPER_DEPS_RETRY) {
      out('Uploads need a quick repair that did not take. Run: npx scorper@latest init');
      process.exitCode = 1;
      return;
    }
    out('One moment, finishing the upload setup on this machine…');
    const cliRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    if (!installCliDeps(cliRoot)) {
      out('Could not finish the setup. Run: npx scorper@latest init');
      process.exitCode = 1;
      return;
    }
    const r = spawnSync(process.execPath, process.argv.slice(1), {
      stdio: 'inherit',
      env: { ...process.env, SCORPER_DEPS_RETRY: '1' },
    });
    process.exitCode = r.status ?? 0;
    return;
  }
  out(`Uploading ${name} (${(size / 1024 / 1024).toFixed(1)} MB)…`);
  const blob = await put(`connect-cli/${name}`, createReadStream(path), {
    access: 'public',
    token: mint.clientToken,
    contentType,
    multipart: size > 50 * 1024 * 1024,
  });
  out(`Uploaded. URL: ${blob.url}`);
  out('Use this URL with the posting tools (scorper tool) or /api/schedule.');
}

async function cmdTool() {
  const tool = String(flags.tool || positionals[0] || '');
  if (!tool) {
    const res = await api('/api/cli/tool');
    out(JSON.stringify(res.tools, null, 2));
    return;
  }
  let args = {};
  if (flags.args) {
    try { args = JSON.parse(String(flags.args)); } catch { out('--args must be valid JSON'); process.exitCode = 1; return; }
  }
  const res = await api('/api/cli/tool', { method: 'POST', body: { tool, args }, timeoutMs: 180000 });
  if (res.isError) process.exitCode = 1;
  out(res.text ?? '');
}

function cmdLogout() {
  const config = readConfig();
  delete config.token;
  delete config.email;
  delete config.name;
  writeConfig(config);
  out('Signed out on this machine. (Revoke the key too in Settings → API if you want it dead everywhere.)');
}

function cmdDoctor() {
  const agents = detectAgents();
  for (const a of agents) out(`${a.found ? '✓' : '✗'} ${a.name}`);
  const config = readConfig();
  out(`config: ${config.install_id ? 'present' : 'missing'} · signed in: ${config.token ? 'yes' : 'no'} · version ${packageVersion()}`);
  out('If skills look stale, run: npx scorper@latest init');
}

const HELP = `scorper ${packageVersion()}: Scorper Connect inside your AI agent (${API_BASE})

  npx scorper@latest init    install skills + hooks into your agents
  scorper login              approve this terminal in your browser (no passwords here)
  scorper status [--json]    plan, connected socials, workspaces
  scorper pay                open the Studio upgrade, wait + verify
  scorper connect            open the dashboard to connect a social, wait for it
  scorper upload <file> [--account @handle]   upload local media, get a postable URL
  scorper tool [name] --args '{"...": "..."}'  run a Scorper action (list with no name)
  scorper logout             forget the key on this machine
  scorper doctor             check the install
  npx scorper uninstall      remove everything Scorper added

Docs: https://scorper.ai/connect`;

try {
  if (command === 'init') await cmdInit();
  else if (command === 'login') await cmdLogin();
  else if (command === 'status') await cmdStatus();
  else if (command === 'pay' || command === 'upgrade') await cmdPay();
  else if (command === 'connect') await cmdConnect();
  else if (command === 'upload') await cmdUpload();
  else if (command === 'tool') await cmdTool();
  else if (command === 'logout') cmdLogout();
  else if (command === 'doctor') cmdDoctor();
  else if (command === 'uninstall') { uninstallAll({ dryRun: Boolean(flags['dry-run']) }); if (!flags['dry-run']) out('Scorper removed. Settings backups were left in place.'); }
  else out(HELP);
} catch (err) {
  out(`scorper: ${err.message || err}`);
  process.exitCode = 1;
}
