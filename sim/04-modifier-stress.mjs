#!/usr/bin/env node
/**
 * 04-modifier-stress.mjs
 *
 * Tests every debuff (and notable buff-with-downside) under each difficulty
 * to find mathematically unwinnable or trivially-bypassed combinations.
 *
 * Answers:
 *  - Which modifier × difficulty combos guarantee a loss?
 *  - Which buffs have downsides too severe to overcome?
 *  - Is any single debuff alone sufficient to make Standard unwinnable?
 *  - Combined "double debuff" worst-case analysis.
 *
 * Run: node sim/04-modifier-stress.mjs [--runs=N]
 */

import { fileURLToPath } from "node:url";
import {
  DEBUFFS, BUFFS_MIXED, DIFFICULTIES, strategies, multiRunStats,
  SECTOR1_WAVES, mergeModifiers,
  printHeader, printSubHeader, printFlag, pad, pct, fmt1, RUNS,
} from "./shared.mjs";

export function main() {
  printHeader("TEST 04 — MODIFIER STRESS TEST");

  const TARGET_STRAT  = strategies.mixed;
  const DIFF_LIST     = Object.values(DIFFICULTIES);

  // ── Helper: run a strat + diff + modifier combo ──────────────────────────
  function runCombo(stratFn, diff, mod) {
    return multiRunStats(stratFn, RUNS, {
      wavesArr:          SECTOR1_WAVES,
      enemyHpMul:        (diff.enemyHpMul ?? 1)  * (mod.enemyHpMul    ?? 1),
      enemySpeedMul:     (diff.enemySpeedMul ?? 1) * (mod.enemySpeedMul ?? 1),
      coreIntegrityMul:  (diff.coreIntegrityMul ?? 1) * (mod.coreMul   ?? 1),
      rewardMul:         diff.rewardMul ?? 1,
      towerCostMul:      mod.towerCostMul    ?? 1,
      harvesterIncomeMul: mod.harvesterIncomeMul ?? 1,
      enemyRewardMul:    mod.enemyRewardMul  ?? 1,
      towerCooldownMul:  mod.towerCooldownMul ?? 1,
      towerDamageMul:    mod.towerDamageMul  ?? 1,
      enemyArmorAdd:     mod.enemyArmorAdd   ?? 0,
      enemyHealPerSec:   mod.enemyHealPerSec ?? 0,
    });
  }

  // ── Section A: Debuff × Difficulty matrix (Mixed Optimal) ────────────────
  printSubHeader("Debuff × Difficulty win-rate matrix (Mixed Optimal, " + RUNS + " runs)");

  const COL = 12;
  let header = pad("Debuff", 26, true);
  for (const d of DIFF_LIST) header += pad(d.label, COL);
  console.log("\n  " + header);
  console.log("  " + "─".repeat(26 + COL * DIFF_LIST.length));

  const debuffMatrix = {};
  for (const debuff of DEBUFFS) {
    debuffMatrix[debuff.id] = {};
    let row = pad(debuff.name.slice(0, 24), 26, true);
    for (const diff of DIFF_LIST) {
      const stats = runCombo(TARGET_STRAT.fn, diff, debuff);
      const win   = stats.at(-1)?.survivalRate ?? 0;
      debuffMatrix[debuff.id][diff.id] = win;
      const tag   = win >= 0.9 ? "✓" : win >= 0.5 ? "~" : win >= 0.1 ? "✗" : "☠";
      row += pad(`${pct(win)}${tag}`, COL);
    }
    console.log("  " + row);
  }

  // ── Section B: Buff-with-downside × Difficulty ───────────────────────────
  printSubHeader("Buff-with-downside × Difficulty win-rate matrix (Mixed Optimal)");

  header = pad("Modifier", 26, true);
  for (const d of DIFF_LIST) header += pad(d.label, COL);
  console.log("\n  " + header);
  console.log("  " + "─".repeat(26 + COL * DIFF_LIST.length));

  const buffMatrix = {};
  for (const buff of BUFFS_MIXED) {
    buffMatrix[buff.id] = {};
    let row = pad(buff.name.slice(0, 24), 26, true);
    for (const diff of DIFF_LIST) {
      const stats = runCombo(TARGET_STRAT.fn, diff, buff);
      const win   = stats.at(-1)?.survivalRate ?? 0;
      buffMatrix[buff.id][diff.id] = win;
      const tag   = win >= 0.9 ? "✓" : win >= 0.5 ? "~" : win >= 0.1 ? "✗" : "☠";
      row += pad(`${pct(win)}${tag}`, COL);
    }
    console.log("  " + row);
  }

  // ── Section C: Flags ─────────────────────────────────────────────────────
  printSubHeader("Flags");

  let flagged = false;
  for (const debuff of DEBUFFS) {
    const stdRate = debuffMatrix[debuff.id]?.standard ?? 1;
    const nmRate  = debuffMatrix[debuff.id]?.nightmare ?? 1;
    if (stdRate < 0.10) {
      printFlag(`[DEBUFF] "${debuff.name}" makes Standard unwinnable (${pct(stdRate)}) with Mixed Optimal`);
      flagged = true;
    }
    if (nmRate < 0.01) {
      printFlag(`[DEBUFF] "${debuff.name}" on Nightmare is completely unwinnable — extreme difficulty spike`);
      flagged = true;
    }
  }
  for (const buff of BUFFS_MIXED) {
    const stdRate = buffMatrix[buff.id]?.standard ?? 1;
    if (stdRate < 0.30) {
      printFlag(`[BUFF-MIXED] "${buff.name}" drops Standard win rate to ${pct(stdRate)} — downside may outweigh benefit`);
      flagged = true;
    }
    if (stdRate > 0.97) {
      // Check whether it still has a meaningful tradeoff
      printFlag(`[BUFF-MIXED] "${buff.name}" keeps >97% win rate on Standard — tradeoff may be too safe`);
      flagged = true;
    }
  }
  if (!flagged) console.log("  No extreme outliers found.");

  // ── Section D: Double-debuff worst case ──────────────────────────────────
  printSubHeader("Worst double-debuff combos on Veteran difficulty");

  const HEAVY_DEBUFFS = DEBUFFS.filter(d => {
    const rate = debuffMatrix[d.id]?.standard ?? 1;
    return rate < 0.80;
  });

  if (HEAVY_DEBUFFS.length < 2) {
    console.log("  No debuffs are severe enough on Standard to test double combos.");
  } else {
    const pairs = [];
    for (let i = 0; i < HEAVY_DEBUFFS.length; i++) {
      for (let j = i + 1; j < HEAVY_DEBUFFS.length; j++) {
        const merged = mergeModifiers(HEAVY_DEBUFFS[i], HEAVY_DEBUFFS[j]);
        const stats  = runCombo(TARGET_STRAT.fn, DIFFICULTIES.veteran, merged);
        const win    = stats.at(-1)?.survivalRate ?? 0;
        pairs.push({ a: HEAVY_DEBUFFS[i].name, b: HEAVY_DEBUFFS[j].name, win });
      }
    }
    pairs.sort((a, b) => a.win - b.win);

    console.log("\n  " + pad("Debuff A", 22, true) + pad("Debuff B", 22, true) + pad("Win Rate", 10));
    console.log("  " + "─".repeat(56));
    for (const { a, b, win } of pairs.slice(0, 8)) {
      const tag = win < 0.10 ? " ← UNWINNABLE" : win < 0.30 ? " ← very hard" : "";
      console.log("  " + pad(a.slice(0, 20), 22, true) + pad(b.slice(0, 20), 22, true)
        + pad(pct(win), 10) + tag);
      if (win < 0.10) {
        printFlag(`Double debuff "${a.slice(0, 20)}" + "${b.slice(0, 20)}" is unwinnable on Veteran`);
        flagged = true;
      }
    }
  }

  // ── Section E: Modifier effective-HP breakdown ───────────────────────────
  printSubHeader("Effective enemy HP under modifier combinations (brute vs. Standard)");

  const SAMPLE_ENEMY = { hp: 82, speed: 30, armor: 0.15 };
  const testMods = [
    { label: "Baseline",                  mod: {} },
    { label: "Heavy Hull",                mod: DEBUFFS.find(d => d.id === "heavy_hull") },
    { label: "Hardened Carapace",         mod: DEBUFFS.find(d => d.id === "armored") },
    { label: "Nightmare diff",            mod: { enemyHpMul: DIFFICULTIES.nightmare.enemyHpMul } },
    { label: "Nightmare + Heavy Hull",    mod: mergeModifiers(
        { enemyHpMul: DIFFICULTIES.nightmare.enemyHpMul },
        DEBUFFS.find(d => d.id === "heavy_hull")
      )},
    { label: "Nightmare + Hardened + Heal", mod: mergeModifiers(
        { enemyHpMul: DIFFICULTIES.nightmare.enemyHpMul },
        DEBUFFS.find(d => d.id === "armored"),
        DEBUFFS.find(d => d.id === "haunted")
      )},
  ];

  console.log("\n  " + pad("Combo", 32, true) + pad("Base HP", 10) + pad("Eff HP", 10) + pad("Armor", 8) + pad("Multiplier", 12));
  console.log("  " + "─".repeat(74));

  for (const tm of testMods) {
    const hpMul   = tm.mod.enemyHpMul ?? 1;
    const armAdd  = tm.mod.enemyArmorAdd ?? 0;
    const heal    = tm.mod.enemyHealPerSec ?? 0;
    const effArmor = Math.min(0.90, SAMPLE_ENEMY.armor + armAdd);
    const effHp    = SAMPLE_ENEMY.hp * hpMul + heal * (390 / SAMPLE_ENEMY.speed);
    const effEhp   = effHp / (1 - effArmor);
    const mult     = effEhp / (SAMPLE_ENEMY.hp / (1 - SAMPLE_ENEMY.armor));

    console.log("  " + pad(tm.label, 32, true) + pad(fmt1(SAMPLE_ENEMY.hp), 10)
      + pad(fmt1(effHp), 10) + pad(fmt1(effArmor * 100) + "%", 8) + pad(`×${mult.toFixed(2)}`, 12));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
