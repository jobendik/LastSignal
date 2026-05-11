#!/usr/bin/env node
/**
 * shared.mjs — Shared engine, data, and utilities for all Last Signal balance sims.
 *
 * Game data is kept in sync with src/data/*.ts
 * Combat model faithfully mirrors balance-sim.mjs but extended for:
 *   - All 4 sectors (waves.ts defaultWaves / sector2Waves / sector3Waves / sector4Waves)
 *   - All 4 difficulty tiers (difficulty.ts)
 *   - Run modifier effects (modifiers.ts)
 *   - Research node delta calculations (research.ts)
 *   - Tower cost-efficiency and DPS analysis (towers.ts / enemies.ts)
 *
 * NOTE: balance-sim.mjs uses slightly different reward values and is missing
 *       wave 7b "Silence Protocol" from Sector 1. This module uses the actual
 *       game values from waves.ts (rewardCredits field, 16 waves in Sector 1).
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENEMY DATA  (src/data/enemies.ts)
// ─────────────────────────────────────────────────────────────────────────────
export const ENEMIES = {
  scout:      { hp:   8, speed:  82, reward:   2, breach:  4, armor: 0.00 },
  grunt:      { hp:  20, speed:  50, reward:   4, breach:  8, armor: 0.00 },
  brute:      { hp:  82, speed:  30, reward:  12, breach: 18, armor: 0.15 },
  weaver:     { hp:  28, speed:  45, reward:   8, breach: 10, armor: 0.00 },
  phantom:    { hp:  16, speed:  61, reward:  10, breach:  9, armor: 0.00, phases: true },
  carrier:    { hp: 124, speed:  20, reward:  20, breach: 22, armor: 0.10, spawnsScouts: 4 },
  sprinter:   { hp:   6, speed: 130, reward:   3, breach:  5, armor: 0.00 },
  juggernaut: { hp: 180, speed:  22, reward:  22, breach: 28, armor: 0.30 },
  shielder:   { hp:  46, speed:  42, reward:   9, breach: 12, armor: 0.25, extraHp: 2 },
  splitter:   { hp:  58, speed:  36, reward:  14, breach: 14, armor: 0.00 },
  jammer:     { hp:  34, speed:  48, reward:  11, breach: 10, armor: 0.00 },
  swarm:      { hp:   3, speed:  72, reward:   1, breach:  2, armor: 0.00 },
  overlord:   { hp: 420, speed:  22, reward:  60, breach: 32, armor: 0.18, isBoss: true },
  tunneler:   { hp:  38, speed:  52, reward:  16, breach: 12, armor: 0.00 },
  saboteur:   { hp:  30, speed:  62, reward:  14, breach:  9, armor: 0.00 },
  cache:      { hp:  22, speed: 100, reward:  50, breach:  0, armor: 0.00 },
  leviathan:  { hp: 850, speed:  15, reward: 100, breach: 45, armor: 0.20, isBoss: true },
  harbinger:  { hp: 620, speed:  12, reward: 120, breach: 38, armor: 0.16, isBoss: true },
  // Mirror units: reflect tower fire — modelled as high armor (absorption proxy)
  mirror:     { hp:  35, speed:  35, reward:  10, breach:  6, armor: 0.50 },
};

// ─────────────────────────────────────────────────────────────────────────────
// TOWER DATA  (src/data/towers.ts)
// ─────────────────────────────────────────────────────────────────────────────
export const TOWERS = {
  pulse:     { cost:  20, range: 112, damage:  3.00, cd: 0.48, combat: true },
  blaster:   { cost:  40, range:  88, damage:  1.15, cd: 0.12, combat: true },
  stasis:    { cost:  50, range: 132, damage:  0,    cd: 1.35, slow: true,  slowFactor: 0.45 },
  mortar:    { cost:  80, range: 165, damage: 15.00, cd: 2.15, combat: true, splashMul: 1.45 },
  tesla:     { cost:  90, range: 102, damage:  7.00, cd: 0.80, combat: true, chainMul: 2.0 },
  harvester: { cost:  45, range:   0, damage:  0,    cd: 5.00, isEco: true,  income: 17 },
  railgun:   { cost: 150, range: 260, damage: 42.00, cd: 2.60, combat: true, buildLimit: 3 },
  flamer:    { cost:  70, range:  74, damage:  1.20, cd: 0.09, combat: true },
  barrier:   { cost:  90, range: 120, damage:  0,    cd: 0.60, slow: true,  slowFactor: 0.65 },
  amplifier: { cost: 110, range:  48, damage:  0,    cd: 99999 },
  snare:     { cost:  65, range: 118, damage:  0,    cd: 2.40, slow: true,  slowFactor: 0.40 },
  overclock: { cost: 125, range:  48, damage:  0,    cd: 15 },
};

// ─────────────────────────────────────────────────────────────────────────────
// DIFFICULTY TIERS  (src/data/difficulty.ts)
// ─────────────────────────────────────────────────────────────────────────────
export const DIFFICULTIES = {
  recruit: {
    id: "recruit", label: "Recruit",
    enemyHpMul: 0.75, enemySpeedMul: 0.90, rewardMul: 1.0, coreIntegrityMul: 1.35,
  },
  standard: {
    id: "standard", label: "Standard",
    enemyHpMul: 1.15, enemySpeedMul: 1.00, rewardMul: 1.0, coreIntegrityMul: 1.00,
  },
  veteran: {
    id: "veteran", label: "Veteran",
    enemyHpMul: 1.65, enemySpeedMul: 1.15, rewardMul: 1.1, coreIntegrityMul: 0.80,
  },
  nightmare: {
    id: "nightmare", label: "Nightmare",
    enemyHpMul: 2.40, enemySpeedMul: 1.30, rewardMul: 1.1, coreIntegrityMul: 0.55,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MODIFIERS  (src/data/modifiers.ts)
// ─────────────────────────────────────────────────────────────────────────────
export const DEBUFFS = [
  { id: "haunted",       name: "HAUNTED SIGNAL",     enemyHealPerSec: 2 },
  { id: "scarcity",      name: "RESOURCE SCARCITY",  harvesterIncomeMul: 0 },
  { id: "armored",       name: "HARDENED CARAPACE",  enemyArmorAdd: 0.20 },
  { id: "turbulent",     name: "TURBULENT FLOW",     enemySpeedMul: 1.30 },
  { id: "bleeding",      name: "BLEEDING SIGNAL",    enemyHealPerSec: 4 },
  { id: "brittle_walls", name: "BRITTLE WALLS",      coreMul: 0.85 },
  { id: "inflation",     name: "INFLATION",          towerCostMul: 1.35 },
  { id: "heavy_hull",    name: "HEAVY HULL",         enemyHpMul: 1.60 },
  { id: "drought",       name: "ECONOMY DROUGHT",    harvesterIncomeMul: 0.50 },
  { id: "desperate_foe", name: "DESPERATE FOE",      enemySpeedMul: 1.15, enemyArmorAdd: 0.15 },
  { id: "degraded_fire", name: "DEGRADED FIRING",    towerCooldownMul: 1.20 },
  { id: "rationed",      name: "RATIONED SUPPLY",    towerCostMul: 1.15, harvesterIncomeMul: 0.75 },
];

export const BUFFS_MIXED = [
  { id: "signal_boost",    name: "SIGNAL BOOST",      coreMul: 1.30 },
  { id: "overclock",       name: "OVERCLOCK",          towerCooldownMul: 0.75, towerCostMul: 1.25 },
  { id: "dark_matter",     name: "DARK MATTER",        enemyHpMul: 1.55, enemyRewardMul: 1.40 },
  { id: "credit_flood",    name: "CREDIT OVERFLOW",    harvesterIncomeMul: 2.00, towerCostMul: 1.25 },
  { id: "rapid_response",  name: "RAPID RESPONSE",     towerCooldownMul: 0.70, coreMul: 0.85 },
  { id: "bounty_targets",  name: "BOUNTY TARGETS",     enemyHpMul: 1.70, enemyRewardMul: 1.60 },
  { id: "supply_line",     name: "SUPPLY LINE",        harvesterIncomeMul: 1.50, towerCostMul: 1.10 },
  { id: "crystal_rush",    name: "CRYSTAL RUSH",       harvesterIncomeMul: 1.75, enemySpeedMul: 1.15 },
  { id: "reinforced_hull", name: "REINFORCED HULL",    coreMul: 1.50, enemyHpMul: 1.25 },
  { id: "glass_cannon",   name: "GLASS CANNON",      towerCostMul: 0.75, towerDamageMul: 1.20, coreMul: 0.75 },
  { id: "blood_bounty",    name: "BLOOD FOR BOUNTY",   enemyRewardMul: 1.50, enemyHealPerSec: 2 },
  { id: "ascendant_wave",  name: "ASCENDANT WAVES",    enemyArmorAdd: 0.22, enemyRewardMul: 1.40 },
];

// ─────────────────────────────────────────────────────────────────────────────
// RESEARCH NODES  (src/data/research.ts — sim-relevant effects only)
// ─────────────────────────────────────────────────────────────────────────────
export const RESEARCH_NODES = [
  { id: "logistics_1",      tier: 1, cost: 3, label: "Logistics I",       effect: { startingCreditsAdd: 40 } },
  { id: "reinforced_core",  tier: 1, cost: 4, label: "Reinforced Core",   effect: { coreIntegrityAdd: 35 } },
  { id: "logistics_2",      tier: 2, cost: 5, label: "Logistics II",      effect: { startingCreditsAdd: 75 } },
  { id: "calibrated_optics",tier: 2, cost: 4, label: "Calibrated Optics", effect: { towerRangeAdd: 12 } },
  { id: "plasma_metallurgy",tier: 2, cost: 6, label: "Plasma Metallurgy", effect: { towerDamageMul: 1.20 } },
  { id: "deep_mining",      tier: 2, cost: 5, label: "Deep Mining",       effect: { harvesterIncomeMul: 1.25 } },
  { id: "bountyful",        tier: 2, cost: 4, label: "Bountyful Hunt",    effect: { rewardMul: 1.15 } },
  { id: "fortified_signal", tier: 2, cost: 6, label: "Fortified Signal",  effect: { coreIntegrityAdd: 70 } },
  { id: "advanced_arsenal", tier: 3, cost: 9, label: "Advanced Arsenal",  effect: { towerDamageMul: 1.30 } },
  { id: "precision_optics", tier: 3, cost: 7, label: "Precision Optics",  effect: { towerRangeAdd: 20 } },
  { id: "deep_reserves",    tier: 3, cost: 8, label: "Deep Reserves",     effect: { harvesterIncomeMul: 1.25 } },
  { id: "supply_chain",     tier: 3, cost: 7, label: "Supply Chain",      effect: { rewardMul: 1.15 } },
  { id: "logistics_3",      tier: 3, cost: 8, label: "Logistics III",     effect: { startingCreditsAdd: 75 } },
];

// ─────────────────────────────────────────────────────────────────────────────
// WAVE DATA — All 4 sectors
// Translated from src/data/waves.ts (rewardCredits → reward, type/count kept).
// NOTE: Sector 1 has 16 waves; balance-sim.mjs was missing wave 7b (Silence).
//       Rewards here match the actual game, not balance-sim's higher estimates.
// ─────────────────────────────────────────────────────────────────────────────

// Helper: compact wave builder
const W = (reward, name, lanes, extra = {}) => ({ reward, name, lanes, ...extra });
const L = (...enemies) => ({ enemies });
const E = (type, count) => ({ type, count });

export const SECTOR1_WAVES = [
  W( 28, "First Contact",      [L(E("scout",6))]),
  W( 40, "Signal Pressure",    [L(E("grunt",9))]),
  W( 48, "Iron Wall",          [L(E("brute",3), E("grunt",8))]),
  W( 52, "Phase Echo",         [L(E("scout",7)), L(E("phantom",2))]),
  W( 60, "Carrier Breach",     [L(E("carrier",1)), L(E("scout",8))]),
  W( 55, "Weaver Escort",      [L(E("brute",4), E("weaver",2))]),
  W( 58, "Ghost Column",       [L(E("phantom",6)), L(E("grunt",12))]),
  W( 60, "Silence Protocol",   [L(E("brute",5)), L(E("grunt",12))], { waveEvent: "silence" }),
  W( 65, "Nest Splitters",     [L(E("carrier",3)), L(E("weaver",2))]),
  W( 70, "Blitz Swarm",        [L(E("scout",18)), L(E("scout",18))], { waveEvent: "blitz" }),
  W( 78, "Armored Ghosts",     [L(E("brute",9)), L(E("phantom",5))]),
  W( 82, "Carrier Tide",       [L(E("carrier",4))]),
  W( 88, "Repair Swarm",       [L(E("grunt",26)), L(E("weaver",5))]),
  W( 92, "Crushing Mass",      [L(E("brute",13)), L(E("carrier",4))]),
  W( 98, "Fractured Reality",  [L(E("phantom",16)), L(E("scout",18))]),
  W(140, "The Gauntlet",       [L(E("scout",6),E("grunt",6),E("sprinter",5),E("brute",4),
                                   E("phantom",4),E("weaver",3),E("shielder",4),E("jammer",3),
                                   E("splitter",3),E("carrier",3),E("juggernaut",2))]),
];

export const SECTOR2_WAVES = [
  W( 36, "Crystal Probe",      [L(E("grunt",7))]),
  W( 48, "First Sprint",       [L(E("sprinter",6)), L(E("grunt",6))]),
  W( 60, "Split Kindling",     [L(E("splitter",4)), L(E("grunt",8))]),
  W( 68, "Brute Rumble",       [L(E("brute",4)), L(E("grunt",10))]),
  W( 76, "Credit Run",         [L(E("grunt",8)), L(E("scout",6))]),
  W( 88, "Sprint Storm",       [L(E("sprinter",12)), L(E("scout",8))]),
  W( 96, "Armor Test",         [L(E("brute",5)), L(E("shielder",3))]),
  W(104, "Silence Protocol",   [L(E("brute",5)), L(E("grunt",12))], { waveEvent: "silence" }),
  W(112, "Fission Tide",       [L(E("splitter",7)), L(E("scout",10))]),
  W(120, "Carrier Pair",       [L(E("carrier",2)), L(E("weaver",2))]),
  W(128, "Blitz Swarm",        [L(E("scout",22)), L(E("scout",22))], { waveEvent: "blitz" }),
  W(136, "Economy Clash",      [L(E("brute",5)), L(E("sprinter",9)), L(E("splitter",4))]),
  W(144, "Reinforced Wall",    [L(E("brute",8)), L(E("weaver",4))]),
  W(176, "Crystal Overlord",   [L(E("overlord",1)), L(E("swarm",12)), L(E("grunt",8))]),
  W(208, "Crystal Gauntlet",   [L(E("scout",8),E("sprinter",8),E("splitter",5),E("brute",5),
                                   E("shielder",4),E("carrier",3),E("weaver",4))]),
];

export const SECTOR3_WAVES = [
  W( 36, "First Phase",        [L(E("scout",5)), L(E("phantom",2))]),
  W( 48, "Signal Jammer",      [L(E("jammer",1)), L(E("grunt",8))]),
  W( 60, "Phase Volley",       [L(E("phantom",6))]),
  W( 68, "Saboteur Cell",      [L(E("saboteur",3)), L(E("grunt",9))]),
  W( 76, "Ghost Column",       [L(E("phantom",6)), L(E("grunt",12))]),
  W( 84, "Jammer Pair",        [L(E("jammer",2)), L(E("brute",5))]),
  W( 92, "Phantom Blitz",      [L(E("phantom",14))]),
  W(100, "Silence Protocol",   [L(E("phantom",5)), L(E("grunt",14))], { waveEvent: "silence" }),
  W(108, "Saboteur Storm",     [L(E("saboteur",5)), L(E("saboteur",5))]),
  W(116, "Armored Ghosts",     [L(E("brute",8)), L(E("phantom",6))]),
  W(128, "Mirror Vanguard",    [L(E("mirror",3), E("grunt",10))]),
  W(136, "Disruption Field",   [L(E("jammer",3)), L(E("phantom",10))]),
  W(148, "Phantom Carrier",    [L(E("carrier",3)), L(E("phantom",8))]),
  W(160, "Detection Breach",   [L(E("saboteur",4)), L(E("jammer",3)), L(E("phantom",8))]),
  W(208, "Phantom Gauntlet",   [L(E("phantom",10),E("saboteur",5),E("jammer",4),
                                   E("mirror",4),E("carrier",2),E("phantom",12))]),
];

export const SECTOR4_WAVES = [
  W( 48, "Hostile Advance",    [L(E("grunt",12)), L(E("scout",8))]),
  W( 60, "Brute Volley",       [L(E("brute",6)), L(E("grunt",10))]),
  W( 72, "Saboteur Test",      [L(E("saboteur",4)), L(E("brute",5))]),
  W( 84, "Carrier Wedge",      [L(E("carrier",2)), L(E("brute",6))]),
  W( 96, "Phantom Breach",     [L(E("phantom",8)), L(E("brute",5))]),
  W(108, "Juggernaut Charge",  [L(E("juggernaut",3)), L(E("saboteur",4))]),
  W(116, "Silence Protocol",   [L(E("juggernaut",2)), L(E("grunt",16))], { waveEvent: "silence" }),
  W(128, "Blitz Swarm",        [L(E("scout",24)), L(E("scout",24))], { waveEvent: "blitz" }),
  W(140, "Mirror Armor",       [L(E("mirror",4), E("juggernaut",3)), L(E("grunt",12))]),
  W(152, "Jammer Field",       [L(E("jammer",4)), L(E("phantom",8)), L(E("brute",6))]),
  W(176, "Overlord Strike",    [L(E("overlord",1)), L(E("brute",6)), L(E("swarm",14))]),
  W(160, "Tunneler Cell",      [L(E("tunneler",6)), L(E("grunt",12))]),
  W(192, "Harbinger",          [L(E("harbinger",1)), L(E("jammer",4)), L(E("brute",6))]),
  W(176, "Final Push",         [L(E("juggernaut",3)), L(E("saboteur",5)), L(E("phantom",8)), L(E("tunneler",4))]),
  W(256, "The Leviathan",      [L(E("leviathan",1)), L(E("carrier",3)), L(E("brute",8)), L(E("saboteur",5))]),
];

export const ALL_SECTORS = [
  { id: "sector1", label: "Sector 1 — Broken Relay",   waves: SECTOR1_WAVES, startCredits: 250 },
  { id: "sector2", label: "Sector 2 — Crystal Scar",   waves: SECTOR2_WAVES, startCredits: 300 },
  { id: "sector3", label: "Sector 3 — Phantom Gate",   waves: SECTOR3_WAVES, startCredits: 350 },
  { id: "sector4", label: "Sector 4 — Hostile Core",   waves: SECTOR4_WAVES, startCredits: 400 },
];

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS  (src/core/Config.ts, src/core/GameState.ts)
// ─────────────────────────────────────────────────────────────────────────────
export const CORE_INTEGRITY_STANDARD = 100;
export const STARTING_CREDITS_S1 = 250;
// Estimated enemy path length in pixels (see balance-sim.mjs for derivation)
export const PATH_LENGTH = 390;

// Realistic placement cap: how many combat towers can practically cover the path.
// Real maps have finite buildable cells; without this cap, "spam" strategies
// stack unlimited towers and trivially win every difficulty. Tuned to match
// the buildable footprint of Sector 1 along its primary lane.
export const MAX_COMBAT_TOWERS = 20;
// Estimated wave duration in seconds (used for harvester income calculation)
export const WAVE_DURATION_SECS = 30;
// Silence wave model: fraction of enemies that auto-breach while towers are offline
export const SILENCE_BREACH_FRACTION = 0.15;

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Damage one combat tower deals to one enemy.
 *
 * @param {object} tDef       Tower definition
 * @param {object} eDef       Enemy definition (may include overrides)
 * @param {object} [opts]     Modifiers: speedMul, cooldownMul, damageMul, armorAdd, rangeAdd
 */
