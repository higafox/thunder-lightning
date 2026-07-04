"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { VideoData } from "@/lib/types";
import type { NodeAction } from "@/lib/constellation";
import { usePlayer } from "@/lib/useStream";
import { useVideoData } from "@/lib/useVideoData";
import { VideoFrame } from "./VideoFrame";
import { Constellation } from "./Constellation";
import { MobilePlayer } from "./MobilePlayer";

export function Player({ initialSlug }: { initialSlug?: string | null }) {
  const data = useVideoData();
  if (!data) {
    return (
      <div id="player">
        <div className="stage">
          <div className="frame" id="frame">
            <div className="placeholder">loading</div>
          </div>
        </div>
      </div>
    );
  }
  return <PlayerReady data={data} initialSlug={initialSlug} />;
}

function PlayerReady({ data, initialSlug }: { data: VideoData; initialSlug?: string | null }) {
  const router = useRouter();
  const { cur, stream, pickStream, timeline, advance } = usePlayer(data, initialSlug ?? null);
  const frameRef = useRef<HTMLDivElement>(null);

  const video = cur ? data.videos[cur] : null;
  const CT = data.counts;

  // Desktop and mobile are two different embeds of the same video. If both
  // were ever mounted at once, CSS's display:none on whichever is hidden
  // does NOT stop that iframe from loading and autoplaying audio -- that
  // was producing doubled-up sound. Only one is ever rendered, decided by
  // an actual viewport check (client-only, so this starts at null to avoid
  // a hydration mismatch and resolves right after mount).
  //
  // Uses the SMALLER of width/height rather than width alone, so a phone
  // rotated to landscape (width easily 800px+) still gets the simplified
  // mobile view instead of the cluttered desktop constellation -- a
  // phone's short axis stays ~375-430px in either orientation, while a
  // real desktop window has both dimensions large.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setIsMobile(Math.min(window.innerWidth, window.innerHeight) <= 720);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // keep the address bar in sync with whatever's actually playing (shuffle,
  // tag/artist/director streams, timeline) so any moment is shareable/
  // refreshable. Uses the raw History API, not next/navigation's router, so
  // this never triggers Next to re-render/remount the page for the new slug.
  useEffect(() => {
    if (!cur) return;
    const newPath = `/video/${cur}`;
    if (window.location.pathname !== newPath) {
      window.history.replaceState(null, "", newPath);
    }
  }, [cur]);

  const handleAction = useCallback(
    (action: NodeAction) => {
      if (!action) return;
      if (action.kind === "shuffle") pickStream("shuffle", null);
      else if (action.kind === "stream") pickStream(action.type, action.key);
      else if (action.kind === "timeline") timeline(action.dir);
    },
    [pickStream, timeline]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping) return;
      if (e.key === "ArrowLeft") timeline(-1);
      else if (e.key === "ArrowRight") timeline(1);
      else if (e.key === "r" || e.key === "R") pickStream("shuffle", null);
      else if (e.key === "a" || e.key === "A") router.push("/archive");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [timeline, pickStream, router]);

  const artistOn = video ? (CT.artists[video.artist] || 0) > 1 : false;
  const artistActive = video ? stream.type === "artist" && stream.key === video.artist : false;

  if (isMobile === null) return null; // viewport not yet determined; mount neither embed

  if (isMobile) {
    return (
      <MobilePlayer
        video={video}
        onPrev={() => timeline(-1)}
        onNext={() => timeline(1)}
        onShuffle={() => pickStream("shuffle", null)}
      />
    );
  }

  return (
    <>
      <div id="player">
        <div className="stage">
          <div className="frame" id="frame" ref={frameRef}>
            {video ? (
              <VideoFrame key={video.id} video={video} onEnded={advance} />
            ) : (
              <div className="placeholder">loading</div>
            )}
          </div>
          <div className="meta">
            <div className="info" id="meta">
              {video && (
                <>
                  <div className="line1">
                    <span
                      className={`artist${artistOn ? " streamable" : ""}${artistActive ? " activeStream" : ""}`}
                      onClick={artistOn ? () => pickStream("artist", video.artist) : undefined}
                    >
                      {video.artist}
                    </span>{" "}
                    <span className="song">{video.song}</span>
                  </div>
                  <div className="sub">
                    {video.directors.map((d, i) => {
                      const on = (CT.directors[d] || 0) > 1;
                      const active = stream.type === "director" && stream.key === d;
                      return (
                        <span key={d}>
                          {i > 0 && " + "}
                          <span
                            className={on ? `streamable${active ? " activeStream" : ""}` : undefined}
                            onClick={on ? () => pickStream("director", d) : undefined}
                          >
                            {d}
                          </span>
                        </span>
                      );
                    })}
                    {video.directorAffiliate &&
                      (() => {
                        const affiliate = video.directorAffiliate!;
                        const on = (CT.directors[affiliate] || 0) > 1;
                        const active = stream.type === "director" && stream.key === affiliate;
                        return (
                          <span>
                            {" ("}
                            <span
                              className={on ? `streamable${active ? " activeStream" : ""}` : undefined}
                              onClick={on ? () => pickStream("director", affiliate) : undefined}
                            >
                              {affiliate}
                            </span>
                            {")"}
                          </span>
                        );
                      })()}
                    {video.dateDisplay && <div>{video.dateDisplay}</div>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {video && (
        <Constellation key={cur} video={video} counts={CT} stream={stream} cur={cur!} frameRef={frameRef} onAction={handleAction} />
      )}
      {!video && <div className="constellation" id="constellation" />}
    </>
  );
}
