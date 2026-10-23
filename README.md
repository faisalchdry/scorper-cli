# scorper

Post directly to your socials from your AI agent (Claude Code, Codex, Cursor
and more): Instagram, TikTok, LinkedIn, X and YouTube, plus Instagram
comment-to-DM automations.

```
npx scorper@latest init
```

That installs the Scorper Agent Skills and a lightweight hook into every AI
coding agent on your machine, then your agent takes it from there: it asks
for your email, you type the 6-digit code we send you, pick a plan, connect
your socials, and from then on "post this to my Instagram" just works.

- New or existing account, same flow: the emailed code signs you in or
  creates your account. No passwords.
- Scorper holds the connections; your agent (or anything you build on
  localhost) does the posting through them
- Plans: Max (1 brand account, all socials, 7 days free on monthly) or
  Studio (3 brand accounts)
- `npx scorper uninstall` removes everything it added

Privacy: your access key lives only in `~/.scorper/config.json` on your
machine. Policy: https://scorper.ai/privacy

Docs: https://scorper.ai/connect
