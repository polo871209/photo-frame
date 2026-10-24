import type { Track } from "../../shared/spotify";
import { Art } from "./Art";

export function TrackRow({
  track,
  onPick,
}: {
  track: Track;
  onPick: () => void;
}) {
  return (
    <li>
      <button class="music-row" onClick={onPick}>
        <Art src={track.thumb} class="music-thumb" />
        <div class="music-row-text">
          <b>{track.title}</b>
          <span>{track.artists}</span>
        </div>
        <span class="num">{clock(track.durationMs)}</span>
      </button>
    </li>
  );
}

export function clock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
