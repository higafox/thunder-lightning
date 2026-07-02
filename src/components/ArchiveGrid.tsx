"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { VideoData } from "@/lib/types";

function shuffleArray<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ArchiveGrid({ data }: { data: VideoData }) {
  const router = useRouter();
  const { videos: V, playlists: PL, counts: CT, meta: META } = data;

  const [search, setSearch] = useState("");
  const [selTags, setSelTags] = useState<Set<string>>(new Set());
  const [shuffled, setShuffled] = useState<string[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "A") router.push("/");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  const allTags = useMemo(() => Object.keys(CT.tags).sort((x, y) => CT.tags[y] - CT.tags[x]), [CT.tags]);

  const list = useMemo(() => {
    const base = shuffled ? shuffled.slice() : PL.timeline.slice().reverse();
    const q = search.toLowerCase().trim();
    return base.filter((id) => {
      const v = V[id];
      if (selTags.size) {
        for (const t of selTags) if (!v.tags.includes(t)) return false;
      }
      if (q) {
        const hay = `${v.artist} ${v.song} ${v.director} ${v.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [shuffled, PL.timeline, search, selTags, V]);

  return (
    <div id="archive">
      <div className="arcHead">
        <div className="t">{META.title}</div>
        <div className="st">{META.subtitle}</div>
        <div className="stats">
          {META.totalVideos} videos · {META.totalArtists} artists · {META.totalDirectors} directors · {META.totalTags}{" "}
          connections
        </div>
        <div className="arcTools">
          <input
            id="arcSearch"
            placeholder="Search artist, song, director, tag"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <button className="arcShuffle" onClick={() => setShuffled(shuffleArray(PL.timeline))}>
            Shuffle
          </button>
        </div>
        <div className="tagbar">
          <button className={`tg${selTags.size === 0 ? " sel" : ""}`} onClick={() => setSelTags(new Set())}>
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              className={`tg${selTags.has(t) ? " sel" : ""}`}
              onClick={() =>
                setSelTags((prev) => {
                  const next = new Set(prev);
                  if (next.has(t)) next.delete(t);
                  else next.add(t);
                  return next;
                })
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="archiveGrid">
        {list.length === 0 ? (
          <div className="empty">Nothing matches that thread.</div>
        ) : (
          list.map((id) => {
            const v = V[id];
            return (
              <Link key={id} href={`/video/${id}`} className="cell">
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} loading="lazy" alt="" />
                ) : (
                  <div className="ph">{v.provider.toUpperCase()}</div>
                )}
                <div className="ov">
                  <div className="a">{v.artist}</div>
                  <div className="s">{v.song}</div>
                  <div className="d">
                    {v.director}
                    {v.dateDisplay ? ` · ${v.dateDisplay}` : ""}
                  </div>
                  <div className="tgs">{v.tags.join("  ·  ")}</div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
