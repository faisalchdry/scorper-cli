// Calls to dashboard.scorper.ai. The base URL is public; the scrp_live_ token
// lives only in ~/.scorper/config.json and goes out as a bearer header, never
// in argv logs.
import { readConfig } from './config.mjs';

export const API_BASE = (process.env.SCORPER_API_URL || 'https://dashboard.scorper.ai').replace(/\/$/, '');

export async function api(path, { method = 'GET', body, auth = true, timeoutMs = 20000 } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth) {
    const { token } = readConfig();
    if (!token) throw new Error('This machine is not signed in to Scorper yet. Run: scorper login');
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
