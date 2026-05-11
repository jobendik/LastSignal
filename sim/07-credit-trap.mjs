#!/usr/bin/env node
/**
 * 07-credit-trap.mjs
 *
 * Tracks credit economy per wave to identify "credit traps":
 *
 *  - Decision poverty: player has some credits but can't buy anything useful
 *  - Credit desert: player can't afford even the cheapest tower
 *  - Credit surplus: player ends a wave with unspent credits > 1 tower cost
 *  - Dead weight: credits still unspent at run-end
 *
 * Answers:
 *  - Are there waves where the cheapest useful tower is out of reach?
 *  - Does the economy go flat mid-campaign (nothing meaningful to buy)?
 *  - Which difficulty creates the widest credit deserts?
 *  - Does the Economy strategy actually help with decision poverty?
 *
 * Run: node sim/07-credit-trap.mjs [--runs=N]
 */

import { fileURLToPath } from "node:url";
import {
  TOWERS, DIFFICULTIES, strategies, simulateCampaign, SECTOR1_WAVES,
  printHeader, printSubHeader, printFlag, pad, pct, fmt1, fmt0, RUNS,
} from "./shared.mjs";

// Credit-state thresholds
const TOWER_COSTS  = Object.values(TOWERS).map(t => t.cost).sort((a, b) => a - b);
const MIN_COST     = Math.min(...TOWER_COSTS);  // cheapest tower (~20 pulse)
const MID_COST     = 80;   // meaningful mid-tier (mortar)
const HIGH_COST    = 150;  // expensive (railgun)

/**
 * Categorize a credit balance:
 *  desert   – can't afford cheapest tower
 *  poverty  – can afford cheapest but nothing mid-tier
 *  mid      – can afford mid-tier but not high-tier
 *  rich     – can afford high-tier
 */
function creditState(credits) {
  if (credits < MIN_COST)  return "desert";
  if (credits < MID_COST)  return "poverty";
  if (credits < HIGH_COST) return "mid";
  return "rich";
}

/**
 * Run a strategy and return per-wave credit states over multiple runs.
 * Returns wave-indexed { desert, poverty, mid, rich } rates (0–1 fraction).
 */
function waveCreditsStats(stratFn, diff, runs = RUNS) {
  const waveCounts = SECTOR1_WAVES.map(() => ({ desert: 0, poverty: 0, mid: 0, rich: 0 }));

  for (let r = 0; r < runs; r++) {
    const noise = 0.70 + Math.random() * 0.60;
    const logs  = simulateCampaign(stratFn, {
      wavesArr:         SECTOR1_WAVES,
      enemyHpMul:       diff.enemyHpMul / noise,
      enemySpeedMul:    diff.enemySpeedMul,
      coreIntegrityMul: diff.coreIntegrityMul,
      rewardMul:        diff.rewardMul,
    });

    for (let wi = 0; wi < logs.length; wi++) {
      const state = creditState(logs[wi].credits);
      waveCounts[wi][state]++;
    }
  }

  return waveCounts.map(c => ({
    desert:  c.desert  / runs,
    poverty: c.poverty / runs,
    mid:     c.mid     / runs,
    rich:    c.rich    / runs,
  }));
}