export function towerDamageVsEnemy(tDef, eDef, opts = {}) {
  if (!tDef.combat) return 0;
  const { speedMul = 1.0, cooldownMul = 1.0, damageMul = 1.0, armorAdd = 0, rangeAdd = 0 } = opts;
  const speed       = (eDef.speed ?? 60) * speedMul;
  const range       = tDef.range + rangeAdd;
  const timeInRange = (range * 2) / speed;
  const effectiveCd = tDef.cd * cooldownMul;
  const shots       = Math.floor(timeInRange / effectiveCd) + 1;
  const mul         = tDef.splashMul ?? tDef.chainMul ?? 1.0;
  const raw         = shots * tDef.damage * mul * damageMul;
  const armor       = Math.min(0.90, (eDef.armor ?? 0) + armorAdd);
  return raw * (1 - armor);
}

/**
 * Simulate one enemy passing through a tower lineup.
 *
 * @param {string}   eType      Enemy type key
 * @param {string[]} towerList  Array of tower-type keys
 * @param {object}  [override]  Override fields on the enemy (hp, speed, etc.)
 * @param {object}  [modOpts]   Combat modifier options forwarded to towerDamageVsEnemy
 * @param {number[]} [shotsRemaining]  Per-tower per-wave shot budget (drains as enemies absorb fire).
 *                                     Pass null/undefined to skip the budget cap (legacy behaviour).
 */
