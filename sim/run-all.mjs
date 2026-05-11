#!/usr/bin/env node
/**
 * run-all.mjs — Orchestrator for the full Last Signal balance sim suite.
 *
 * Runs all 7 balance tests in sequence. Each test can also be run standalone.
 *
 * Usage:
 *   node sim/run-all.mjs              # run all tests
 *   node sim/run-all.mjs --tests=1,3  # run only tests 01 and 03
 *   node sim/run-all.mjs --runs=50    # faster (less accurate) run
 *
 * The --runs and --verbose flags are forwarded to each sub-test via process.argv.
 */

import { printHeader } from "./shared.mjs";

const args     = process.argv.slice(2);
const testsArg = args.find(a => a.startsWith("--tests="));
const selected = testsArg
  ? new Set(testsArg.split("=")[1].split(",").map(Number))
  : null;

const tests = [
  { num: 1, label: "Difficulty Scaling",    file: "./01-difficulty-scaling.mjs" },
  { num: 2, label: "Tower Efficiency",      file: "./02-tower-efficiency.mjs" },
  { num: 3, label: "Research Delta",        file: "./03-research-delta.mjs" },
  { num: 4, label: "Modifier Stress",       file: "./04-modifier-stress.mjs" },
  { num: 5, label: "Multi-Sector Chain",    file: "./05-multisector-chain.mjs" },
  { num: 6, label: "Endless Ceiling",       file: "./06-endless-ceiling.mjs" },
  { num: 7, label: "Credit Trap",           file: "./07-credit-trap.mjs" },
];

const toRun = selected ? tests.filter(t => selected.has(t.num)) : tests;

if (toRun.length === 0) {
  console.error("No tests matched --tests= filter. Use comma-separated numbers e.g. --tests=1,3,5");
  process.exit(1);
}

const start = Date.now();
printHeader(`LAST SIGNAL — FULL BALANCE SIM SUITE  (running ${toRun.length} of ${tests.length} tests)`);
console.log(`  Node ${process.version}  ·  ${new Date().toISOString()}`);
console.log(`  Args: ${args.join(" ") || "(none)"}`);

let passed = 0, failed = 0;

for (const test of toRun) {
  console.log(`\n${"═".repeat(78)}`);
  console.log(`  ▶  Test ${String(test.num).padStart(2, "0")} / ${tests.length} — ${test.label}`);
  console.log("═".repeat(78));

  const t0 = Date.now();
  try {
    const mod = await import(test.file);
    if (typeof mod.main === "function") {
      await mod.main();
    }
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n  ✓ Test ${test.num} completed in ${elapsed}s`);
    passed++;
  } catch (err) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`\n  ✗ Test ${test.num} FAILED in ${elapsed}s`);
    console.error("  " + err.message);
    if (process.argv.includes("--verbose")) console.error(err.stack);
    failed++;
  }
}

const totalElapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n${"═".repeat(78)}`);
console.log(`  DONE: ${passed} passed, ${failed} failed  (${totalElapsed}s total)`);
console.log("═".repeat(78) + "\n");

if (failed > 0) process.exit(1);