export function main() {
  printHeader("TEST 07 — CREDIT TRAP ANALYSIS");

  const STRATS = [
    { key: "pulseSpam",  s: strategies.pulseSpam },
    { key: "economy",   s: strategies.economy },
    { key: "mixed",     s: strategies.mixed },
  ];

  const DIFFS = [
    DIFFICULTIES.standard,
    DIFFICULTIES.veteran,
    DIFFICULTIES.nightmare,
  ];

  // ── Section A: Per-wave credit state map ─────────────────────────────────
  for (const diff of DIFFS) {
    printSubHeader(`Credit state per wave — ${diff.label} difficulty`);

    console.log(`\n  Desert = can't afford cheapest tower (<${MIN_COST}cr)`);
    console.log(`  Poverty = only cheapest towers available (${MIN_COST}–${MID_COST - 1}cr)`);
    console.log(`  Mid     = can afford mortars/stasis (${MID_COST}–${HIGH_COST - 1}cr)`);
    console.log(`  Rich    = can afford railgun+ (${HIGH_COST}cr+)\n`);

    const COL = 10;
    let hdr = pad("Wave", 7) + pad("Wave Name", 22, true);
    for (const { key } of STRATS) hdr += pad(key, COL * 4);
    console.log("  " + hdr);

    let subhdr = pad("", 7) + pad("", 22);
    for (const _ of STRATS) subhdr += pad("Desert", COL) + pad("Poor", COL) + pad("Mid", COL) + pad("Rich", COL);
    console.log("  " + subhdr);
    console.log("  " + "─".repeat(7 + 22 + STRATS.length * COL * 4));

    const allStats = STRATS.map(({ s }) => waveCreditsStats(s.fn, diff));

    for (let wi = 0; wi < SECTOR1_WAVES.length; wi++) {
      const waveName = (SECTOR1_WAVES[wi].name ?? `Wave ${wi + 1}`).slice(0, 20);
      let row = pad(wi + 1, 7) + pad(waveName, 22, true);
      for (let si = 0; si < STRATS.length; si++) {
        const cs = allStats[si][wi];
        row += pad(pct(cs.desert),  COL)
             + pad(pct(cs.poverty), COL)
             + pad(pct(cs.mid),     COL)
             + pad(pct(cs.rich),    COL);
      }
      console.log("  " + row);
    }
  }

  // ── Section B: Aggregate credit trap stats ────────────────────────────────
  printSubHeader("Aggregate credit trap statistics per strategy × difficulty");

  console.log("\n  " + pad("Strategy", 14, true) + pad("Difficulty", 12)
    + pad("Waves Desert", 14) + pad("Waves Poverty", 15) + pad("Dead Weight", 13) + "  Notes");
  console.log("  " + "─".repeat(75));

  for (const diff of DIFFS) {
    for (const { key, s } of STRATS) {
      const stats = waveCreditsStats(s.fn, diff);

      // Average fraction of waves in each state
      const avgDesert  = stats.reduce((sum, cs) => sum + cs.desert,  0) / stats.length;
      const avgPoverty = stats.reduce((sum, cs) => sum + cs.poverty, 0) / stats.length;

      // Dead weight: estimate by running full campaign and checking final credits
      let totalEnd = 0;
      for (let r = 0; r < Math.min(RUNS, 30); r++) {
        const noise = 0.70 + Math.random() * 0.60;
        const logs  = simulateCampaign(s.fn, {
          wavesArr: SECTOR1_WAVES, enemyHpMul: diff.enemyHpMul / noise,
          enemySpeedMul: diff.enemySpeedMul, coreIntegrityMul: diff.coreIntegrityMul,
          rewardMul: diff.rewardMul,
        });
        totalEnd += logs.at(-1)?.credits ?? 0;
      }
      const avgDeadWeight = totalEnd / Math.min(RUNS, 30);

      const note = avgDesert > 0.30 ? "⚠ frequent deserts"
        : avgPoverty > 0.50 ? "⚠ mostly poverty"
        : avgDeadWeight > 500 ? "⚠ credits unused"
        : "";

      console.log("  " + pad(key, 14, true) + pad(diff.label, 12)
        + pad(pct(avgDesert), 14) + pad(pct(avgPoverty), 15)
        + pad(fmt0(avgDeadWeight) + "cr", 13) + "  " + note);
    }
  }

  // ── Section C: "Can I buy anything right now?" per wave ──────────────────
  printSubHeader("Decision availability per wave (Standard, Mixed strategy)");

  const DECISION_RUNS = Math.min(RUNS, 50);
  const STANDARD = DIFFICULTIES.standard;
  const availabilityByWave = SECTOR1_WAVES.map(() => ({ no: 0, one: 0, multi: 0 }));

  for (let r = 0; r < DECISION_RUNS; r++) {
    const noise = 0.70 + Math.random() * 0.60;
    const logs  = simulateCampaign(strategies.mixed.fn, {
      wavesArr: SECTOR1_WAVES, enemyHpMul: STANDARD.enemyHpMul / noise,
      enemySpeedMul: STANDARD.enemySpeedMul, coreIntegrityMul: STANDARD.coreIntegrityMul,
      rewardMul: STANDARD.rewardMul,
    });

    for (let wi = 0; wi < logs.length; wi++) {
      const cr = logs[wi].credits;
      const affordable = Object.values(TOWERS).filter(t => cr >= t.cost).length;
      if (affordable === 0)       availabilityByWave[wi].no++;
      else if (affordable <= 3)   availabilityByWave[wi].one++;
      else                        availabilityByWave[wi].multi++;
    }
  }

  console.log("\n  " + pad("Wave", 7) + pad("No Option", 11) + pad("1–3 Options", 13) + pad("4+ Options", 12) + "  Wave Name");
  console.log("  " + "─".repeat(60));

  for (let wi = 0; wi < SECTOR1_WAVES.length; wi++) {
    const a     = availabilityByWave[wi];
    const total = a.no + a.one + a.multi;
    const noP   = pct(a.no / total);
    const oneP  = pct(a.one / total);
    const mulP  = pct(a.multi / total);
    const tag   = a.no / total > 0.40 ? " ← decision desert!" : "";
    console.log("  " + pad(wi + 1, 7) + pad(noP, 11) + pad(oneP, 13) + pad(mulP, 12)
      + "  " + (SECTOR1_WAVES[wi].name ?? "") + tag);
  }

  // ── Section D: Flags ─────────────────────────────────────────────────────
  printSubHeader("Flags");

  let flagged = false;
  for (const diff of DIFFS) {
    const stats = waveCreditsStats(strategies.pulseSpam.fn, diff, 30);
    const desertWaves = stats.filter(cs => cs.desert > 0.5).length;
    if (desertWaves > 4) {
      printFlag(`On ${diff.label}, Pulse Spam spends >50% of ${desertWaves} waves in credit desert — economy feels starved`);
      flagged = true;
    }
  }

  for (let wi = 0; wi < availabilityByWave.length; wi++) {
    const a     = availabilityByWave[wi];
    const total = a.no + a.one + a.multi;
    if (a.no / total > 0.60) {
      printFlag(`Wave ${wi + 1} (${SECTOR1_WAVES[wi].name}): player has no purchasable towers >60% of the time on Standard`);
      flagged = true;
    }
  }

  if (!flagged) console.log("  No severe credit traps detected.");

  // ── Section E: Economy strategy ROI ──────────────────────────────────────
  printSubHeader("Economy strategy: harvester break-even analysis");

  console.log("\n  Harvester costs 60cr. Each harvester earns 15cr every 5s during ~30s waves.");
  console.log("  Income per wave per harvester: ~90cr");
  console.log("  Break-even: 1 wave (60cr cost → 90cr back)");
  console.log("  On a 16-wave run: 1 harvester earns ~" + fmt0(90 * 16) + "cr total, net +" + fmt0(90 * 16 - 60) + "cr");

  let h1runs = 0, h2runs = 0, h3runs = 0;
  for (let r = 0; r < 30; r++) {
    const noise = 0.70 + Math.random() * 0.60;
    const logs  = simulateCampaign(strategies.economy.fn, {
      wavesArr: SECTOR1_WAVES, enemyHpMul: STANDARD.enemyHpMul / noise,
      enemySpeedMul: STANDARD.enemySpeedMul, coreIntegrityMul: STANDARD.coreIntegrityMul,
      rewardMul: STANDARD.rewardMul,
    });
    if (logs.at(-1)?.alive) h1runs++;
  }
  console.log(`\n  Economy strategy survival rate (Standard, 30 runs): ${pct(h1runs / 30)}`);

  const economyVsSpam = (() => {
    let econWin = 0, spamWin = 0;
    for (let r = 0; r < RUNS; r++) {
      const noise = 0.70 + Math.random() * 0.60;
      const hpN   = STANDARD.enemyHpMul / noise;
      const eopts = { wavesArr: SECTOR1_WAVES, enemyHpMul: hpN,
        enemySpeedMul: STANDARD.enemySpeedMul, coreIntegrityMul: STANDARD.coreIntegrityMul, rewardMul: STANDARD.rewardMul };
      if (simulateCampaign(strategies.economy.fn, eopts).at(-1)?.alive) econWin++;
      if (simulateCampaign(strategies.pulseSpam.fn, eopts).at(-1)?.alive) spamWin++;
    }
    return { econWin, spamWin };
  })();

  console.log(`\n  Economy vs Pulse Spam (${RUNS} runs, Standard):`);
  console.log(`    Economy  win rate: ${pct(economyVsSpam.econWin / RUNS)}`);
  console.log(`    PulseSpam win rate: ${pct(economyVsSpam.spamWin / RUNS)}`);

  const diff = economyVsSpam.spamWin - economyVsSpam.econWin;
  if (diff > RUNS * 0.15) {
    printFlag(`Economy strategy is ${(diff / RUNS * 100).toFixed(0)}pp worse than Pulse Spam — harvester investment may not pay off fast enough`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
