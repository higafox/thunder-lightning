export type Provider = "youtube" | "vimeo";

export interface Video {
  id: string;
  artist: string;
  song: string;
  director: string;
  directors: string[];
  // production house/collective the director(s) made this video through (e.g.
  // "CANADA", "Hammer & Tongs"). One per video (matches the source column),
  // not tied to a specific director when there are several. Shown as
  // "Director (Affiliate)"; pools into the same directors playlist/counts
  // as a regular director credit, so the same name credited as a director
  // on one video and an affiliate on another is followed as one entity.
  directorAffiliate: string | null;
  dateDisplay: string | null;
  sortDate: string;
  year: number | null;
  provider: Provider;
  youtubeId: string | null;
  vimeoId: string | null;
  thumbnailUrl: string | null;
  tags: string[];
  // manual override for embeds that are confirmed broken (e.g. Vimeo privacy
  // restrictions that fail silently, with no error our code can detect) --
  // skips attempting to embed entirely and shows the "watch on source" card.
  embedBroken: boolean;
}

export interface Meta {
  title: string;
  subtitle: string;
  totalVideos: number;
  totalArtists: number;
  totalDirectors: number;
  totalTags: number;
}

export interface Playlists {
  timeline: string[];
  tags: Record<string, string[]>;
  artists: Record<string, string[]>;
  directors: Record<string, string[]>;
}

export interface Counts {
  tags: Record<string, number>;
  artists: Record<string, number>;
  directors: Record<string, number>;
}

export interface VideoData {
  meta: Meta;
  videos: Record<string, Video>;
  playlists: Playlists;
  counts: Counts;
}

export type StreamType = "shuffle" | "timeline" | "tag" | "artist" | "director";

export interface StreamState {
  type: StreamType;
  key: string | null;
  list: string[] | null;
  dir?: -1 | 1;
}
