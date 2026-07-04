"use client";

import type { Video } from "@/lib/types";
import { useOpenAbout } from "./AboutProvider";

export function MobilePlayer({
  video,
  onPrev,
  onNext,
  onShuffle,
}: {
  video: Video | null;
  onPrev: () => void;
  onNext: () => void;
  onShuffle: () => void;
}) {
  const openAbout = useOpenAbout();

  if (!video) return <div id="mobile" />;

  const embed = video.youtubeId
    ? `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1`
    : `https://player.vimeo.com/video/${video.vimeoId}?autoplay=1&title=0&byline=0`;

  return (
    <div id="mobile">
      <button className="mbrand" onClick={openAbout}>
        Thunder/Lightning <span className="mbrandTag">· a love letter to music videos</span>
      </button>
      <div className="mframe">
        <iframe key={video.id} src={embed} allow="autoplay; fullscreen" allowFullScreen />
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
