"use client";

import type { Video } from "@/lib/types";

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
  if (!video) return <div id="mobile" />;

  const embed = video.youtubeId
    ? `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1`
    : `https://player.vimeo.com/video/${video.vimeoId}?autoplay=1&title=0&byline=0`;

  return (
    <div id="mobile">
      <div className="mbrand">Thunder/Lightning</div>
      <div className="mframe">
        <iframe key={video.id} src={embed} allow="autoplay; fullscreen" allowFullScreen />
      </div>
      <div className="minfo">
        <div className="a">{video.artist}</div>
        <div className="s">{video.song}</div>
        <div className="d">
          {video.director}
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
