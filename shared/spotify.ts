export interface Track {
  /** The Spotify URI. A `skipTo` command takes it for a track in `next`. */
  uri: string;
  title: string;
  /** Artist names joined with ", ", or the show name for a podcast episode. */
  artists: string;
  album: string;
  /** About 640 px wide. `null` for local files, which have no artwork. */
  art: string | null;
  /** About 64 px wide, for list rows. */
  thumb: string | null;
  durationMs: number;
}

/** The body of `GET /api/spotify`. */
export interface NowPlaying {
  source: "spotify" | "sample";
  /** `null` when no Spotify device has played anything recently. */
  track: Track | null;
  playing: boolean;
  /** Position in `track` when the worker read it. */
  progressMs: number;
  device: string | null;
  /** When nothing plays, `track` is the last played track and this is when it played, as an ISO instant. Otherwise `null`. */
  playedAt: string | null;
  /** The next tracks in the queue, at most `NEXT_UP_COUNT`. */
  next: Track[];
}

export const NEXT_UP_COUNT = 4;

/** A playlist, album or artist from `GET /api/spotify/suggestions`. */
export interface Suggestion {
  /** The Spotify URI to send as `uri` in a `play` command. */
  uri: string;
  name: string;
  kind: "playlist" | "album" | "artist";
  image: string | null;
}

/** The body of `GET /api/spotify/suggestions`. */
export interface Suggestions {
  /** The playlists and albums of the recently played tracks, at most `SUGGESTION_COUNT`. */
  jumpBackIn: Suggestion[];
  /** The owner's most played tracks of the last 4 weeks, at most `TOP_TRACK_COUNT`. */
  topTracks: Track[];
}

/**
 * The body of `POST /api/spotify/control`.
 * `play` without `uri` resumes. `skipTo` skips ahead to a track in the queue.
 * `playTracks` plays the track at index `offset` of `uris`, then queues the tracks after it.
 */
export type PlayerCommand =
  | { action: "pause" | "next" | "previous" }
  | { action: "play"; uri?: string }
  | { action: "skipTo"; uri: string }
  | { action: "playTracks"; uris: string[]; offset: number };

export const SUGGESTION_COUNT = 8;
export const TOP_TRACK_COUNT = 20;
