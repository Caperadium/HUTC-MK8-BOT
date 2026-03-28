# PRD: Mario Kart Grand Prix — Monte Carlo Probability Engine
**HUTC 2026 · Jump Trading Round**
**Status:** Final · **Author:** HUTC Team 2

---

## 1. Overview

### Problem

The existing spreadsheet tracker calculates W1–W4 win probabilities using a proportional score-weighting heuristic that does not correctly model the discrete points distribution of Mario Kart. Specifically:

- It assumes winning probability scales linearly with current score, which is wrong — a player 3 points behind has meaningfully different odds than one 15 points behind depending on how many races remain.
- The Layer 3 formula breaks when any player is eliminated, causing W probabilities to no longer sum to 100.
- It cannot model scenario-specific outcomes (e.g. "what if the leader finishes last in Race 3?").

### Solution

A browser-based Monte Carlo simulator that, given current standings and races remaining, simulates thousands of possible remaining race outcomes and returns empirical win probabilities for all four players, along with updated fair values for all eight contracts traded in the Jump Trading round.

### Goal

Give the team a fast, accurate source of fair values that updates between races, so order entry on the exchange is driven by math rather than intuition.

---

## 2. Context

### Competition constraints

- No pre-coded trading bots are permitted. This tool is a **decision-support calculator only** — it displays fair values and the trader manually enters orders.
- The tool must run entirely in-browser with no server or internet dependency (the competition venue uses eduroam and network reliability is uncertain).
- The tool will be used on a single laptop during a live event. Latency between race result and updated fair values must be under 5 seconds.

### Contracts traded

| Contract | Settlement |
|---|---|
| W1 | 100 if Player 1 has highest point total, else 0 |
| W2 | 100 if Player 2 has highest point total, else 0 |
| W3 | 100 if Player 3 has highest point total, else 0 |
| W4 | 100 if Player 4 has highest point total, else 0 |
| MAX | Highest point total of any human player |
| MIN | Lowest point total of any human player |
| DIFF | MAX minus MIN |
| TOPBOT | Highest point total of any bot player |

### Points per race

1st: 15 · 2nd: 12 · 3rd: 10 · 4th: 9 · 5th: 8 · 6th: 7 · 7th: 6 · 8th: 5 · 9th: 4 · 10th: 3 · 11th: 2 · 12th: 1

---

## 3. Simulation Design

### Core logic

For each simulation run:

1. For each remaining race, sample a finishing position for each of the four human players from a configurable probability distribution over positions 1–12.
2. Positions must be sampled without replacement within a single race (two players cannot finish in the same position).
3. Add the corresponding points to each player's current score.
4. After all remaining races are simulated, determine the winner (highest total), MAX, MIN, DIFF, and TOPBOT.
5. Repeat N times (target: 50,000 runs). Aggregate results into empirical probabilities.

### Position distribution

The simulator requires a prior over finishing positions for each human player. Two modes are needed:

**Uniform mode (default):** Each player is equally likely to finish in any position 1–12 not already claimed by another player in that race. Use this when no player skill information is available.

**Skill-weighted mode:** Each player is assigned a skill weight (1–5 scale, user input). Higher skill shifts the distribution toward better finishing positions using a configurable weighting function. The exact function does not need to be statistically rigorous — it just needs to be directionally correct and adjustable.

The skill weights are the main subjective input. The team should update them after observing Race 1 performance.

### Bot handling (TOPBOT contract)

**Confirmed:** All 8 bots participate in all 4 races. **Confirmed:** TOPBOT settles to the single highest cumulative point total across all 8 bots at the end of all 4 races.

Bots occupy the remaining 8 positions in each simulated race (positions not taken by human players). For each simulation run, track the cumulative score of each bot across all remaining races and record the maximum. Bot position distribution should default to uniform over the unoccupied slots, with an option to bias bots toward middle positions (3–8) to reflect observed MK8 AI behavior on 150cc. The bot bias setting should be updated after Race 1 once actual bot performance is observable.

### Tie-breaking

**Confirmed rule:** In the event of a tie on total points, all W contracts tied for the highest score resolve to 100. Multiple W contracts can simultaneously settle to 100.

Implications for simulation:
- In each simulation run, identify the highest total score among the four players. Any player matching that score is counted as a winner for their W contract.
- W fair values are therefore independent expected values, not a zero-sum allocation — they no longer need to sum to 100 in the presence of tie probability. In practice ties will be rare given the points distribution, but the sum of W fair values may slightly exceed 100. Do not normalize W values. Remove the "sum must equal 100" check and replace it with a display of the raw sum, with a note that values above 100 reflect tie probability.
- The more players are bunched in the standings, the higher the tie probability and the further the W sum will exceed 100. This is correct and tradeable information.

---

## 4. Functional Requirements

### F1 — Standings input

- Four labeled player rows (Player 1 through Player 4), each with a current score input field.
- Four race result columns (R1–R4), each with a position input (1–12) per player. Entering a position auto-fills the points for that race.
- Races completed counter (0–4) that determines how many races are simulated forward.
- All inputs update fair values in real time on change.

### F2 — Skill weight inputs

- One slider per player, range 1–5, default 3 (neutral/uniform).
- Sliders are labelled with the implied prior: at 3, finishing position is approximately uniform; at 5, strongly skewed toward top 4; at 1, skewed toward bottom half.
- Sliders should be visually distinct from the score inputs so the operator doesn't confuse them mid-round.

### F3 — Simulation output

Display the following for all eight contracts, updated after each simulation run:

- Fair value (the simulated expected settlement value)
- Suggested bid (fair value minus a configurable spread, default 2)
- Suggested ask (fair value plus a configurable spread, default 2)
- A simple bar or colour indicator showing confidence (width of 90% confidence interval across simulation runs, computed by running the simulation twice and comparing)

