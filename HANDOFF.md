# Thunder/Lightning — Build Handoff

**Subtitle:** A Love Letter to Music Videos
**Author:** higafox.com

This document is the source of truth for building the production version. It reflects
what was actually decided and built across an iterative prototyping process, and
supersedes any earlier SPEC.md where they differ. A working single-file prototype
(`thunder-lightning.html`) accompanies this doc — treat it as the visual and
behavioral reference. When in doubt, match the prototype.

---

## What this is

A personal, public music video archive built from a Notion database. Not a social
platform, playlist manager, or recommendation engine. An immersive way to wander
through music videos by following connections: tags, artists, directors, and time.

The current video sits at the center of a constellation. Every pill around it is
either a property of the current video or a path to another one.

---

## Recommended stack

- Next.js + React + TypeScript + Tailwind, Vercel deploy target
- Static data file at `public/videos.json`
- A `npm run sync` script that pulls from Notion and regenerates the JSON
- The prototype is vanilla HTML/JS/SVG; the constellation math ports directly

---

## Routes

- `/` — main player, starts on a random playable video
- `/video/[slug]` — main player on a specific video (shareable URL)
- `/archive` — full thumbnail grid

---

## Data pipeline

### Source
A Notion database exported as CSV. Columns actually present:
`Name`, `Artist`, `Song`, `Director`, `Release Date`, `YouTube`, `Vimeo`, `Tags`,
`Thumbnail URL` (usually empty), `Embed Broken` (checkbox, manual override —
see below), plus a `Rating` (ignored) and `Formula` (duplicate of Name, ignored).

### Conversion (`convert.py`, included)
The included Python script is the working converter. It becomes the basis of
`npm run sync` — the transform logic is identical, only the input changes (CSV file
now, Notion API later). Key behaviors, all deliberate:

- **Exclude** rows with no YouTube AND no Vimeo link (~1 skipped in current data).
- **Keep BOTH** youtubeId and vimeoId when present — do not collapse to one provider.
  This is required for the playback waterfall (see below).
- **Directors are ONE name, never split.** Do not split on `/`, `&`, `and`, `+`, or
  `,`. Names like "AB/CD/CD", "Kijek/Adamski", "Dom & Nic", "Hammer & Tongs" are
  single entities. Splitting them fabricates directors that don't exist. The script
  does strip URLs, parenthetical annotations `(...)`, and social `@handles` out of
  the director field (these are data-entry errors), and cleans a dangling leading
  "and"/"&" left after URL removal.
- **Dates**: parse "May 3, 2023" / "May 2023" / "2023" formats. Use the most specific
  clean display available. Missing dates sort last.
- **Slugs**: `artist-song`, lowercased, punctuation stripped, deduped with numeric
  suffix on collision.

### Generated JSON shape
```
{
  meta: { title, subtitle, totalVideos, totalArtists, totalDirectors, totalTags },
  videos: {
    "slug": {
      id, artist, song,
      director,            // full string, one name
      directors,           // array with a single entry (kept as array for flexibility)
      dateDisplay,         // "May 2023" or "2023" or null
      sortDate,            // "2023-05-01" for sorting; "9999-99-99" if missing
      year,
      provider,            // "youtube" | "vimeo" (primary)
      youtubeId, vimeoId,  // BOTH kept when available
      thumbnailUrl,        // YouTube hqdefault, or null for Vimeo-only
      tags: [...],
      embedBroken,         // manual override: skip embedding, show watch-on-source card
    }
  },
  playlists: {
    timeline: [...ids sorted ascending by date],
    tags:      { "dance": [...ids] },
    artists:   { "Björk": [...ids] },
    directors: { "Chris Cunningham": [...ids] }
  },
  counts: { tags: {...}, artists: {...}, directors: {...} }
}
```
All playlists are pre-sorted by date ascending. The player relies on this.

### Notion sync script (to build)
- `npm run sync` reads a Notion integration token + database ID from env
  (`NOTION_TOKEN`, `NOTION_DATABASE_ID`), never exposed to the browser.
