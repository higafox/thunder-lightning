"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StreamState, StreamType, VideoData } from "./types";

function computeStream(data: VideoData, type: StreamType, key: string | null, dir?: -1 | 1): StreamState {
  let list: string[] | null = null;
  if (type === "shuffle") list = null;
  else if (type === "timeline") list = data.playlists.timeline;
  else if (type === "tag") list = key ? data.playlists.tags[key] ?? [] : [];
  else if (type === "artist") list = key ? data.playlists.artists[key] ?? [] : [];
  else if (type === "director") list = key ? data.playlists.directors[key] ?? [] : [];
  return { type, key, list, dir };
}

/**
 * Ports the prototype's TL singleton (play/advance/pickStream/timeline/setStream)
 * into a hook. Refs hold the imperative source of truth (mirroring the prototype's
 * plain-object mutation) so advance()/pickStream() always act on the latest
 * cur/stream/history even when called synchronously back-to-back.
 */
export function usePlayer(data: VideoData, initialSlug?: string | null) {
  const ids = useMemo(() => Object.keys(data.videos), [data]);

  const [cur, setCur] = useState<string | null>(null);
  const curRef = useRef<string | null>(null);

  const [stream, setStream] = useState<StreamState>({ type: "shuffle", key: null, list: null });
  const streamRef = useRef<StreamState>(stream);

  const historyRef = useRef<string[]>([]);
  const initedRef = useRef(false);

  const applyStream = useCallback(
    (type: StreamType, key: string | null, dir?: -1 | 1) => {
      const next = computeStream(data, type, key, dir);
      streamRef.current = next;
      setStream(next);
      return next;
    },
    [data]
  );

  const play = useCallback(
    (id: string) => {
      if (!data.videos[id]) return;
      const prev = curRef.current;
      if (prev) {
        historyRef.current.push(prev);
        if (historyRef.current.length > 50) historyRef.current.shift();
      }
      curRef.current = id;
      setCur(id);
    },
    [data]
  );

  const advance = useCallback(() => {
    const s = streamRef.current;
    if (s.type === "shuffle") {
      const recent = new Set(historyRef.current.slice(-5));
      let pick = ids[Math.floor(Math.random() * ids.length)];
      let guard = 0;
      while ((pick === curRef.current || recent.has(pick)) && guard < 40) {
        pick = ids[Math.floor(Math.random() * ids.length)];
        guard++;
      }
      play(pick);
      return;
    }
    const list = s.list;
    if (!list || !list.length) return;
    const i = curRef.current ? list.indexOf(curRef.current) : -1;
    const next = i === -1 ? list[0] : list[(i + 1) % list.length];
    play(next);
  }, [ids, play]);

  const pickStream = useCallback(
    (type: StreamType, key: string | null) => {
      const s = applyStream(type, key);
      if (type === "shuffle") {
        advance();
        return;
      }
      const list = s.list;
      if (list && list.length) {
        const i = curRef.current ? list.indexOf(curRef.current) : -1;
        const target = i === -1 ? list[0] : list[(i + 1) % list.length];
        play(target);
      } else {
        advance();
      }
    },
    [applyStream, advance, play]
  );

  const timeline = useCallback(
    (dir: -1 | 1) => {
      applyStream("timeline", null, dir);
      const list = data.playlists.timeline;
      let i = curRef.current ? list.indexOf(curRef.current) : -1;
      if (i === -1) i = 0;
      const ni = (i + dir + list.length) % list.length;
      play(list[ni]);
    },
    [applyStream, data, play]
  );

  // initial video: honor a specific slug (shareable URL) else pick random on mount.
  // done in an effect (not render) so the random pick is client-only and doesn't
  // trigger a hydration mismatch against the server-rendered (video-less) markup.
  /* eslint-disable react-hooks/set-state-in-effect -- intentional: one-time client-only init, not a derived-state sync */
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    applyStream("shuffle", null);
    if (initialSlug && data.videos[initialSlug]) {
      play(initialSlug);
    } else {
      play(ids[Math.floor(Math.random() * ids.length)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { cur, stream, pickStream, timeline, advance, ids };
}
