import type { AccessibilityPalette } from "../core/Types";
import { enemyDefinitions } from "./enemies";
import { towerDefinitions } from "./towers";

type PaletteMap = Record<string, string>;
type NonDefaultPalette = Exclude<AccessibilityPalette, "default">;

const DEUTERANOPIA: PaletteMap = {
  pulse: "#f0e442",
  blaster: "#0072b2",
  plasma: "#0072b2",
  stasis: "#cc79a7",
  mortar: "#e69f00",
  tesla: "#56b4e9",
  harvester: "#009e73",
  railgun: "#fff176",
  flamer: "#d55e00",
  barrier: "#66c2ff",
  amplifier: "#fe6100",
  reflector: "#f7f7f7",
  snare: "#b3de69",
  overclock: "#dc267f",

  scout: "#56b4e9",
  grunt: "#d55e00",
  brute: "#e69f00",
  weaver: "#cc79a7",
  phantom: "#d0d0d0",
  carrier: "#8da0ae",
  leviathan: "#b03a2e",
  sprinter: "#8dd3f7",
  juggernaut: "#fe6100",
  shielder: "#66c2ff",
  splitter: "#cc79a7",
  jammer: "#f0e442",
  swarm: "#ffb000",
  overlord: "#785ef0",
  tunneler: "#9c755f",
  saboteur: "#d55e00",
  cache: "#f0e442",
  mirror: "#ffffff",
  harbinger: "#dc267f",
};

const PROTANOPIA: PaletteMap = {
  pulse: "#56b4e9",
  blaster: "#f0e442",
  plasma: "#f0e442",
  stasis: "#785ef0",
  mortar: "#ffb000",
  tesla: "#00bcd4",
  harvester: "#009e73",
  railgun: "#ffffff",
  flamer: "#fe6100",
  barrier: "#80d8ff",
  amplifier: "#e69f00",
  reflector: "#f7f7f7",
  snare: "#b3de69",
  overclock: "#dc267f",

  scout: "#56b4e9",
  grunt: "#fe6100",
  brute: "#ffb000",
  weaver: "#dc267f",
  phantom: "#d0d0d0",
  carrier: "#8da0ae",
  leviathan: "#a64d79",
  sprinter: "#80d8ff",
  juggernaut: "#e69f00",
  shielder: "#00bcd4",
  splitter: "#cc79a7",
  jammer: "#f0e442",
  swarm: "#ffd166",
  overlord: "#785ef0",
  tunneler: "#9c755f",
  saboteur: "#fe6100",
  cache: "#ffffff",
  mirror: "#e0f7fa",
  harbinger: "#dc267f",
};

const HIGH_CONTRAST: PaletteMap = {
  pulse: "#ffffff",
  blaster: "#00e5ff",
  plasma: "#00e5ff",
  stasis: "#ff4dff",
  mortar: "#ffb000",
  tesla: "#00ffff",
  harvester: "#00ff66",
  railgun: "#ffff00",
  flamer: "#ff6a00",
  barrier: "#66fcf1",
  amplifier: "#ff9f1c",
  reflector: "#ffffff",
  snare: "#d7ff00",
  overclock: "#ff2a8a",

  scout: "#00e5ff",
  grunt: "#ff6a00",
  brute: "#ffb000",
  weaver: "#ff2a8a",
  phantom: "#ffffff",
  carrier: "#b0bec5",
  leviathan: "#ff1744",
  sprinter: "#80ffff",
  juggernaut: "#ff9100",
  shielder: "#64ffda",
  splitter: "#ff4dff",
  jammer: "#ffff00",
  swarm: "#ffd54f",
  overlord: "#d500f9",
  tunneler: "#bcaaa4",
  saboteur: "#ff6d00",
  cache: "#ffffff",
  mirror: "#e0f7fa",
  harbinger: "#ff1744",
};

export const paletteMaps: Record<NonDefaultPalette, PaletteMap> = {
  deuteranopia: DEUTERANOPIA,
  protanopia: PROTANOPIA,
  highContrast: HIGH_CONTRAST,
};

const defaultColorIds = new Map<string, string>();
for (const def of Object.values(towerDefinitions)) {
  defaultColorIds.set(def.color.toLowerCase(), def.id);
}
for (const def of Object.values(enemyDefinitions)) {
  const color = def.color.toLowerCase();
  if (!defaultColorIds.has(color)) defaultColorIds.set(color, def.id);
}

let activePalette: AccessibilityPalette = "default";

export function setActivePalette(palette: AccessibilityPalette): void {
  activePalette = palette;
}

export function paletteIdForColor(color: string): string | undefined {
  return defaultColorIds.get(color.toLowerCase());
}

export function paletteColor(id: string | undefined, fallback: string): string {
  if (activePalette === "default") return fallback;
  const map = paletteMaps[activePalette];
  if (!map) return fallback;
  const key = (id ?? "").toLowerCase();
  return map[key] ?? map[paletteIdForColor(fallback) ?? ""] ?? fallback;
}
