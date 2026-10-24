import { useEffect, useState } from "preact/hooks";
import type {
  PlayerCommand,
  Suggestions as SuggestionsBody,
} from "../../shared/spotify";
import { Icon } from "../icons";
import { Art } from "./Art";
import { fetchSuggestions } from "./player";
import { TrackRow } from "./TrackRow";

const AUTO_CLOSE_MS = 60_000;

export function Suggestions({
  onCommand,
  onClose,
}: {
  onCommand: (command: PlayerCommand) => void;
  onClose: () => void;
}) {
  const [body, setBody] = useState<SuggestionsBody>();
  const [error, setError] = useState<string>();
  const [lastTouch, setLastTouch] = useState(0);

  useEffect(() => {
    fetchSuggestions().then(setBody, (failure: Error) =>
      setError(failure.message),
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [lastTouch]);

  return (
    <div class="music-pick" onPointerDown={() => setLastTouch(Date.now())}>
      <button class="music-pick-x" aria-label="Close" onClick={onClose}>
        <Icon name="close" />
      </button>
      {error ? (
        <p class="music-pick-note">Not loaded · {error}</p>
      ) : !body ? (
        <p class="music-pick-note">Loading…</p>
      ) : (
        <div class="music-pick-body">
          <span class="label music-pick-label">Jump back in</span>
          {body.jumpBackIn.length ? (
            <div class="music-pick-grid">
              {body.jumpBackIn.map((item) => (
                <button
                  key={item.uri}
                  class="music-tile"
                  onClick={() => onCommand({ action: "play", uri: item.uri })}
                >
                  <Art src={item.image} class="music-tile-art" />
                  <b>{item.name}</b>
                  <span class="label">{item.kind}</span>
                </button>
              ))}
            </div>
          ) : (
            <p class="music-pick-note">No recent playlists or albums</p>
          )}
          <span class="label music-pick-label">Your top songs</span>
          {body.topTracks.length ? (
            <ol class="music-top">
              {body.topTracks.map((track, index) => (
                <TrackRow
                  key={track.uri}
                  track={track}
                  onPick={() =>
                    onCommand({
                      action: "playTracks",
                      uris: body.topTracks.map(({ uri }) => uri),
                      offset: index,
                    })
                  }
                />
              ))}
            </ol>
          ) : (
            <p class="music-pick-note">No top songs yet</p>
          )}
        </div>
      )}
    </div>
  );
}
