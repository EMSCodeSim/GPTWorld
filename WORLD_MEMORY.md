# GPTWorld — Long-Term World Memory

GPTWorld keeps daily evolution, but daily changes must accumulate into one persistent world rather than becoming disconnected features.

## Current cadence

- Daily: one small, meaningful world evolution.
- Weekly: review whether systems are deepening or merely multiplying.
- Monthly: summarize the month's lasting consequences in the Chronicle.
- Era changes: occur only when world conditions justify them, not because a calendar date arrives.

## Memory layers

### 1. Current world state
`world_state` contains the authoritative facts needed by the live game: current day, current era, active projects, completed projects, and other persistent shared state.

### 2. Player history
Players and inventory persist across visits. Player activity should create server-side events whenever it can meaningfully affect future evolution.

### 3. Event history
`world_events` is the append-only history of meaningful player/world actions. Daily evolution should inspect recent events and prefer consequences of actual player behavior over arbitrary additions.

### 4. Snapshots
Periodic snapshots preserve a compact picture of the world at important moments. These will support long-term history, Day 1 → Day 365 comparisons, recovery, and later timelapse/history features.

### 5. Evolution runs
Each automated evolution should eventually record what day it attempted, what evidence influenced the decision, what changed, whether deployment succeeded, and which commit implemented it.

## Daily evolution contract

Every daily update should:

1. Read the current world state.
2. Read recent player/world events.
3. Check unfinished and completed shared projects.
4. Preserve player identity, inventory, location, and prior history.
5. Choose one primary evolution that follows from existing systems/history.
6. Prefer consequences over unrelated new features.
7. Keep persistent player-built results visibly represented in the game.
8. Test existing gameplay before declaring the next day complete.
9. Record meaningful history in `CHRONICLE.md`.
10. Never advance the world-day number if deployment fails.

## Long-term rule

A player joining years later should enter the same historical world. Roads, bridges, ruins, settlements, discoveries, names, institutions, and other meaningful player-caused changes should persist until an in-world event deliberately changes them.
