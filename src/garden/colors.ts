import type {
  Colors,
  LeafShape,
  SceneColors,
  Season,
  TreeLook,
} from "@opengardenjs/core";
import type { Theme } from "../lib/theme";

type Ramp = [string, string, string, string];

const GROUND: Record<
  Theme,
  Pick<
    SceneColors,
    "ground" | "gravel" | "rake" | "shadow" | "snow" | "rock" | "rockShade"
  >
> = {
  light: {
    ground: "#eff1f5",
    gravel: "#e8eaf0",
    rake: "#d6dae3",
    shadow: "#b4b8c6",
    snow: "#f6f7fa",
    rock: "#d8dae0",
    rockShade: "#a0a4b4",
  },
  dark: {
    ground: "#24273a",
    gravel: "#212436",
    rake: "#30344a",
    shadow: "#15161f",
    snow: "#a9b0cc",
    rock: "#6e738d",
    rockShade: "#3e4259",
  },
};

interface SeasonColors {
  crown: Ramp;
  leaf: LeafShape;
  moss: [shade: string, mid: string, light: string];
  bark: string;
  barkShade: string;
  sun: string;
}

const SEASON_COLORS: Record<Season, SeasonColors> = {
  spring: {
    crown: ["#9c8aa6", "#c3a0b2", "#d9b9c2", "#ead3d6"],
    leaf: "blossom",
    moss: ["#7d978e", "#93ab9a", "#a9bea8"],
    bark: "#a49aa4",
    barkShade: "#757186",
    sun: "#fbf6f2",
  },
  summer: {
    crown: ["#4f7468", "#678c78", "#88a78b", "#b5c9a8"],
    leaf: "leaf",
    moss: ["#5f8478", "#749a84", "#93b296"],
    bark: "#857670",
    barkShade: "#5c5c6a",
    sun: "#fbf8ec",
  },
  autumn: {
    crown: ["#a0705e", "#b98866", "#cba479", "#dcc398"],
    leaf: "leaf",
    moss: ["#a0705e", "#b98866", "#cba479"],
    bark: "#7e6254",
    barkShade: "#584a4e",
    sun: "#fbf3e6",
  },
  winter: {
    crown: ["#8193ab", "#a6b4c6", "#cbd4df", "#e8ecf1"],
    leaf: "dab",
    moss: ["#a2b2c4", "#c4cfdb", "#dde3ea"],
    bark: "#6c7686",
    barkShade: "#4a5366",
    sun: "#ffffff",
  },
};

const DARK_DIM = 0.72;

function scaled(hex: string, factor: number): string {
  const value = parseInt(hex.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((value >> shift) & 255) * factor)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/** Muted tree colors and a Catppuccin ground, dimmed for the dark theme. */
export function colorsFor(theme: Theme): Required<Colors> {
  const dim = (hex: string) => scaled(hex, theme === "dark" ? DARK_DIM : 1);
  const tree = (season: Season): TreeLook => {
    const colors = SEASON_COLORS[season];
    return {
      crown: [
        dim(colors.crown[0]),
        dim(colors.crown[1]),
        dim(colors.crown[2]),
        dim(colors.crown[3]),
      ],
      leaf: colors.leaf,
      bark: dim(colors.bark),
      barkShade: dim(colors.barkShade),
    };
  };
  return {
    trees: {
      spring: tree("spring"),
      summer: tree("summer"),
      autumn: tree("autumn"),
      winter: tree("winter"),
    },
    scene: (season) => {
      const [shade, mid, light] = SEASON_COLORS[season].moss;
      return {
        ...GROUND[theme],
        mossShade: dim(shade),
        moss: dim(mid),
        mossLight: dim(light),
        sun: SEASON_COLORS[season].sun,
      };
    },
  };
}
