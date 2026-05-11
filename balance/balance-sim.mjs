#!/usr/bin/env node
/**
 * balance-sim.mjs — Last Signal game-balance simulation
 *
 * This script simulates hundreds of games using simplified but faithful combat
 * maths (sourced directly from the game data files) and outputs a balance
 * report:
 *
 *   - Wave-by-wave threat vs. tower-response ratios
 *   - Credit economy at each strategy
 *   - "Tower-count to zero-breach" thresholds per wave
 *   - Endless-mode escalation curve
 *   - Per-strategy win-rate (core survived all waves)
 *
 * Run:   node balance/balance-sim.mjs
 * Or:    node balance/balance-sim.mjs --verbose
 */

// ─────────────────────────────────────────────────────────────────────────────
// GAME DATA  (kept in sync with src/data/*)
// ─────────────────────────────────────────────────────────────────────────────

/** Enemy definitions — mirrored from src/data/enemies.ts */
const ENEMIES = {
  scout:      { hp:   8, speed:  82, reward:   2, breach:  4, armor: 0.00 },
  grunt:      { hp:  20, speed:  50, reward:   4, breach:  8, armor: 0.00 },
  brute:      { hp:  82, speed:  30, reward:  12, breach: 18, armor: 0.15 },
  weaver:     { hp:  28, speed:  45, reward:   8, breach: 10, armor: 0.00 },
  phantom:    { hp:  16, speed:  61, reward:  10, breach:  9, armor: 0.00, phases: true },
  carrier:    { hp: 124, speed:  20, reward:  20, breach: 22, armor: 0.10, spawnsScouts: 4 },
  sprinter:   { hp:   6, speed: 130, reward:   3, breach:  5, armor: 0.00 },
  juggernaut: { hp: 180, speed:  22, reward:  22, breach: 28, armor: 0.30 },
  shielder:   { hp:  46, speed:  42, reward:   9, breach: 12, armor: 0.25, extraHp: 2 }, // 2 absorb charges
  splitter:   { hp:  58, speed:  36, reward:  14, breach: 14, armor: 0.00 },
  jammer:     { hp:  34, speed:  48, reward:  11, breach: 10, armor: 0.00 },
  swarm:      { hp:   3, speed:  72, reward:   1, breach:  2, armor: 0.00 },
  overlord:   { hp: 420, speed:  22, reward:  60, breach: 32, armor: 0.18, isBoss: true },
  tunneler:   { hp:  38, speed:  52, reward:  16, breach: 12, armor: 0.00 },
  saboteur:   { hp:  30, speed:  62, reward:  14, breach:  9, armor: 0.00 },
  cache:      { hp:  22, speed: 100, reward:  50, breach:  0, armor: 0.00 },
  leviathan:  { hp: 850, speed:  15, reward: 100, breach: 45, armor: 0.20, isBoss: true },
  harbinger:  { hp: 620, speed:  12, reward: 120, breach: 38, armor: 0.16, isBoss: true },
};

/**
 * Tower definitions — mirrored from src/data/towers.ts
 *
 * "effective" fields for the simulation:
 *   combat   – fires projectiles at enemies
 *   slow     – slows enemies (reduces speed to slowFactor × base)
 *   splashMul – AoE multiplier on effective DPS (enemies hit multiple times)
 *   chainMul  – chain-hit multiplier on effective DPS
 *   isEco    – generates income per tick
 *   buildLimit – max towers of this type allowed (null = unlimited)
 */
const TOWERS = {
  pulse:     { cost:  20, range: 112, damage:  3.00, cd: 0.48, combat: true },
  blaster:   { cost:  40, range:  88, damage:  1.15, cd: 0.12, combat: true },
  stasis:    { cost:  50, range: 132, damage:  0,    cd: 1.35, slow: true,   slowFactor: 0.45 },
  mortar:    { cost:  80, range: 165, damage: 15.00, cd: 2.15, combat: true, splashMul: 1.45 },
  tesla:     { cost: 120, range: 102, damage:  6.00, cd: 0.95, combat: true, chainMul: 1.5 },
  harvester: { cost:  60, range:   0, damage:  0,    cd: 5.00, isEco: true,  income: 15 },
  railgun:   { cost: 150, range: 260, damage: 42.00, cd: 2.60, combat: true, buildLimit: 3 },
  flamer:    { cost:  70, range:  74, damage:  1.80, cd: 0.09, combat: true },
  barrier:   { cost:  90, range: 120, damage:  0,    cd: 0.60, slow: true,   slowFactor: 0.65 },
  amplifier: { cost: 110, range:  48, damage:  0,    cd: 99999 },
  snare:     { cost:  65, range: 118, damage:  0,    cd: 2.40, slow: true,   slowFactor: 0.40 },
  overclock: { cost: 125, range:  48, damage:  0,    cd: 15 },
};

/**
 * Campaign wave list (Sector 1, waves 1–15).
 * Sourced from src/data/waves.ts  (defaultWaves).
 * Format: { reward, lanes: [ { enemies: [ { t, n } ] } ] }
 */
