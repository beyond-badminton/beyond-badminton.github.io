# Tournament Generator — Project Context

## Overview
A client-side (vanilla JS + HTML + CSS) badminton tournament generator.
Generates **2 vs 2** doubles matches for a group of players on available courts.
No build step, no framework — plain files opened directly in the browser.
State is persisted via `localStorage`.

## File Structure
```
tournament-generator.html   # Single-page app shell, all tabs
assets/
  css/styles.css       # All styles
  js/
    init.js            # App bootstrap, tab switching
    common.js          # Shared utilities / helpers
    all-players.js     # "All Players" tab — master player list
    active-players.js  # "Active Players" tab — players entering the current tournament
    courts.js          # "Courts" tab — court names + court availability blocks
    schedule.js        # "Schedule" tab — generated matches + stats
    schedule.export.js # "Schedule" tab — print/export functions
```

## Tabs
| Tab | File | Description |
|-----|------|-------------|
| All Players | `all-players.js` | Master list of known players (persisted). Add / remove players. |
| Active Players | `active-players.js` | Subset of all players participating in the current tournament. |
| Courts | `courts.js` | (1) Define court names, (2) add availability blocks (start time + duration + courts). |
| Schedule | `schedule.js` | Will schedule a round-robin / random match schedule (2v2). |

## Key Data Shapes (localStorage)
- **Court names** — `{ id: number, name: string }[]`
- **Court blocks** — `{ id: number, start: "HH:MM", duration: number (mins), courts: string[] }[]`

## Domain Rules
- Matches are always **2 vs 2** (doubles badminton).
- A court name cannot be removed if it is referenced by an existing availability block.
- Court availability blocks define *when* and *which* courts are free.

## Conventions
- Storage keys are prefixed `tournament-generator:`.
- Validation uses `.invalid` CSS class toggled on field wrapper elements.
- "Chip" UI for list items, "checkbox-pill" for court selection.

## Schedule Tab — Generate Algorithm

### Approach: Monte Carlo with Penalty Scoring
The generator runs **many random tournament simulations** and keeps the one with the **lowest total penalty score**.

### High-level flow
1. Read active players (with skill levels) + court availability blocks.
2. For each block: determine how many courts are available → how many simultaneous matches → how many players can play (`courts × 4`). Remaining players sit on the bench.
3. Run **N iterations** (e.g. 1000–5000), each producing a fully randomized schedule.
4. Score each schedule by summing all penalties.
5. Output the schedule with the **lowest total penalty**.

---

### Bench / Sitting-out Rules
- If `activePlayers > availableCourts × 4`, some players must sit each round.
- **Minimum required sits** = 
distribute sit-outs as evenly as possible across all players.

- Penalties:

| Situation | Penalty |
|-----------|---------|
| Player sits more rounds than the minimum required | medium penalty per extra sit |
| Player sits **two rounds in a row** | **very high penalty** |

---

### Team Balancing (Skill)
- Each player has a **skill level** (numeric).
- A match is `(A + B) vs (C + D)`. Ideal: `sum(A,B) == sum(C,D)`.
- Penalties based on skill difference between the two teams:

| Skill diff | Penalty |
|------------|---------|
| 0 | 0 |
| ±1 | small |
| ±2 | medium |
| ±3+ | large, scales up with diff |

---

### Pair / Opponent Repetition
The generator tracks a **match history matrix** across all rounds of the tournament:
- `sameTeam[i][j]` — how many times players i and j were on the **same team**
- `opponent[i][j]` — how many times players i and j **faced each other**

Penalties:

| Situation | Penalty |
|-----------|---------|
| Two players assigned to the **same team again** | **high penalty** per repeat |
| Two players assigned as **opponents again** | small/medium penalty per repeat |

---

### Total Tournament Penalty
```
totalPenalty =
    Σ bench penalties (extra sits + consecutive sits)
  + Σ skill imbalance penalties (per match)
  + Σ same-team repeat penalties (per match)
  + Σ opponent repeat penalties (per match)
```

The run with the **lowest otalPenalty** is selected as the final schedule.

---

### Implementation Notes
- `assets/js/schedule.js` — Monte Carlo engine + UI for the Schedule tab.
- Penalty weights should be tunable constants at the top of the file.
- The history matrices reset per tournament generation (not persisted).

---

## Generator Optimization — Guided Initialization

