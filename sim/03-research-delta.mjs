#!/usr/bin/env node
/**
 * 03-research-delta.mjs
 *
 * Measures the win-rate delta each research node provides.
 * Answers:
 *
 *  - Which research nodes make the biggest survival impact?
 *  - Are any nodes effectively useless (<2% delta)?
 *  - Are any overpowered (>20% delta)?
 *  - How does node impact vary across difficulty tiers?
 *
 * Run: node sim/03-research-delta.mjs [--runs=N]
 */

import { fileURLToPath } from "node:url";
import {
  RESEARCH_NODES, DIFFICULTIES, strategies, multiRunStats,
  SECTOR1_WAVES, CORE_INTEGRITY_STANDARD, STARTING_CREDITS_S1,
  printHeader, printSubHeader, printFlag, pad, fmt1, pct, RUNS,
} from "./shared.mjs";

export function main() {
  printHeader("TEST 03 — RESEARCH NODE DELTA ANALYSIS");

  const STRATS = [
    { id: "mixed",    s: strategies.mixed },
    { id: "economy",  s: strategies.economy },
  ];

  const DIFFS = [
    DIFFICULTIES.standard,
    DIFFICULTIES.veteran,
    DIFFICULTIES.nightmare,
  ];

  // ── Helper: run with a research node effect applied ──────────────────────
  function runWithNode(stratFn, diff, nodeEffect, extraStart = 0) {
    const baseStart   = STARTING_CREDITS_S1 + (nodeEffect.startingCreditsAdd ?? 0) + extraStart;
    const coreExtra   = nodeEffect.coreIntegrityAdd ?? 0;
    const coreMax     = CORE_INTEGRITY_STANDARD + coreExtra;
    return multiRunStats(stratFn, RUNS, {
      wavesArr:          SECTOR1_WAVES,
      startingCredits:   baseStart,
      coreMax,
      enemyHpMul:        diff.enemyHpMul,
      enemySpeedMul:     diff.enemySpeedMul,
      coreIntegrityMul:  diff.coreIntegrityMul,
      rewardMul:         diff.rewardMul * (nodeEffect.rewardMul ?? 1),
      towerDamageMul:    nodeEffect.towerDamageMul ?? 1,
      towerRangeAdd:     nodeEffect.towerRangeAdd  ?? 0,
      harvesterIncomeMul: nodeEffect.harvesterIncomeMul ?? 1,
    });
  }

  // ── Section A: Delta per research node on Standard × Mixed ───────────────
  const targetDiff   = DIFFICULTIES.standard;
  const targetStrat  = strategies.mixed;

  const baseStats = multiRunStats(targetStrat.fn, RUNS, {
    wavesArr:         SECTOR1_WAVES,
    enemyHpMul:       targetDiff.enemyHpMul,
    enemySpeedMul:    targetDiff.enemySpeedMul,
    coreIntegrityMul: targetDiff.coreIntegrityMul,
    rewardMul:        targetDiff.rewardMul,
  });
  const baseWin = baseStats.at(-1)?.survivalRate ?? 0;
  const baseCoreHp = baseStats.at(-1)?.avgCoreHp ?? 0;

  printSubHeader(`Baseline: Mixed / Standard — win rate: ${pct(baseWin)}, avg final core: ${fmt1(baseCoreHp)}`);
  printSubHeader("Win-rate delta per research node (Standard difficulty, Mixed strategy)");

  console.log("\n  " + pad("Node", 22, true) + pad("Tier", 6) + pad("Cost", 6)
    + pad("WinRate", 9) + pad("Δ Win%", 9) + pad("Avg Core HP", 13) + "  Effect");
  console.log("  " + "─".repeat(80));

  const deltas = [];

  for (const node of RESEARCH_NODES) {
    const stats  = runWithNode(targetStrat.fn, targetDiff, node.effect);
    const win    = stats.at(-1)?.survivalRate ?? 0;
    const core   = stats.at(-1)?.avgCoreHp ?? 0;
    const delta  = win - baseWin;
    const effect = Object.entries(node.effect).map(([k, v]) => `${k}:${v}`).join(", ");
    deltas.push({ node, win, delta, core });

    const arrow  = delta > 0.01 ? "↑" : delta < -0.01 ? "↓" : "≈";
    console.log("  " + pad(node.label, 22, true) + pad(node.tier, 6) + pad(node.cost, 6)
      + pad(pct(win), 9) + pad(`${arrow}${(Math.abs(delta) * 100).toFixed(1)}pp`, 9)
      + pad(fmt1(core), 13) + "  " + effect);
  }

  // ── Section B: Flags ─────────────────────────────────────────────────────
  printSubHeader("Flags");

  let flagged = false;
  for (const { node, delta } of deltas) {
    if (Math.abs(delta) < 0.02 && baseWin < 0.98) {
      printFlag(`"${node.label}" (Tier ${node.tier}, cost ${node.cost}) has <2pp delta — near-useless in Standard`);
      flagged = true;
    }
    if (delta > 0.20) {
      printFlag(`"${node.label}" (Tier ${node.tier}) bumps win rate +${(delta * 100).toFixed(0)}pp — may be too powerful`);
      flagged = true;
    }
    if (delta < -0.10) {
      printFlag(`"${node.label}" (Tier ${node.tier}) HURTS win rate (${(delta * 100).toFixed(0)}pp) — check data`);
      flagged = true;
    }
  }
  // Check tier alignment: Tier 3 nodes should generally beat Tier 1
  const byTier = t => deltas.filter(d => d.node.tier === t).map(d => d.delta);
  const avgDelta = arr => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
  if (avgDelta(byTier(3)) < avgDelta(byTier(1)) - 0.05) {
    printFlag("Tier 3 research nodes have LOWER average impact than Tier 1 — progression may feel unrewarding");
    flagged = true;
  }
  if (!flagged) console.log("  All nodes within acceptable delta range.");

  // ── Section C: Node impact across difficulties ────────────────────────────
  printSubHeader("Best nodes per difficulty tier");

  for (const diff of DIFFS) {
    const diffBase = multiRunStats(targetStrat.fn, RUNS, {
      wavesArr: SECTOR1_WAVES, enemyHpMul: diff.enemyHpMul,
      enemySpeedMul: diff.enemySpeedMul, coreIntegrityMul: diff.coreIntegrityMul,
      rewardMul: diff.rewardMul,
    });
    const diffBaseWin = diffBase.at(-1)?.survivalRate ?? 0;

    const nodeDeltas = RESEARCH_NODES.map(node => {
      const s   = runWithNode(targetStrat.fn, diff, node.effect);
      const win = s.at(-1)?.survivalRate ?? 0;
      return { node, delta: win - diffBaseWin };
    });

    nodeDeltas.sort((a, b) => b.delta - a.delta);

    console.log(`\n  ${diff.label} (baseline ${pct(diffBaseWin)})`);
    console.log("  " + pad("Node", 22, true) + pad("Δ Win%", 10));
    for (const { node, delta } of nodeDeltas.slice(0, 5)) {
      const arrow = delta > 0.01 ? "↑" : "≈";
      console.log("  " + pad(node.label, 22, true) + pad(`${arrow}${(delta * 100).toFixed(1)}pp`, 10));
    }
  }

  // ── Section D: Research "value-for-science" ranking ──────────────────────
  printSubHeader("Delta-per-science-point ranking (Standard, Mixed)");

  const ranked = deltas
    .filter(d => d.delta > 0)
    .map(d => ({ ...d, efficiency: d.delta / d.node.cost }))
    .sort((a, b) => b.efficiency - a.efficiency);

  console.log("\n  " + pad("Node", 22, true) + pad("Tier", 6) + pad("Cost", 6)
    + pad("Δ Win%", 9) + pad("Δ/Point", 10));
  console.log("  " + "─".repeat(55));

  for (const { node, delta, efficiency } of ranked) {
    console.log("  " + pad(node.label, 22, true) + pad(node.tier, 6) + pad(node.cost, 6)
      + pad(`+${(delta * 100).toFixed(1)}pp`, 9) + pad((efficiency * 100).toFixed(2), 10));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
