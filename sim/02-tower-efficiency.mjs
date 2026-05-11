#!/usr/bin/env node
/**
 * 02-tower-efficiency.mjs
 *
 * Tower cost-efficiency analysis. Answers:
 *
 *  - How much damage does each tower deal per credit invested?
 *  - Which towers are drastically over-tuned vs. under-tuned?
 *  - Which tower is best against each enemy archetype?
 *  - DPS, shots-to-kill, and time-to-kill for every tower × enemy pair.
 *
 * Run: node sim/02-tower-efficiency.mjs
 */

import { fileURLToPath } from "node:url";
import {
  ENEMIES, TOWERS, PATH_LENGTH,
  towerDamageVsEnemy, printHeader, printSubHeader, printFlag, pad, fmt1, fmt0,
} from "./shared.mjs";

export function main() {
  printHeader("TEST 02 — TOWER COST-EFFICIENCY ANALYSIS");

  const towerKeys  = Object.keys(TOWERS).filter(t => TOWERS[t].combat);
  const enemyKeys  = Object.keys(ENEMIES).filter(e => !ENEMIES[e].isBoss);

  // ── Section A: DPS table ──────────────────────────────────────────────────
  printSubHeader("Effective DPS per tower (at base speed, no slow)");

  console.log("\n  " + pad("Tower", 12, true) + pad("Cost", 7)
    + pad("DPS", 8) + pad("DPS/Credit", 12) + pad("Range", 7) + "  Notes");
  console.log("  " + "─".repeat(70));

  const dpsPerCredit = {};
  for (const key of towerKeys) {
    const t   = TOWERS[key];
    const dps = t.damage / t.cd * (t.splashMul ?? t.chainMul ?? 1.0);
    const dpc = dps / t.cost;
    dpsPerCredit[key] = dpc;
    const note = t.splashMul ? "AoE" : t.chainMul ? "Chain" : "";
    console.log("  " + pad(key, 12, true) + pad(t.cost, 7) + pad(fmt1(dps), 8)
      + pad(dpc.toFixed(4), 12) + pad(t.range, 7) + "  " + note);
  }

  // Flag outliers
  const dpcValues = Object.values(dpsPerCredit);
  const medianDpc = dpcValues.slice().sort((a, b) => a - b)[Math.floor(dpcValues.length / 2)];

  printSubHeader("DPS/Credit outlier flags");
  let flagged = false;
  for (const [key, dpc] of Object.entries(dpsPerCredit)) {
    if (dpc > medianDpc * 2.0) {
      printFlag(`"${key}" DPS/credit is ${(dpc / medianDpc).toFixed(1)}× the median → potentially overtuned`);
      flagged = true;
    } else if (dpc < medianDpc * 0.4) {
      printFlag(`"${key}" DPS/credit is only ${(dpc / medianDpc).toFixed(1)}× the median → potentially undertuned / niche`);
      flagged = true;
    }
  }
  if (!flagged) console.log("  All combat towers within 2.5× of each other. Looks balanced.");

  // ── Section B: Damage-per-enemy heat map ─────────────────────────────────
  printSubHeader("Damage dealt by 1 tower to 1 enemy (no slow) — heat map");

  // Print header row
  const COL = 10;
  let hdr = pad("Enemy \\ Tower", 14, true);
  for (const t of towerKeys) hdr += pad(t, COL);
  console.log("\n  " + hdr);
  console.log("  " + "─".repeat(14 + towerKeys.length * COL));

  // Find global max for ▓ scaling
  let globalMax = 0;
  const dmgTable = {};
  for (const eKey of enemyKeys) {
    dmgTable[eKey] = {};
    for (const tKey of towerKeys) {
      const d = towerDamageVsEnemy(TOWERS[tKey], ENEMIES[eKey]);
      dmgTable[eKey][tKey] = d;
      if (d > globalMax) globalMax = d;
    }
  }

  for (const eKey of enemyKeys) {
    const e    = ENEMIES[eKey];
    let row    = pad(eKey, 14, true);
    let bestT  = null, bestDmg = -1;
    for (const tKey of towerKeys) {
      const d      = dmgTable[eKey][tKey];
      const kills  = d >= e.hp ? "✓" : d >= e.hp * 0.5 ? "½" : "·";
      row += pad(kills + fmt0(d), COL);
      if (d > bestDmg) { bestDmg = d; bestT = tKey; }
    }
    row += `  ← best: ${bestT}`;
    console.log("  " + row);
  }
  console.log("\n  Legend: ✓=kills  ½=half HP  ·=less than half");

  // ── Section C: Shots-to-kill by tower type ────────────────────────────────
  printSubHeader("Shots-to-kill (single tower, no slow, standard difficulty)");

  console.log("\n  " + pad("Enemy", 14, true) + pad("HP", 7) + pad("Armor", 7)
    + towerKeys.map(t => pad(t, 8)).join(""));
  console.log("  " + "─".repeat(14 + 14 + towerKeys.length * 8));

  for (const eKey of enemyKeys) {
    const e = ENEMIES[eKey];
    let row = pad(eKey, 14, true) + pad(fmt0(e.hp), 7) + pad(fmt0((e.armor ?? 0) * 100) + "%", 7);
    for (const tKey of towerKeys) {
      const t       = TOWERS[tKey];
      const dmgPerShot = t.damage * (1 - (e.armor ?? 0));
      const shots   = dmgPerShot <= 0 ? "∞" : Math.ceil(e.hp / dmgPerShot);
      row += pad(String(shots), 8);
    }
    console.log("  " + row);
  }

  // ── Section D: Cost-per-kill analysis ────────────────────────────────────
  printSubHeader("Credits-per-kill (1 tower, at standard kill rate)");

  console.log("\n  Higher = tower needs more copies (or is expensive) to kill this enemy.");
  console.log("\n  " + pad("Tower", 12, true) + pad("Cost", 7)
    + enemyKeys.map(e => pad(e.substring(0, 8), 10)).join(""));
  console.log("  " + "─".repeat(12 + 7 + enemyKeys.length * 10));

  const allCpk = [];
  for (const tKey of towerKeys) {
    const t = TOWERS[tKey];
    let row = pad(tKey, 12, true) + pad(t.cost, 7);
    for (const eKey of enemyKeys) {
      const e   = ENEMIES[eKey];
      const dmg = towerDamageVsEnemy(t, e);
      const cpk = dmg >= e.hp ? t.cost : (dmg > 0 ? t.cost * (e.hp / dmg) : 99999);
      allCpk.push(cpk);
      const disp = cpk >= 9999 ? "N/A" : fmt0(cpk);
      row += pad(disp, 10);
    }
    console.log("  " + row);
  }

  // ── Section E: Slow tower synergy ────────────────────────────────────────
  printSubHeader("Slow synergy — damage increase from pairing slow + combat (stasis + mortar)");

  const comboPairs = [
    ["stasis", "mortar"],
    ["stasis", "tesla"],
    ["stasis", "pulse"],
    ["snare",  "mortar"],
    ["snare",  "pulse"],
    ["barrier","mortar"],
  ];

  console.log("\n  " + pad("Slow+Combat pair", 24, true) + enemyKeys.slice(0, 8).map(e => pad(e.substring(0, 9), 10)).join(""));
  console.log("  " + "─".repeat(24 + 8 * 10));

  for (const [slowKey, combatKey] of comboPairs) {
    const slowT   = TOWERS[slowKey];
    const combatT = TOWERS[combatKey];
    if (!slowT || !combatT) continue;

    let row = pad(`${slowKey}+${combatKey}`, 24, true);
    for (const eKey of enemyKeys.slice(0, 8)) {
      const eDef      = ENEMIES[eKey];
      const baseline  = towerDamageVsEnemy(combatT, eDef, { speedMul: 1.0 });
      const withSlow  = towerDamageVsEnemy(combatT, eDef, { speedMul: slowT.slowFactor ?? 0.5 });
      const boost     = baseline > 0 ? (withSlow / baseline) : 1;
      row += pad(`+${fmt0((boost - 1) * 100)}%`, 10);
    }
    console.log("  " + row);
  }

  // ── Section F: Upgrade impact preview ────────────────────────────────────
  printSubHeader("Key upgrade effects on representative towers");

  const upgradeTests = [
    { label: "Overclock (+10% fire rate)",     opts: { cooldownMul: 1 / 1.1 } },
    { label: "Plasma Metallurgy (+15% dmg)",   opts: { damageMul: 1.15 } },
    { label: "Calibrated Optics (+12 range)",  opts: { rangeAdd: 12 } },
    { label: "Advanced Arsenal (+20% dmg)",    opts: { damageMul: 1.20 } },
    { label: "Overclock+Plasma (+10%+15%)",    opts: { cooldownMul: 1/1.1, damageMul: 1.15 } },
  ];

  const testEnemies = ["grunt", "brute", "juggernaut"];
  const testTowers  = ["pulse", "mortar", "railgun"];

  for (const upg of upgradeTests) {
    console.log(`\n  ${upg.label}`);
    console.log("  " + pad("Tower", 10, true) + testEnemies.map(e => pad(e, 12)).join(""));
    for (const tKey of testTowers) {
      const t = TOWERS[tKey];
      if (!t.combat) continue;
      let row = pad(tKey, 10, true);
      for (const eKey of testEnemies) {
        const base = towerDamageVsEnemy(t, ENEMIES[eKey]);
        const upd  = towerDamageVsEnemy(t, ENEMIES[eKey], upg.opts);
        const d    = base > 0 ? `+${fmt0((upd / base - 1) * 100)}%` : "N/A";
        row += pad(d, 12);
      }
      console.log("  " + row);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
