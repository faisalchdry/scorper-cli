# scorper

Scorper Connect — post and schedule to your social accounts straight from
your AI agent (Claude Code, Codex, Cursor and more).

```
npx scorper@latest init
```

That installs the Scorper Agent Skills and a lightweight hook into every AI
coding agent on your machine, then your agent takes it from there: it opens
your browser once so you can approve the terminal, and from then on "post
this to my Instagram" just works.

- You connect your social accounts once at https://dashboard.scorper.ai/connect
- Scorper holds the connection; your agent (or anything you build on
  localhost) does the posting through it
- Needs a Scorper Studio subscription
- `npx scorper uninstall` removes everything it added

Privacy: your access key lives only in `~/.scorper/config.json` on your
machine. Policy: https://scorper.ai/privacy

Docs: https://scorper.ai/connect
