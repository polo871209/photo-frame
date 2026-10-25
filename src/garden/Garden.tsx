import { useEffect, useRef, useState } from "preact/hooks";
import { useTheme } from "../lib/theme";
import { SEASONS, type Season } from "./seasons";
import type { GardenScene } from "./scene";

const SEASON_KEY = "frame.season";

export function Garden({ interactive }: { interactive: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<GardenScene | null>(null);
  const [season, setSeason] = useState(savedSeason);
  const [theme] = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let unmounted = false;
    import("./scene")
      .then(({ createGarden }) => {
        if (unmounted || !host.current) return;
        scene.current = createGarden(host.current, {
          season,
          theme,
          interactive,
        });
      })
      .catch(() => setFailed(true));
    return () => {
      unmounted = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => scene.current?.setLook(season, theme), [season, theme]);

  const pick = (next: Season) => {
    setSeason(next);
    localStorage.setItem(SEASON_KEY, next);
  };

  return (
    <div class="garden" ref={host}>
      {failed && <p class="empty">The garden cannot load</p>}
      {interactive && !failed && (
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
