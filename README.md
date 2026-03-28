# MK8 Grand Prix — Monte Carlo Probability Engine

A browser-based Monte Carlo simulator for the HUTC 2026 Jump Trading round. Calculates real-time fair values for all 8 traded contracts based on current standings, races remaining, and configurable skill assumptions.

## Quick Start

1. Open `index.html` in Chrome (no server or internet required)
2. Enter race finishing positions as they happen
3. Click **▶ Run Simulation** to compute fair values
4. Use the displayed bid/ask prices to guide order entry

---

## UI Guide

### Left Panel — Inputs

| Section | What It Does |
|---------|-------------|
| **Race Results** | Enter each player's finishing position (1–12) per race. Total score auto-computes. |
| **Skill Weights** | Slider per player (1–5). Adjusts how likely each player is to finish in top positions. Default 3 = roughly uniform. |
| **Bot Position Bias** | Slider (0–10). Controls whether bots cluster toward middle positions. 5 = uniform, 10 = strongly mid-biased. |
| **Current Top Bot Score** | Enter the leading bot's cumulative score from completed races for accurate TOPBOT values. |
| **Simulation** | Choose run count (10K/50K/100K), run manually or enable auto-run on input change. |
| **Global Spread** | Half-width applied to all contracts. Bid = FV − spread, Ask = FV + spread. |
| **Undo Race / Clear All** | Undo the last race entry or reset everything. |

### Right Panel — Outputs

Each contract card shows:
- **Fair Value** (large number) — the simulated expected settlement value
- **Bid / Ask** (green / red) — fair value ± spread
- **Confidence bar** — green = tight CI (confident), yellow = moderate, red = wide (uncertain)
- **± override** — type a number to set a per-contract spread different from the global default

The **ΣW** bar shows the sum of W1–W4 fair values. Values above 100 indicate tie probability (this is correct, not an error).

---

## Contracts

| Contract | Settlement Rule |
|----------|----------------|
| **W1–W4** | 100 if that player has the highest total score, else 0. If tied for highest, all tied W contracts settle to 100. |
| **MAX** | The highest total score among the 4 human players. |
| **MIN** | The lowest total score among the 4 human players. |
| **DIFF** | MAX minus MIN. |
| **TOPBOT** | The highest cumulative score across all 8 bot players. |

### Points Table

| Position | 1st | 2nd | 3rd | 4th | 5th | 6th | 7th | 8th | 9th | 10th | 11th | 12th |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|------|------|------|
| Points   | 15  | 12  | 10  | 9   | 8   | 7   | 6   | 5   | 4   | 3    | 2    | 1    |

---

## How the Simulation Works

### Overview

The engine runs N independent Monte Carlo trials (default 50,000). Each trial simulates all remaining races, assigns finishing positions, accumulates points, and records contract settlement values. Fair values are the averages across all trials.

### Step-by-Step (Per Trial)

1. **Initialize scores** to each player's current total from completed races.
2. **For each remaining race:**
   - Start with all 12 positions available (1st through 12th).
   - Assign positions to the 4 human players via **weighted sampling without replacement** (see below).
   - Assign the remaining 8 positions to 8 bots (with optional mid-position bias).
   - Add the corresponding points to each player's running total.
3. **After all races are simulated:**
   - Identify the maximum human score → any player matching it counts as a winner for their W contract (scored at 100).
   - Record MAX, MIN, DIFF (= MAX − MIN), and TOPBOT (highest bot cumulative score).
4. **Repeat** N times and average all values.

### Weighted Sampling Without Replacement

Human players are assigned positions using a **weighted permutation** approach:

1. Randomly shuffle the sampling order of the 4 players (so no player gets systematic "first pick" advantage).
2. For each player in the shuffled order:
   - Compute a weight for every still-available position using the **power-law skill function**.
   - Sample one position from the available positions proportional to these weights.
   - Remove the chosen position from the available pool.
3. The remaining 8 positions go to bots.

This ensures no two players (or bots) share a position in any race.

### Skill Weight Function (Power Law)

Each player has a skill weight `s` on a 1–5 scale (default 3). The probability of finishing in position `p` (1–12) is proportional to:

```
weight(p) = (13 − p) ^ α
```

where:

```
α = (s − 3) × 0.5 + 1
```

| Skill | α | Effect |
|-------|---|--------|
| 1 | 0.0 | All positions equally likely (flat). Slight bottom-bias relative to higher skills. |
| 2 | 0.5 | Mild top-bias. |
| 3 | 1.0 | Linear weights — position 1 is 12× more likely than position 12. Reasonable neutral. |
| 4 | 1.5 | Moderate top-bias. |
| 5 | 2.0 | Quadratic bias toward top positions. Position 1 is 144× more likely than position 12. |

### Bot Position Bias

Bots occupy whichever 8 positions humans didn't take. By default (bias = 5), all positions are equally likely for bots. Increasing the bias slider concentrates bots toward middle positions (4–9), reflecting observed MK8 AI behavior on 150cc.

The weighting function for bot bias:

```
weight(p) = 1 + strength × max(0, 3 − |p − 5.5|)
```

where `strength = (bias − 5) / 5` (0 at bias=5, 1 at bias=10). Below bias=5, bots are uniform.

### TOPBOT Calculation

Each of the 8 bots accumulates points across all simulated remaining races. TOPBOT is the maximum cumulative score among all 8 bots. If a "Current Top Bot Score" is entered, that value is added to the leading bot's simulated total to account for points already earned in completed races.

### DIFF Calculation

DIFF is computed **directly** within each simulation trial as `MAX − MIN` for that trial, then averaged. This correctly captures the correlation between MAX and MIN (the same scenarios that produce a high MAX often produce a low MIN). Deriving DIFF from the marginal MAX and MIN distributions independently would underestimate the fair value.

### Tie Handling

If two or more players are tied for the highest total score at the end of a trial, **all** tied players' W contracts are scored at 100 for that trial. This means:

- W fair values are independent expected values, not a zero-sum split.
- The sum of W1–W4 can exceed 100. The excess represents the expected probability-weighted cost of ties.
- A ΣW of 102 means roughly a 2% chance of at least one tie scenario.

### Confidence Intervals

Rather than running the simulation twice, the engine splits the N trials into **20 equal batches**. Each batch independently computes all fair values. The 90% confidence interval is the range from the 5th to 95th percentile of the 20 batch means.

The CI bar on each card reflects this:
- **Green** = narrow CI (high confidence in the fair value)
- **Yellow** = moderate CI
- **Red** = wide CI (consider using more simulation runs or widening your spread)

---

## Performance

- 50,000 runs complete in **1–3 seconds** on a standard laptop in Chrome.
- The simulation runs in a **Web Worker** (background thread), so the UI never freezes.
- All computation is client-side. No network requests are made.

---

## Tips for Live Trading

1. **After Race 1:** Update skill weights based on observed performance. Update bot bias and top bot score.
2. **TOPBOT spread:** Consider widening to 4–5 (it has the highest variance of any contract).
3. **Auto-run:** Enable for hands-free updates as you enter positions.
4. **100K runs:** Use during breaks between races for tighter confidence intervals. Drop to 10K if you need sub-second updates during active trading.
5. **ΣW > 100:** This is tradeable information — the excess tells you how much tie risk is in the market.
