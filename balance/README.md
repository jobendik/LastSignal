# Last Signal — Balance Testing Scripts

## Overview

This directory contains a standalone Node.js simulation that stress-tests game
balance by running hundreds of virtual games and measuring key metrics.

**No browser, no build step required.**  Run directly with Node.js ≥ 18:

```
node balance/balance-sim.mjs
```

Optional flags:

| Flag | Default | Description |
|---|---|---|
| `--runs=N` | 200 | Monte-Carlo iterations per strategy |
| `--verbose` | off | Extra per-wave detail |

---

## What the simulation tests

The script runs **six sections** in sequence:

### Section 1 — Wave Threat Budget
For every campaign wave (Sector 1, waves 1–15) it computes:
- Total enemy count (including carrier/splitter offspring)
- Total **Effective HP** (raw HP adjusted for armor — what towers must deal)
- Maximum breach damage if all enemies reach the core

### Section 2 — Minimum Towers for Zero Breaches
Sweeps from 0 to 60 towers of each type and records the *first* count at which
every enemy in that wave is killed before reaching the core.  A low number
indicates that wave can be trivially neutralised by spamming that tower type.

### Section 3 — Credit Economy Trace
Single deterministic run per strategy showing:
- Tower count at each wave
- Breaches / core damage per wave
- Credits accumulated over time

### Section 4 — Monte-Carlo Strategy Comparison (200 runs default)
Runs each strategy many times with ±30% random placement-efficiency noise
(models sub-optimal tower positioning) and reports:
- Average breaches per wave
- Average core HP remaining
- Overall win rate

Strategies tested:
| Strategy | Description |
|---|---|
| **No Defense** | Build nothing — baseline showing raw breach damage |
| **Minimal Defense** | Buy exactly 1 pulse tower per wave |
| **Pulse Spam** | Spend all credits on pulse cannons every planning phase |
| **Blaster Spam** | Same but with blasters |
| **Economy-First** | Build 3 harvesters first, then switch to pulse spam |
| **Mixed Optimal** | Stasis + mortar + tesla + railgun with pulse fill |

### Section 5 — Endless-Mode Scaling Analysis
Computes the first endless wave at which the first enemy breaches for lineups
of 1 to 50 pulse towers.  Shows where the HP/speed scaling finally outpaces
tower DPS.

### Section 6 — Balance Diagnosis & Recommendations
Summarises identified issues and proposes concrete tuning changes.

---

## Key Findings (Sector 1, Standard Difficulty)

> Results are from the last committed run in `balance/latest-results.txt`.

### 1. Minimal effort wins 100 % of games
A player who builds **just 1 pulse tower per wave** (15 towers total, costing
only 300 credits) clears every wave with zero breaches in 100 % of Monte-Carlo
runs.  The minimum viable strategy already trivialises the campaign.

### 2. Starting budget enables 12 towers before wave 1
`250 starting credits ÷ 20 (pulse cost) = 12 towers`.  By wave 3 a spam
player has ≥ 19 towers — several times the threshold needed for zero breaches
on the hardest wave (wave 15 needs only 4 pulse towers).

### 3. No per-tower diminishing returns
Damage scales linearly: 2× towers = 2× DPS on every enemy simultaneously.
There is no cooldown penalty, overlap discount, or build-cap for pulse cannons.

### 4. Credit economy out-paces wave EHP growth
Wave rewards accumulate faster than wave threat grows.  Even after spending
all credits on combat towers each wave, the player ends with >600 credits
unspent by wave 15.  An economy player accumulates ~320 towers.

### 5. Endless mode eventually challenges — but too late
The endless HP scaling (+18 %/wave) does create a ceiling:
- Lineups of 3–20 pulse towers fail at endless wave 8 (juggernaut/overlord)
- Lineups of 25–50 towers fail at endless wave 16 (leviathan boss)
- A player with 151 towers (typical pulse-spam campaign end-state) survives
  well past endless wave 50

---

## Suggested Remedies

See **Section 6** of the simulation output for full detail.  In summary:

| Change | Expected effect |
|---|---|
| Build limit: pulse ≤ 6–8 | Forces strategic diversification |
| Tower density penalty (congestion cooldown) | Punishes stacking on one chokepoint |
| Reduce starting credits 250 → 180–190 | Delays "enough towers" threshold to wave 6+ |
| Increase wave EHP 1.25–1.40× | Makes later waves threatening even with many towers |
| Increase per-wave reward by less (−20–30 %) | Slows credit snowball |
| Endless HP scale 0.18 → 0.25 per wave | Tightens the endless ceiling |

---

## Files

| File | Description |
|---|---|
| `balance-sim.mjs` | Main simulation script (standalone, no build needed) |
| `latest-results.txt` | Output of the most recent committed run |
| `README.md` | This document |
