---
name: scorper-posting
description: Post and schedule to the person's social accounts (Instagram, LinkedIn, TikTok, X, YouTube) through Scorper Connect, manage what is already queued, and work their Instagram comments and DMs. Use when they want to post something now, schedule a post, publish a local photo or video, cancel or reschedule something queued, check their calendar, read or reply to comments, send a DM, or run comment-to-DM automations. Trigger words - post to instagram, schedule this, publish, cancel that post, what's scheduled, reply to that comment, DM them, auto DM, comment to DM, ManyChat.
---

# Posting and engagement through Scorper Connect

Everything runs through the CLI tool proxy (JSON in, JSON out):

```
{{SCORPER_CLI}} tool                  # list every available action
{{SCORPER_CLI}} tool <name> --args '{"key": "value"}'
```

Run `tool` with no name for the live list. Roughly:

**Posting and the queue**
- `scorper_post_now`, `scorper_schedule_post`
- `scorper_calendar`: upcoming and recent
- `scorper_cancel_post`, `scorper_edit_post`, `scorper_post_now_by_id`: act on
  something already queued, by its id from the calendar
- `scorper_list_accounts`: connected accounts across all their brands

**Reading back what happened**
- `scorper_list_posts`: what is actually published, with media ids
- `scorper_post_metrics`: likes and comments on a post
- `scorper_analytics`: followers per platform, and the change since last time

**Comments and DMs (Instagram)**

The comment and DM actions are rolling out account by account, so trust
`{{SCORPER_CLI}} tool` over this list: if they are not in the output yet, they
are not on this account yet, and the automations below still are.

- `scorper_list_comments`, `scorper_reply_to_comment`
- `scorper_hide_comment`, `scorper_delete_comment`
- `scorper_list_conversations`, `scorper_send_dm`
- `scorper_dm_status`, `scorper_list_dm_automations`,
  `scorper_create_dm_automation`, `scorper_pause_dm_automation`,
  `scorper_delete_dm_automation`

**Generation**
- `scorper_generate_carousel`, `scorper_check_credits`

## The rules that matter

1. **While you are talking to them, read it back before it goes out**:
   caption, media, platform(s), time, and the exact account. Not because
   Scorper requires a gate, but because they are right there and a wrong
   caption on the wrong account is expensive. One clear confirmation, then
   fire. If instead they are asking you to BUILD something that posts by
   itself, build exactly that and do not bolt an approval step onto it. See
   the scorper-dashboard skill.
2. **Brands**: with one brand there is nothing to ask. With several, work the
   @handle out from what they said plus the status list
   (`{{SCORPER_CLI}} status --json`), pass it as `account`, and let the
   read-back in rule 1 catch a wrong guess. Ask only when it is genuinely
   ambiguous. A default (`{{SCORPER_CLI}} default @handle`) means you never
   have to.
3. **Local files first get a URL**: `{{SCORPER_CLI}} upload ./video.mp4`
   prints a hosted URL to pass as media. jpg, png, webp, mp4, mov, up to
   300 MB.
4. **Times**: ask their timezone once if it is ambiguous, send ISO timestamps.
5. **Captions in THEIR voice.** Short beats clever. Never pad with hashtags
   they did not ask for. When drafting, offer 3 to 5 options and let them pick.
6. **Multi-platform caption flow**: draft ONE caption first, then ask "same
   caption everywhere, or platform-specific for any of them?" If specific,
   suggest a tailored one per platform or take theirs. Then ONE call does it
   all: `caption` is the default, `captions` overrides per platform, e.g.
   `{"caption": "...", "captions": {"tiktok": "..."}}`. Never split one post
   into separate calls just for different captions.
7. **AI-made content**: pass `aiGenerated: true`. On TikTok videos that applies
   TikTok's permanent AI label (tell them it cannot be removed once posted).
   Instagram has no per-post API label, that disclosure is an account-level
   switch in the Instagram app, so remind accounts that mostly post AI content
   to turn it on themselves.
8. Free trial notes: a result may end with a "[Scorper trial note ...]".
   Follow it (mention the days left once per conversation, after the task,
   lightly) and never paste it verbatim. If a posting or DM action says the
   free trial has ended, tell them kindly and offer to subscribe right
   then, using the pay flow in the scorper skill.


## What the platforms do and do not allow

Say these plainly when they come up. They are platform rules, not Scorper's,
and stating them beats trying and failing:

- **Instagram DMs only work inside a 24-hour window** after that person's last
  message to the account. There is no way to DM by @handle and no way to DM
  someone who has never contacted them. So "DM all my followers" is not
  possible through any tool. `scorper_list_conversations` flags which threads
  are still open.
- **Instagram reach, impressions, saves and audience demographics are not
  available** through Scorper. Likes and comment counts per post, and
  followers over time, are. Do not offer the rest.
- **LinkedIn cannot be read back at all**, so no metrics, no comments, no DMs.
  Posting works (text, images, multi-image, PDF documents).
- **TikTok and X** expose no comments or DMs to Scorper.
- **Instagram allows 50 published posts per account per 24 hours.**
- Deleting a comment is permanent on Instagram's side. Hiding it is not, so
  offer hiding first unless they clearly want it gone.
- Instagram's API cannot delete a published post. That has to be done in the
  app, and `scorper_cancel_post` only works on something still queued.

## Shapes this covers

- "Post launch.mp4 to Instagram and TikTok now" → upload → caption flow → ONE
  post_now with both platforms.
- "Schedule this for 6pm tomorrow on LinkedIn" → confirm → schedule_post.
- "What's going out this week?" → calendar.
- "Cancel the one going out Friday" → calendar to find the id → confirm which
  one → cancel_post.
- "Move tomorrow's post to Thursday 9am" → calendar → edit_post.
- "What did my last post do?" → list_posts or post_metrics.
- "Reply to everyone asking about price" → list_comments → draft replies →
  show them → reply_to_comment per comment.
- "Make a carousel about X and post it" → generate_carousel → show them →
  confirm → post_now.

## Comment-to-DM automations (Instagram)

Someone comments a trigger word (like GUIDE) on a post and automatically gets
a DM with a message and a link. ManyChat-style, included in Max and Studio.
Needs a one-time second Instagram approval: `scorper_dm_status` says whether it
is connected, and `{{SCORPER_CLI}} connect --dm` opens it (right Instagram
account logged in first).

- About to post and they want an automation on it: create it with
  `post: "next"` BEFORE posting, then post. It attaches within about 5 minutes
  of going live and catches comments from the gap.
- Already posted: `post: "latest"` (check the caption it echoes back matches)
  or a media id from `scorper_list_dm_automations`.
- Confirm the trigger word(s), the DM text (their voice, short) and the link
  before creating. Offer the tap-button version (`buttonLabel`, e.g.
  "Send it 👇", plus `followUpMessage` carrying the link): Instagram filters
  links in a first DM hard, the tap flow lands far better.
- After a successful Instagram post, if DM automations are connected and the
  post has a "comment X" call to action, offer once: "Want me to DM everyone
  who comments X?"
- Pause, resume or delete with the matching actions.

If anything fails, read the error out in plain words. The usual causes are a
platform that is not connected (fix in the Scorper dashboard), a lapsed
subscription (`{{SCORPER_CLI}} pay`), a platform limit, or a key that was
created with limited access.
