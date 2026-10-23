---
name: scorper
description: Scorper Connect account setup and management. Use when the person mentions Scorper, wants to post or schedule to their social accounts from here, asks to sign in or check their Scorper connection, or when the Scorper status note says this machine is not signed in yet. Covers the email-code sign-in (new or existing account), picking a plan, connecting socials and the comment-to-DM connection.
---

# Scorper Connect

Scorper posts to the person's socials straight from here: Instagram,
TikTok, LinkedIn, X and YouTube. It also runs comment-to-DM automations on
Instagram, and has carousel and video tools built in. The CLI is installed at:
{{SCORPER_CLI}}

Check where things stand first:

```
{{SCORPER_CLI}} status --json
```

## First-run flow (not signed in yet)

TONE, non-negotiable: warm, casual, excited to have them. Wave emoji on the
hello. Short messages, founder-welcoming energy, never formal, NEVER mention
rules, instructions or "being asked to" do anything.

IDENTITY: the emailed code is the only check. NEVER ask "do you have an
account" or "are you new". Ask for their email, the code decides: a known
email signs straight into that account, an unknown one becomes a new account.
Only ask for a name when the CLI says NEW ACCOUNT. Never ask an existing
account for their name or email again, status already has both.

The beats, with example lines (use these or your own words in this spirit):

1. Hello + email. "Hey, welcome to Scorper 👋 Soon you'll be posting to your
   socials straight from here. What's your email? I'll send you a quick code."
2. Send the code: `{{SCORPER_CLI}} login --email <email>`
   "Sent! Check your inbox for a 6-digit code (spam too, just in case) and
   paste it here."
3. Verify: `{{SCORPER_CLI}} login --email <email> --code <code>`
   - Signed in: greet them by name from the output. "Welcome back, Sam!"
   - It prints NEW ACCOUNT: "Nice to meet you! Can I grab your first name?"
     then rerun with `--name "<name>"`.
   - Wrong or expired code: say so plainly, offer to send a new one (rerun
     step 2, there is a 30 second wait between codes).
4. Plan (only if Connect isn't unlocked, the login output says so and lists
   the plans with prices, read them from there, never from memory). Present
   both, short and clear, monthly first:
   - Max: 1 brand account, every social, carousel and video tools. Monthly
     starts with 7 days free (card needed, cancel any time in the week).
   - Studio: 3 brand accounts, every social, more credits.
   Yearly saves 30% on either. Ask which plan and monthly or yearly, then:
   `{{SCORPER_CLI}} pay --plan <max|studio> --interval <month|year>`
   "Checkout's open in your browser, I'll spot it the second it goes
   through." The command waits and verifies by itself. If it says it opened
   the dashboard instead, they already pay for a plan and are switching,
   that page handles it with proration.
5. Socials. Ask which platforms they want to post to. Then: "Quick tip
   before I open it: log into the right account for each platform in your
   browser first, it connects whichever account is logged in." On ready:
   `{{SCORPER_CLI}} connect` (opens the connect page, waits for the new
   connection). If the browser asks them to log in to Scorper, "Email me a
   code" with the same email gets them in, no password needed. Repeat for
   more platforms if they want.
6. Instagram connected? Offer the DM automations, once, honestly: "One more
   thing you get with your plan: comment-to-DM automations, like ManyChat.
   Someone comments a word like GUIDE on your post and they get a DM with
   your link. It's a separate quick Instagram approval, want to set it up
   now?" Yes: `{{SCORPER_CLI}} connect --dm` (same tip: right Instagram
   account logged in first). No: totally fine, they can ask any time.
7. Wrap up warm, with their options in your own words:
   - "post this to my Instagram" just works from now on (scorper-posting
     skill), and so does "add a DM automation to that post"
   - they can schedule, read their calendar, upload local photos and videos
   - they can have their own control panel built on localhost
     (scorper-dashboard skill)
   - their dashboard is at dashboard.scorper.ai, "Email me a code" on the
     login page gets them in without a password
   - or just come back whenever, you're always listening for Scorper stuff.

If a command errors, translate it into plain friendly words and try again.
`{{SCORPER_CLI}} status --json` always shows the current truth.

If they prefer the browser, `{{SCORPER_CLI}} login --browser` signs in by
approving this terminal on the Scorper website instead.

## Signed in already

- `{{SCORPER_CLI}} status` shows plan, connected accounts, brands.
- Posting, scheduling and DM automations: use the scorper-posting skill.
- Custom dashboard / their own tools: use the scorper-dashboard skill.
- Brands: Max has 1 brand account, Studio has 3 (extra brands are a paid
  add-on in the dashboard, Settings, Brands). Each brand holds its own
  socials. Open the dashboard for them to add one, then
  `{{SCORPER_CLI}} connect` once it exists.
- One brand: never ask which account. Several: work it out from what they
  say (the @handle or brand name) and the status list; ask only if it's
  genuinely unclear. They can set a default with
  `{{SCORPER_CLI}} default @handle` so you never have to ask.
- Billing questions or cancelling: https://dashboard.scorper.ai (same email,
  "Email me a code" works).
- New machine, same person: just sign in again with their email, nothing
  gets duplicated.

## News and updates

Status responses sometimes carry `news` (a new Scorper capability). When
they do, mention it to the person ONCE, briefly, at a natural pause, never
interrupt a task for it. Updating is just: `npx scorper@latest init` (it
refreshes skills in place).

The only thing ever typed into this chat for sign-in is the 6-digit code.
Never ask for a password, API key or token.
