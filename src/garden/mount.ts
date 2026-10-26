import { cherry } from "@opengardenjs/cherry";
import type { Season } from "@opengardenjs/core";
import { type MountedGarden, mountGarden } from "@opengardenjs/web";
import type { Theme } from "../lib/theme";
import { colorsFor } from "./colors";

export function mount(
  host: HTMLElement,
  season: Season,
  theme: Theme,
): Promise<MountedGarden> {
  return mountGarden(host, {
    species: cherry,
    season,
    ...colorsFor(theme),
    renderScale: 0.6,
    maxFps: 30,
    quality: {
      leafDensity: 0.5,
      antialias: false,
      shadowSize: 512,
      shadowInterval: 2,
      shadowSamples: 4,
      leafShadowSamples: 1,
      fallingLeaves: 2000,
    },
  });
}
