# Day 8 — The Western Firebreak

Repeated wildfire has crossed the valley while the settlement continues pushing timber work west. Day 8 turns that pressure into a cooperative defensive project instead of adding another source of raw materials.

## Playable Day 8 evolution

- A new shared **Western Firebreak** project becomes available along the Timber Line once the authoritative world day reaches 8.
- Travelers near the timber line can contribute their own saved wood and stone through an explicit server-authoritative action.
- Contributions are transaction-safe: accepted materials are deducted from persistent inventory in the same database statement that advances the shared project.
- The project requires **6 wood and 24 stone**.
- When the final materials are contributed, a cleared firebreak line and two boundary cairns are appended to persistent `render_entities` and become visible to future travelers.
- Completion and individual contributions are written to `world_events`.
- The project does not manually advance weather, disasters, ecology, regrowth, NPCs, or any other recurring system.
- The feature remains hidden while `current_day < 8`, so preparing/deploying code cannot itself advance narrative history.

## Core repair included before Day 8

Dynamic persistent resource nodes now inherit validated `x`/`z` coordinates from their `render_entities` definitions. This repairs the authoritative gathering-distance contract for the Western Survey and Timber Line without changing player inventory or resource history.

Existing resource-node records whose positions are null repair themselves on the next resource-state refresh from the persistent render definition. No destructive migration is required.

## Why this evolution

The forest remains at critical harvesting pressure after continued expansion, while the autonomous ecosystem recorded repeated wildfire disturbances. The next useful consequence is not another expansion: it is a cooperative attempt to protect the route players already created.

The firebreak is intentionally modest. It creates a persistent physical mark and another reason for travelers to cooperate without pretending that one small project can control the autonomous wildfire simulation.
