import fs from "node:fs";
import path from "node:path";
import type { VideoData } from "./types";

let cached: VideoData | null = null;

export function getVideoData(): VideoData {
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "videos.json");
  const raw = fs.readFileSync(file, "utf-8");
  cached = JSON.parse(raw) as VideoData;
  return cached;
}
