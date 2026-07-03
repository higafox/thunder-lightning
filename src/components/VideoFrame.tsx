"use client";

import { useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/types";

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: string | HTMLElement,
        opts: {
          videoId: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: () => void;
            onStateChange?: (e: { data: number }) => void;
            onError?: (e: { data: number }) => void;
          };
        }
      ) => { destroy: () => void; pauseVideo?: () => void };
      PlayerState: { ENDED: number; PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Mode = "youtube" | "vimeo" | "blocked";
type BlockedProvider = "youtube" | "vimeo";

// Playback waterfall (HANDOFF.md): YouTube first (end-detection), fall back to
// Vimeo on embed error (101/150/153 = embedding disabled), else a blocked card
// with a "watch on source" link. Vimeo videos can also fail on their own
// (privacy/domain-restricted embeds) — sometimes with a catchable SDK error,
// sometimes silently (a black frame with no signal at all). Since that
// silent-failure case can't always be auto-detected, `video.embedBroken` is a
// manual override (set via the "Embed Broken" checkbox in Notion) that skips
// straight to the blocked card instead of attempting to embed at all.
//
// The caller mounts this with `key={video.id}` so a new video means a fresh
// component instance (mode re-derives from props at mount); within one mounted
// instance `mode` only ever moves forward through the waterfall on error.
export function VideoFrame({ video, onEnded }: { video: Video; onEnded: () => void }) {
  const [mode, setMode] = useState<Mode>(() =>
    video.embedBroken ? "blocked" : video.youtubeId ? "youtube" : video.vimeoId ? "vimeo" : "blocked"
  );
  const [blockedProvider, setBlockedProvider] = useState<BlockedProvider>(() =>
    video.youtubeId ? "youtube" : "vimeo"
  );
  const mountRef = useRef<HTMLDivElement>(null);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  });

  // The YouTube IFrame API takes a DOM node and replaces it with its own
  // <iframe>, mutating the tree behind React's back. If React owned that node
  // via JSX it would crash on unmount (removeChild on a node React no longer
  // recognizes). So `mountRef` is a plain wrapper React renders once and never
  // touches again; the actual mount point is an imperatively-created child
  // that only YT's API and this effect ever manipulate.
  useEffect(() => {
    if (mode !== "youtube" || !video.youtubeId) return;
    const wrapper = mountRef.current;
    if (!wrapper) return;
    const mountPoint = document.createElement("div");
    wrapper.appendChild(mountPoint);

    let player: { destroy: () => void } | null = null;
    let cancelled = false;
    let hasPlayed = false;
    let failTimer: ReturnType<typeof setTimeout> | null = null;

    const fallback = () => {
      if (cancelled) return;
      if (video.vimeoId) setMode("vimeo");
      else {
        setBlockedProvider("youtube");
        setMode("blocked");
      }
    };

    const build = () => {
      if (cancelled) return;
      if (!window.YT) return;
      player = new window.YT.Player(mountPoint, {
        videoId: video.youtubeId!,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
        events: {
          // Age-restricted videos (and some other embed refusals) don't fire
          // onError at all -- the player just sits showing YouTube's own
          // restriction card, forever "unstarted". If we never reach
          // PLAYING within a generous window, treat it as blocked. The
          // window is long enough that a real but slow-to-start video, or
          // one merely paused waiting on an autoplay-policy click, has time
          // to prove itself first.
          onReady: () => {
            if (cancelled) return;
            failTimer = setTimeout(() => {
              if (!hasPlayed) fallback();
            }, 8000);
          },
          onStateChange: (e) => {
            if (cancelled) return;
            if (e.data === window.YT!.PlayerState.PLAYING) {
              hasPlayed = true;
              if (failTimer) {
                clearTimeout(failTimer);
                failTimer = null;
              }
            }
            if (e.data === window.YT!.PlayerState.ENDED) onEndedRef.current();
          },
          // 2=bad param, 5=html5 error, 100=removed, 101/150=embed disabled, 153=config error
          onError: () => {
            if (failTimer) {
              clearTimeout(failTimer);
              failTimer = null;
            }
            fallback();
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      build();
    } else {
      if (!document.getElementById("ytapi")) {
        const s = document.createElement("script");
        s.id = "ytapi";
        s.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(s);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        build();
      };
    }

    return () => {
      cancelled = true;
      if (failTimer) clearTimeout(failTimer);
      if (player) {
        try {
          player.destroy();
        } catch {
          /* noop */
        }
      }
      // belt-and-suspenders: whatever YT left behind, clear it ourselves so
      // this wrapper is guaranteed empty before React reuses/removes it.
      wrapper.innerHTML = "";
    };
  }, [mode, video.id, video.youtubeId, video.vimeoId]);

  useEffect(() => {
    if (mode !== "vimeo" || !video.vimeoId) return;
    const iframe = mountRef.current?.querySelector("iframe");
    if (!iframe) return;
    let vimeoPlayer: import("@vimeo/player").default | null = null;
    let cancelled = false;

    import("@vimeo/player").then(({ default: Player }) => {
      if (cancelled || !iframe) return;
      vimeoPlayer = new Player(iframe);
      vimeoPlayer.on("ended", () => {
        if (!cancelled) onEndedRef.current();
      });
      // privacy/domain-restricted embeds (and similar) surface here — e.g.
      // PrivacyError. Genuine autoplay-blocked-pending-click videos do NOT
      // error; they just wait, so this only catches real failures.
      vimeoPlayer.on("error", () => {
        if (cancelled) return;
        setBlockedProvider("vimeo");
        setMode("blocked");
      });
    });

    return () => {
      cancelled = true;
      try {
        vimeoPlayer?.unload();
      } catch {
        /* noop */
      }
    };
  }, [mode, video.id, video.vimeoId]);

  if (mode === "youtube" && video.youtubeId) {
    return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
  }

  if (mode === "vimeo" && video.vimeoId) {
    return (
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }}>
        <iframe
          src={`https://player.vimeo.com/video/${video.vimeoId}?autoplay=1&title=0&byline=0`}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  // blocked card: shown when a video refuses to embed. Provider-specific link
  // + thumbnail depending on which provider actually failed.
  if (blockedProvider === "vimeo" && video.vimeoId) {
    const url = `https://vimeo.com/${video.vimeoId}`;
    const thumb = video.thumbnailUrl;
    return (
      <a
        className="blocked"
        href={url}
        target="_blank"
        rel="noopener"
        style={thumb ? { backgroundImage: `url('${thumb}')` } : undefined}
      >
        <div className="blockedInner">
          <div className="blockedCta">Watch on Vimeo ↗</div>
          <div className="blockedLabel">Playback restricted</div>
        </div>
      </a>
    );
  }

  // Only reachable when a youtubeId exists (data excludes videos with no link at all).
  if (!video.youtubeId) return null;
  const url = `https://www.youtube.com/watch?v=${video.youtubeId}`;
  const thumb = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
  return (
    <a className="blocked" href={url} target="_blank" rel="noopener" style={{ backgroundImage: `url('${thumb}')` }}>
      <div className="blockedInner">
        <div className="blockedCta">Watch on YouTube ↗</div>
        <div className="blockedLabel">Playback restricted</div>
      </div>
    </a>
  );
}