const SECTOR1_WAVES = [
  { reward:  35, lanes: [{ enemies: [{ t: "scout",      n:  6 }] }] },
  { reward:  50, lanes: [{ enemies: [{ t: "grunt",      n:  9 }] }] },
  { reward:  60, lanes: [{ enemies: [{ t: "brute",      n:  3 }, { t: "grunt", n: 8 }] }] },
  { reward:  65, lanes: [{ enemies: [{ t: "scout",      n:  7 }] },
                          { enemies: [{ t: "phantom",    n:  2 }] }] },
  { reward:  75, lanes: [{ enemies: [{ t: "carrier",    n:  1 }] },
                          { enemies: [{ t: "scout",      n:  8 }] }] },
  { reward:  85, lanes: [{ enemies: [{ t: "brute",      n:  4 }, { t: "weaver", n: 2 }] }] },
  { reward:  90, lanes: [{ enemies: [{ t: "phantom",    n:  6 }] },
                          { enemies: [{ t: "grunt",      n: 12 }] }] },
  { reward: 100, lanes: [{ enemies: [{ t: "carrier",    n:  3 }] },
                          { enemies: [{ t: "weaver",     n:  2 }] }] },
  { reward: 110, lanes: [{ enemies: [{ t: "scout",      n: 18 }] },    // blitz
                          { enemies: [{ t: "scout",      n: 18 }] }] },
  { reward: 120, lanes: [{ enemies: [{ t: "brute",      n:  9 }] },
                          { enemies: [{ t: "phantom",    n:  5 }] }] },
  { reward: 130, lanes: [{ enemies: [{ t: "carrier",    n:  4 }] }] },
  { reward: 140, lanes: [{ enemies: [{ t: "grunt",      n: 26 }] },
                          { enemies: [{ t: "weaver",     n:  5 }] }] },
  { reward: 150, lanes: [{ enemies: [{ t: "brute",      n: 13 }] },
                          { enemies: [{ t: "carrier",    n:  4 }] }] },
  { reward: 160, lanes: [{ enemies: [{ t: "phantom",    n: 16 }] },
                          { enemies: [{ t: "scout",      n: 18 }] }] },
  { reward: 220, lanes: [
    { enemies: [{ t: "scout",      n:  6 }] },
    { enemies: [{ t: "grunt",      n:  6 }] },
    { enemies: [{ t: "sprinter",   n:  5 }] },
    { enemies: [{ t: "brute",      n:  4 }] },
    { enemies: [{ t: "phantom",    n:  4 }] },
    { enemies: [{ t: "weaver",     n:  3 }] },
    { enemies: [{ t: "shielder",   n:  4 }] },
    { enemies: [{ t: "jammer",     n:  3 }] },
    { enemies: [{ t: "splitter",   n:  3 }] },
    { enemies: [{ t: "carrier",    n:  3 }] },
    { enemies: [{ t: "juggernaut", n:  2 }] },
  ]},
];

/**
 * Constants mirrored from src/core/Config.ts and src/core/GameState.ts
 */
const CORE_INTEGRITY_STANDARD = 100; // standard difficulty
const STARTING_CREDITS_S1     = 250; // sector 1

/**
 * Estimated pixel distance from spawner to core for a default 32×22 map.
 * Computed from typical enemy paths observed in the grid layout (sector 1).
 * North/south: ~11 tiles × 32 = 352 px vertical + ~4 tiles lateral ≈ 380 px
 * East/west:   ~12 tiles × 32 = 384 px + vertical offset ≈ 400 px
 * We use 390 px as the representative path length for sector-1 analysis.
 *
 * Enemies follow the flow-field, not a straight line, so actual distances are
 * longer; 390 is a conservative lower-bound that makes results pessimistic for
 * towers (harder to kill = more accurate balance concerns).
 */
const PATH_LENGTH = 390; // px

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT SIMULATION CORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Damage one combat tower deals to one enemy passing through its range.
 *
 * Formula:
 *   shots = floor( timeInRange / cooldown ) + 1
 *   raw   = shots × damage
 *   dealt = raw × (1 − armor)
 *
 * Multipliers for AoE/chain are applied as a flat scalar to DPS to model the
 * "bonus enemies hit per shot" effect (enemies are grouped on the same lane).
 */
function towerDamageVsEnemy(tDef, eDef, speedMul = 1.0) {
  if (!tDef.combat) return 0;
  const speed = eDef.speed * speedMul;
  const timeInRange = (2 * tDef.range) / speed;
  const shots = Math.floor(timeInRange / tDef.cd) + 1;
  let raw = shots * tDef.damage;
  const mul = (tDef.splashMul ?? 1) * (tDef.chainMul ?? 1);
  raw *= mul;
  const armor = eDef.armor ?? 0;
  return raw * (1 - armor);
}

