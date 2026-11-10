---
name: scorper-dashboard
description: Build the person their own local posting dashboard, scheduler or automation pipeline on top of their Scorper connection. Use when they want their own control panel or admin UI for their socials on localhost, a custom scheduling app, or an automation (cron, approval flow, Telegram-gated posting, comment-to-DM logic, auto-replies) that reads from or writes to their social accounts.
---

# Build their own thing on the Scorper connection

The connection belongs to them. Scorper holds the credentials and the route to
the platform, and that is all it does. How content gets there, when, and with
what checks in between is entirely theirs to decide.

So: build what they actually asked for. If they want a cron that posts at 9am
every day with nobody watching, build that. If they want a Telegram bot that
pings them for a thumbs-up first, build that. If they want a review link for a
client to approve, build that. Do not add a human approval step they did not
ask for, and do not talk them out of an unattended pipeline. The one place you
still read something back is while you are in the conversation with them (see
the scorper-posting skill). That is good manners during a chat, not a rule
about what their software may do.

## What they have to build on

Everything runs through the CLI:

```
{{SCORPER_CLI}} tool                        # list every available action
{{SCORPER_CLI}} tool <name> --args '{...}'  # run one
{{SCORPER_CLI}} upload ./video.mp4          # local file to a hosted URL
```

Shell out to it from the SERVER side of whatever you build. Never read
`~/.scorper/config.json` and never put the key in frontend code.

Roughly what the actions cover, but always run `tool` with no name for the
live list, since it grows:

- **Posting**: publish now, schedule for a time, cancel, edit or reschedule a
  queued post, fire a queued post early, read the calendar.
- **Reading back**: connected accounts and brands, published posts with their
  likes and comment counts, followers over time.
- **Engagement**: read comments, reply publicly, hide or delete a comment,
  read DM threads, send a DM, and manage comment-to-DM automations.
- **Generation**: Scorper carousels in their saved style (tweet-style by
  default, creative image templates on request), plus no-login preview links
  for anything before it is posted.

## Platform limits worth designing around

These are the platforms' rules, not Scorper's. Build with them in mind rather
than discovering them at runtime:

- Instagram only accepts a DM within **24 hours** of that person's last
  message to the account. There is no way to DM someone by @handle, and no way
  to DM someone who never contacted the account. A "DM my followers" feature
  is not buildable by anyone, on any tool.
- Instagram gives likes and comment counts per post. **Reach, impressions,
  saves and audience demographics are not available.** Do not design a
  dashboard tile for them.
- LinkedIn can be posted to but **cannot be read back at all**: no metrics, no
  comments, no DMs.
- TikTok and X expose no comment or DM access to Scorper.
- Instagram caps published posts at 50 per account per 24 hours.
- Scorper also applies its own per-account ceilings, purely so one busy
  automation cannot get Scorper's app throttled by a platform for everybody.
  Errors say which limit was hit and whose it is.

If a tool call fails, read the error out in plain words. It carries a machine
readable code too (`payment_required`, `platform_limit`, `scorper_limit`,
`not_connected`, `slot_locked`), so an unattended script can branch on it
instead of parsing English. `payment_required` means the subscription lapsed:
their automation keeps running but nothing will publish until they subscribe
again, so surface that loudly rather than swallowing it.

## Practical notes

- Keep it on localhost unless they ask otherwise, and never deploy their key
  anywhere they did not choose.
- Start simple, then grow it: one page with the calendar and connected
  accounts, a compose form, a post button. A plain Node server is plenty, use
  whatever stack they prefer.
- If their tool will be used by someone else (a colleague, a VA, a client),
  pass an `actor` field on each call with that person's name. Scorper stores it
  verbatim on the call record, so their own logs say who did what. Optional,
  and worth offering once when the tool has more than one user.
- They can mint a **scoped** key in their Scorper dashboard under Settings,
  API keys: limit it to read, post, comments and DMs, or generate. Worth
  suggesting when the key is going somewhere they do not fully control. A
  normal key has full access.
- **Ask what THEY want it to look like before you build.** It is their
  dashboard.
