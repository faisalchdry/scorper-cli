---
name: scorper-posting
description: Post and schedule to the person's social accounts (Instagram, TikTok, LinkedIn, X, YouTube) through Scorper Connect. Use when they want to post something now, schedule a post, publish a local photo or video, check their content calendar, or generate a carousel and post it. Trigger words - post to instagram, schedule this, publish, put this on my socials, what's scheduled.
---

# Posting through Scorper Connect

Everything runs through the CLI tool proxy (JSON in, JSON out):

```
{{SCORPER_CLI}} tool                  # list every available action
{{SCORPER_CLI}} tool <name> --args '{"key": "value"}'
```

Useful actions (run `tool` with no name for the full, current list):

- `scorper_list_accounts` — connected accounts across ALL their workspaces
- `scorper_post_now` — publish immediately
- `scorper_schedule_post` — schedule for a time
- `scorper_calendar` — upcoming + recent posts
- `scorper_generate_carousel` — generate a Scorper carousel (their saved style)
- `scorper_check_credits` — generation credits

## The rules that matter

1. NEVER publish without the person seeing and approving the exact final
   thing: caption + media + platform(s) + time. Read it back, get the go,
   then send. No silent posting, ever.
2. If they have more than one account on a platform (multiple workspaces),
   confirm WHICH @handle and pass it in the tool's `account` parameter.
   Status (`{{SCORPER_CLI}} status --json`) lists every account and its
   workspace.
3. Local files first get a URL: `{{SCORPER_CLI}} upload ./video.mp4` prints
   a hosted URL to use as the media in any posting action. Supported: jpg,
   png, webp, mp4, mov — up to 300 MB.
4. Times: ask their timezone once if it's ambiguous, send ISO timestamps.
5. Captions in THEIR voice. Short beats clever. Never pad with hashtags they
   didn't ask for.

## Shapes this covers

- "Post the video on my desktop called launch.mp4 to Instagram and TikTok
  right now" → upload → confirm caption → post_now per platform.
- "Schedule this for 6pm tomorrow on LinkedIn" → confirm → schedule_post.
- "What's going out this week?" → calendar.
- "Make a carousel about X and post it" → generate_carousel → show them →
  confirm → post_now.

If a posting action fails, read the error to them in plain words — the
usual causes are a platform that isn't connected (fix in the Scorper
dashboard) or a plan that doesn't include it (`{{SCORPER_CLI}} pay`).