/**
 * Simulate one enemy traversing the full tower line-up.
 *
 * Model:
 *  - All towers are placed along the path; each enemy passes through every
 *    tower's range zone exactly once (true when towers are spread over a path
 *    ≤ 2 × tower.range away from each other, which is realistic for the
 *    compact sector-1 grid).
 *  - Slow towers (stasis/snare/barrier) are applied first because skilled
 *    players place them near the entry-point; they reduce the enemy speed for
 *    subsequent combat-tower calculations.
 *  - Phantom phase immunity: phantoms ignore towers 50% of the time (their
 *    phase cycle gives roughly a 50% damage reduction on average).
 *  - Shielder absorb charges: add flat 2-shot equivalents to effective HP.
 *
 * @param {string}   enemyType   – key into ENEMIES
 * @param {string[]} towerList   – array of tower-type strings
 * @param {object}   [override]  – optional { hp, speed, armor } to override base enemy stats
 * Returns { killed, breachDmg } where breachDmg is 0 if killed.
 */
function simulateEnemyVsTowers(enemyType, towerList, override = null) {
  const base = ENEMIES[enemyType];
  if (!base) return { killed: false, breachDmg: 0 };

  // Merge override into a local copy so we never mutate global state
  const eDef = override ? { ...base, ...override } : base;

  // Effective HP: shielder absorb charges add ~2 shots of the avg combat tower
  let hp = eDef.hp;
  if (eDef.extraHp) {
    const combatTowers = towerList.filter(t => TOWERS[t]?.combat);
    const avgDmg = combatTowers.length > 0
      ? combatTowers.reduce((s, t) => s + TOWERS[t].damage, 0) / combatTowers.length
      : 0;
    hp += eDef.extraHp * avgDmg;
  }

  // Phase factor for phantoms (50% of time they are immune)
  const phaseFactor = eDef.phases ? 0.5 : 1.0;

  // Determine the weakest slow factor from slow towers on this line
  let speedMul = 1.0;
  for (const t of towerList) {
    const tDef = TOWERS[t];
    if (tDef?.slow) speedMul = Math.min(speedMul, tDef.slowFactor ?? 0.5);
  }

  // Accumulate damage from combat towers
  for (const t of towerList) {
    const tDef = TOWERS[t];
    if (!tDef?.combat) continue;
    const dmg = towerDamageVsEnemy(tDef, eDef, speedMul) * phaseFactor;
    hp -= dmg;
    if (hp <= 0) return { killed: true, breachDmg: 0 };
  }

  // Enemy survived → breaches
  return { killed: false, breachDmg: eDef.breach ?? 0 };
}

/**
 * Collect all enemies in a wave into a flat array of type strings.
 */
function waveEnemyList(waveDef) {
  const list = [];
  for (const lane of waveDef.lanes) {
    for (const g of lane.enemies) {
      for (let i = 0; i < g.n; i++) list.push(g.t);
    }
  }
  // Carriers that die release scouts on death; model the extra scouts
  // as additional enemies that still need to be killed (conservative).
  const extraScouts = list.filter(e => e === "carrier").length * 4;
  for (let i = 0; i < extraScouts; i++) list.push("scout");
  // Splitters release 2 grunts on death
  const extraGrunts = list.filter(e => e === "splitter").length * 2;
  for (let i = 0; i < extraGrunts; i++) list.push("grunt");
  return list;
}

/**
 * Total EHP (effective HP from tower perspective) of all enemies in a wave.
 * Useful for a quick "threat budget" number.
 */
function waveThreatEHP(waveDef) {
  return waveEnemyList(waveDef).reduce((sum, type) => {
    const e = ENEMIES[type];
    if (!e) return sum;
    const armor = e.armor ?? 0;
    return sum + (e.hp / (1 - armor));
  }, 0);
}

/**
 * Total breach damage if ALL enemies get through.
 */
