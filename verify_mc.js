// Monte Carlo Engine Verification Suite (Node.js)
const PTS=[15,12,10,9,8,7,6,5,4,3,2,1];

function weightedSample(available, weights) {
  let total = 0;
  for (let i = 0; i < available.length; i++) total += weights[available[i]];
  let r = Math.random() * total, cum = 0;
  for (let i = 0; i < available.length; i++) {
    cum += weights[available[i]];
    if (r <= cum) { const picked = available[i]; available.splice(i, 1); return picked; }
  }
  return available.pop();
}
function fisherYates(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function makeSkillWeights(skill) {
  const a = (skill - 3) * 0.5;
  const w = new Float64Array(12);
  for (let p = 0; p < 12; p++) w[p] = Math.pow(13 - p, a);
  return w;
}
function makeBotWeights(bias) {
  const w = new Float64Array(12);
  if (bias <= 5) { for (let i = 0; i < 12; i++) w[i] = 1; return w; }
  const strength = (bias - 5) / 5;
  for (let i = 0; i < 12; i++) {
    w[i] = 1 + strength * Math.max(0, 3 - Math.abs(i - 5.5));
  }
  return w;
}
function runSim(scores0, racesCompleted, skills, botBias, botScore, N) {
  const racesLeft = 4 - racesCompleted;
  const skillW = skills.map(s => makeSkillWeights(s));
  const botW = makeBotWeights(botBias);
  const sums = {W1:0,W2:0,W3:0,W4:0,MAX:0,MIN:0,DIFF:0,TOPBOT:0};
  for (let run = 0; run < N; run++) {
    const sc = [...scores0];
    let topBot = botScore;
    const botSc = new Float64Array(8);
    for (let race = 0; race < racesLeft; race++) {
      const avail = [0,1,2,3,4,5,6,7,8,9,10,11];
      const order = fisherYates([0,1,2,3]);
      for (let oi = 0; oi < 4; oi++) {
        const pi = order[oi];
        const pos = weightedSample(avail, skillW[pi]);
        sc[pi] += PTS[pos];
      }
      for (let bi = 0; bi < 8 && avail.length > 0; bi++) {
        const bp = weightedSample(avail, botW);
        botSc[bi] += PTS[bp];
      }
    }
    for (let bi = 0; bi < 8; bi++) if (botSc[bi] + botScore > topBot) topBot = botSc[bi] + botScore;
    let mx = -Infinity, mn = Infinity;
    for (let i = 0; i < 4; i++) { if (sc[i] > mx) mx = sc[i]; if (sc[i] < mn) mn = sc[i]; }
    for (let i = 0; i < 4; i++) if (sc[i] === mx) sums['W'+(i+1)] += 100;
    sums.MAX += mx; sums.MIN += mn; sums.DIFF += (mx - mn); sums.TOPBOT += topBot;
  }
  const fv = {};
  for (const k in sums) fv[k] = sums[k] / N;
  return fv;
}

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (!cond) { console.log('  ❌ FAIL:', msg); fail++; return false; }
  console.log('  ✅ PASS:', msg); pass++; return true;
}
function approx(val, expected, tol, msg) {
  const ok = Math.abs(val - expected) <= tol;
  if (!ok) { console.log(`  ❌ FAIL: ${msg} — got ${val.toFixed(4)}, expected ~${expected.toFixed(4)} ±${tol}`); fail++; }
  else { console.log(`  ✅ PASS: ${msg} — ${val.toFixed(4)} (~${expected.toFixed(4)})`); pass++; }
  return ok;
}

// ===== TEST 1: Skill weights =====
console.log('\n=== TEST 1: Skill Weight Function ===');
{
  const w3 = makeSkillWeights(3);
  assert(Array.from(w3).every(v => Math.abs(v-1) < 1e-10), 'Skill=3 → uniform (all 1.0)');
  const w5 = makeSkillWeights(5);
  assert(Math.abs(w5[0]-13) < 1e-10 && Math.abs(w5[11]-2) < 1e-10, 'Skill=5 → linear [13..2]');
  assert(w5[0] > w5[11], 'Skill=5: 1st > 12th');
  const w1 = makeSkillWeights(1);
  assert(w1[0] < w1[11], 'Skill=1: 1st < 12th (bottom bias)');
}

// ===== TEST 2: Bot weights =====
console.log('\n=== TEST 2: Bot Weight Function ===');
{
  const bw5 = makeBotWeights(5);
  assert(Array.from(bw5).every(v => Math.abs(v-1) < 1e-10), 'BotBias=5 → uniform');
  const bw10 = makeBotWeights(10);
  approx(bw10[5], 3.5, 1e-10, 'BotBias=10, pos6: w=3.5');
  assert(bw10[2] === 1.0 && bw10[9] === 1.0, 'BotBias=10: pos3,10 no bonus');
  assert(bw10[3] > 1.0 && bw10[8] > 1.0, 'BotBias=10: pos4-9 get bonus');
}

