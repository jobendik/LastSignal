#!/usr/bin/env node
/**
 * 01-difficulty-scaling.mjs
 *
 * Tests whether each strategy is appropriately challenged across all 4
 * difficulty tiers. Answers the questions:
 *
 *  - Which strategy/difficulty combos are trivially easy (>90% win rate)?
 *  - Which are punishing but fair (50–90%)?
 *  - Which are unwinnable (<10%)?
 *  - Does "Minimal Defense" stay as OP on Nightmare as it is on Standard?
 *
 * Run: node sim/01-difficulty-scaling.mjs [--runs=N]
 */

import { fileURLToPath } from "node:url";
import {
  DIFFICULTIES, strategies, multiRunStats, SECTOR1_WAVES,
  printHeader, printSubHeader, printFlag, pad, fmt1, pct, RUNS,
} from "./shared.mjs";

export function main() {
  printHeader("TEST 01 — DIFFICULTY SCALING  (Sector 1, all 4 difficulties)");

  const diffList = Object.values(DIFFICULTIES);
  const stratList = Object.values(strategies);

  // ── Section A: Win-rate matrix ────────────────────────────────────────────
  printSubHeader("Win-rate matrix: strategy × difficulty  (" + RUNS + " runs each)");

  // Column headers
  const COL = 18;
  let header = pad("Strategy", 22, true);
  for (const d of diffList) header += pad(d.label, COL);
  console.log("\n  " + header);
  console.log("  " + "─".repeat(22 + COL * diffList.length));

  /** { stratId: { diffId: winRate } } */
  const matrix = {};

  for (const strat of stratList) {
    matrix[strat.label] = {};
    let row = pad(strat.label, 22, true);
    for (const diff of diffList) {
      const stats = multiRunStats(strat.fn, RUNS, {
        wavesArr:         SECTOR1_WAVES,
        enemyHpMul:       diff.enemyHpMul,
        enemySpeedMul:    diff.enemySpeedMul,
        coreIntegrityMul: diff.coreIntegrityMul,
        rewardMul:        diff.rewardMul,
      });
      const winRate = stats.at(-1)?.survivalRate ?? 0;
      matrix[strat.label][diff.label] = winRate;
      const tag = winRate >= 0.9 ? "✓" : winRate >= 0.5 ? "~" : winRate >= 0.1 ? "✗" : "☠";
      row += pad(`${pct(winRate)} ${tag}`, COL);
    }
    console.log("  " + row);
  }

  // ── Section B: Flags ─────────────────────────────────────────────────────
  printSubHeader("Flags");

  let flagged = false;
  for (const strat of stratList) {
    const rates = Object.entries(matrix[strat.label]);
    const recruitRate   = rates.find(([k]) => k === "Recruit")?.[1]  ?? 0;
    const standardRate  = rates.find(([k]) => k === "Standard")?.[1] ?? 0;
    const veteranRate   = rates.find(([k]) => k === "Veteran")?.[1]  ?? 0;
    const nightmareRate = rates.find(([k]) => k === "Nightmare")?.[1] ?? 0;

    if (standardRate > 0.9 && nightmareRate > 0.9) {
      printFlag(`"${strat.label}" wins >90% on both Standard AND Nightmare → may need tuning`);
      flagged = true;
    }
    if (standardRate < 0.15) {
      printFlag(`"${strat.label}" wins <15% on Standard → likely too hard for casual players`);
      flagged = true;
    }
    if (recruitRate < 0.5) {
      printFlag(`"${strat.label}" wins <50% on Recruit → Recruit is not beginner-friendly`);
      flagged = true;
    }
    // Check that difficulty progression is monotonic
    if (veteranRate > standardRate + 0.10) {
      printFlag(`"${strat.label}" has higher win rate on Veteran than Standard (${pct(veteranRate)} vs ${pct(standardRate)}) → reward/HP ratio may be off`);
      flagged = true;
    }
  }

  // Check that difficulty does create meaningful separation
  const pulseStat = matrix["Pulse Spam"];
  if (pulseStat) {
    const diff = (pulseStat["Standard"] ?? 0) - (pulseStat["Nightmare"] ?? 0);
    if (diff < 0.3) {
      printFlag(`Pulse Spam win-rate gap Standard→Nightmare is only ${(diff * 100).toFixed(0)}pp → Nightmare may not be hard enough`);
      flagged = true;
    }
  }

  if (!flagged) console.log("  No flags raised. Difficulty scaling looks clean.");

  // ── Section C: Difficulty pressure per wave (Nightmare, Mixed strategy) ──
  printSubHeader("Per-wave survival: Mixed Optimal on Nightmare");

  const nmDiff = DIFFICULTIES.nightmare;
  const nmStats = multiRunStats(strategies.mixed.fn, RUNS, {
    wavesArr:         SECTOR1_WAVES,
    enemyHpMul:       nmDiff.enemyHpMul,
    enemySpeedMul:    nmDiff.enemySpeedMul,
    coreIntegrityMul: nmDiff.coreIntegrityMul,
    rewardMul:        nmDiff.rewardMul,
  });

  console.log("\n  " + pad("Wave", 6) + pad("Survived", 10) + pad("AvgCoreHP", 11) + pad("AvgBreaches", 13) + pad("  WaveName", 0, true));
  console.log("  " + "─".repeat(60));
  for (const s of nmStats) {
    const wave = SECTOR1_WAVES[s.wave - 1];
    const tag  = s.survivalRate < 0.5 ? " ← hard checkpoint" : "";
    console.log("  " + pad(s.wave, 6) + pad(pct(s.survivalRate), 10) + pad(fmt1(s.avgCoreHp), 11)
      + pad(fmt1(s.avgBreaches), 13) + "  " + (wave?.name ?? "") + tag);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
