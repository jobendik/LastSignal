#!/usr/bin/env node
/**
 * 06-endless-ceiling.mjs
 *
 * Finds the wave at which different tower compositions first breach in
 * Endless mode. Answers:
 *
 *  - What is the practical "ceiling" for each tower build?
 *  - Does Endless scale faster or slower than tower investment allows?
 *  - Which enemy type typically causes the first breach?
 *  - At what wave does Endless enemy HP become theoretically unkillable?
 *
 * Run: node sim/06-endless-ceiling.mjs
 */

import { fileURLToPath } from "node:url";
import {
  TOWERS, ENEMIES, DIFFICULTIES,
  generateEndlessWave, endlessSurvivalLimit, waveEnemyList,
  simulateEnemyVsTowers, towerDamageVsEnemy,
  printHeader, printSubHeader, printFlag, pad, fmt1, fmt0,
} from "./shared.mjs";

/** Build a tower list from a spec: [{type, count}, ...] */
function buildTowers(spec) {
  const list = [];
  for (const { type, count } of spec) {
    for (let i = 0; i < count; i++) list.push(type);
  }
  return list;
}

/** Total credit cost of a tower list. */
function totalCost(towers) {
  return towers.reduce((s, t) => s + (TOWERS[t]?.cost ?? 0), 0);
}

/** Find the first enemy type that causes a breach on a given endless wave. */
function findBreachingEnemy(towers, endlessWaveNum) {
  const waveDef   = generateEndlessWave(endlessWaveNum);
  const enemyList = waveEnemyList(waveDef);
  for (const eType of enemyList) {
    const base = ENEMIES[eType];
    if (!base) continue;
    const override = { hp: base.hp * waveDef.hpScale, speed: base.speed * waveDef.speedScale };
    const { killed } = simulateEnemyVsTowers(eType, towers, override);
    if (!killed) return { eType, hpScale: waveDef.hpScale };
  }
  return null;
}

// Tower compositions to test
const COMPOSITIONS = [
  {
    label: "Pulse ×20 (cheap baseline)",
    spec: [{ type: "pulse", count: 20 }],
  },
  {
    label: "Pulse ×40 (full spam)",
    spec: [{ type: "pulse", count: 40 }],
  },
  {
    label: "Pulse ×60 (extreme spam)",
    spec: [{ type: "pulse", count: 60 }],
  },
  {
    label: "Blaster ×30",
    spec: [{ type: "blaster", count: 30 }],
  },
  {
    label: "Mixed ×30 (stasis+mortar+tesla+pulse)",
    spec: [
      { type: "stasis",  count: 4 },
      { type: "mortar",  count: 4 },
      { type: "tesla",   count: 4 },
      { type: "railgun", count: 3 },
      { type: "pulse",   count: 15 },
    ],
  },
  {
    label: "Mixed ×50 (optimized endgame)",
    spec: [
      { type: "stasis",  count: 6 },
      { type: "mortar",  count: 8 },
      { type: "tesla",   count: 6 },
      { type: "railgun", count: 3 },
      { type: "snare",   count: 4 },
      { type: "pulse",   count: 23 },
    ],
  },
  {
    label: "Railgun ×3 + Pulse ×30 (railgun-anchored)",
    spec: [
      { type: "railgun", count: 3 },
      { type: "pulse",   count: 30 },
    ],
  },
  {
    label: "Flamer ×40 (fire DPS focus)",
    spec: [{ type: "flamer", count: 40 }],
  },
  {
    label: "Mortar ×20 (AoE ceiling)",
    spec: [
      { type: "stasis", count: 4 },
      { type: "mortar", count: 20 },
    ],
  },
  {
    label: "Max Economy (16 harvesters + combat)",
    spec: [
      { type: "harvester", count: 16 },
      { type: "stasis",    count: 3 },
      { type: "mortar",    count: 3 },
      { type: "pulse",     count: 10 },
    ],
  },
];