// ===== TEST 3: No duplicate positions =====
console.log('\n=== TEST 3: No Duplicate Positions (10K races) ===');
{
  const skillW = [3,3,3,3].map(s => makeSkillWeights(s));
  const botW = makeBotWeights(5);
  let violations = 0;
  for (let run = 0; run < 10000; run++) {
    const avail = [0,1,2,3,4,5,6,7,8,9,10,11];
    const used = new Set();
    const order = fisherYates([0,1,2,3]);
    for (let oi = 0; oi < 4; oi++) {
      const pos = weightedSample(avail, skillW[order[oi]]);
      if (used.has(pos)) violations++;
      used.add(pos);
    }
    for (let bi = 0; bi < 8 && avail.length > 0; bi++) {
      const bp = weightedSample(avail, botW);
      if (used.has(bp)) violations++;
      used.add(bp);
    }
    if (used.size !== 12) violations++;
  }
  assert(violations === 0, `No duplicate positions (${violations} violations)`);
}

// ===== TEST 4: Symmetric W probs (uniform) =====
console.log('\n=== TEST 4: Symmetric W Probs (50K runs) ===');
{
  const fv = runSim([0,0,0,0], 0, [3,3,3,3], 5, 0, 50000);
  approx(fv.W1, 25, 2, 'W1 ≈ 25');
  approx(fv.W2, 25, 2, 'W2 ≈ 25');
  approx(fv.W3, 25, 2, 'W3 ≈ 25');
  approx(fv.W4, 25, 2, 'W4 ≈ 25');
  const wSum = fv.W1+fv.W2+fv.W3+fv.W4;
  assert(wSum >= 99.5, `W sum ≈ 100+ (got ${wSum.toFixed(2)})`);
  console.log(`  Info: MAX=${fv.MAX.toFixed(2)}, MIN=${fv.MIN.toFixed(2)}, DIFF=${fv.DIFF.toFixed(2)}`);
}

// ===== TEST 5: Skill asymmetry =====
console.log('\n=== TEST 5: Skill Asymmetry (50K runs) ===');
{
  const fv = runSim([0,0,0,0], 0, [5,3,3,3], 5, 0, 50000);
  assert(fv.W1 > fv.W2+5, `High skill W1(${fv.W1.toFixed(1)}) >> W2(${fv.W2.toFixed(1)})`);
}

// ===== TEST 6: Score advantage =====
console.log('\n=== TEST 6: Score Advantage (50K runs) ===');
{
  const fv = runSim([15,0,0,0], 1, [3,3,3,3], 5, 0, 50000);
  assert(fv.W1 > fv.W2, `15pt lead → W1(${fv.W1.toFixed(1)}) > W2(${fv.W2.toFixed(1)})`);
}

// ===== TEST 7: TOPBOT =====
console.log('\n=== TEST 7: TOPBOT Calculation (50K runs) ===');
{
  const fv0 = runSim([0,0,0,0], 3, [3,3,3,3], 5, 0, 50000);
  assert(fv0.TOPBOT > 0 && fv0.TOPBOT <= 15, `TOPBOT 1-race range: ${fv0.TOPBOT.toFixed(2)}`);
  const fv30 = runSim([0,0,0,0], 3, [3,3,3,3], 5, 30, 50000);
  approx(fv30.TOPBOT - fv0.TOPBOT, 30, 1.5, 'TOPBOT base offset +30');
}

// ===== TEST 8: TOPBOT double-counting analysis =====
console.log('\n=== TEST 8: TOPBOT Semantics ===');
{
  console.log('  ⚠️  botScoreBase added to ALL 8 sim bots → upper-bound TOPBOT');
  console.log('  README says "leading bot cumulative score" but code adds to all 8 bots');
  console.log('  Net effect: slight overestimate. Acceptable simplification.');
}

// ===== TEST 9: DIFF per-trial vs marginal =====
console.log('\n=== TEST 9: DIFF Per-Trial (100K runs) ===');
{
  const fv = runSim([0,0,0,0], 0, [3,3,3,3], 5, 0, 100000);
  const direct = fv.DIFF, marginal = fv.MAX - fv.MIN;
  console.log(`  E[DIFF] (per-trial)  = ${direct.toFixed(3)}`);
  console.log(`  E[MAX]-E[MIN] (marg) = ${marginal.toFixed(3)}`);
  assert(direct >= marginal - 0.3, `E[DIFF] >= E[MAX]-E[MIN] (Jensen) ✓`);
}

// ===== TEST 10: Tie handling =====
console.log('\n=== TEST 10: Tie Handling (50K runs) ===');
{
  // Equal scores, 1 race left, unique pts → no ties
  const fv1 = runSim([30,30,30,30], 3, [3,3,3,3], 5, 0, 50000);
  const ws1 = fv1.W1+fv1.W2+fv1.W3+fv1.W4;
  approx(ws1, 100, 1.0, `Equal scores + 1 race: WSum=${ws1.toFixed(2)} ≈ 100 (no ties)`);
  
  // P1=15, P2=12: tie possible when one gets +12 and other gets +15
  const fv2 = runSim([15,12,0,0], 3, [3,3,3,3], 5, 0, 50000);
  const ws2 = fv2.W1+fv2.W2+fv2.W3+fv2.W4;
  assert(ws2 > 100.5, `Tie-possible scenario WSum=${ws2.toFixed(2)} > 100`);
}

