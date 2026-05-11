#!/usr/bin/env node
/**
 * 05-multisector-chain.mjs
 *
 * Simulates all 4 sectors in sequence, carrying over credits and applying
 * cumulative research bonuses. Answers:
 *
 *  - Does credit carry-over cause compounding power imbalances?
 *  - Which sector is the sharpest difficulty spike?
 *  - How much do Tier 1/2/3 research bundles shift cross-sector survival?
 *  - Does a player who scraped through Sector 1 have enough resources for S2?
 *
 * Run: node sim/05-multisector-chain.mjs [--runs=N]
 */

import { fileURLToPath } from "node:url";
import {
  ALL_SECTORS, DIFFICULTIES, strategies, simulateCampaign,
  CORE_INTEGRITY_STANDARD, RESEARCH_NODES,
  printHeader, printSubHeader, printFlag, pad, pct, fmt1, fmt0, RUNS,
} from "./shared.mjs";

// Research bundles to test
const RESEARCH_BUNDLES = [
  {
    id: "none",
    label: "No Research",
    effect: {},
  },
  {
    id: "tier1",
    label: "Tier 1 Bundle (Logistics I + Reinforced Core)",
    effect: {
      startingCreditsAdd: RESEARCH_NODES.find(n => n.id === "logistics_1")?.effect.startingCreditsAdd ?? 25,
      coreIntegrityAdd:   RESEARCH_NODES.find(n => n.id === "reinforced_core")?.effect.coreIntegrityAdd ?? 25,
    },
  },
  {
    id: "tier2_econ",
    label: "Tier 2 Econ (Logistics II + Deep Mining + Bountyful)",
    effect: {
      startingCreditsAdd:  RESEARCH_NODES.find(n => n.id === "logistics_2")?.effect.startingCreditsAdd ?? 50,
      harvesterIncomeMul:  RESEARCH_NODES.find(n => n.id === "deep_mining")?.effect.harvesterIncomeMul ?? 1.25,
      rewardMul:           RESEARCH_NODES.find(n => n.id === "bountyful")?.effect.rewardMul ?? 1.15,
    },
  },
  {
    id: "tier2_combat",
    label: "Tier 2 Combat (Plasma Metallurgy + Calibrated Optics)",
    effect: {
      towerDamageMul: RESEARCH_NODES.find(n => n.id === "plasma_metallurgy")?.effect.towerDamageMul ?? 1.15,
      towerRangeAdd:  RESEARCH_NODES.find(n => n.id === "calibrated_optics")?.effect.towerRangeAdd ?? 12,
    },
  },
  {
    id: "tier3_all",
    label: "Tier 3 Max (Advanced Arsenal + Precision Optics + Logistics III)",
    effect: {
      towerDamageMul:    (RESEARCH_NODES.find(n => n.id === "advanced_arsenal")?.effect.towerDamageMul ?? 1.20)
                       * (RESEARCH_NODES.find(n => n.id === "plasma_metallurgy")?.effect.towerDamageMul ?? 1.15),
      towerRangeAdd:     (RESEARCH_NODES.find(n => n.id === "precision_optics")?.effect.towerRangeAdd ?? 20)
                       + (RESEARCH_NODES.find(n => n.id === "calibrated_optics")?.effect.towerRangeAdd ?? 12),
      startingCreditsAdd: RESEARCH_NODES.find(n => n.id === "logistics_3")?.effect.startingCreditsAdd ?? 75,
      harvesterIncomeMul: RESEARCH_NODES.find(n => n.id === "deep_reserves")?.effect.harvesterIncomeMul ?? 1.25,
      rewardMul:         (RESEARCH_NODES.find(n => n.id === "supply_chain")?.effect.rewardMul ?? 1.15)
                       * (RESEARCH_NODES.find(n => n.id === "bountyful")?.effect.rewardMul ?? 1.15),
    },
  },
];