export function main() {
  printHeader("TEST 06 — ENDLESS MODE CEILING");

  // ── Section A: Survival limit per composition ─────────────────────────────
  printSubHeader("First-breach wave per composition (Endless mode)");

  console.log("\n  " + pad("Composition", 40, true) + pad("Cost", 8) + pad("Breach@W", 10)
    + pad("HP×scale", 10) + pad("Culprit", 14) + "  Verdict");
  console.log("  " + "─".repeat(90));

  const MAX_WAVE = 60;
  const results  = [];

  for (const comp of COMPOSITIONS) {
    const towers = buildTowers(comp.spec);
    const cost   = totalCost(towers);
    const limit  = endlessSurvivalLimit(towers, MAX_WAVE);
    let verdict, culprit = "—", hpScaleAtBreak = "—";

    if (limit > MAX_WAVE) {
      verdict = "survives all";
    } else {
      const info = findBreachingEnemy(towers, limit);
      if (info) {
        culprit      = info.eType;
        hpScaleAtBreak = fmt1(info.hpScale) + "×";
      }
      verdict = limit <= 10 ? "early collapse" : limit <= 20 ? "mid-game ceiling" : "strong build";
    }

    results.push({ comp, cost, limit, culprit, hpScaleAtBreak });

    console.log("  " + pad(comp.label, 40, true) + pad(cost, 8)
      + pad(limit > MAX_WAVE ? ">" + MAX_WAVE : String(limit), 10)
      + pad(hpScaleAtBreak, 10) + pad(culprit, 14) + "  " + verdict);
  }

  // ── Section B: Theoretical DPS cap vs endless HP scaling ─────────────────
  printSubHeader("Theoretical DPS cap vs endless enemy HP scaling (juggernaut as benchmark)");

  const baseJugg = ENEMIES.juggernaut;
  const pulseT   = TOWERS.pulse;
  const mortarT  = TOWERS.mortar;
  const railgunT = TOWERS.railgun;

  console.log("\n  Wave  HP×   Jugg EHP    Pulse×40 dmg  Mortar×20 dmg  Railgun×3 dmg");
  console.log("  " + "─".repeat(70));

  for (const ew of [1, 5, 10, 15, 20, 25, 30, 40, 50]) {
    const wave     = generateEndlessWave(ew);
    const effHp    = baseJugg.hp * wave.hpScale / (1 - baseJugg.armor);
    const pulseD   = towerDamageVsEnemy(pulseT, { ...baseJugg, hp: baseJugg.hp * wave.hpScale, speed: baseJugg.speed * wave.speedScale }) * 40;
    const mortarD  = towerDamageVsEnemy(mortarT, { ...baseJugg, hp: baseJugg.hp * wave.hpScale, speed: baseJugg.speed * wave.speedScale }) * 20;
    const railD    = towerDamageVsEnemy(railgunT, { ...baseJugg, hp: baseJugg.hp * wave.hpScale, speed: baseJugg.speed * wave.speedScale }) * 3;

    const pKill  = pulseD  >= effHp ? "✓" : "✗";
    const mKill  = mortarD >= effHp ? "✓" : "✗";
    const rKill  = railD   >= effHp ? "✓" : "✗";

    console.log("  " + pad(ew, 5) + pad(fmt1(wave.hpScale) + "×", 7)
      + pad(fmt0(effHp), 13) + pad(fmt0(pulseD)  + pKill, 14)
      + pad(fmt0(mortarD) + mKill, 15) + pad(fmt0(railD) + rKill, 0));
  }

  // ── Section C: Sprinter / scout wall-clock test ──────────────────────────
  printSubHeader("Speed-class threat analysis (sprinter, scout — endless wave 20)");

  const EW = 20;
  const speedWave = generateEndlessWave(EW);
  const SPEED_ENEMIES = ["scout", "sprinter", "phantom"];

  console.log("\n  These enemies outrun coverage even with many towers.");
  console.log("\n  " + pad("Enemy", 12, true) + pad("Base spd", 10) + pad("EW20 spd", 10)
    + pad("P×40 kill?", 12) + pad("B×30 kill?", 12) + pad("F×40 kill?", 12));
  console.log("  " + "─".repeat(68));

  for (const eKey of SPEED_ENEMIES) {
    const base = ENEMIES[eKey];
    const ov   = { hp: base.hp * speedWave.hpScale, speed: base.speed * speedWave.speedScale };
    const pKill = simulateEnemyVsTowers(eKey, buildTowers([{ type: "pulse",   count: 40 }]), ov).killed;
    const bKill = simulateEnemyVsTowers(eKey, buildTowers([{ type: "blaster", count: 30 }]), ov).killed;
    const fKill = simulateEnemyVsTowers(eKey, buildTowers([{ type: "flamer",  count: 40 }]), ov).killed;

    console.log("  " + pad(eKey, 12, true) + pad(base.speed, 10)
      + pad(fmt0(base.speed * speedWave.speedScale), 10)
      + pad(pKill ? "✓" : "✗", 12) + pad(bKill ? "✓" : "✗", 12) + pad(fKill ? "✓" : "✗", 12));
  }

  // ── Section D: Flags ─────────────────────────────────────────────────────
  printSubHeader("Flags");

  let flagged = false;
  for (const { comp, limit } of results) {
    if (limit <= 10) {
      printFlag(`"${comp.label}" collapses by wave ${limit} — may need at least a baseline of combat towers`);
      flagged = true;
    }
  }

  const bestResult  = results.reduce((a, b) => (b.limit > a.limit ? b : a));
  const worstResult = results.reduce((a, b) => (b.limit < a.limit ? b : a));
  console.log(`\n  Best build:  "${bestResult.comp.label}" → survives to wave ${bestResult.limit > MAX_WAVE ? ">"+MAX_WAVE : bestResult.limit}`);
  console.log(`  Worst build: "${worstResult.comp.label}" → breaches at wave ${worstResult.limit > MAX_WAVE ? ">"+MAX_WAVE : worstResult.limit}`);

  if (!flagged) console.log("  No critical ceiling issues found.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