Instead of pure random, the generator uses a **3-phase approach** to reduce the search space and iteration count.

### Phase 1 — Deterministic bench assignment
- Pre-compute a round-robin sit-out schedule **before** any randomization.
- Distribute sit-outs so every player sits the minimum required number of times, evenly spread across rounds, with **no consecutive sits** guaranteed.
- This is solved deterministically (similar to a round-robin rotation table).
- Result: bench penalties are effectively **0** from the start — Monte Carlo does not need to search this space at all.

### Phase 2 — Guided random (only active players per round)
- For each round, the set of playing players is already known from Phase 1.
- Only randomize the assignment of those players into 2v2 teams, optimizing for:
  - Skill balance between teams
  - Minimizing same-team and opponent repeats
- The randomization space is **much smaller** (shuffling N active players into teams vs. shuffling all players including bench).

### Phase 3 — Reduced Monte Carlo
- Because the starting point is already near-valid, far fewer iterations are needed.
- Target: **200–500 iterations** instead of 1000–5000.
- Same penalty scoring applies, but convergence is faster and results are better on average.

### Summary of gains
| Concern | Pure random | Guided init |
|---|---|---|
| Bench fairness | Needs many iterations | Solved deterministically |
| Skill balance | Searched randomly | Searched randomly (smaller space) |
| Pair/opponent variety | Searched randomly | Searched randomly (smaller space) |
| Iterations needed | 1000–5000 | 200–500 |

---

## Generator Optimization — Pre-seeding Strategies

Using smart seeds means Monte Carlo acts as a **local search / hill climber** around an already-good solution rather than exploring the full random space. Target iterations drops to **50–100**.

### Seed 1 — Skill snake draft (team balance)
- Sort active players in each round by skill descending: `[5, 4, 4, 3, 3, 2, 2, 1]`
- Snake-assign into matches so highest + lowest vs second + third-lowest → naturally balanced teams from the start.
- Monte Carlo then only needs to **swap players between matches** rather than rebuild from scratch.

### Seed 2 — Fresh pair priority (same-team history)
- Before randomizing teams, build a priority list of pairs where `sameTeam[i][j] == 0` (never played together).
- Prefer those pairs as partners first; only fall back to repeat pairs when no fresh ones remain.

### Seed 3 — Fresh opponent priority (opponent history)
- Similarly, prefer cross-match assignments where `opponent[i][j]` is lowest.
- Seed the match-up from least-seen opponents across the current round.

### Combined seeding pipeline
```
Phase 1 (deterministic):  bench rotation — even, no consecutive sits
Phase 2 (seeded):         skill snake draft
                          → prefer fresh same-team pairs
                          → prefer fresh opponents
Phase 3 (Monte Carlo):    mutate via player swaps around the seeded solution
                          score penalties, keep best
                          target: 50–100 iterations
```

