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

### 2. Named persistent entities
`world_state.world_entities` is the registry for durable named places and objects such as bridges, roads, settlements, ruins, monuments, institutions, discoveries, and other lasting world features.

Each entity should have:
- a stable id
- a human-readable name
- type and status
- creation/completion day and era
- location when relevant
- origin (`player_built`, `world_event`, `discovery`, etc.)
- important creator/completer attribution when known
- structured history entries
- `persistent: true` when it should remain part of the world until an in-world event changes it

Do not silently replace an entity's history. Append a new history entry when it changes state.

### 3. Player history
Players and inventory persist across visits. Player activity should create server-side events whenever it can meaningfully affect future evolution.

### 4. Event history
`world_events` is the append-only history of meaningful player/world actions. Daily evolution should inspect recent events and prefer consequences of actual player behavior over arbitrary additions.

### 5. Snapshots
World snapshots are stored as `world_snapshot_day_N` entries in `world_state`, with `latest_world_snapshot` pointing at the newest completed snapshot.

Snapshots are compact summaries, not replacements for the event log. They should include:
- snapshot version
- world day and era
- captured time
- durable world/project state
- referenced persistent entity ids
- the last event id included (`event_cursor`)

Create a snapshot after a meaningful world-day transition is successfully implemented and deployed. Never advance `latest_world_snapshot` for a failed or partial day.

### 6. Evolution runs
Each automated evolution should eventually record what day it attempted, what evidence influenced the decision, what changed, whether deployment succeeded, and which commit implemented it.

## Daily evolution contract

Every daily update should:

1. Read the current world state.
2. Read named persistent entities and the latest snapshot.
3. Read recent player/world events after the latest snapshot cursor when practical.
4. Check unfinished and completed shared projects.
5. Preserve player identity, inventory, location, and prior history.
6. Choose one primary evolution that follows from existing systems/history.
7. Prefer consequences over unrelated new features.
8. Keep persistent player-built results visibly represented in the game.
9. Update an existing entity instead of creating a duplicate when the same place/object changes.
10. Test existing gameplay before declaring the next day complete.
11. Record meaningful history in `CHRONICLE.md`.
12. Create/update the new day's snapshot only after playable implementation and deployment succeed.
13. Never advance the world-day number if deployment fails.

## Current first persistent entity

Day 2 established **The Western Crossing** as GPTWorld's first named persistent entity. Its completion is preserved in both the world event log and the entity registry, and the Day 2 snapshot records it as part of the lasting world.

## Long-term rule

A player joining years later should enter the same historical world. Roads, bridges, ruins, settlements, discoveries, names, institutions, and other meaningful player-caused changes should persist until an in-world event deliberately changes them.

## Player-facing living memory

World memory must not remain a private database log. The live game exposes:

- active pressures derived from recent player behavior;
- readable cause → consequence chains;
- possible future consequences clearly labeled as possibilities, not completed facts;
- creator and aging information on inspectable player-made landmarks;
- permanent outcomes only after the corresponding shared state actually changes.

The AI evolution process should use the same evidence players can inspect. This keeps world changes understandable, defensible, and connected to play instead of feeling random.
