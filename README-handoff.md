# Thunder/Lightning — Claude Code Handoff Package

This folder is everything needed to build the production version in Claude Code.

## What's here

- **HANDOFF.md** — the real spec, reflecting every decision made during prototyping.
  Read this first. It supersedes the older SPEC.md.
- **thunder-lightning.html** — the working single-file prototype. Open it in a browser
  to see the target behavior and look. This is the visual reference.
- **convert.py** — the working CSV→JSON converter. Becomes the basis of `npm run sync`.
- **videos.json** — current generated data (169 videos), the exact output shape to match.

## How to start the Claude Code session

1. Put this whole folder in a new project directory.
2. Open Claude Code there.
3. Paste this as the first message:

> Build the production version of Thunder/Lightning, a personal music video archive.
> Read HANDOFF.md completely first — it's the source of truth and reflects decisions
> made while building the prototype. Open thunder-lightning.html to see the exact
> target behavior and visual design; match it. Use videos.json as the data shape to
> produce. convert.py is the working CSV→JSON logic; turn it into a `npm run sync`
> Notion sync script per HANDOFF.md.
>
> Stack: Next.js + React + TypeScript + Tailwind, Vercel target. Routes: /, /video/[slug],
> /archive. Port the constellation math from the prototype's inline JS. Ask me before
> coding if any Notion property names or the thumbnail field differ from what HANDOFF
> assumes.

## What you'll need to provide during that session

- A Notion internal integration token and the database ID (for the sync script).
  Keep these in local env vars, never committed.
- A fresh CSV export or Notion API access to test the sync.

## The two things worth doing in production that the prototype skips

1. **Vimeo end-detection** via the Vimeo Player SDK, so videos playing on Vimeo also
   auto-advance (the prototype can't, using a plain iframe).
2. **Vimeo thumbnails** via oEmbed for the archive, so Vimeo-only videos show a real
   thumbnail instead of a placeholder.
