import { useEffect, useState } from "preact/hooks";
import type {
  PlayerCommand,
  Suggestions as SuggestionsBody,
} from "../../shared/spotify";
import { Art } from "./Art";
import { fetchSuggestions } from "./player";
import { TrackRow } from "./TrackRow";

const REFRESH_MS = 10 * 60_000;
const RETRY_MS = 15_000;

export function Suggestions({
  onCommand,
}: {
  onCommand: (command: PlayerCommand) => void;
}) {
  const [body, setBody] = useState<SuggestionsBody>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let closed = false;
    const load = () =>
      fetchSuggestions().then(
        (next) => {
          if (closed) return;
          setBody(next);
          setError(undefined);
          timer = setTimeout(load, REFRESH_MS);
        },
        (failure: Error) => {
          if (closed) return;
          setError(failure.message);
          timer = setTimeout(load, RETRY_MS);
        },
      );
    load();
    return () => {
      closed = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div class="music-pick">
      {error && !body ? (
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
