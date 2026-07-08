"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Video, VideoData } from "@/lib/types";
import { useVideoData } from "@/lib/useVideoData";

function shuffleArray<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ArchiveGrid() {
  const data = useVideoData();
  if (!data) return <div id="archive" />;
  return <ArchiveGridReady data={data} />;
}

function ArchiveGridReady({ data }: { data: VideoData }) {
  const router = useRouter();
  const { videos: V, playlists: PL, counts: CT, meta: META } = data;

  const [search, setSearch] = useState("");
  // initialized from the URL (?tag=...) so a filtered archive link is
  // shareable/refreshable, same idea as the /video/[slug] URL sync in
  // Player.tsx. ArchiveGridReady only ever mounts client-side (see
  // ArchiveGrid above), so reading window here can't cause a hydration
  // mismatch.
  const [selTag, setSelTag] = useState<string | null>(() => new URLSearchParams(window.location.search).get("tag"));
  const [shuffled, setShuffled] = useState<string[] | null>(null);
  // null = untouched (defaults to newest-first, same ordering as "desc" below
  // but shown unhighlighted); once clicked it only ever alternates asc/desc,
  // it never falls back to the unhighlighted default.
  const [chrono, setChrono] = useState<boolean | null>(null);

  // CSS multi-column (columns:3) balances items across declared columns by
  // its own heuristics; with a small filtered result set it can leave a
  // whole column empty even though there's plenty of horizontal room (looks
  // like "2 columns" on a wide screen). Assigning items to columns explicitly
  // guarantees every column gets used whenever there are enough items.
  const [numCols, setNumCols] = useState(3);
  useEffect(() => {
    const update = () => setNumCols(window.innerWidth <= 820 ? 2 : 3);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // keep ?tag= in sync with the current filter so a filtered view is
  // shareable/refreshable, without triggering Next's router (no remount).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (selTag) params.set("tag", selTag);
    else params.delete("tag");
    const qs = params.toString();
    const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [selTag]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;
      if (e.key === "a" || e.key === "A") router.push("/");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  const allTags = useMemo(() => Object.keys(CT.tags).sort((x, y) => CT.tags[y] - CT.tags[x]), [CT.tags]);

  const list = useMemo(() => {
    const base = shuffled ? shuffled.slice() : chrono === true ? PL.timeline.slice() : PL.timeline.slice().reverse();
    const q = search.toLowerCase().trim();
    return base.filter((id) => {
      const v = V[id];
      if (selTag && !v.tags.includes(selTag)) return false;
      if (q) {
        const hay = `${v.artist} ${v.song} ${v.director} ${v.directorAffiliate ?? ""} ${v.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [shuffled, chrono, PL.timeline, search, selTag, V]);

  const columns = useMemo(() => {
    const cols: string[][] = Array.from({ length: numCols }, () => []);
    list.forEach((id, i) => cols[i % numCols].push(id));
    return cols;
  }, [list, numCols]);

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
          <button
            className={`arcShuffle${!shuffled && chrono !== null ? " sel" : ""}`}
            onClick={() => {
              setShuffled(null);
              setChrono((c) => (c === true ? false : true));
            }}
          >
            {chrono === true ? "Chronological ↓" : chrono === false ? "Chronological ↑" : "Chronological"}
          </button>
        </div>
        <div className="tagbar">
          <button className={`tg${selTag === null ? " sel" : ""}`} onClick={() => setSelTag(null)}>
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              className={`tg${selTag === t ? " sel" : ""}`}
              onClick={() => setSelTag((prev) => (prev === t ? null : t))}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="empty">Nothing matches that thread.</div>
      ) : (
        <>
          <div className="archiveGrid">
            {columns.map((col, i) => (
              <div className="archiveCol" key={i}>
                {col.map((id) => (
                  <Cell key={id} video={V[id]} />
                ))}
              </div>
            ))}
          </div>
          <button
            className="arcToTop"
            onClick={(e) => e.currentTarget.closest("#archive")?.scrollTo({ top: 0, behavior: "smooth" })}
          >
            ↑ Scroll to top
          </button>
        </>
      )}
    </div>
  );
}

function Cell({ video: v }: { video: Video }) {
  return (
    <Link href={`/video/${v.id}`} className="cell">
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
          {v.directorAffiliate ? ` (${v.directorAffiliate})` : ""}
          {v.dateDisplay ? ` · ${v.dateDisplay}` : ""}
        </div>
        <div className="tgs">{v.tags.join("  ·  ")}</div>
      </div>
    </Link>
  );
}