### Monte Carlo mutation types
Small targeted mutations work best on a seeded solution:
- **Swap two players between different matches** in the same round
- **Swap partners within a match** (A+B vs C+D → A+C vs B+D)
- **Swap a playing player with a bench player** (only if it doesn't break bench fairness)

---

## Actual Data Shapes (from source)

### All Players — `tournament-generator:allPlayers`
```js
{ id: number, name: string, skill: '1' | '2' | '3' }
```
- Skill labels: `1` = Beginner, `2` = Intermediate, `3` = Advanced
- Next ID key: `tournament-generator:allPlayersNextId`

### Active Players — `tournament-generator:activePlayers`
```js
{ id: number, allPlayerId: number, arrival: "HH:MM", playtime: number }
```
- `arrival` — time the player arrives (dropdown: 08:00–20:00, 30-min steps)
- `playtime` — how many **hours** the player is available to play
- Player is available from `arrival` to `arrival + playtime hours`
- Next ID key: `tournament-generator:activePlayersNextId`

### Court Names — `tournament-generator:courtNames`
```js
{ id: number, name: string }
```
- Next ID key: `tournament-generator:courtNamesNextId`

### Court Blocks — `tournament-generator:courts`
```js
{ id: number, start: "HH:MM", duration: number (mins), courts: string[] }
```
- `courts` — array of court name strings selected for this block
- Next ID key: `tournament-generator:courtsNextId`

---

## Generator — Player Availability Constraint (important!)

Each active player has an **availability window**: `arrival` → `arrival + playtime`.
Court blocks also have a time window: `start` → `start + duration`.

The generator must **only assign a player to a match if their availability window covers that court block's time window** (or at minimum overlaps — TBD).

This means:
- Per court block, the set of **eligible players** is a subset of all active players.
- Bench assignment in Phase 1 must also respect availability — a player outside their window is not "on bench", they simply don't participate in that block at all.
- The generator needs to intersect player availability with court block times before building any round.

---

## Discard Tournament
- Clears: `activePlayers`, `courtBlocks`
- Keeps: `allPlayers`, `courtNames`
- Triggered by the "Discard" button in the UI

---

## Court Availability Over Time (important for generator!)

Court blocks are **not global** — each block defines which specific courts are available during a specific time window. The number of available courts can differ between blocks.

Example:
```
08:00–10:00 → [Court 1, Court 2]        (2 courts → max 8 players playing)
10:00–12:00 → [Court 1, Court 2, Court 3] (3 courts → max 12 players playing)
12:00–14:00 → [Court 2]                 (1 court  → max 4 players playing)
```

### Impact on generator
- The generator must process **each court block independently** — available courts, eligible players, bench size, and match count all vary per block.
- Per block:
  - `availableCourts` = `block.courts.length`
  - `eligiblePlayers` = active players whose availability window covers (or overlaps) this block
  - `playingSlotsPerBlock` = `availableCourts × 4`
  - `benchCount` = `max(0, eligiblePlayers.length - playingSlotsPerBlock)`
- Phase 1 bench rotation is computed **per block** based on that block's eligible players and court count.
- The history matrices (`sameTeam`, `opponent`) accumulate **across all blocks** — variety is tracked for the whole tournament, not just within a block.

---

## Edge Case — Fewer Players Than Available Court Slots

If `eligiblePlayers.length < availableCourts × 4`, do **not** try to fill all courts.
Instead, calculate how many full 2v2 matches can actually be played:

```
matchCount = Math.floor(eligiblePlayers.length / 4)
activeCourts = matchCount  // one match per court, use only as many courts as needed
bench = eligiblePlayers.length % 4  // leftover players sit out
```

Examples:
| Eligible players | Courts available | Matches played | Bench |
|-----------------|-----------------|---------------|-------|
| 16 | 4 | 4 | 0 |
| 13 | 4 | 3 | 1 |
| 10 | 4 | 2 | 2 |
| 7  | 4 | 1 | 3 |
| 3  | 4 | 0 | 3 (no matches generated for this block) |

- Courts are assigned to matches in order (Court 1 first, etc.) — unused courts are simply skipped.
- Bench penalties still apply: players who sit more than the minimum required still incur a penalty.
- If `matchCount == 0` for a block, skip that block entirely — no matches, no bench penalty.

---

## Generator Option — Allow Singles

A checkbox in the Schedule tab (`#allow-singles`).

**Default (unchecked):** Generator generates doubles only (matches 2x2 - 4 players)

**When checked:** if there are more court slots than eligible players to play doubles, allow to preffer to play singles in order to fill up the free courts

---

## Generator Tab — Round Duration Setting

A `<select>` (`#matches-per-hour`) in the Schedule tab with values from 2 to 8

- Used to compute how many rounds fit into each court block: `roundsPerBlock = floor(block.duration / roundDuration)`
- **Lenient rounding rule**: if the remaining time after full rounds is `>= roundDuration * 0.5`, squeeze in one extra round. E.g. 30-min block with 20-min rounds → `floor(30/20) = 1`, remainder = 10 min which is `>= 10` → **2 rounds accepted**.
- This is computed per block (blocks have different durations).
- Total rounds for a block = `roundsPerBlock × block.courts.length` simultaneous matches.

---

## Generator Tab — Penalty Score Display

After generation, display a **live penalty scoreboard** that updates whenever the user manually moves a player.

### Scoreboard shows:
| Row | Value |
|-----|-------|
| Bench fairness | current penalty / theoretical best (0) |
| Consecutive sits | current penalty / theoretical best (0) |
| Skill imbalance | current penalty / theoretical best (0) |
| Same-team repeats | current penalty / theoretical best (0) |
| Opponent repeats | current penalty / theoretical best (0) |
| **Total** | **sum / theoretical best** |

- **Theoretical best** is always `0` for each category (perfect schedule = no penalty) — display it as a fixed reference, not computed.
- Each category shows its current penalty value in real time.
- Colour-code: green when penalty = 0, yellow for small, red for high.
- Score updates **immediately** after any drag-and-drop move (no save button needed).

---

## Generator Tab — Editable Match Layout (Drag & Drop)

### Scope
- Players are draggable **within a single block only** — a player in Block 1 Round 2 cannot be dragged to Block 2, because the same person may appear in multiple blocks as a separate "instance".
- Within a block, dragging is allowed between: teams within a match, different matches, and the bench.

### Drag targets
| From | To | Result |
|------|----|--------|
| Team slot | Other team slot (same match) | Swap partners |
| Team slot | Team slot (different match) | Swap players between matches |
| Team slot | Bench | Player moves to bench, bench player (if any) swaps in |
| Bench | Team slot | Bench player takes that slot, displaced player goes to bench |

### Rules
- Every match must always have exactly 4 players (2v2). Moves are **swaps**, never one-way removals that leave empty slots — unless the target is the bench.
- Manual edits do **not** lock the schedule — pressing "Regenerate" will fully replace the schedule (with a confirmation prompt).
- After any move, penalty score recalculates live immediately.

---

## Generator Tab —  print CSS
- Use `@media print` stylesheet as the **primary export mechanism** — zero dependencies, no CDN needed, consistent with no-build-step convention.
- A **"Print"** button triggers `window.print()`.
- Print styles hide all UI controls (tabs, buttons, forms) and show only the generated schedule in a clean layout.


### Content
- One section per court block (header: time window e.g. `08:00 – 10:00`).
- One section per round within the block.
- Each match shows:
  - Court name (e.g. `Court 1`)
  - Team A: player names
  - Team B: player names
  - A blank box **between the two teams** for writing/displaying the match score
- If a score has been entered in the UI, it is included in the PDF export.
- Bench players listed at the end of each round.

### Score input in UI
- Each match card has a small score input (e.g. `__ : __`) between the two teams.
- Score is stored in memory (not persisted to localStorage — lost on page refresh).
- Score is displayed on the match card and included in PDF export if filled in.

---

## Generator Tab — UI Layout Summary

Controls (top of tab):
- `#matches-per-hour` — select number of matches per hour
- `#allow-singles` — checkbox
- "Schedule" button
- "Regenerate" button (with confirmation prompt, replaces current schedule)
- "Export PDF" button

Below controls:
- Penalty scoreboard (live)
- Generated schedule: grouped by block → by round → match cards with drag-and-drop

---

## Decisions & Clarifications (Aug 2026)

### 1. Player availability — based on match slots, not court blocks
- Player availability is sliced into **individual match-duration slots**, not court block windows.
- Example: court block 08:00–10:00, round duration 15 min → slots are 08:00, 08:15, 08:30 … 09:45 (8 slots).
- Player arrives 09:00 → skips first 4 slots (08:00–08:45), eligible from 09:00 → plays up to 4 slots.
- A player is **not bound to a specific court** — court name is only assigned at final match output so players know where to stand.

### 2. Minimum block duration
- If `block.duration < roundDuration` but `block.duration >= 10 minutes` → schedule one game anyway, no warning.
- Players have watches and will play faster. Only skip a block entirely if `block.duration < 10 minutes`.

### 3. Monte Carlo — Web Worker
- Max expected player count is **40**. With guided seeding + 50–100 iterations this may still cause a brief UI freeze.
- Run the Monte Carlo engine in a **Web Worker**.
- Show a **progress bar / spinner** in the Schedule tab while the worker runs.
- Worker posts the best schedule back to the main thread when done.

### 4. Player stats summary
- After generation, display a **per-player stats table** below the match schedule:
  - Columns: Player name, Matches played, Times on bench, Unique partners, Unique opponents
- Acts as a sanity check before exporting.

### 5. Score persistence
- Match scores **are persisted** to `localStorage` under key `tournament-generator:scores`.
- Format: `{ [matchId]: { a: number|null, b: number|null } }`
- An extra **"Clear all scores"** button clears only scores (does not touch matches or players).

### 6. Generated schedule persistence
- Generated schedule **is persisted** to `localStorage` under key `tournament-generator:schedule`.
- "Discard tournament" (existing button) clears everything including schedule and scores.
- A new **"Clear matches"** button in the Schedule tab clears only the generated schedule (and scores), without touching active players or courts.
- "Schedule" replaces any existing schedule (with confirmation prompt if one already exists).