export function simulateEnemyVsTowers(eType, towerList, override = null, modOpts = {}, shotsRemaining = null) {
  const base = ENEMIES[eType];
  if (!base) return { killed: false, breachDmg: 0 };

  const eDef = override ? { ...base, ...override } : base;
  const { cooldownMul = 1.0, damageMul = 1.0, armorAdd = 0, healPerSec = 0, rangeAdd = 0 } = modOpts;

  // Regen bonus: enemy heals for (healRate × traversal_time) of total HP
  const traverseTime = PATH_LENGTH / (eDef.speed ?? 60);
  let hp = eDef.hp + healPerSec * traverseTime;

  // Phantom phase — half effective DPS window
  const phaseFactor = eDef.phases ? 0.5 : 1.0;

  // Worst-case slow: the slowest tower on the line determines speed multiplier
  let speedMul = 1.0;
  for (const t of towerList) {
    const tDef = TOWERS[t];
    if (tDef?.slow) speedMul = Math.min(speedMul, tDef.slowFactor ?? 0.5);
  }

  // Sum damage from all combat towers (subject to per-tower per-wave shot budget)
  for (let ti = 0; ti < towerList.length; ti++) {
    const tDef = TOWERS[towerList[ti]];
    if (!tDef?.combat) continue;

    const speed        = (eDef.speed ?? 60) * speedMul;
    const range        = tDef.range + rangeAdd;
    const timeInRange  = (range * 2) / speed;
    const effectiveCd  = tDef.cd * cooldownMul;
    const aoeMul       = tDef.splashMul ?? tDef.chainMul ?? 1.0;
    const armor        = Math.min(0.90, (eDef.armor ?? 0) + armorAdd);

    let shotsAtEnemy = Math.floor(timeInRange / effectiveCd) + 1;

    if (shotsRemaining) {
      // AoE/chain shots count as fractional consumption (1 shot = aoeMul enemy hits)
      const shotsAvailable = Math.max(0, shotsRemaining[ti]) * aoeMul;
      shotsAtEnemy = Math.min(shotsAtEnemy, Math.floor(shotsAvailable));
      if (shotsAtEnemy <= 0) continue;
    }

    const rawDmg = shotsAtEnemy * tDef.damage * aoeMul * damageMul * phaseFactor;
    hp -= rawDmg * (1 - armor);

    if (shotsRemaining) {
      shotsRemaining[ti] -= shotsAtEnemy / aoeMul;
    }

    if (hp <= 0) return { killed: true, breachDmg: 0 };
  }

  return { killed: false, breachDmg: eDef.breach ?? 0 };
}