The W1–W4 fair values may sum to slightly above 100 due to tie probability — this is correct behaviour. Display the live sum alongside the W values with a label indicating that any excess above 100 represents estimated tie probability. No warning is needed unless the sum exceeds 110, which would suggest a simulation error.

### F4 — Simulation controls

- Run simulation button (triggers a fresh 50,000-run batch).
- Auto-run toggle: if enabled, re-runs simulation automatically whenever any input changes, after a 300ms debounce.
- Simulation count selector: 10,000 / 50,000 / 100,000 runs. Lower counts for speed during live trading; higher for pre-race preparation.
- Progress indicator while simulation is running (a simple spinner or progress bar is sufficient).

### F5 — Spread control

- A single numeric input for the spread half-width (default: 2).
- Applied symmetrically to all contracts: bid = FV − spread, ask = FV + spread.
- The operator may want to widen spreads on uncertain contracts (e.g. TOPBOT) — a per-contract override would be a nice-to-have but is not required.

### F6 — Points reference panel

- A collapsed/expandable panel showing the full 1st–12th points table.
- Visible at all times if screen space allows, otherwise accessible via a toggle.

### F7 — Reset and undo

- Clear all scores button: resets all inputs to zero, races completed to 0.
- Undo last race: removes the most recently entered set of race positions (one race at a time).

---

## 5. Non-Functional Requirements

### Performance

- Simulation must complete in under 3 seconds for 50,000 runs on a standard laptop in Chrome.
- Use a Web Worker for the simulation loop so the UI does not block during computation.
- If Web Workers are unavailable (unlikely but possible), fall back to synchronous execution with a reduced default run count (10,000).

### Reliability

- The tool must work fully offline. No CDN dependencies, no API calls.
- All logic must be self-contained in a single HTML file for easy deployment (open the file in Chrome, use immediately).
- No build step required.

### Usability

- The tool must be operable by one person while also watching a live Mario Kart race on another screen.
- Input targets (score fields, position dropdowns) must be large enough to click accurately under time pressure.
- Font sizes must be readable at arms length from a laptop screen.
- The most important output — the fair value for each contract — must be the most visually prominent element on the page.

---

## 6. Out of Scope

- Automated order submission to the exchange (explicitly prohibited by competition rules).
- Historical data or persistence across sessions (not needed for a single competition day).
- Multiplayer / shared state between team members' laptops.
- Support for browsers other than Chrome.
- Mobile or tablet layout.

---

## 7. Open Questions

| # | Question | Owner | Priority |
|---|---|---|---|
| 1 | What exactly happens at settlement if two players tie on points? Does the exchange have a tiebreaker rule, or do both W contracts settle to 100? | Clarify with HUTC organizers before competition | High |
| 2 | Are bots guaranteed to participate in all 4 races, or can they be eliminated / drop out? | Check MK8 rules | Medium |
| 3 | What is the exact TOPBOT settlement rule — is it the single highest-scoring bot, or the highest bot score in any single race? | Re-read problem statement | High |
| 4 | Is the skill-weighted position distribution worth the added complexity, or should we just use uniform and adjust manually? | Team decision | Low |
| 5 | Should DIFF be simulated directly (MAX_sim − MIN_sim) or derived from the MAX and MIN distributions independently? Simulating directly is more accurate since MAX and MIN are correlated. | Implementation decision | Medium |

---

## 8. Suggested Implementation Notes

These are not requirements but observations that will affect implementation:

**On sampling without replacement:** The simplest correct approach is to generate a random permutation of positions 1–12 for each race, then assign the first four positions to the human players (weighted by skill) and the remaining eight to bots. This automatically enforces the no-duplicate-position constraint.

**On DIFF simulation:** DIFF must be computed directly within each simulation run as final_MAX − final_MIN for that run, then averaged across runs. Deriving it from the marginal MAX and MIN distributions independently would ignore the correlation between them (the same player who scores highest tends to push DIFF wide at the same time the lowest scorer pulls it wide), producing an understated fair value. Direct simulation captures this correctly.

**On the W contract sum:** Because ties cause multiple W contracts to resolve to 100 simultaneously, W fair values are independent expected values and will sum to slightly above 100 when tie probability is non-trivial. Do not normalize. The sum is meaningful — display it in the UI so the operator can gauge how much tie probability the simulation is detecting. A sum of 102 means roughly a 2% chance of at least one tie scenario.

**On TOPBOT variance:** TOPBOT has the highest variance of any contract because it depends on 8 bot positions across 4 races. The confidence interval will be wide, especially early in the tournament. The spread on TOPBOT should probably be wider than the default 2 — consider defaulting TOPBOT spread to 4 or 5. Crucially, after Race 1 you have real data on bot performance — update the bot bias slider immediately, as this will significantly narrow TOPBOT's uncertainty.

**On Web Worker communication:** Pass the full simulation inputs (current scores, races completed, skill weights, bot bias, N runs) as a serializable object to the worker. The worker returns the full output object (all eight fair values plus confidence intervals). Keep the worker stateless.

---

## 7. Open Questions

All questions from the original draft have been resolved:

| # | Question | Resolution |
|---|---|---|
| 1 | Tie settlement rule | All W contracts tied for highest resolve to 100. W sum can exceed 100. |
| 2 | Bots in all races? | Confirmed — all 8 bots race in all 4 races. |
| 3 | TOPBOT definition | Single highest cumulative bot score across all 4 races. |
| 4 | Skill weighting worth the complexity? | Yes — include skill-weighted mode. |
| 5 | DIFF simulation method | Simulate directly (MAX_sim − MIN_sim per run). Do not derive independently. |

No open questions remain. PRD is ready for implementation.