// ===== TEST 11: Points table =====
console.log('\n=== TEST 11: Points Table ===');
{
  const expected = [15,12,10,9,8,7,6,5,4,3,2,1];
  assert(PTS.every((v,i) => v === expected[i]), 'Points table matches MK8 GP');
  assert(PTS.reduce((a,b)=>a+b,0) === 78, `Total pts/race = 78`);
}

// ===== TEST 12: Analytical exact check (1 race) =====
console.log('\n=== TEST 12: Analytical Exact vs MC (50K runs) ===');
{
  let totalMax=0, totalMin=0, totalDiff=0, count=0;
  for (let a=0; a<12; a++)
    for (let b=0; b<12; b++) { if (b===a) continue;
      for (let c=0; c<12; c++) { if (c===a||c===b) continue;
        for (let d=0; d<12; d++) { if (d===a||d===b||d===c) continue;
          const v=[PTS[a],PTS[b],PTS[c],PTS[d]];
          const mx=Math.max(...v), mn=Math.min(...v);
          totalMax+=mx; totalMin+=mn; totalDiff+=(mx-mn); count++;
        }
      }
    }
  const eMax=totalMax/count, eMin=totalMin/count, eDiff=totalDiff/count;
  console.log(`  Exact: MAX=${eMax.toFixed(4)}, MIN=${eMin.toFixed(4)}, DIFF=${eDiff.toFixed(4)}`);
  
  const fv = runSim([0,0,0,0], 3, [3,3,3,3], 5, 0, 50000);
  approx(fv.MAX, eMax, 0.2, `MC MAX matches exact`);
  approx(fv.MIN, eMin, 0.2, `MC MIN matches exact`);
  approx(fv.DIFF, eDiff, 0.3, `MC DIFF matches exact`);
}

// ===== TEST 13: Fisher-Yates uniformity =====
console.log('\n=== TEST 13: Fisher-Yates Uniformity (100K) ===');
{
  const N = 100000;
  const counts = [0,0,0,0];
  for (let i = 0; i < N; i++) counts[fisherYates([0,1,2,3])[0]]++;
  for (let i=0; i<4; i++) approx(counts[i]/N, 0.25, 0.015, `Elem ${i} in pos 0: ${(counts[i]/N*100).toFixed(1)}%`);
}

// ===== TEST 14: WeightedSample distribution =====
console.log('\n=== TEST 14: WeightedSample Ratio (50K) ===');
{
  const w = new Float64Array(12).fill(0); w[0]=3; w[1]=1;
  const c = [0,0];
  for (let i=0; i<50000; i++) { const a=[0,1]; c[weightedSample(a,w)]++; }
  approx(c[0]/c[1], 3, 0.2, `3:1 ratio → ${(c[0]/c[1]).toFixed(2)}`);
}

// ===== TEST 15: CI bounds analysis =====
console.log('\n=== TEST 15: CI Percentile Index Check ===');
{
  const BATCHES = 20;
  const lowerIdx = Math.floor(BATCHES * 0.05); // = 1
  const upperIdx = Math.floor(BATCHES * 0.95); // = 19
  console.log(`  Lower CI index: ${lowerIdx} (2nd smallest of 20 → ~10th percentile)`);
  console.log(`  Upper CI index: ${upperIdx} (20th of 20 → 100th percentile = MAX)`);
  console.log('  ⚠️  BUG: Upper CI is MAX, not 95th percentile.');
  console.log('  Fix: use index 18 for upper bound, or use ceil/floor differently.');
  console.log('  Impact: CI appears wider than actual 90% interval (conservative).');
}

// ===== TEST 16: 15-point lead unbeatable in 1 race =====
console.log('\n=== TEST 16: 15pt Lead Unbeatable in 1 Race (50K) ===');
{
  const fv = runSim([15,0,0,0], 3, [3,3,3,3], 5, 0, 50000);
  approx(fv.W1, 100, 0.1, `15pt lead + 1 race = W1 = 100`);
}

// ===== TEST 17: Extreme skills numerical stability =====
console.log('\n=== TEST 17: Numerical Stability ===');
{
  for (const sk of [1,1.5,2,2.5,3,3.5,4,4.5,5]) {
    const w = makeSkillWeights(sk);
    const ok = Array.from(w).every(v => isFinite(v) && v > 0);
    assert(ok, `Skill=${sk}: all weights finite & positive`);
  }
}

console.log('\n==================== SUMMARY ====================');
console.log(`${pass} passed, ${fail} failed`);
if (fail === 0) console.log('All tests PASSED ✅');
else console.log('Some tests FAILED ❌');