/**
 * Flatten all enemies from a wave definition into a type-string array.
 * Includes carrier offspring (4 scouts) and splitter offspring (2 grunts).
 */
export function waveEnemyList(waveDef) {
  const list = [];
  for (const lane of waveDef.lanes) {
    for (const g of lane.enemies) {
      for (let i = 0; i < g.count; i++) list.push(g.type);
    }
  }
  const extraScouts = list.filter(e => e === "carrier").length * 4;
  for (let i = 0; i < extraScouts; i++) list.push("scout");
  const extraGrunts = list.filter(e => e === "splitter").length * 2;
  for (let i = 0; i < extraGrunts; i++) list.push("grunt");
  return list;
}

/** Total EHP (effective HP from tower perspective) for a wave. */
export function waveThreatEHP(waveDef) {
  return waveEnemyList(waveDef).reduce((sum, type) => {
    const e = ENEMIES[type];
    if (!e) return sum;
    return sum + e.hp / (1 - (e.armor ?? 0));
  }, 0);
}

/** Total breach damage if ALL enemies get through. */
export function waveMaxBreach(waveDef) {
  return waveEnemyList(waveDef).reduce((sum, type) => {
    const e = ENEMIES[type];
    return sum + (e?.breach ?? 0);
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN SIMULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate a full campaign sector.
 *
 * @param {Function} strategyFn  (credits, waveIndex, towers, opts) => towersToAdd[]
 * @param {object}   opts
 *   wavesArr           – wave list (default SECTOR1_WAVES)
 *   startingCredits    – initial credits
 *   coreMax            – base core integrity (before coreIntegrityMul)
 *   -- Difficulty --
 *   enemyHpMul         – enemy HP multiplier
 *   enemySpeedMul      – enemy speed multiplier
 *   coreIntegrityMul   – core HP multiplier
 *   rewardMul          – kill credit multiplier (difficulty bonus)
 *   -- Modifiers --
 *   towerCostMul       – build cost multiplier
 *   harvesterIncomeMul – harvester income multiplier
 *   enemyRewardMul     – additional kill reward multiplier (modifier)
 *   towerCooldownMul   – tower fire rate multiplier (>1 = slower)
 *   towerDamageMul     – tower damage multiplier
 *   towerRangeAdd      – flat range bonus for all towers
 *   enemyArmorAdd      – flat armor bonus for all enemies
 *   enemyHealPerSec    – enemy regen per second
 *   coreMul            – additional core multiplier (modifier)
 *
 * @returns {object[]} waveLogs  one entry per wave
 */
export function simulateCampaign(strategyFn, opts = {}) {
  const {
    wavesArr          = SECTOR1_WAVES,
    startingCredits   = STARTING_CREDITS_S1,
    coreMax           = CORE_INTEGRITY_STANDARD,
    // Difficulty
    enemyHpMul        = 1.0,
    enemySpeedMul     = 1.0,
    coreIntegrityMul  = 1.0,
    rewardMul         = 1.0,
    // Modifier
    towerCostMul      = 1.0,
    harvesterIncomeMul = 1.0,
    enemyRewardMul    = 1.0,
    towerCooldownMul  = 1.0,
    towerDamageMul    = 1.0,
    towerRangeAdd     = 0,
    enemyArmorAdd     = 0.0,
    enemyHealPerSec   = 0,
    coreMul           = 1.0,
  } = opts;

  const modOpts = { cooldownMul: towerCooldownMul, damageMul: towerDamageMul,
    armorAdd: enemyArmorAdd, healPerSec: enemyHealPerSec, rangeAdd: towerRangeAdd };

  let credits = startingCredits;
  let coreHp  = Math.round(coreMax * coreIntegrityMul * coreMul);
  const towers = [];
  const waveLogs = [];

  for (let wi = 0; wi < wavesArr.length; wi++) {
    if (coreHp <= 0) {
      waveLogs.push({ wave: wi + 1, towers: towers.length, enemies: 0,
        breaches: 0, coreDmg: 0, coreHp: 0, credits, alive: false });
      continue;
    }

    // ── Planning phase ──────────────────────────────────────────────────────
    const toBuild = strategyFn(credits, wi, towers, { towerCostMul });
    for (const t of toBuild) {
      const def = TOWERS[t];
      if (!def) continue;
      const cost = def.cost * towerCostMul;
      if (credits < cost) continue;
      if (def.buildLimit != null && towers.filter(x => x === t).length >= def.buildLimit) continue;
      // Realistic placement cap on combat towers (eco/support unlimited).
      if (def.combat && towers.filter(x => TOWERS[x]?.combat).length >= MAX_COMBAT_TOWERS) continue;
      credits -= cost;
      towers.push(t);
    }

    // ── Harvester income ────────────────────────────────────────────────────
    const harvCount  = towers.filter(t => t === "harvester").length;
    const harvIncome = harvCount * Math.floor(WAVE_DURATION_SECS / 5)
                       * (TOWERS.harvester.income ?? 15) * harvesterIncomeMul;

    // ── Per-tower per-wave shot budget (caps spam compositions) ────────────
    const shotsRemaining = towers.map(t => {
      const tDef = TOWERS[t];
      if (!tDef?.combat) return 0;
      const cd = tDef.cd * (modOpts.cooldownMul ?? 1.0);
      return WAVE_DURATION_SECS / cd;
    });

    // ── Wave phase ──────────────────────────────────────────────────────────
    const waveDef   = wavesArr[wi];
    const enemyList = waveEnemyList(waveDef);
    let breaches = 0, coreDmg = 0, killCredits = 0;

    // Silence wave: first SILENCE_BREACH_FRACTION of enemies auto-breach
    const silenceCount = waveDef.waveEvent === "silence"
      ? Math.ceil(enemyList.length * SILENCE_BREACH_FRACTION) : 0;

    for (let ei = 0; ei < enemyList.length; ei++) {
      const eType = enemyList[ei];
      const base  = ENEMIES[eType];
      if (!base) continue;

      // Auto-breach during silence window
      if (ei < silenceCount) {
        breaches++;
        coreDmg += base.breach ?? 0;
        continue;
      }

      const override = (enemyHpMul !== 1.0 || enemySpeedMul !== 1.0)
        ? { hp: base.hp * enemyHpMul, speed: base.speed * enemySpeedMul } : null;

      const { killed, breachDmg } = simulateEnemyVsTowers(eType, towers, override, modOpts, shotsRemaining);
      if (killed) {
        killCredits += (base.reward ?? 0) * rewardMul * enemyRewardMul;
      } else {
        breaches++;
        coreDmg += breachDmg;
      }
    }

    coreHp  = Math.max(0, coreHp - coreDmg);
    credits += (waveDef.reward ?? 0) + killCredits + harvIncome;

    waveLogs.push({ wave: wi + 1, towers: towers.length, enemies: enemyList.length,
      breaches, coreDmg, coreHp, credits, alive: coreHp > 0 });
  }

  return waveLogs;
}

/**
 * Multi-run Monte-Carlo stats for a strategy.
 * Adds ±30% placement-efficiency noise (enemy HP variance) per run.
 */
export function multiRunStats(strategyFn, runs = 100, opts = {}) {
  const wavesArr  = opts.wavesArr ?? SECTOR1_WAVES;
  const aggregated = Array.from({ length: wavesArr.length }, () =>
    ({ breaches: [], coreDmg: [], coreHp: [], towers: [], alive: [] }));

  for (let r = 0; r < runs; r++) {
    const noiseScale = 0.70 + Math.random() * 0.60; // 0.70–1.30
    const hpNoise    = (opts.enemyHpMul ?? 1.0) / noiseScale;
    const logs = simulateCampaign(strategyFn, { ...opts, enemyHpMul: hpNoise });
    for (let wi = 0; wi < logs.length; wi++) {
      const { breaches: b, coreDmg: d, coreHp: h, towers: t, alive: a } = logs[wi];
      const agg = aggregated[wi];
      agg.breaches.push(b); agg.coreDmg.push(d); agg.coreHp.push(h);
      agg.towers.push(t);   agg.alive.push(a ? 1 : 0);
    }
  }

  const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  return aggregated.map((agg, wi) => ({
    wave:         wi + 1,
    avgBreaches:  avg(agg.breaches),
    avgCoreDmg:   avg(agg.coreDmg),
    avgCoreHp:    avg(agg.coreHp),
    avgTowers:    avg(agg.towers),
    survivalRate: avg(agg.alive),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDLESS MODE  (src/systems/EndlessSystem.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function generateEndlessWave(endlessWave) {
  // Mirrors EndlessSystem.ts scaling
  const hpScale    = 1 + endlessWave * 0.22 + Math.max(0, endlessWave - 12) * 0.04;
  const speedScale = 1 + Math.min(endlessWave * 0.04, 0.9);

  const pool = [
    "scout", "grunt", "sprinter", "swarm",
    ...(endlessWave >= 3  ? ["brute", "weaver"] : []),
    ...(endlessWave >= 5  ? ["phantom", "shielder"] : []),
    ...(endlessWave >= 7  ? ["splitter", "jammer"] : []),
    ...(endlessWave >= 8  ? ["tunneler"] : []),
    ...(endlessWave >= 10 ? ["juggernaut", "carrier", "saboteur"] : []),
  ];

  const groups = [1, 2, 3].map(i => ({
    type: pool[Math.floor(Math.sin(endlessWave * 17 + i * 31) * 0.5 + 0.5) * pool.length | 0],
    count: 8 + (endlessWave % 6) + i * 2,
  }));

  const isBoss = endlessWave % 8 === 0;
  if (isBoss) groups.push({ type: endlessWave >= 16 ? "leviathan" : "overlord", count: 1 });

  return {
    reward: 30 + endlessWave * 6,
    name: `Endless Wave ${endlessWave}`,
    lanes: [{ enemies: groups }],
    hpScale,
    speedScale,
  };
}

/** Returns the endless wave number at which a tower list first has a breach (or maxEndlessWave+1). */
export function endlessSurvivalLimit(towers, maxEndlessWave = 50) {
  for (let ew = 1; ew <= maxEndlessWave; ew++) {
    const waveDef   = generateEndlessWave(ew);
    const enemyList = waveEnemyList(waveDef);
    for (const eType of enemyList) {
      const base = ENEMIES[eType];
      if (!base) continue;
      const override = { hp: base.hp * waveDef.hpScale, speed: base.speed * waveDef.speedScale };
      const { killed } = simulateEnemyVsTowers(eType, towers, override);
      if (!killed) return ew;
    }
  }
  return maxEndlessWave + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGIES
// ─────────────────────────────────────────────────────────────────────────────

// Each strategy receives (credits, waveIndex, currentTowers, {towerCostMul})
// and returns an array of tower-type strings to buy.

export const strategies = {
  none: {
    label: "No Defense",
    fn: () => [],
  },
  minimal: {
    label: "Minimal (1 pulse/wave)",
    fn: (credits, _wi, _towers, { towerCostMul = 1 } = {}) => {
      const cost = TOWERS.pulse.cost * towerCostMul;
      return credits >= cost ? ["pulse"] : [];
    },
  },
  pulseSpam: {
    label: "Pulse Spam",
    fn: (credits, _wi, _towers, { towerCostMul = 1 } = {}) => {
      const result = []; let budget = credits;
      const cost = TOWERS.pulse.cost * towerCostMul;
      while (budget >= cost) { result.push("pulse"); budget -= cost; }
      return result;
    },
  },
  blasterSpam: {
    label: "Blaster Spam",
    fn: (credits, _wi, _towers, { towerCostMul = 1 } = {}) => {
      const result = []; let budget = credits;
      const cost = TOWERS.blaster.cost * towerCostMul;
      while (budget >= cost) { result.push("blaster"); budget -= cost; }
      return result;
    },
  },
  flamerSpam: {
    label: "Flamer Spam",
    fn: (credits, _wi, _towers, { towerCostMul = 1 } = {}) => {
      const result = []; let budget = credits;
      const cost = TOWERS.flamer.cost * towerCostMul;
      while (budget >= cost) { result.push("flamer"); budget -= cost; }
      return result;
    },
  },
  economy: {
    label: "Economy-First",
    fn: (credits, waveIndex, currentTowers, { towerCostMul = 1 } = {}) => {
      const result = []; let budget = credits;
      const pulseCost   = TOWERS.pulse.cost * towerCostMul;
      const harvestCost = TOWERS.harvester.cost * towerCostMul;
      const harvCount   = currentTowers.filter(t => t === "harvester").length;

      if (waveIndex < 3 && harvCount < 3 && budget >= harvestCost) {
        result.push("harvester"); budget -= harvestCost;
      }
      const existingPulse = currentTowers.filter(t => t === "pulse").length
                          + result.filter(t => t === "pulse").length;
      if (existingPulse < 2 && budget >= pulseCost) {
        result.push("pulse"); budget -= pulseCost;
      }
      if (waveIndex >= 3) {
        while (budget >= pulseCost) { result.push("pulse"); budget -= pulseCost; }
      }
      return result;
    },
  },
  mixed: {
    label: "Mixed Optimal",
    fn: (credits, waveIndex, currentTowers, { towerCostMul = 1 } = {}) => {
      const result = []; let budget = credits;
      const has   = t => currentTowers.includes(t) || result.includes(t);
      const cost  = t => TOWERS[t].cost * towerCostMul;

      if (waveIndex <= 1) {
        while (budget >= cost("pulse")) { result.push("pulse"); budget -= cost("pulse"); }
        return result;
      }
      if (!has("stasis") && budget >= cost("stasis")) {
        result.push("stasis"); budget -= cost("stasis");
      }
      if (!has("mortar") && budget >= cost("mortar")) {
        result.push("mortar"); budget -= cost("mortar");
      }
      // Add 2 flamers for swarm clearing (waves 3+)
      if (waveIndex >= 3 && currentTowers.filter(t => t === "flamer").length < 2 && budget >= cost("flamer")) {
        result.push("flamer"); budget -= cost("flamer");
      }
      if (waveIndex >= 4 && currentTowers.filter(t => t === "tesla").length < 2 && budget >= cost("tesla")) {
        result.push("tesla"); budget -= cost("tesla");
      }
      if (waveIndex >= 5 && !has("railgun") && budget >= cost("railgun")) {
        result.push("railgun"); budget -= cost("railgun");
      }
      while (budget >= cost("pulse")) { result.push("pulse"); budget -= cost("pulse"); }
      return result;
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// REPORTING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export const VERBOSE = process.argv.includes("--verbose");
export const RUNS    = Number(process.argv.find(a => a.startsWith("--runs="))?.split("=")[1] ?? 100);

export function pad(str, len, right = false) {
  const s = String(str);
  return right ? s.padEnd(len) : s.padStart(len);
}
export const fmt1 = n => typeof n === "number" ? n.toFixed(1) : String(n);
export const fmt0 = n => typeof n === "number" ? n.toFixed(0) : String(n);
export const pct  = n => (n * 100).toFixed(0) + "%";

export function printHeader(title) {
  console.log("\n" + "═".repeat(78));
  console.log(`  ${title}`);
  console.log("═".repeat(78));
}

export function printSubHeader(title) {
  console.log(`\n  ── ${title}`);
  console.log("  " + "─".repeat(74));
}

export function printFlag(msg) {
  console.log(`  ⚠  ${msg}`);
}

/** Merge modifier fields from multiple modifier objects into one opts object. */
export function mergeModifiers(...mods) {
  const out = {};
  for (const m of mods) {
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      if (k === "id" || k === "name" || k === "kind" || k === "label") continue;
      if (k === "harvestDisabled") { out.harvesterIncomeMul = 0; continue; }
      if (typeof v === "number") {
        if (k.endsWith("Mul") && !k.startsWith("enemy")) {
          out[k] = (out[k] ?? 1) * v;
        } else if (k.endsWith("Add")) {
          out[k] = (out[k] ?? 0) + v;
        } else {
          out[k] = (out[k] ?? 1) * v;
        }
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}