export function main() {
  printHeader("TEST 05 — MULTI-SECTOR CAMPAIGN CHAIN");

  const TARGET_STRAT = strategies.mixed;
  const TARGET_DIFF  = DIFFICULTIES.standard;

  // ── Section A: Single run trace per sector (Mixed/Standard, no research) ─
  printSubHeader("Single-run sector trace: Mixed / Standard / No Research");

  console.log("\n  " + pad("Sector", 34, true) + pad("Win?", 6) + pad("FinalHP", 9)
    + pad("FinalCr", 9) + pad("TotalBr", 9) + pad("TotalDmg", 10));
  console.log("  " + "─".repeat(78));

  let carryCredits = ALL_SECTORS[0].startCredits;

  for (const sector of ALL_SECTORS) {
    const startCredits = sector === ALL_SECTORS[0] ? sector.startCredits
      : Math.max(sector.startCredits, carryCredits);

    const logs  = simulateCampaign(TARGET_STRAT.fn, {
      wavesArr:         sector.waves,
      startingCredits:  startCredits,
      enemyHpMul:       TARGET_DIFF.enemyHpMul,
      enemySpeedMul:    TARGET_DIFF.enemySpeedMul,
      coreIntegrityMul: TARGET_DIFF.coreIntegrityMul,
      rewardMul:        TARGET_DIFF.rewardMul,
    });

    const last     = logs.at(-1);
    const won      = last?.alive ?? false;
    const coreDmg  = logs.reduce((s, l) => s + l.coreDmg, 0);
    const breaches = logs.reduce((s, l) => s + l.breaches, 0);
    carryCredits   = last?.credits ?? 0;

    const tag      = won ? "✓" : "✗";
    console.log("  " + pad(sector.label, 34, true) + pad(tag, 6) + pad(fmt0(last?.coreHp ?? 0), 9)
      + pad(fmt0(carryCredits), 9) + pad(breaches, 9) + pad(fmt0(coreDmg), 10));
  }

  // ── Section B: Multi-run win rates per sector per research bundle ─────────
  printSubHeader(`Per-sector win rate by research bundle (${RUNS} runs each)`);

  const COL = 14;
  let hdr = pad("Sector", 22, true);
  for (const b of RESEARCH_BUNDLES) hdr += pad(b.label.slice(0, 12), COL);
  console.log("\n  " + hdr);
  console.log("  " + "─".repeat(22 + COL * RESEARCH_BUNDLES.length));

  const sectorRates = ALL_SECTORS.map(() => ({}));

  for (let si = 0; si < ALL_SECTORS.length; si++) {
    const sector = ALL_SECTORS[si];
    let row = pad(sector.id, 22, true);

    for (const bundle of RESEARCH_BUNDLES) {
      let wins = 0;
      for (let r = 0; r < RUNS; r++) {
        const noise = 0.70 + Math.random() * 0.60;
        const logs  = simulateCampaign(TARGET_STRAT.fn, {
          wavesArr:          sector.waves,
          startingCredits:   sector.startCredits + (bundle.effect.startingCreditsAdd ?? 0),
          coreMax:           CORE_INTEGRITY_STANDARD + (bundle.effect.coreIntegrityAdd ?? 0),
          enemyHpMul:        (TARGET_DIFF.enemyHpMul / noise),
          enemySpeedMul:     TARGET_DIFF.enemySpeedMul,
          coreIntegrityMul:  TARGET_DIFF.coreIntegrityMul,
          rewardMul:         TARGET_DIFF.rewardMul * (bundle.effect.rewardMul ?? 1),
          towerDamageMul:    bundle.effect.towerDamageMul ?? 1,
          towerRangeAdd:     bundle.effect.towerRangeAdd ?? 0,
          harvesterIncomeMul: bundle.effect.harvesterIncomeMul ?? 1,
        });
        if (logs.at(-1)?.alive) wins++;
      }
      const rate = wins / RUNS;
      sectorRates[si][bundle.id] = rate;
      const tag = rate >= 0.90 ? "✓" : rate >= 0.50 ? "~" : "✗";
      row += pad(`${pct(rate)}${tag}`, COL);
    }
    console.log("  " + row);
  }

  // ── Section C: Flags ─────────────────────────────────────────────────────
  printSubHeader("Flags");

  let flagged = false;
  for (let si = 0; si < ALL_SECTORS.length; si++) {
    const sector   = ALL_SECTORS[si];
    const noResRate = sectorRates[si]["none"] ?? 0;
    const maxRate   = Math.max(...RESEARCH_BUNDLES.map(b => sectorRates[si][b.id] ?? 0));
    const maxBundle = RESEARCH_BUNDLES.find(b => sectorRates[si][b.id] === maxRate);

    if (noResRate < 0.30 && si > 0) {
      printFlag(`${sector.id} is very hard without research (${pct(noResRate)}) — may feel punishing for new players`);
      flagged = true;
    }
    if (noResRate > 0.90) {
      printFlag(`${sector.id} has >90% win rate with no research — may be too easy for veterans`);
      flagged = true;
    }
    if (maxRate - noResRate > 0.30) {
      printFlag(`${sector.id}: "${maxBundle?.label}" adds +${((maxRate - noResRate) * 100).toFixed(0)}pp — research creates large power gap`);
      flagged = true;
    }

    // Sector difficulty progression
    if (si > 0) {
      const prevRate = sectorRates[si - 1]["none"] ?? 0;
      const drop     = prevRate - noResRate;
      if (drop > 0.40) {
        printFlag(`${sector.id} is a steep difficulty spike vs. previous sector (−${(drop * 100).toFixed(0)}pp)`);
        flagged = true;
      }
    }
  }

  if (!flagged) console.log("  Campaign chain looks well-paced.");

  // ── Section D: Credit carry-over impact ──────────────────────────────────
  printSubHeader("Credit carry-over analysis (Mixed / Standard)");

  console.log("\n  Simulates a player carrying credits from S1→S2→S3→S4.");
  console.log("  Shows whether earlier performance gates later sectors.");

  for (const outcome of ["survived", "barely survived", "defeated"]) {
    const coreHpTarget = outcome === "survived" ? 80 : outcome === "barely survived" ? 20 : 0;
    const wins = [], carryArr = [];

    for (let r = 0; r < RUNS; r++) {
      let prevCredits = ALL_SECTORS[0].startCredits;
      for (let si = 0; si < ALL_SECTORS.length; si++) {
        const sector = ALL_SECTORS[si];
        const startCr = si === 0 ? sector.startCredits : Math.max(sector.startCredits, prevCredits);
        const noise   = 0.70 + Math.random() * 0.60;
        const logs    = simulateCampaign(TARGET_STRAT.fn, {
          wavesArr: sector.waves, startingCredits: startCr,
          enemyHpMul: TARGET_DIFF.enemyHpMul / noise,
          enemySpeedMul: TARGET_DIFF.enemySpeedMul, coreIntegrityMul: TARGET_DIFF.coreIntegrityMul,
          rewardMul: TARGET_DIFF.rewardMul,
        });
        prevCredits = logs.at(-1)?.credits ?? 0;
        if (si === ALL_SECTORS.length - 1) {
          wins.push(logs.at(-1)?.alive ? 1 : 0);
          carryArr.push(prevCredits);
        }
      }
    }

    const avgCarry = carryArr.reduce((s, v) => s + v, 0) / carryArr.length;
    const winRate  = wins.reduce((s, v) => s + v, 0) / wins.length;
    console.log(`\n  → Average S4 end credits: ${fmt0(avgCarry)}   S4 win rate: ${pct(winRate)}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
