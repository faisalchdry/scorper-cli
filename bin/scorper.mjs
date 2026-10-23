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
    email: { type: 'string' },
    code: { type: 'string' },
    name: { type: 'string' },
    browser: { type: 'boolean', default: false },
    plan: { type: 'string' },
    interval: { type: 'string' },
    dm: { type: 'boolean', default: false },
    clear: { type: 'boolean', default: false },
  },
  allowPositionals: true,
  strict: false,
});

const out = (s) => process.stdout.write(s + '\n');
const isTTY = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);
// Connect unlocked? Servers since the 2026-10-23 pivot send `connect`;
// older ones only `studio` (same meaning).
const unlocked = (s) => Boolean(s.connect ?? s.studio);
// "trial" + incomplete = signed up, no plan picked yet.
const planName = (s) => (s.status === 'incomplete' || (s.tier === 'trial' && !unlocked(s)) ? 'no plan yet' : s.tier);

async function ask(question) {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await rl.question(question)).trim(); } finally { rl.close(); }
}

function plansLine(s) {
  if (!Array.isArray(s.plans) || !s.plans.length) return '';
  return s.plans.map((p) => `${p.name}: ${p.monthly} or ${p.yearly}, ${p.summary}${p.trial ? ` (${p.trial})` : ''}`).join('\n');
}
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
  if (isTTY()) {
    out('\nNext: scorper login, it emails you a 6-digit code (no passwords).');
  } else {
    // Launched by an agent: hand the conversation to it.
    out('AGENT NOTE: Scorper Connect is installed. Now get the person signed in, following the scorper skill, and keep it WARM and conversational, wave emoji hello, excited to have them, short messages, founder-welcoming energy, never formal. Ask for their email only (never "do you have an account", the code decides that), run scorper login --email <their email>, ask for the 6-digit code from their inbox, then scorper login --email <email> --code <code>. If it says NEW ACCOUNT, ask their first name and rerun with --name. Known accounts come back with their name, greet them by it.');
  }
}

async function finishLogin(token) {
  const config = readConfig();
  config.token = token;
  writeConfig(config);
  const s = await fetchStatus();
  config.email = s.email;
  config.name = s.name;
  writeConfig(config);
  return s;
}

function afterLoginLines(s, isNew) {
  out(`\n${isNew ? 'Account created' : 'Signed in'}: ${s.email}${s.name ? ` (${s.name})` : ''}.`);
  if (unlocked(s)) {
    out(s.status === 'trialing' && s.trial_end ? `Plan: ${s.tier}, free trial until ${String(s.trial_end).slice(0, 10)}. Connect is unlocked.` : `Plan: ${s.tier}. Connect is unlocked.`);
    out(accountsLine(s));
  } else {
    out('Posting from here comes with Max or Studio. Plans:');
    const pl = plansLine(s);
    if (pl) out(pl);
    out('Next: scorper pay --plan max|studio --interval month|year');
  }
}

async function cmdLoginBrowser() {
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
  afterLoginLines(await finishLogin(token), false);
}

// Email-code sign-in (Connect pivot 2026-10-23). The code is the only
// identity check: a known email signs in, an unknown one becomes a new
// passwordless account (name asked once). Works step by step for agents
// (--email, then --email --code, then --name if NEW ACCOUNT) and as one
// interactive prompt flow in a real terminal.
async function cmdLogin() {
  if (flags.browser) return cmdLoginBrowser();
  const agents = detectAgents().filter((a) => a.found).map((a) => a.id);
  const agent = agents[0] || 'terminal';
  let email = flags.email ? String(flags.email).trim().toLowerCase() : '';
  let code = flags.code ? String(flags.code).replace(/\D/g, '') : '';
  let name = flags.name ? String(flags.name).trim() : '';

  if (!email && isTTY()) email = (await ask('Your email: ')).toLowerCase();
  if (!email) {
    out('Usage: scorper login --email you@example.com  (then --code 123456). Or: scorper login --browser');
    process.exitCode = 1;
    return;
  }

  if (!code) {
    await api('/api/cli/otp-start', { method: 'POST', auth: false, body: { email } });
    out(`Code sent to ${email}. It's 6 digits and lasts 10 minutes (check spam if it's not there).`);
    if (!isTTY()) {
      out(`Next: scorper login --email ${email} --code <the 6 digits>`);
      return;
    }
    code = (await ask('Code: ')).replace(/\D/g, '');
  }

  const verify = (n) => api('/api/cli/otp-verify', { method: 'POST', auth: false, body: { email, code, agent, ...(n ? { name: n } : {}) } });
  let res = await verify(name);
  if (res.needName) {
    if (!isTTY()) {
      out(`NEW ACCOUNT: there's no Scorper account for ${email} yet, this code creates one. Ask for their first name, then run: scorper login --email ${email} --code ${code} --name "<name>"`);
      return;
    }
    name = await ask('Welcome to Scorper! Your first name: ');
    res = await verify(name);
  }
  afterLoginLines(await finishLogin(res.token), Boolean(res.isNew));
}

