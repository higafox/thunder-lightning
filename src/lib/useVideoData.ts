"use client";

import { useEffect, useState } from "react";
import type { VideoData } from "./types";

// Fetched once and cached at module scope so every route (/, /video/[slug],
// /archive) shares the same copy instead of each server-rendering the whole
// ~200KB dataset into its own page payload. First component to mount
// triggers the fetch; every other mount (including across client-side route
// changes within the same session) reuses the cached result synchronously.
let cached: VideoData | null = null;
let inflight: Promise<VideoData> | null = null;

function loadVideoData(): Promise<VideoData> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/videos.json")
      .then((res) => res.json())
      .then((data: VideoData) => {
        cached = data;
        return data;
      });
  }
  return inflight;
}

export function useVideoData(): VideoData | null {
  const [data, setData] = useState<VideoData | null>(cached);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    loadVideoData().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