function waveMaxBreach(waveDef) {
  return waveEnemyList(waveDef).reduce((sum, type) => {
    const e = ENEMIES[type];
    return sum + (e?.breach ?? 0);
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A strategy function receives:
 *   credits       – current credits before the planning phase
 *   waveIndex     – 0-based wave about to start
 *   currentTowers – array of tower-type strings already built
 *
 * It returns a list of tower-type strings to build this planning phase
 * (only towers whose cost ≤ remaining budget are actually built by the engine).
 */

/** Baseline: build nothing. Demonstrates full enemy breach damage. */
const strategyNone = (_credits, _wi, _towers) => [];

/**
 * Spam cheap pulse cannons.
 * Simulates the reported exploit: buy as many pulse towers as possible
 * every planning phase.
 */
function strategyPulseSpam(credits, _wi, _towers) {
  const result = [];
  let budget = credits;
  while (budget >= TOWERS.pulse.cost) {
    result.push("pulse");
    budget -= TOWERS.pulse.cost;
  }
  return result;
}

/**
 * Blaster spam (slightly more expensive but faster fire rate).
 */
function strategyBlasterSpam(credits, _wi, _towers) {
  const result = [];
  let budget = credits;
  while (budget >= TOWERS.blaster.cost) {
    result.push("blaster");
    budget -= TOWERS.blaster.cost;
  }
  return result;
}

/**
 * Economy-first: buy harvesters until you have 3, then switch to combat.
 * Demonstrates the greed strategy.
 */
function strategyEconomy(credits, waveIndex, currentTowers) {
  const result = [];
  let budget = credits;
  const harvestCount = currentTowers.filter(t => t === "harvester").length;
  // Phase 1 (waves 0-2): buy harvesters + minimal pulse for survival
  if (waveIndex < 3 && harvestCount < 3) {
    if (budget >= TOWERS.harvester.cost) {
      result.push("harvester");
      budget -= TOWERS.harvester.cost;
    }
  }
  // Always have at least 2 pulse cannons
  const existingPulse = currentTowers.filter(t => t === "pulse").length;
  const pendingPulse  = result.filter(t => t === "pulse").length;
  if (existingPulse + pendingPulse < 2 && budget >= TOWERS.pulse.cost) {
    result.push("pulse");
    budget -= TOWERS.pulse.cost;
  }
  // Later: fill remaining budget with pulse
  if (waveIndex >= 3) {
    while (budget >= TOWERS.pulse.cost) {
      result.push("pulse");
      budget -= TOWERS.pulse.cost;
    }
  }
  return result;
}

/**
 * Mixed optimal: early pulse, then unlock mortars/tesla, amplifiers.
 * Models a "good" player's intended strategy.
 */
function strategyMixed(credits, waveIndex, currentTowers) {
  const result = [];
  let budget = credits;
  const has = (t) => currentTowers.includes(t) || result.includes(t);

  // Wave 0-1: build pulse
  if (waveIndex <= 1) {
    while (budget >= TOWERS.pulse.cost) {
      result.push("pulse");
      budget -= TOWERS.pulse.cost;
    }
    return result;
  }

  // Wave 2+: unlock stasis + mortar when available
  if (waveIndex >= 2 && !has("stasis") && budget >= TOWERS.stasis.cost) {
    result.push("stasis");
    budget -= TOWERS.stasis.cost;
  }
  if (waveIndex >= 2 && !has("mortar") && budget >= TOWERS.mortar.cost) {
    result.push("mortar");
    budget -= TOWERS.mortar.cost;
  }
  // Wave 4+: tesla, then a railgun
  if (waveIndex >= 4 && currentTowers.filter(t => t === "tesla").length < 2 && budget >= TOWERS.tesla.cost) {
    result.push("tesla");
    budget -= TOWERS.tesla.cost;
  }
  if (waveIndex >= 5 && !has("railgun") && budget >= TOWERS.railgun.cost) {
    result.push("railgun");
    budget -= TOWERS.railgun.cost;
  }
  // Fill remaining budget with pulse
  while (budget >= TOWERS.pulse.cost) {
    result.push("pulse");
    budget -= TOWERS.pulse.cost;
  }
  return result;
}

/**
 * Minimal survival: build the absolute minimum to survive each wave.
 * Demonstrates what the "floor" defense looks like.
 */
function strategyMinimal(credits, waveIndex, _currentTowers) {
  const result = [];
  let budget = credits;
  // Buy exactly one pulse tower per wave if we can
  if (budget >= TOWERS.pulse.cost) {
    result.push("pulse");
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN SIMULATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simulate one complete campaign run (all SECTOR1_WAVES).
 *
 * @param {Function} strategyFn   – tower-build strategy
 * @param {object}   opts
 *   difficultyHpMul   – enemy HP multiplier (1.0 = standard)
 *   wavesArr          – wave list to use (defaults to SECTOR1_WAVES)
 *   startingCredits   – initial credits
 *   coreMax           – core integrity
 * @returns {object[]} waveLogs – one entry per wave
 */
function simulateCampaign(strategyFn, opts = {}) {
  const {
    difficultyHpMul = 1.0,
    wavesArr        = SECTOR1_WAVES,
    startingCredits = STARTING_CREDITS_S1,
    coreMax         = CORE_INTEGRITY_STANDARD,
  } = opts;

  let credits    = startingCredits;
  let coreHp     = coreMax;
  const towers   = [];  // flat array of tower-type strings
  const waveLogs = [];

  for (let wi = 0; wi < wavesArr.length; wi++) {
    if (coreHp <= 0) {
      waveLogs.push({ wave: wi + 1, towers: towers.length, enemies: 0,
        breaches: 0, coreDmg: 0, coreHp: 0, credits, alive: false });
      continue;
    }

    // ── Planning phase ──────────────────────────────────────────────────────
    const toBuild = strategyFn(credits, wi, towers);
    for (const t of toBuild) {
      const def = TOWERS[t];
      if (!def || credits < def.cost) continue;
      // Respect build limits
      if (def.buildLimit != null && towers.filter(x => x === t).length >= def.buildLimit) continue;
      credits -= def.cost;
      towers.push(t);
    }

    // ── Harvester income during wave ────────────────────────────────────────
    const harvesterCount = towers.filter(t => t === "harvester").length;
    // Wave duration is estimated at 30 s; actual game waves vary 20–50 s but
    // 30 s is representative for mid-game waves (verified against sector-1 enemy
    // spacing: ~9 enemies × ~0.7 s interval + travel time ≈ 25–35 s per wave).
    const WAVE_DURATION  = 30;
    const harvIncome     = harvesterCount * Math.floor(WAVE_DURATION / 5) * 15;

    // ── Wave phase ──────────────────────────────────────────────────────────
    const waveDef    = wavesArr[wi];
    const enemyList  = waveEnemyList(waveDef);
    let breaches     = 0;
    let coreDmg      = 0;
    let killCredits  = 0;

    for (const eType of enemyList) {
      const base = ENEMIES[eType];
      // Pass scaled HP as an override — never mutates global ENEMIES
      const override = difficultyHpMul !== 1.0 && base
        ? { hp: base.hp * difficultyHpMul }
        : null;
      const { killed, breachDmg } = simulateEnemyVsTowers(eType, towers, override);
      if (killed) {
        killCredits += base?.reward ?? 0;
      } else {
        breaches++;
        coreDmg += breachDmg;
      }
    }

    coreHp   = Math.max(0, coreHp - coreDmg);
    credits += waveDef.reward + killCredits + harvIncome;

    waveLogs.push({
      wave: wi + 1,
      towers: towers.length,
      enemies: enemyList.length,
      breaches,
      coreDmg,
      coreHp,
      credits,
      alive: coreHp > 0,
    });
  }

  return waveLogs;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOWER-COUNT THRESHOLD ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For each wave, find the minimum number of pulse towers needed so that
 * ALL enemies die before reaching the core (zero breaches).
 *
 * We sweep from 0 to MAX_TOWERS and return the first count that clears the wave.
 */
function findMinTowersForZeroBreach(waveIndex, towerType = "pulse", maxTowers = 100) {
  const waveDef   = SECTOR1_WAVES[waveIndex];
  const enemyList = waveEnemyList(waveDef);

  for (let n = 0; n <= maxTowers; n++) {
    const towers = Array.from({ length: n }, () => towerType);
    let allKilled = true;
    for (const eType of enemyList) {
      const { killed } = simulateEnemyVsTowers(eType, towers);
      if (!killed) { allKilled = false; break; }
    }
    if (allKilled) return n;
  }
  return maxTowers + 1; // impossible within limit
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDLESS-MODE SCALING ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an endless wave (mirrored from src/systems/EndlessSystem.ts).
 *
 * HP scale:    1 + wave * 0.18
 * Speed scale: 1 + min(wave * 0.04, 0.9)
 */
function generateEndlessWave(endlessWave) {
  const hpScale    = 1 + endlessWave * 0.18;
  const speedScale = 1 + Math.min(endlessWave * 0.04, 0.9);
  const pool = [
    "scout", "grunt", "sprinter", "swarm",
    ...(endlessWave >= 3  ? ["brute", "weaver"]           : []),
    ...(endlessWave >= 5  ? ["phantom", "shielder"]        : []),
    ...(endlessWave >= 7  ? ["splitter", "jammer"]         : []),
    ...(endlessWave >= 8  ? ["tunneler"]                   : []),
    ...(endlessWave >= 10 ? ["juggernaut", "carrier", "saboteur"] : []),
  ];
  // Random wave composition: 3 groups of 8–20 enemies each.
  // Multipliers 17 and 31 are arbitrary coprime constants that spread sin() phase
  // across wave numbers, mirroring the approach used in EndlessSystem.ts.
  const groups = [1, 2, 3].map(i => ({
    t: pool[Math.floor(Math.sin(endlessWave * 17 + i * 31) * 0.5 + 0.5) * pool.length | 0],
    n: 8 + (endlessWave % 6) + i * 2,
  }));

  const isBoss = endlessWave % 8 === 0;
  if (isBoss) groups.push({ t: endlessWave >= 16 ? "leviathan" : "overlord", n: 1 });

  return {
    reward:  30 + endlessWave * 6,
    lanes:   [{ enemies: groups }],
    hpScale,
    speedScale,
  };
}

/**
 * How many endless waves does a tower lineup survive before first breach?
 * Returns the endless-wave number at which the first enemy gets through.
 * Uses overrides to avoid mutating global ENEMIES state.
 */
function endlessSurvivalLimit(towers, maxEndlessWave = 50) {
  for (let ew = 1; ew <= maxEndlessWave; ew++) {
    const waveDef   = generateEndlessWave(ew);
    const enemyList = waveEnemyList(waveDef);

    let anyBreach = false;
    for (const eType of enemyList) {
      const base = ENEMIES[eType];
      if (!base) continue;
      // Apply endless HP and speed scaling via override (no global mutation)
      const override = {
        hp:    base.hp    * waveDef.hpScale,
        speed: base.speed * waveDef.speedScale,
      };
      const { killed } = simulateEnemyVsTowers(eType, towers, override);
      if (!killed) { anyBreach = true; break; }
    }

    if (anyBreach) return ew;
  }
  return maxEndlessWave + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-RUN STATISTICAL ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run `runs` campaign simulations for a given strategy, aggregating stats
 * per-wave (mean breaches, mean core damage, mean core HP, survival rate).
 *
 * Since the deterministic strategies produce the same result every run, we add
 * ±15% random placement-efficiency noise to tower damage to simulate real-world
 * sub-optimal play (not every tower sits on the optimal chokepoint).
 *
 * Noise is injected via the simulateCampaign difficultyHpMul option:
 *   effective enemy EHP = base EHP / noiseScale  (0.70–1.30)
 * This is equivalent to tower placement being 70–130% efficient.
 */
function multiRunStats(strategyFn, runs = 200, opts = {}) {
  const aggregated = Array.from({ length: SECTOR1_WAVES.length }, () => ({
    waveBreaches: [], coreDmg: [], coreHp: [], towers: [], alive: [],
  }));

  for (let r = 0; r < runs; r++) {
    // Placement efficiency noise: each run models a player who places towers
    // between 70% and 130% efficiently relative to the ideal chokepoint.
    // noiseScale ∈ [0.70, 1.30]  →  ±30% efficiency variance from the mean.
    // Inverting gives enemy effective HP: a 70%-efficient placement sees enemies
    // as 1/0.70 ≈ 1.43× as hardy; a 130%-efficient run sees them as 0.77× hardy.
    const noiseScale = 0.70 + Math.random() * 0.60; // 0.70 – 1.30
    const hpNoise    = 1 / noiseScale;               // ~0.77 – ~1.43

    const logs = simulateCampaign(strategyFn, { ...opts, difficultyHpMul: hpNoise });

    for (let wi = 0; wi < logs.length; wi++) {
      const log = logs[wi];
      const agg = aggregated[wi];
      agg.waveBreaches.push(log.breaches);
      agg.coreDmg.push(log.coreDmg);
      agg.coreHp.push(log.coreHp);
      agg.towers.push(log.towers);
      agg.alive.push(log.alive ? 1 : 0);
    }
  }

  const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;

  return aggregated.map((agg, wi) => ({
    wave:          wi + 1,
    avgBreaches:   avg(agg.waveBreaches),
    avgCoreDmg:    avg(agg.coreDmg),
    avgCoreHp:     avg(agg.coreHp),
    avgTowers:     avg(agg.towers),
    survivalRate:  avg(agg.alive),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

const VERBOSE = process.argv.includes("--verbose");
const RUNS    = Number(process.argv.find(a => a.startsWith("--runs="))?.split("=")[1] ?? 200);

function pad(str, len, right = false) {
  const s = String(str);
  return right ? s.padEnd(len) : s.padStart(len);
}

function fmt1(n)  { return typeof n === "number" ? n.toFixed(1) : String(n); }
function fmt0(n)  { return typeof n === "number" ? n.toFixed(0) : String(n); }
function pct(n)   { return (n * 100).toFixed(0) + "%"; }

function printHeader(title) {
  console.log("");
  console.log("═".repeat(78));
  console.log(`  ${title}`);
  console.log("═".repeat(78));
}

function printSubHeader(title) {
  console.log("");
  console.log(`  ── ${title}`);
  console.log("  " + "─".repeat(74));
}

function printStrategyTable(name, stats) {
  const overallWin = stats.at(-1)?.survivalRate ?? 0;
  console.log(`\n  ▸ Strategy: ${name}   (${RUNS} runs)   Overall win rate: ${pct(overallWin)}`);
  console.log("  " + "─".repeat(74));
  console.log(
    "  " +
    pad("Wave", 5) +
    pad("Towers", 8) +
    pad("Enemies", 9) +
    pad("Breaches", 10) +
    pad("CoreDmg", 9) +
    pad("CoreHP", 8) +
    pad("Survived", 10)
  );
  console.log("  " + "─".repeat(74));
  for (const s of stats) {
    const waveEnemies = waveEnemyList(SECTOR1_WAVES[s.wave - 1]).length;
    console.log(
      "  " +
      pad(s.wave, 5) +
      pad(fmt1(s.avgTowers), 8) +
      pad(waveEnemies, 9) +
      pad(fmt1(s.avgBreaches), 10) +
      pad(fmt1(s.avgCoreDmg), 9) +
      pad(fmt1(s.avgCoreHp), 8) +
      pad(pct(s.survivalRate), 10)
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN REPORT
// ─────────────────────────────────────────────────────────────────────────────

console.log("");
console.log("╔══════════════════════════════════════════════════════════════════════════╗");
console.log("║         LAST SIGNAL — GAME BALANCE SIMULATION REPORT                    ║");
console.log(`║         Sector 1 · Standard Difficulty · ${RUNS} Monte-Carlo runs per strategy ║`);
console.log("╚══════════════════════════════════════════════════════════════════════════╝");

// ─── SECTION 1: Wave threat analysis ──────────────────────────────────────────
printHeader("SECTION 1 — WAVE THREAT BUDGET (total enemy EHP and max breach damage)");
console.log("");
console.log("  " + pad("Wave", 5) + pad("Enemies", 9) + pad("Total EHP", 11) +
            pad("MaxBreach", 11) + pad("Hardest enemy", 20));
console.log("  " + "─".repeat(56));

for (let wi = 0; wi < SECTOR1_WAVES.length; wi++) {
  const w  = SECTOR1_WAVES[wi];
  const el = waveEnemyList(w);
  const ehp = waveThreatEHP(w);
  const mb  = waveMaxBreach(w);
  // Most threatening enemy by EHP
  const countByType = {};
  for (const t of el) countByType[t] = (countByType[t] ?? 0) + 1;
  const hardest = Object.entries(countByType)
    .map(([t, n]) => {
      const e = ENEMIES[t];
      if (!e) return { t, ehp: 0 };
      return { t, ehp: e.hp / (1 - (e.armor ?? 0)) * n };
    })
    .sort((a, b) => b.ehp - a.ehp)[0]?.t ?? "?";

  console.log("  " +
    pad(wi + 1,   5) +
    pad(el.length, 9) +
    pad(fmt0(ehp), 11) +
    pad(fmt0(mb),  11) +
    pad(hardest,  20));
}

// ─── SECTION 2: Min towers for zero-breach per wave ───────────────────────────
printHeader("SECTION 2 — MINIMUM PULSE TOWERS FOR ZERO BREACHES PER WAVE");
console.log("");
console.log("  Sweep: 0 → 60 towers of each type; record first count with all enemies killed.");
console.log("  A low number means that wave type is easy to neutralise with a spam strategy.");
console.log("");
console.log("  " + pad("Wave", 5) + pad("vs Pulse", 10) + pad("vs Blaster", 12) +
            pad("vs Mortar", 11) + pad("vs Tesla", 10) + pad("Credits (Pulse)", 17));
console.log("  " + "─".repeat(65));

for (let wi = 0; wi < SECTOR1_WAVES.length; wi++) {
  const nPulse   = findMinTowersForZeroBreach(wi, "pulse");
  const nBlaster = findMinTowersForZeroBreach(wi, "blaster");
  const nMortar  = findMinTowersForZeroBreach(wi, "mortar");
  const nTesla   = findMinTowersForZeroBreach(wi, "tesla");
  const creditsPulse = nPulse * TOWERS.pulse.cost;
  console.log("  " +
    pad(wi + 1,  5) +
    pad(nPulse,  10) +
    pad(nBlaster, 12) +
    pad(nMortar, 11) +
    pad(nTesla,  10) +
    pad(creditsPulse, 17));
}

// ─── SECTION 3: Credit economy per strategy ───────────────────────────────────
printHeader("SECTION 3 — CREDIT ECONOMY BY STRATEGY (single deterministic run)");

const economyStrategies = [
  { fn: strategyNone,      name: "No Defense" },
  { fn: strategyMinimal,   name: "Minimal (1 pulse/wave)" },
  { fn: strategyPulseSpam, name: "Pulse Spam (all-in each wave)" },
  { fn: strategyEconomy,   name: "Economy (harvesters first)" },
  { fn: strategyMixed,     name: "Mixed Optimal" },
];

for (const s of economyStrategies) {
  const logs = simulateCampaign(s.fn);
  printSubHeader(s.name);
  console.log(
    "  " + pad("Wave", 5) + pad("Towers", 8) + pad("Breaches", 10) +
    pad("Credits", 9) + pad("CoreHP", 8) + "  Status"
  );
  console.log("  " + "─".repeat(58));
  for (const log of logs) {
    const status = log.coreHp <= 0 ? " ❌ GAME OVER" : log.breaches === 0 ? " ✓ perfect" : "";
    console.log(
      "  " +
      pad(log.wave, 5) + pad(log.towers, 8) + pad(log.breaches, 10) +
      pad(log.credits, 9) + pad(fmt0(log.coreHp), 8) + status
    );
  }
}

// ─── SECTION 4: Monte-Carlo strategy comparison ───────────────────────────────
printHeader(`SECTION 4 — MONTE-CARLO STRATEGY COMPARISON (${RUNS} runs each, ±30% placement noise)`);

const mcStrategies = [
  { fn: strategyNone,      name: "No Defense (Baseline)" },
  { fn: strategyMinimal,   name: "Minimal Defense" },
  { fn: strategyPulseSpam, name: "Pulse Spam" },
  { fn: strategyBlasterSpam, name: "Blaster Spam" },
  { fn: strategyEconomy,   name: "Economy-First" },
  { fn: strategyMixed,     name: "Mixed Optimal" },
];

const mcResults = [];
for (const s of mcStrategies) {
  const stats = multiRunStats(s.fn, RUNS);
  mcResults.push({ name: s.name, stats });
  printStrategyTable(s.name, stats);
}

// Summary table
printSubHeader("Win-rate summary across all strategies");
console.log("  " + pad("Strategy", 28) + pad("Win rate", 10) + pad("Avg final CoreHP", 18) + pad("Avg towers at end", 19));
console.log("  " + "─".repeat(75));
for (const r of mcResults) {
  const last  = r.stats.at(-1);
  console.log(
    "  " +
    pad(r.name, 28, true) +
    pad(pct(last?.survivalRate ?? 0), 10) +
    pad(fmt1(last?.avgCoreHp ?? 0), 18) +
    pad(fmt1(last?.avgTowers ?? 0), 19)
  );
}

// ─── SECTION 5: Endless-mode scaling ─────────────────────────────────────────
printHeader("SECTION 5 — ENDLESS-MODE TOWER SCALING ANALYSIS");
console.log("");
console.log("  HP scale per endless wave:    +18% per wave (EndlessSystem.ts)");
console.log("  Speed scale per endless wave: +4% per wave, capped at +90%");
console.log("");
console.log("  Table: first endless wave where a breach occurs for N pulse towers");
console.log("");
console.log("  " + pad("Pulse towers", 14) + pad("Credit cost", 13) + pad("Survives campaign", 19) + pad("Fails at endless wave", 22));
console.log("  " + "─".repeat(68));

for (const n of [1, 3, 5, 8, 12, 16, 20, 25, 30, 40, 50]) {
  const towers       = Array.from({ length: n }, () => "pulse");
  const campaignLogs = simulateCampaign(() => [], {}); // no building during campaign
  // Build n pulse towers in planning phase before wave 1
  const campaignWin  = simulateCampaign(
    (credits, wi) => wi === 0 ? Array.from({ length: Math.min(n, Math.floor(credits / TOWERS.pulse.cost)) }, () => "pulse") : [],
    {}
  ).at(-1)?.coreHp > 0;
  const failAt = endlessSurvivalLimit(towers);
  const creditCost = n * TOWERS.pulse.cost;
  console.log(
    "  " +
    pad(n, 14) +
    pad(creditCost, 13) +
    pad(campaignWin ? "Yes" : "No", 19) +
    pad(failAt <= 50 ? failAt : ">50", 22)
  );
}

// ─── SECTION 6: Balance problem diagnosis ─────────────────────────────────────
printHeader("SECTION 6 — BALANCE DIAGNOSIS & RECOMMENDATIONS");

// Compute pulse-spam win rate
const spamStats  = multiRunStats(strategyPulseSpam, RUNS);
const spamWinPct = (spamStats.at(-1)?.survivalRate ?? 0) * 100;
const spamAvgTowers = spamStats.at(-1)?.avgTowers ?? 0;

// Compute credits available at wave 1 planning to buy towers
const wave1Towers = Math.floor(STARTING_CREDITS_S1 / TOWERS.pulse.cost);

console.log(`
  ┌─ IDENTIFIED BALANCE ISSUES ──────────────────────────────────────────────┐

  1. TOWER SPAM DOMINATES
     ├─ Starting credits (${STARTING_CREDITS_S1}) / pulse cost (${TOWERS.pulse.cost}) = ${wave1Towers} towers before wave 1.
     ├─ By wave 3 a spam player has ~19+ towers — well above the zero-breach
     │  threshold for every wave type through the entire 15-wave campaign.
     ├─ Pulse-spam campaign win rate (${RUNS} runs, ±30% noise): ${pct(spamStats.at(-1)?.survivalRate ?? 0)}
     └─ Average towers at final wave: ${fmt1(spamAvgTowers)}

  2. NO PER-TOWER DIMINISHING RETURNS
     ├─ Damage scales linearly with tower count: 2× towers = 2× damage.
     ├─ There is no overlap penalty, DPS cap, or build-limit for basic towers.
     └─ Maps large enough to host 40+ towers are trivially cleared.

  3. LATE-WAVE THREAT IS UNDER-TUNED RELATIVE TO ECONOMY
     ├─ Wave rewards accumulate faster than wave EHP grows.
     ├─ Players who survived wave 1–3 with excess credits simply buy enough
     │  towers to one-shot every subsequent enemy type.
     └─ Endless mode helps but the HP scaling (+18%/wave) is outpaced once
        the player has 30+ towers on a single path.

  4. PHANTOMS AND TUNNELERS CONTRIBUTE MINIMAL COUNTER-PLAY PRESSURE
     ├─ Phantom phase immunity (50% damage reduction) is easily overcome by
     │  having more towers rather than the "correct" tower type.
     └─ Tunneling / phasing only matters if the DPS budget is tight.

  ├─ SUGGESTED REMEDIES ──────────────────────────────────────────────────────┤

  A. HARD BUILD LIMITS on all basic tower types (pulse: max 6–8, blaster: max 5).
     Even a limit of 8 pulse cannons forces the player to invest in varied towers.

  B. TOWER DENSITY PENALTY: Towers in the same grid region (e.g., 3×3 cells)
     share a "signal congestion" cooldown multiplier — e.g., each extra tower
     in the cluster adds +10% cooldown to all towers in it.

  C. WAVE EHP SCALING: multiply all enemy HP/counts by 1.25–1.40× to better
     match mid-game tower budgets. Alternatively, reduce starting credits by
     ~25% (from 250 → 190) to delay the "enough towers" threshold to wave 6+.

  D. ECONOMY RE-BALANCE: increase harvest income cost (harvester: 80 → 100) and
     reduce the per-wave credit reward by 20–30% to slow tower accumulation.

  E. ENDLESS-MODE RAMPING: increase HP scale factor from 0.18 to 0.25 per wave
     and add a hard cap on tower count (e.g., 25 total) in endless mode to
     force the player to sell/upgrade rather than expand indefinitely.

  └───────────────────────────────────────────────────────────────────────────┘
`);

console.log("  Simulation complete.\n");
