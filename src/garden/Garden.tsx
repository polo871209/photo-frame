import type { Season } from "@opengardenjs/core";
import type { MountedGarden } from "@opengardenjs/web";
import { useEffect, useRef, useState } from "preact/hooks";
import { useTheme } from "../lib/theme";
import { colorsFor } from "./colors";

const SEASON_KEY = "frame.season";
const SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"];

export function Garden({ controls }: { controls: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const garden = useRef<MountedGarden | null>(null);
  const [season, setSeason] = useState(savedSeason);
  const [theme] = useTheme();
  const latest = useRef({ season, theme });
  latest.current = { season, theme };
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let unmounted = false;
    import("./mount")
      .then(({ mount }) =>
        host.current
          ? mount(host.current, latest.current.season, latest.current.theme)
          : null,
      )
      .then((mounted) => {
        if (unmounted) mounted?.dispose();
        else garden.current = mounted;
      })
      .catch(() => setFailed(true));
    return () => {
      unmounted = true;
      garden.current?.dispose();
      garden.current = null;
    };
  }, []);

  useEffect(() => garden.current?.setSeason(season), [season]);
  useEffect(() => garden.current?.setColors(colorsFor(theme)), [theme]);

  const pick = (next: Season) => {
    setSeason(next);
    localStorage.setItem(SEASON_KEY, next);
  };

  return (
    <div class="garden" ref={host}>
      {failed && <p class="empty">The garden cannot load</p>}
      {controls && !failed && (
        <div class="garden-bar">
          <div class="seg">
            {SEASONS.map((value) => (
              <button
                key={value}
                class={value === season ? "is-on" : ""}
                onClick={() => pick(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function savedSeason(): Season {
  const saved = localStorage.getItem(SEASON_KEY);
  return SEASONS.find((value) => value === saved) ?? "spring";
}
