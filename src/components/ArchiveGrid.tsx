"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const archiveRef = useRef<HTMLDivElement>(null);
  const [showFloatingTop, setShowFloatingTop] = useState(false);

  const [search, setSearch] = useState("");
  // initialized from the URL (?tag=...) so a filtered archive link is
  // shareable/refreshable, same idea as the /video/[slug] URL sync in
  // Player.tsx. ArchiveGridReady only ever mounts client-side (see
  // ArchiveGrid above), so reading window here can't cause a hydration
  // mismatch.
  const [selTag, setSelTag] = useState<string | null>(() => new URLSearchParams(window.location.search).get("tag"));
  // shuffled on mount so each fresh visit to the archive looks different by
  // default, rather than always opening on the same newest-first order.
  const [shuffled, setShuffled] = useState<string[] | null>(() => shuffleArray(PL.timeline));
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

  // #archive is its own scrollable container (position: fixed + overflow-y:
  // auto), not the window -- show a floating "scroll to top" once you've
  // scrolled past ~3 viewport heights of it.
  useEffect(() => {
    const el = archiveRef.current;
    if (!el) return;
    const onScroll = () => setShowFloatingTop(el.scrollTop > el.clientHeight * 3);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
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

  // tag cloud order is independent of the video sort/shuffle above -- it only
  // rearranges the tag pills themselves. cycles popular (default, by usage
  // count) -> A-Z -> shuffled -> back to popular; a fresh shuffle is drawn
  // each time it lands on "shuffled" so re-cycling into it looks different.
  const [tagSort, setTagSort] = useState<"count" | "alpha" | "shuffle">("count");
  const [shuffledTags, setShuffledTags] = useState<string[]>([]);
  const cycleTagSort = () => {
    setTagSort((prev) => {
      if (prev === "count") return "alpha";
      if (prev === "alpha") {
        setShuffledTags(shuffleArray(Object.keys(CT.tags)));
        return "shuffle";
      }
      return "count";
    });
  };
  const tagSortLabel = tagSort === "count" ? "Tag: Popular" : tagSort === "alpha" ? "Tag: A–Z" : "Tag: Shuffle";

  const allTags = useMemo(() => {
    const names = Object.keys(CT.tags);
    if (tagSort === "alpha") return names.sort((a, b) => a.localeCompare(b));
    if (tagSort === "shuffle") return shuffledTags.length ? shuffledTags : names;
    return names.sort((x, y) => CT.tags[y] - CT.tags[x]);
  }, [CT.tags, tagSort, shuffledTags]);

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

  // "342 artists" / "384 directors" in the stats line open a roster of that
  // type; picking a name jumps to a random video of theirs rather than
  // filtering the grid, since there's no tag-style pill to filter by for
  // every single artist/director. Both stats share one modal instance with
  // an Artists/Directors tab switcher, rather than being two separate
  // modals, so flipping between them doesn't require closing and reopening.
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterKind, setRosterKind] = useState<"artists" | "directors">("artists");
  // cycles the same way the tag cloud's sort control does: A-Z -> most -> least -> A-Z
  const [rosterSort, setRosterSort] = useState<"alpha" | "most" | "least">("alpha");
  const cycleRosterSort = () => {
    setRosterSort((prev) => (prev === "alpha" ? "most" : prev === "most" ? "least" : "alpha"));
  };
  const rosterNames = useMemo(() => {
    if (!rosterOpen) return [];
    const pl = PL[rosterKind];
    const entries = Object.keys(pl).map((name) => ({ name, count: pl[name].length }));
    if (rosterSort === "most") return entries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    if (rosterSort === "least") return entries.sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [rosterOpen, rosterKind, rosterSort, PL]);
  const openRandomFor = (name: string) => {
    const ids = PL[rosterKind][name];
    if (!ids || !ids.length) return;
    const id = ids[Math.floor(Math.random() * ids.length)];
    setRosterOpen(false);
    router.push(`/video/${id}`);
  };

  return (
    <div id="archive" ref={archiveRef}>
      <div className="arcHead">
        <div className="t">{META.title}</div>
        <div className="st">{META.subtitle}</div>
        <div className="stats">
          {META.totalVideos} videos ·{" "}
          <button
            className="statsLink"
            onClick={() => {
              setRosterKind("artists");
              setRosterOpen(true);
            }}
          >
            {META.totalArtists} artists
          </button>{" "}
          ·{" "}
          <button
            className="statsLink"
            onClick={() => {
              setRosterKind("directors");
              setRosterOpen(true);
            }}
          >
            {META.totalDirectors} directors
          </button>{" "}
          · {META.totalTags} connections
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
          <button className="tgSort" onClick={cycleTagSort} title="Change tag order">
            {tagSortLabel}
          </button>
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
            className={`arcToTopFloat${showFloatingTop ? " show" : ""}`}
            onClick={() => archiveRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            aria-hidden={!showFloatingTop}
            tabIndex={showFloatingTop ? 0 : -1}
          >
            ↑ Scroll to top
          </button>
        </>
      )}
      {rosterOpen && (
        <RosterModal
          kind={rosterKind}
          onSwitchKind={setRosterKind}
          totalArtists={META.totalArtists}
          totalDirectors={META.totalDirectors}
          sort={rosterSort}
          onCycleSort={cycleRosterSort}
          names={rosterNames}
          onClose={() => setRosterOpen(false)}
          onPick={openRandomFor}
        />
      )}
    </div>
  );
}

function RosterModal({
  kind,
  onSwitchKind,
  totalArtists,
  totalDirectors,
  sort,
  onCycleSort,
  names,
  onClose,
  onPick,
}: {
  kind: "artists" | "directors";
  onSwitchKind: (k: "artists" | "directors") => void;
  totalArtists: number;
  totalDirectors: number;
  sort: "alpha" | "most" | "least";
  onCycleSort: () => void;
  names: { name: string; count: number }[];
  onClose: () => void;
  onPick: (name: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sortLabel = sort === "alpha" ? "A–Z" : sort === "most" ? "Most" : "Least";

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card roster">
        <button className="cardx" onClick={onClose}>
          ✕
        </button>
        <div className="rosterTabs">
          <button className={`rosterTab${kind === "artists" ? " sel" : ""}`} onClick={() => onSwitchKind("artists")}>
            Artists ({totalArtists})
          </button>
          <span className="rosterTabSep">/</span>
          <button className={`rosterTab${kind === "directors" ? " sel" : ""}`} onClick={() => onSwitchKind("directors")}>
            Directors ({totalDirectors})
          </button>
        </div>
        <div className="rosterSortRow">
          <button className="rosterSort" onClick={onCycleSort} title="Change sort order">
            {sortLabel}
          </button>
        </div>
        <div className="rosterList">
          {names.map(({ name, count }) => (
            <button key={name} className="rosterItem" onClick={() => onPick(name)}>
              {name} <span className="c">({count})</span>
            </button>
          ))}
        </div>
      </div>
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
