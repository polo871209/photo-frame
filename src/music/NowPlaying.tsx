import { useEffect, useState } from "preact/hooks";
import type { PlayerCommand } from "../../shared/spotify";
import { Icon } from "../icons";
import { format, sameDay } from "../lib/dates";
import { sendCommand } from "./player";
import { Suggestions } from "./Suggestions";
import { clock, TrackRow } from "./TrackRow";
import { useNowPlaying } from "./useNowPlaying";
import { Art } from "./Art";
import { LyricsView } from "./LyricsView";
import { useLyrics } from "./useLyrics";

const COMMAND_ERROR_MS = 6_000;
const CONTROL_ICON_PX = 22;

export function NowPlaying() {
  const { data, receivedAt, error, refresh } = useNowPlaying();
  const [picking, togglePicking] = useSavedToggle("frame.picker");
  const [commandError, setCommandError] = useState<string>();
  const [lyricsOn, toggleLyrics] = useSavedToggle("frame.lyrics");
  const track = data?.track;
  const playing = !!(data?.playing && track);
  const lyrics = useLyrics(track?.uri, lyricsOn);
  useSecondTick(playing);

  useEffect(() => {
    if (!commandError) return;
    const timer = setTimeout(
      () => setCommandError(undefined),
      COMMAND_ERROR_MS,
    );
    return () => clearTimeout(timer);
  }, [commandError]);

  const run = (command: PlayerCommand) => {
    setCommandError(undefined);
    sendCommand(command).then(
      () => refresh(command),
      (failure: Error) => setCommandError(failure.message),
    );
  };

  const status = commandError ? (
    <span class="music-status is-error">{commandError}</span>
  ) : error ? (
    <span class="music-status is-error">Offline · {error}</span>
  ) : data?.source === "sample" ? (
    <span class="music-status">Sample track</span>
  ) : null;

  const controls = (
    <Controls
      playing={playing}
      canSkip={!!track && !data?.playedAt}
      hasTrack={!!track}
      lyricsOn={lyricsOn}
      onCommand={run}
      picking={picking}
      onTogglePicking={togglePicking}
      onToggleLyrics={toggleLyrics}
    />
  );
  const sheet = picking && <Suggestions onCommand={run} />;

  if (!data) return <div class="music">{status}</div>;
  if (!track) {
    return (
      <div class="music">
        <div class="music-info music-info--empty">
          <h1 class="music-title title">Nothing playing on Spotify</h1>
          {controls}
        </div>
        {sheet}
        {status}
      </div>
    );
  }

  const position = Math.min(
    track.durationMs,
    data.progressMs + (playing ? Date.now() - receivedAt : 0),
  );
  return (
    <div class="music">
      <Art src={track.art} class="music-art" />
      <div class={`music-info${lyricsOn ? " is-lyrics" : ""}`}>
        <span class="label">
          {heading(data.playing, data.device, data.playedAt)}
        </span>
        <h1 class="music-title title">{track.title}</h1>
        <p class="music-artist">{track.artists}</p>
        {track.album && !lyricsOn && <p class="music-album">{track.album}</p>}
        {!data.playedAt && (
          <>
            <div class="music-bar">
              <i style={`width:${(100 * position) / track.durationMs}%`} />
            </div>
            <div class="music-times num">
              <span>{clock(position)}</span>
              <span>{clock(track.durationMs)}</span>
            </div>
          </>
        )}
        {controls}
        {lyricsOn && (
          <LyricsView
            lyrics={lyrics}
            playhead={
              data.playedAt
                ? null
                : {
                    progressMs: data.progressMs,
                    at: receivedAt,
                    playing: data.playing,
                  }
            }
          />
        )}
        {!lyricsOn && data.next.length > 0 && (
          <>
            <span class="label music-next-label">Next up</span>
            <ol class="music-next">
              {data.next.map((next, index) => (
                <TrackRow
                  key={index}
                  track={next}
                  onPick={() => run({ action: "skipTo", uri: next.uri })}
                />
              ))}
            </ol>
          </>
        )}
      </div>
      {sheet}
      {status}
    </div>
  );
}

function Controls({
  playing,
  canSkip,
  hasTrack,
  lyricsOn,
  picking,
  onCommand,
  onTogglePicking,
  onToggleLyrics,
}: {
  playing: boolean;
  canSkip: boolean;
  hasTrack: boolean;
  lyricsOn: boolean;
  picking: boolean;
  onCommand: (command: PlayerCommand) => void;
  onTogglePicking: () => void;
  onToggleLyrics: () => void;
}) {
  return (
    <div class="music-ctl">
      {canSkip && (
        <button
          aria-label="Previous"
          onClick={() => onCommand({ action: "previous" })}
        >
          <Icon name="previous" size={CONTROL_ICON_PX} />
        </button>
      )}
      <button
        class="is-main"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => onCommand({ action: playing ? "pause" : "play" })}
      >
        <Icon name={playing ? "pause" : "play"} size={CONTROL_ICON_PX} />
      </button>
      {canSkip && (
        <button aria-label="Next" onClick={() => onCommand({ action: "next" })}>
          <Icon name="next" size={CONTROL_ICON_PX} />
        </button>
      )}
      {hasTrack && (
        <button
          class={`music-ctl-lyrics${lyricsOn ? " is-on" : ""}`}
          aria-label="Lyrics"
          aria-pressed={lyricsOn}
          onClick={onToggleLyrics}
        >
          <Icon name="lyrics" size={26} />
        </button>
      )}
      <button
        class={`music-ctl-pick${picking ? " is-on" : ""}`}
        aria-label="Pick music"
        aria-pressed={picking}
        onClick={onTogglePicking}
      >
        <Icon name="grid" size={26} />
      </button>
    </div>
  );
}

function heading(
  playing: boolean,
  device: string | null,
  playedAt: string | null,
): string {
  if (playedAt) {
    const at = new Date(playedAt);
    const day = sameDay(at, new Date()) ? "" : `${format.weekdayShort(at)} `;
    return `Last played · ${day}${format.time(at)}`;
  }
  const state = playing ? "Now playing" : "Paused";
  return device ? `${state} · ${device}` : state;
}

function useSavedToggle(key: string): [boolean, () => void] {
  const [on, setOn] = useState(() => localStorage.getItem(key) === "on");
  const toggle = () => {
    localStorage.setItem(key, on ? "off" : "on");
    setOn(!on);
  };
  return [on, toggle];
}

function useSecondTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(timer);
  }, [active]);
}
