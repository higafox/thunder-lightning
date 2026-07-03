// npm run sync -- path/to/export.csv
//
// Reads a Notion "Music Videos" database exported as CSV and regenerates
// public/videos.json. Port of convert.py — same transform logic, CSV in,
// JSON out. See HANDOFF.md for the full behavior spec.
//
// Notion columns expected: Name, Artist, Song, Director, Release Date,
// YouTube, Vimeo, Tags, Thumbnail URL (usually empty), Embed Broken
// (checkbox, manual override for embeds confirmed broken -- see HANDOFF.md),
// Rating (ignored), Formula (ignored, duplicate of Name).

import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type { Counts, Meta, Playlists, Provider, Video, VideoData } from "../src/lib/types";

const DEFAULT_CSV = "notion-export.csv";

function ytId(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function vimId(url: string | undefined | null): string | null {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function isChecked(raw: string | undefined | null): boolean {
  if (!raw) return false;
  return /^(yes|true|checked|x|✓)$/i.test(raw.trim());
}

function slugify(artist: string, song: string): string {
  let base = `${artist}-${song}`.toLowerCase();
  base = base.replace(/['"“”’]/g, "");
  base = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base.slice(0, 60);
}

interface ParsedDate {
  sortDate: string | null;
  display: string | null;
  year: number | null;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function parseDate(raw: string): ParsedDate {
  const d = raw.trim();
  if (!d) return { sortDate: null, display: null, year: null };

  // "May 3, 2023"
  let m = d.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const monthIdx = MONTHS.indexOf(m[1].toLowerCase());
    if (monthIdx !== -1) {
      const day = m[2].padStart(2, "0");
      const month = String(monthIdx + 1).padStart(2, "0");
      const year = m[3];
      return {
        sortDate: `${year}-${month}-${day}`,
        display: `${m[1]} ${year}`,
        year: Number(year),
      };
    }
  }

  // "May 2023"
  m = d.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const monthIdx = MONTHS.indexOf(m[1].toLowerCase());
    if (monthIdx !== -1) {
      const month = String(monthIdx + 1).padStart(2, "0");
      const year = m[2];
      return {
        sortDate: `${year}-${month}-01`,
        display: `${m[1]} ${year}`,
        year: Number(year),
      };
    }
  }

  // "2023"
  m = d.match(/^(\d{4})$/);
  if (m) {
    return { sortDate: `${m[1]}-01-01`, display: m[1], year: Number(m[1]) };
  }

  // unrecognized format: no sort date, but keep the raw string as display
  return { sortDate: null, display: d, year: null };
}

function cleanDirector(raw: string): string {
  let d = raw.trim();
  // drop URLs sitting in the director field (data errors)
  d = d.replace(/https?:\/\/\S+/g, "");
  // strip parenthetical annotations: (animation: ...), (Creative Director: ...)
  d = d.replace(/\([^)]*\)/g, "");
  // strip social handles
  d = d.replace(/\s*[-–]\s*@[\w.]+/g, "");
  d = d.replace(/\s*@[\w.]+/g, "");
  // collapse leftover separators/whitespace and stray leading commas
  d = d.replace(/^\s*[,/&]+\s*/, "");
  d = d.replace(/^\s*(and|&)\s+/i, ""); // dangling "and X" after URL removal
  d = d.replace(/\s{2,}/g, " ").trim().replace(/,+$/, "").trim();
  // non-breaking spaces
  d = d.replace(/ /g, " ").trim();
  return d;
}

function group(videos: Video[], field: "tags" | "artist" | "directors"): Record<string, string[]> {
  const g: Record<string, string[]> = {};
  for (const v of videos) {
    const vals = field === "tags" || field === "directors" ? (v[field] as string[]) : [v[field] as string];
    for (const val of vals) {
      if (!val) continue;
      (g[val] ??= []).push(v.id);
    }
  }
  return g;
}

function main() {
  const csvArg = process.argv[2] || DEFAULT_CSV;
  const csvPath = path.resolve(process.cwd(), csvArg);
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    console.error(`Usage: npm run sync -- path/to/export.csv`);
    console.error(`(or drop a CSV named "${DEFAULT_CSV}" in the project root)`);
    process.exit(1);
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) {
    for (const e of parsed.errors) console.warn("CSV parse warning:", e.message);
  }
  const rows = parsed.data;

  const videos: Record<string, Video> = {};
  let skipped = 0;

  for (const r of rows) {
    const yt = ytId(r["YouTube"]);
    const vm = vimId(r["Vimeo"]);
    if (!yt && !vm) {
      skipped++;
      continue;
    }
    const artist = (r["Artist"] || "").trim();
    const song = (r["Song"] || "").trim();
    if (!artist || !song) {
      skipped++;
      continue;
    }

    const { sortDate, display, year } = parseDate(r["Release Date"] || "");
    const tags = (r["Tags"] || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const director = cleanDirector((r["Director"] || "").trim());
    // whole director string is ONE name. never split.
    const directors = director ? [director] : [];

    let slug = slugify(artist, song);
    const orig = slug;
    let n = 2;
    while (videos[slug]) {
      slug = `${orig}-${n}`;
      n++;
    }

    const primary: Provider = yt ? "youtube" : "vimeo";
    const notionThumb = (r["Thumbnail URL"] || "").trim();
    const thumbnailUrl = notionThumb
      ? notionThumb
      : yt
      ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg`
      : null;
    const embedBroken = isChecked(r["Embed Broken"]);

    videos[slug] = {
      id: slug,
      artist,
      song,
      director,
      directors,
      dateDisplay: display,
      sortDate: sortDate || "9999-99-99",
      year,
      provider: primary,
      youtubeId: yt,
      vimeoId: vm,
      thumbnailUrl,
      tags,
      embedBroken,
    };
  }

  const ordered = Object.values(videos).sort((a, b) => {
    if (a.sortDate !== b.sortDate) return a.sortDate < b.sortDate ? -1 : 1;
    const aLower = a.artist.toLowerCase();
    const bLower = b.artist.toLowerCase();
    return aLower < bLower ? -1 : aLower > bLower ? 1 : 0;
  });
  const timeline = ordered.map((v) => v.id);

  const tagsPl = group(ordered, "tags");
  const artistsPl = group(ordered, "artist");
  const directorsPl = group(ordered, "directors");

  const counts: Counts = {
    tags: Object.fromEntries(Object.entries(tagsPl).map(([k, v]) => [k, v.length])),
    artists: Object.fromEntries(Object.entries(artistsPl).map(([k, v]) => [k, v.length])),
    directors: Object.fromEntries(Object.entries(directorsPl).map(([k, v]) => [k, v.length])),
  };

  const meta: Meta = {
    title: "Thunder/Lightning",
    subtitle: "A Love Letter to Music Videos",
    totalVideos: Object.keys(videos).length,
    totalArtists: Object.keys(artistsPl).length,
    totalDirectors: Object.keys(directorsPl).length,
    totalTags: Object.keys(tagsPl).length,
  };

  const playlists: Playlists = { timeline, tags: tagsPl, artists: artistsPl, directors: directorsPl };
  const data: VideoData = { meta, videos, playlists, counts };

  const outPath = path.join(process.cwd(), "public", "videos.json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");

  console.log(`Playable: ${Object.keys(videos).length} | skipped: ${skipped}`);
  console.log(
    `Artists: ${Object.keys(artistsPl).length} | Directors: ${Object.keys(directorsPl).length} | Tags: ${Object.keys(tagsPl).length}`
  );
  console.log(`Wrote ${outPath}`);
}

main();
