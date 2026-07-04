"use client";

import type { Video } from "@/lib/types";
import { useOpenAbout } from "./AboutProvider";
import { VideoFrame } from "./VideoFrame";

export function MobilePlayer({
  video,
  onEnded,
  onPrev,
  onNext,
  onShuffle,
}: {
  video: Video | null;
  onEnded: () => void;
  onPrev: () => void;
  onNext: () => void;
  onShuffle: () => void;
}) {
  const openAbout = useOpenAbout();

  if (!video) return <div id="mobile" />;

  return (
    <div id="mobile">
      <button className="mbrand" onClick={openAbout}>
        Thunder/Lightning <span className="mbrandTag">· a love letter to music videos</span>
      </button>
      <div className="mframe frame">
        <VideoFrame key={video.id} video={video} onEnded={onEnded} />
      </div>
      <div className="minfo">
        <div className="a">{video.artist}</div>
        <div className="s">{video.song}</div>
        <div className="d">
          {video.director}
          {video.directorAffiliate ? ` (${video.directorAffiliate})` : ""}
          {video.dateDisplay ? ` · ${video.dateDisplay}` : ""}
        </div>
      </div>
      <div className="mnav">
        <button onClick={onPrev}>Prev</button>
        <button onClick={onShuffle}>Shuffle</button>
        <button onClick={onNext}>Next</button>
      </div>
    </div>
  );
}