- Transforms Notion rows into the exact JSON shape above (reuse convert.py's logic).
- Writes `public/videos.json`. Commit and deploy.
- Property names to map: Artist, Song, Director, Release Date, YouTube, Vimeo, Tags,
  Thumbnail URL, Embed Broken.

---

## Playback waterfall (important)

Videos play inline. The order of attempts:

1. **YouTube first** (via the YouTube IFrame API) — needed for end-detection so the
   stream can auto-advance when a song finishes.
2. **On YouTube error** (embedding disabled — codes 101/150/153, common on Vevo/label
   uploads): if the video also has a Vimeo link, silently swap to the Vimeo player.
3. **No Vimeo fallback**: show a "blocked card" — the YouTube thumbnail, dimmed, with
   "Watch on YouTube ↗" over "Embedding disabled". This card is the ONE place a
   watch-on-source link remains; keep it, or those videos are unwatchable. The blocked
   card does not auto-advance; the user moves on via any control.

Vimeo has no end-event from a plain iframe, so a video playing via Vimeo won't
auto-advance. For the production build, consider the Vimeo Player SDK to catch the
`ended` event and keep auto-advance working on Vimeo too. (Optional; not in prototype.)

Note: there is NO "Vimeo mode" — we built and then removed it. A global Vimeo filter
gutted the tag playlists (a 3-video tag with 1 on Vimeo became a dead thread), which
felt wrong. Don't rebuild it.

**Manual override (`embedBroken`)**: some Vimeo embeds fail silently — privacy/
domain-restricted, no catchable error, just a black frame — and the YouTube waterfall's
own error detection doesn't always fire either (age-restricted videos in particular).
Rather than chase unreliable auto-detection, check the "Embed Broken" checkbox in
Notion for any video confirmed broken; the player skips straight to the blocked card
(whichever provider link is available) instead of attempting to embed at all.

---

## The player

Dark mode only. Video centered. Frame is capped by BOTH viewport width and height
(`min(74vw, 112vh, 1080px)` in the prototype) so it never grows so tall on a laptop
that it crowds the controls and metadata. On short viewports height wins; on wide
monitors width wins.

The whole player block sits slightly below true vertical center (top padding) so the
Shuffle crown has breathing room from the top of the window.

### Metadata (below the video, always visible)
```
Artist "Song"                 <- one line: artist sans, song italic serif w/ quotes
Director · Month Year         <- tight 2px gap below, dimmer
```
- Artist is clickable (launches artist stream) when the artist has 2+ videos.
- Each director is clickable (launches director stream) when that director has 2+.
- No "watch on source" link in the metadata — removed. (Only the blocked card has one.)

### The constellation
A calm offset-grid of pills around the video, plus a decorative starburst behind it.

**Pills** (all same size, ~16px, gold border):
- **Tags** of the current video, sorted by global popularity. Clickable when the tag
  has 2+ videos. A tag with only 1 video is a "terminal" pill: dimmer gold border,
  italic serif, non-clickable.
- **Artist/director "person" pills** — added automatically when the current video's
  artist or a director has 2+ videos. Same styling as tags. This is the discoverable
  way to follow an artist/director (in addition to the clickable metadata).
- Pills split alternately down a LEFT rail and a RIGHT rail, person pills first
  (prime spots), then tags. Anchored by inner edge so wide labels grow away from the
  video and never overlap the frame. Kept clear of the frame at all sizes.
- When a rail has only 1–2 pills, they're placed at a random diagonal angle (20–50°
  off horizontal) so their connector lines never run flat at 0°/180°.

**Controls:**
- **Shuffle** — crown, top center, highest. Default stream on load.
- **Earlier / Later** — flank the top corners, inner edge flush to the video's left/
  right borders (measured from the real frame rect at runtime, not fixed %), sitting
  just above the video's top edge, lower than Shuffle.

