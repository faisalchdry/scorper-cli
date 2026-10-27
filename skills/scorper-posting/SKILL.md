---
name: scorper-posting
description: Post and schedule to the person's social accounts (Instagram, LinkedIn, TikTok, X, YouTube) through Scorper Connect, and run Instagram comment-to-DM automations. Use when they want to post something now, schedule a post, publish a local photo or video, check their content calendar, generate a carousel and post it, or add a DM automation to a post. Trigger words - post to instagram, schedule this, publish, put this on my socials, what's scheduled, auto DM, comment to DM, ManyChat.
---

# Posting through Scorper Connect

Everything runs through the CLI tool proxy (JSON in, JSON out):

```
{{SCORPER_CLI}} tool                  # list every available action
{{SCORPER_CLI}} tool <name> --args '{"key": "value"}'
```

Useful actions (run `tool` with no name for the full, current list):

- `scorper_list_accounts`: connected accounts across ALL their brands
- `scorper_post_now`: publish immediately
- `scorper_schedule_post`: schedule for a time
- `scorper_calendar`: upcoming + recent posts
- `scorper_generate_carousel`: generate a Scorper carousel (their saved style)
- `scorper_check_credits`: generation credits
- `scorper_dm_status`, `scorper_list_dm_automations`,
  `scorper_create_dm_automation`, `scorper_pause_dm_automation`,
  `scorper_delete_dm_automation`: Instagram comment-to-DM automations

## The rules that matter

1. NEVER publish without the person seeing and approving the exact final
   thing: caption + media + platform(s) + time. Read it back, get the go,
   then send. No silent posting, ever.
2. Brands: with one brand there's nothing to ask. With several, resolve
   the @handle from what they said and the status list (`{{SCORPER_CLI}}
   status --json` lists every account and its brand), pass it as `account`,
   and the read-back in rule 1 names the exact account so a wrong guess gets
   caught. Ask only when it's genuinely ambiguous. If they set a default
   (`{{SCORPER_CLI}} default @handle`) the CLI fills it in for you.
3. Local files first get a URL: `{{SCORPER_CLI}} upload ./video.mp4` prints
   a hosted URL to use as the media in any posting action. Supported: jpg,
   png, webp, mp4, mov, up to 300 MB.
4. Times: ask their timezone once if it's ambiguous, send ISO timestamps.
5. Captions in THEIR voice. Short beats clever. Never pad with hashtags they
   didn't ask for. When drafting a caption for them, propose a few options
   (3 to 5) and let them pick.
6. Multi-platform caption flow: draft ONE caption first (assume they want
   the same one everywhere), then ask: "Want this caption on every platform
   you're posting to, or a platform-specific caption for any of them?" If
   they go platform-specific, suggest a tailored caption per platform, or
   ask if they have their own. Then ONE call does it all: `caption` is the
   default, the `captions` parameter overrides per platform, e.g.
   `{"caption": "...", "captions": {"tiktok": "..."}}`. Never split one
   post into separate calls just for different captions.
7. AI-made content: if the media is AI-generated, pass `aiGenerated: true`.
   On TikTok videos that applies TikTok's permanent AI-generated label
   (required for compliance, tell them it can't be removed once posted).
   Instagram has no per-post API label, the AI disclosure there is an
   account-level switch in the Instagram app, so remind accounts that
   mainly post AI content to turn it on themselves.

8. Free trial notes: a result may end with a "[Scorper trial note ...]".
   Follow it (mention the days left once per conversation, after the task,
   lightly) and never paste it verbatim. If a posting or DM action says the
   free trial has ended, tell them kindly and offer to subscribe right
   then, using the pay flow in the scorper skill.

## Shapes this covers

- "Post the video on my desktop called launch.mp4 to Instagram and TikTok
  right now" → upload → caption flow (same everywhere or per platform?) →
  ONE post_now with both platforms (per-platform text via `captions`).
- "Schedule this for 6pm tomorrow on LinkedIn" → confirm → schedule_post.
- "What's going out this week?" → calendar.
- "Make a carousel about X and post it" → generate_carousel → show them →
  confirm → post_now.

Supported platforms: Instagram, LinkedIn, TikTok, X and YouTube. YouTube
takes one video (pass `mediaType: "video"`), the first line of the caption
becomes the video title, so make that line a good title.

## Comment-to-DM automations (Instagram)

Someone comments a trigger word (like GUIDE) on a post and automatically
gets a DM with a message and a link. ManyChat-style, included in Max and
Studio. Needs a one-time second Instagram approval: `scorper_dm_status`
tells you if it's connected; if not, `{{SCORPER_CLI}} connect --dm` opens
it (right Instagram account logged in first).

- About to post and they want an automation on it: create it with
  `post: "next"` BEFORE posting, then post. It attaches to that post within
  about 5 minutes of it going live and catches comments from the gap.
- Already posted: `post: "latest"` (the newest live post, check the caption
  it echoes back matches) or a media id from `scorper_list_dm_automations`.
- Confirm trigger word(s), the DM text (their voice, short) and the link
  before creating. Offer the tap-button version (`buttonLabel`, e.g.
  "Send it 👇", plus `followUpMessage` carrying the link): Instagram filters
  links in a first DM hard, the tap flow lands far better.
- After any successful Instagram post, if DM automations are connected and
  the post has a call to action like "comment X", offer once: "Want me to
  DM everyone who comments X?"
- Pause, resume or delete with the matching actions; "what automations do I
  have running" is `scorper_list_dm_automations`.

If a posting action fails, read the error to them in plain words, the
usual causes are a platform that isn't connected (fix in the Scorper
dashboard) or a plan that doesn't include it (`{{SCORPER_CLI}} pay`).