async function cmdPay() {
  const plan = flags.plan ? String(flags.plan).toLowerCase() : '';
  const interval = flags.interval ? String(flags.interval).toLowerCase().replace(/ly$/, '').replace(/^annual$/, 'year').replace(/^month$/, 'month') : 'month';
  if (plan && plan !== 'max' && plan !== 'studio') { out('Plans: max or studio.'); process.exitCode = 1; return; }
  if (interval !== 'month' && interval !== 'year') { out('Interval: month or year.'); process.exitCode = 1; return; }
  if (!plan) {
    const s = await fetchStatus();
    if (unlocked(s)) { out(`You're on ${s.tier}, Connect is unlocked. Nothing to pay.`); return; }
    out('Pick a plan first:');
    out(plansLine(s));
    out('Then: scorper pay --plan max|studio --interval month|year');
    return;
  }
  const res = await api('/api/cli/checkout', { method: 'POST', body: { plan, interval } });
  if (res.alreadyEntitled || res.alreadyStudio) { out(`You already have ${plan === 'studio' ? 'Studio' : 'that'}, Connect is unlocked. Nothing to pay.`); return; }
  const opened = openUrl(res.url);
  if (res.dashboard) {
    out(opened ? 'Opened your Scorper dashboard to switch plans (you already pay, so it is prorated there). If nothing opened, use this link:' : 'Open this link to switch plans in your Scorper dashboard:');
  } else {
    out(opened ? 'Checkout opened in your browser. If nothing opened, use this link:' : 'Open this link in your browser to pay:');
  }
  out(`  ${res.url}`);
  if (res.trial) out('Max monthly starts with 7 days free, card required, cancel any time in the week.');
  if (flags['no-wait']) return;
  out('Waiting for it to land (I check every few seconds)…');
  const s = await pollUntil(async () => {
    const st = await fetchStatus();
    if (!unlocked(st)) return null;
    if (plan === 'studio' && st.tier !== 'studio' && !st.is_admin) return null;
    return st;
  }, { label: 'payment', intervalMs: (res.pollSeconds || 5) * 1000 });
  out(`\nVerified, you're on ${s.tier}${s.status === 'trialing' ? ' (free trial)' : ''}. Connect is unlocked, you can post from here now.`);
}

async function cmdConnectDm() {
  const args = flags.account ? { account: String(flags.account) } : defaultAccountArgs();
  const before = await api('/api/cli/tool', { method: 'POST', body: { tool: 'scorper_dm_status', args } });
  if (before.isError) { out(before.text); process.exitCode = 1; return; }
  if (/connected as @/.test(before.text)) { out(before.text); return; }
  const url = (before.text.match(/https:\/\/\S+/) || [])[0];
  if (!url) { out(before.text); process.exitCode = 1; return; }
  const opened = openUrl(url);
  out(opened ? 'Opened the Instagram approval for DM automations. Log into the SAME Instagram account in that browser first, then approve. If nothing opened, use this link:' : 'Open this link (log into the right Instagram account first) to approve DM automations:');
  out(`  ${url}`);
  if (flags['no-wait']) return;
  out('Waiting for the approval…');
  const done = await pollUntil(async () => {
    const r = await api('/api/cli/tool', { method: 'POST', body: { tool: 'scorper_dm_status', args } });
    return /connected as @/.test(r.text || '') ? r.text : null;
  }, { label: 'DM connection' });
  out(`\n${done}`);
}

async function cmdConnect() {
  if (flags.dm) return cmdConnectDm();
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
  out(`Plan: ${planName(s)}${s.status === 'trialing' ? ' (free trial)' : ''}${unlocked(s) ? ' · Connect unlocked' : ' · Connect comes with Max or Studio (scorper pay)'}`);
  const cfg = readConfig();
  if (cfg.default_account) out(`Default brand on this machine: ${cfg.default_account}`);
  out(accountsLine(s));
  if (s.workspaces.length > 1) out(`Brands: ${s.workspaces.map((w) => w.name).join(', ')}`);
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

const ACCOUNT_AWARE = /^scorper_(post_now|schedule_post|calendar|dm_status|list_dm_automations|create_dm_automation|pause_dm_automation|delete_dm_automation)$/;

function defaultAccountArgs() {
  const { default_account } = readConfig();
  return default_account ? { account: default_account } : {};
}

async function cmdDefault() {
  const config = readConfig();
  if (flags.clear) { delete config.default_account; writeConfig(config); out('Default brand cleared.'); return; }
  const handle = positionals[0] ? String(positionals[0]).trim() : '';
  if (!handle) { out(config.default_account ? `Default brand: ${config.default_account}` : 'No default brand set. Usage: scorper default @handle'); return; }
  const s = await fetchStatus();
  const h = '@' + handle.replace(/^@/, '').toLowerCase();
  const match = s.accounts.find((a) => a.handle.toLowerCase() === h);
  if (!match) { out(`${h} isn't one of your connected accounts. ${accountsLine(s)}`); process.exitCode = 1; return; }
  config.default_account = match.handle;
  writeConfig(config);
  out(`Default brand on this machine: ${match.handle}${match.workspace !== 'default' ? ` (${match.workspace})` : ''}. Posting actions use it unless you name another account.`);
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
  // Per-machine default brand: fills `account` on account-aware actions when
  // the agent didn't name one (multi-brand users only, set via scorper default).
  if (args.account === undefined && args.workspaceId === undefined && ACCOUNT_AWARE.test(tool)) {
    Object.assign(args, defaultAccountArgs());
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
  delete config.default_account;
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
  scorper login --email you@example.com [--code 123456] [--name Sam]
                             sign in or create your account with an emailed code
  scorper login --browser    sign in by approving this terminal in your browser
  scorper status [--json]    plan, connected socials, brands
  scorper pay --plan max|studio --interval month|year
                             open checkout for that plan, wait + verify
  scorper connect            open the dashboard to connect a social, wait for it
  scorper connect --dm [--account @handle]
                             approve comment-to-DM automations for Instagram
  scorper default @handle    make one brand the default on this machine (--clear)
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
  else if (command === 'default') await cmdDefault();
  else if (command === 'doctor') cmdDoctor();
  else if (command === 'uninstall') { uninstallAll({ dryRun: Boolean(flags['dry-run']) }); if (!flags['dry-run']) out('Scorper removed. Settings backups were left in place.'); }
  else out(HELP);
} catch (err) {
  out(`scorper: ${err.message || err}`);
  process.exitCode = 1;
}
