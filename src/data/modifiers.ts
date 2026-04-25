import type { RunModifier } from "../core/Types";

/** Modifiers that hurt the player. Always roll one of these. */
const debuffs: RunModifier[] = [
  {
    id: "haunted",
    name: "HAUNTED SIGNAL",
    description: "Enemies regenerate 2 HP/s.",
    enemyHealPerSec: 2,
  },
  {
    id: "scarcity",
    name: "RESOURCE SCARCITY",
    description: "Harvesters offline — no passive income.",
    harvestDisabled: true,
  },
  {
    id: "armored",
    name: "HARDENED CARAPACE",
    description: "All enemies +20% damage resistance.",
    enemyArmorAdd: 0.20,
  },
  {
    id: "turbulent",
    name: "TURBULENT FLOW",
    description: "Enemy movement speed +30%.",
    enemySpeedMul: 1.3,
  },
];

/** Mixed or buff modifiers. Always roll one of these as counterbalance. */
const buffsAndMixed: RunModifier[] = [
  {
    id: "signal_boost",
    name: "SIGNAL BOOST",
    description: "Core integrity +30%.",
    coreMul: 1.3,
  },
  {
    id: "overclock",
    name: "OVERCLOCK",
    description: "Towers fire 25% faster but cost 25% more.",
    towerCooldownMul: 0.75,
    towerCostMul: 1.25,
  },
  {
    id: "dark_matter",
    name: "DARK MATTER",
    description: "Enemies +40% HP, award +40% credits.",
    enemyHpMul: 1.4,
    enemyRewardMul: 1.4,
  },
  {
    id: "credit_flood",
    name: "CREDIT OVERFLOW",
    description: "Harvester income doubled, tower costs +25%.",
    harvesterIncomeMul: 2.0,
    towerCostMul: 1.25,
  },
];

/**
 * Roll run modifiers: one debuff + one buff/mixed.
 * Returns an empty array for the first sector so new players aren't overwhelmed.
 */
export function rollModifiers(sectorIndex: number): RunModifier[] {
  // No modifiers on the very first run of a sector.
  if (sectorIndex <= 0) return [];
  const d = debuffs[Math.floor(Math.random() * debuffs.length)]!;
  const b = buffsAndMixed[Math.floor(Math.random() * buffsAndMixed.length)]!;
  // Avoid pairing two modifiers that both affect tower cost (too punishing).
  if (d.towerCostMul && b.towerCostMul) {
    const alt = buffsAndMixed.filter((m) => !m.towerCostMul);
    return [d, (alt[Math.floor(Math.random() * alt.length)] ?? b)];
  }
  return [d, b];
}
