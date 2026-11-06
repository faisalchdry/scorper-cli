// Calls to dashboard.scorper.ai. The base URL is public; the scrp_live_ token
// lives only in ~/.scorper/config.json and goes out as a bearer header, never
// in argv logs.
import { readConfig, installInfo } from './config.mjs';

export const API_BASE = (process.env.SCORPER_API_URL || 'https://dashboard.scorper.ai').replace(/\/$/, '');

export async function api(path, { method = 'GET', body, auth = true, timeoutMs = 20000 } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth) {
    const { token } = readConfig();
    if (!token) throw new Error('This machine is not signed in to Scorper yet. Run: scorper login');
    headers.authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Node's bare "fetch failed" tells the person nothing, and the usual cause
    // is not their internet: coding agents run commands in a sandbox that has
    // networking switched off by default, so the request dies inside the box
    // while the machine itself is online. Say that, and say which copy of the
    // CLI is talking, because a stale copy is the other half of this trap.
    throw new Error(networkHelp(err));
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function networkHelp(err) {
  const { version, installedAt } = installInfo();
  const when = installedAt
    ? new Date(installedAt).toISOString().slice(0, 10)
    : null;
  const lines = [
    `Could not reach ${API_BASE} (${err?.message || 'network error'}).`,
    'Your machine is probably fine. Coding agents run commands in a sandbox with',
    'networking switched OFF by default, and the request dies inside it.',
    '  Codex: run /permissions and allow network access.',
    '  Claude Code: allow the command, or run it in a plain terminal instead.',
  ];
  if (version) {
    lines.push(
      '',
      `Heads up: this is Scorper CLI ${version}${when ? `, installed ${when}` : ''}, running from`,
      '~/.scorper/cli. Because the network is blocked it cannot check for a newer one,',
      'so it may be out of date. Once network access works, run: npx scorper@latest init',
    );
  }
  return lines.join('\n');
}
