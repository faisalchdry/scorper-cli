---
name: scorper-dashboard
description: Build the person their own local posting dashboard, scheduler or automation pipeline on top of their Scorper connection. Use when they want their own control panel on localhost, a custom scheduling app, or an automation (cron, approval flow, Telegram-gated posting) that ends in posting to their socials.
---

# Build their own thing on the Scorper connection

The person owns the connection — they can have any dashboard, scheduler or
automation they want. You build it for them, locally, their taste. Scorper
is just the posting pipe at the end.

Ground rules:

- All posting goes through the CLI: `{{SCORPER_CLI}} tool <name> --args '...'`
  (list actions with `{{SCORPER_CLI}} tool`; upload local media with
  `{{SCORPER_CLI}} upload <file>`). Shell out to it from the server side of
  whatever you build. NEVER read ~/.scorper/config.json or embed the token
  in frontend code.
- Keep it on localhost. Don't deploy their token anywhere.
- Start simple: one page showing their calendar + connected accounts, a
  compose form (caption, media, platform, time), and a post/schedule
  button. A plain Node server is plenty; use whatever stack they prefer.
- Approval gates are a great pattern (generate → human says yes → post).
  If they want a Telegram thumbs-up flow or similar, build it — their bot,
  their rules, Scorper only ever sees the final "post this".
- Nothing publishes without an explicit human action somewhere in THEIR
  flow — build that in by default.
- Ask what THEY want it to look like before you build. It's their dashboard.