**Connector lines** (center → each pill):
- Bright gold (`--active`, #e8d26a). Followable pills (tags 2+, person, controls) get
  a line that EXTENDS past the pill and beyond the frame edge (clips at viewport).
  Terminal one-video tags get a line that STOPS at the pill — the visual tell that a
  thread continues vs. dead-ends.
- The active stream's line is thicker (.5 vs .34 in SVG units); all connectors share
  the same color, weight carries emphasis.

**Decorative starburst** (behind everything, does not touch pills):
- ~120 thin gold radial lines (`#c9a659`, dimmer than connectors), full length varied
  with a short bias (`rand()*rand()`) so most stop soon past the frame and a few reach
  further. Angular jitter so spacing is organic, not mechanical. Seeded off the
  current video's slug so the pattern is stable per video and reshuffles on change.
  Near-vertical lines suppressed to avoid a stray axis line.
- Plus a smaller set of ambient rays and long ornamental spokes (same family).

The brand line ("Thunder/Lightning · a love letter to music videos", top left) sits on
a soft feathered radial dark backing so the starburst behind it doesn't muddy the text
(a text-shadow alone wasn't enough — the backing plate is the fix). Only the title is
clickable (home); the subtitle is plain text.

---

## Stream model

One active stream at a time. Clicking any pill/control switches the active stream and
immediately hard-cuts to the next video in it. When a video ends, advance within the
active stream.

- **Shuffle**: random playable video, avoid the last 5 played. Default on load.
- **Tag**: next chronological video with that tag; loops at end.
- **Artist / Director**: next chronological video by that artist/director; loops.
- **Timeline (Earlier/Later)**: previous/next playable video across the whole archive
  by date; loops at ends. Only the arrow you clicked lights (direction is tracked).

Hard cut between videos. Metadata and constellation update on each change.

Keyboard: ← Earlier, → Later, R Shuffle, A Archive, Esc close overlays.

---

## Archive (`/archive`)

Cosmos-style dense masonry grid, dark. Entering the archive stops player playback (tear
down the iframe, not just pause — pausing isn't reliable across providers; reload on
return).

- 3 columns desktop (2 on narrow), full-width to match the header/tag bar.
- Header: title, subtitle, stats line (`N videos · N artists · N directors · N tags`),
  search box, Shuffle button.
- Thumbnails only until hover; on hover an overlay shows artist / song (larger) and
  director · date · tags (smaller).
- Search matches artist, song, director, and tags. Multiple tag filters combine with
  search. "All" clears tag filters.
- Archive Shuffle reorders the grid in place, stays in the archive.
- Newest-first by default.
- Click a thumbnail → player view with that video (`/video/[slug]`).
- Vimeo-only videos have no YouTube thumbnail; show a graceful placeholder tile (or
  fetch the Vimeo thumbnail via oEmbed in the production build — nice-to-have).

---

## About

Small popup (not a page), triggered top-right. Current copy:

> An ever-growing collection of music videos I keep returning to. Connected as a
> stream of consciousness. Follow any thread.
>
> higafox.com

---

## Mobile

Do not recreate the constellation. Simplified single-video random playlist: one video,
basic metadata, Prev / Shuffle / Next. No tags, no constellation. Desktop-first.

---

## Color system

- `--active` #e8d26a — the one accent. Active pills, all connector lines, live text.
- `#c9a659` — dimmer gold for the decorative starburst/rays/spokes (low opacity).
- `--bg` #0a0a0b, `--bg2` #0e0e10, `--pill` #1b1b1e — near-black surfaces.
- `--ink` #f2f0ea (primary text), `--dim` #7d7a73 (director/date, nav, terminal tags),
  `--dimmer` #4a4844, `--line` #1e1e21.
- Tag/person pill borders use the accent gold at 55% opacity; terminal tags at 32%.

---

## Non-goals (do not build)

Accounts, likes, comments, user playlists, uploads, AI recommendations, analytics,
session stats, ratings behavior, featured videos, PWA/offline, complex physics,
social sharing beyond normal URLs, and — specifically — no Vimeo filter mode.

---

## Known data notes

- One row is skipped (no playable link).
- ~23 videos have both YouTube and Vimeo (these get the fallback safety net).
- ~17 are Vimeo-only.
- Watch for URLs or stray text landing in the Artist or Director fields on future
  Notion edits; the converter cleans directors but a URL in Artist would display oddly.
