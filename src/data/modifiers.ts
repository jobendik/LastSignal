import type { RunModifier } from "../core/Types";

/**
 * Run modifiers shape the feel of an individual run. Every non-tutorial sector
 * rolls one debuff (always hurts the player) and one buff/mixed modifier
 * (helps or trades off). The pool is intentionally large — by the time a
 * player has cleared the campaign twice they should still see fresh combos.
 *
 * Every modifier carries an explicit `kind` so the HUD modifier strip colors
 * it correctly. The legacy heuristic in HUD remains as a fallback for curse
 * modifiers generated from upgrade cards (which omit `kind`).
 */

/** Modifiers that hurt the player. Always roll one of these. */
const debuffs: RunModifier[] = [
  // ── Original pool ─────────────────────────────────────────────────────
  {
    id: "haunted",
    name: "HAUNTED SIGNAL",
    description: "Enemies regenerate 2 HP/s.",
    kind: "debuff",
    enemyHealPerSec: 2,
  },
  {
    id: "scarcity",
    name: "RESOURCE SCARCITY",
    description: "Harvesters offline — no passive income.",
    kind: "debuff",
    harvestDisabled: true,
  },
  {
    id: "armored",
    name: "HARDENED CARAPACE",
    description: "All enemies +20% damage resistance.",
    kind: "debuff",
    enemyArmorAdd: 0.20,
  },
  {
    id: "turbulent",
    name: "TURBULENT FLOW",
    description: "Enemy movement speed +30%.",
    kind: "debuff",
    enemySpeedMul: 1.3,
  },
  // ── Expansion ────────────────────────────────────────────────────────
  {
    id: "bleeding",
    name: "BLEEDING SIGNAL",
    description: "Enemies regenerate 4 HP/s — pure sustained DPS is required.",
    kind: "debuff",
    enemyHealPerSec: 4,
  },
  {
    id: "brittle_walls",
    name: "BRITTLE WALLS",
    description: "Core integrity -15%. One mistake hurts.",
    kind: "debuff",
    coreMul: 0.85,
  },
  {
    id: "inflation",
    name: "INFLATION",
    description: "Tower build costs +35%.",
    kind: "debuff",
    towerCostMul: 1.35,
  },
  {
    id: "heavy_hull",
    name: "HEAVY HULL",
    description: "All enemies +60% HP.",
    kind: "debuff",
    enemyHpMul: 1.6,
  },
  {
    id: "drought",
    name: "ECONOMY DROUGHT",
    description: "Harvester output halved.",
    kind: "debuff",
    harvesterIncomeMul: 0.5,
  },
  {
    id: "desperate_foe",
    name: "DESPERATE FOE",
    description: "Enemies +15% speed and +15% armor.",
    kind: "debuff",
    enemySpeedMul: 1.15,
    enemyArmorAdd: 0.15,
  },
  {
    id: "degraded_fire",
    name: "DEGRADED FIRING",
    description: "Towers fire 20% slower.",
    kind: "debuff",
    towerCooldownMul: 1.2,
  },
  {
    id: "rationed",
    name: "RATIONED SUPPLY",
    description: "Tower costs +15% and harvester output -25%.",
    kind: "debuff",
    towerCostMul: 1.15,
    harvesterIncomeMul: 0.75,
  },
];

/** Mixed or buff modifiers. Always roll one of these as counterbalance. */
const buffsAndMixed: RunModifier[] = [
  // ── Original pool ─────────────────────────────────────────────────────
  {
    id: "signal_boost",
    name: "SIGNAL BOOST",
    description: "Core integrity +30%.",
    kind: "buff",
    coreMul: 1.3,
  },
  {
    id: "overclock",
    name: "OVERCLOCK",
    description: "Towers fire 25% faster but cost 25% more.",
    kind: "mixed",
    towerCooldownMul: 0.75,
    towerCostMul: 1.25,
  },
  {
    id: "dark_matter",
    name: "DARK MATTER",
    description: "Enemies +40% HP, towers fire 15% faster, kills award +40% credits.",
    kind: "mixed",
    enemyHpMul: 1.40,
    enemyRewardMul: 1.4,
    towerCooldownMul: 0.85,
  },
  {
    id: "credit_flood",
    name: "CREDIT OVERFLOW",
    description: "Harvester income doubled, tower costs +25%.",
    kind: "mixed",
    harvesterIncomeMul: 2.0,
    towerCostMul: 1.25,
  },
  // ── Expansion ────────────────────────────────────────────────────────
  {
    id: "rapid_response",
    name: "RAPID RESPONSE",
    description: "Towers fire 30% faster but core integrity -25%.",
    kind: "mixed",
    towerCooldownMul: 0.7,
    coreMul: 0.75,
  },
  {
    id: "bounty_targets",
    name: "BOUNTY TARGETS",
    description: "Enemies +40% HP and award +60% credits. Tower costs -10%.",
    kind: "mixed",
    enemyHpMul: 1.40,
    enemyRewardMul: 1.6,
    towerCostMul: 0.9,
  },
  {
    id: "supply_line",
    name: "SUPPLY LINE",
    description: "Harvester income +50%, tower costs +10%.",
    kind: "mixed",
    harvesterIncomeMul: 1.5,
    towerCostMul: 1.1,
  },
  {
    id: "crystal_rush",
    name: "CRYSTAL RUSH",
    description: "Harvester income +75% but enemies move 15% faster.",
    kind: "mixed",
    harvesterIncomeMul: 1.75,
    enemySpeedMul: 1.15,
  },
  {
    id: "reinforced_hull",
    name: "REINFORCED HULL",
    description: "Core integrity +50%, enemies +35% HP.",
    kind: "mixed",
    coreMul: 1.5,
    enemyHpMul: 1.35,
  },
  {
    id: "glass_cannon",
    name: "GLASS CANNON",
    description: "Tower costs -25%, tower damage +20%, core integrity -25%.",
    kind: "mixed",
    towerCostMul: 0.75,
    towerDamageMul: 1.20,
    coreMul: 0.75,
  },
  {
    id: "blood_bounty",
    name: "BLOOD FOR BOUNTY",
    description: "Kill rewards +50%, towers fire 10% faster, but enemies regenerate 1 HP/s.",
    kind: "mixed",
    enemyRewardMul: 1.5,
    enemyHealPerSec: 1.0,
    towerCooldownMul: 0.9,
  },
  {
    id: "ascendant_wave",
    name: "ASCENDANT WAVES",
    description: "Enemy armor +15%, credit reward +40%, tower damage +15%.",
    kind: "mixed",
    enemyArmorAdd: 0.15,
    enemyRewardMul: 1.4,
    towerDamageMul: 1.15,
  },
  {
    id: "war_economy",
    name: "WAR ECONOMY",
    description: "Tower costs -20% but enemies +20% HP.",
    kind: "mixed",
    towerCostMul: 0.8,
    enemyHpMul: 1.2,
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
  // Avoid pairing two modifiers that both halve/disable harvesters at once.
  if (
    (d.harvestDisabled || (d.harvesterIncomeMul ?? 1) < 1) &&
    (b.harvesterIncomeMul ?? 1) < 1
  ) {
    const alt = buffsAndMixed.filter((m) => (m.harvesterIncomeMul ?? 1) >= 1);
    return [d, (alt[Math.floor(Math.random() * alt.length)] ?? b)];
  }
  return [d, b];
}
