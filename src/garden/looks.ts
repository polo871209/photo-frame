import { Vector3 } from "three";
import type { Theme } from "../lib/theme";
import type { Season } from "./seasons";


export const ATLAS_CELL = { blossom: 0, dab: 1, leaf: 2 } as const;
export const ATLAS_CELLS = 3;
type LeafShape = keyof typeof ATLAS_CELL;

type Hexes = [string, string, string, string];
export type Ramp = [Vector3, Vector3, Vector3, Vector3];

interface GroundColors {
  ground: string;
  gravel: string;
  rake: string;
  shadow: string;
  snow: string;
  rock: string;
  rockShade: string;
}

const GROUND: Record<Theme, GroundColors> = {
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

interface TreeColors {
  crown: Hexes;
  shape: LeafShape;
  moss: Hexes;
  bark: string;
  barkShade: string;
  sun: string;
}

const TREES: Record<Season, TreeColors> = {
  spring: {
    crown: ["#9c8aa6", "#c3a0b2", "#d9b9c2", "#ead3d6"],
    shape: "blossom",
    moss: ["#7d978e", "#93ab9a", "#a9bea8", "#c4d2c0"],
    bark: "#a49aa4",
    barkShade: "#757186",
    sun: "#fbf6f2",
  },
  summer: {
    crown: ["#4f7468", "#678c78", "#88a78b", "#b5c9a8"],
    shape: "leaf",
    moss: ["#5f8478", "#749a84", "#93b296", "#b4c8ac"],
    bark: "#857670",
    barkShade: "#5c5c6a",
    sun: "#fbf8ec",
  },
  autumn: {
    crown: ["#a0705e", "#b98866", "#cba479", "#dcc398"],
    shape: "leaf",
    moss: ["#a0705e", "#b98866", "#cba479", "#dcc398"],
    bark: "#7e6254",
    barkShade: "#584a4e",
    sun: "#fbf3e6",
  },
  winter: {
    crown: ["#8193ab", "#a6b4c6", "#cbd4df", "#e8ecf1"],
    shape: "dab",
    moss: ["#a2b2c4", "#c4cfdb", "#dde3ea", "#eef1f5"],
    bark: "#6c7686",
    barkShade: "#4a5366",
    sun: "#ffffff",
  },
};

const DAB_SHARE: Record<LeafShape, number> = {
  blossom: 0.35,
  leaf: 0.4,
  dab: 1,
};

const DARK_DIM = 0.72;

export interface Look {
  season: Season;
  crown: Ramp;
  crownShape: number;
  crownDabShare: number;
  moss: Ramp;
  mossShape: number;
  mossDabShare: number;
  ground: Vector3;
  gravel: Vector3;
  rake: Vector3;
  shadow: Vector3;
  bark: Vector3;
  barkShade: Vector3;
  rock: Vector3;
  rockShade: Vector3;
  sun: Vector3;
  snow: number;
  snowColor: Vector3;
}

function hexToVector(hex: string): Vector3 {
  const value = parseInt(hex.slice(1), 16);
  return new Vector3(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  );
}

function ramp([a, b, c, d]: Hexes, dim: number): Ramp {
  const lit = (hex: string) => hexToVector(hex).multiplyScalar(dim);
  return [lit(a), lit(b), lit(c), lit(d)];
}

export function lookFor(season: Season, theme: Theme): Look {
  const tree = TREES[season];
  const ground = GROUND[theme];
  const dim = theme === "dark" ? DARK_DIM : 1;
  const lit = (hex: string) => hexToVector(hex).multiplyScalar(dim);
  const isAutumn = season === "autumn";
  return {
    season,
    crown: ramp(tree.crown, dim),
    crownShape: ATLAS_CELL[tree.shape],
    crownDabShare: DAB_SHARE[tree.shape],
    moss: ramp(tree.moss, dim),
    mossShape: isAutumn ? ATLAS_CELL.leaf : ATLAS_CELL.dab,
    mossDabShare: isAutumn ? 0.45 : 1,
    ground: hexToVector(ground.ground),
    gravel: hexToVector(ground.gravel),
    rake: hexToVector(ground.rake),
    shadow: hexToVector(ground.shadow),
    bark: lit(tree.bark),
    barkShade: lit(tree.barkShade),
    rock: hexToVector(ground.rock),
    rockShade: hexToVector(ground.rockShade),
    sun: hexToVector(tree.sun),
    snow: season === "winter" ? 1 : 0,
    snowColor: hexToVector(ground.snow),
  };
}
