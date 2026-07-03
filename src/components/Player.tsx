"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { VideoData } from "@/lib/types";
import type { NodeAction } from "@/lib/constellation";
import { usePlayer } from "@/lib/useStream";
import { VideoFrame } from "./VideoFrame";
import { Constellation } from "./Constellation";
import { MobilePlayer } from "./MobilePlayer";

export function Player({ data, initialSlug }: { data: VideoData; initialSlug?: string | null }) {
  const router = useRouter();
  const { cur, stream, pickStream, timeline, advance } = usePlayer(data, initialSlug ?? null);
  const frameRef = useRef<HTMLDivElement>(null);

  const video = cur ? data.videos[cur] : null;
  const CT = data.counts;

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

      <MobilePlayer
        video={video}
        onPrev={() => timeline(-1)}
        onNext={() => timeline(1)}
        onShuffle={() => pickStream("shuffle", null)}
      />
    </>
  );
}
