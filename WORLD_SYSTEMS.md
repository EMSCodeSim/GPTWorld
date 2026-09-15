# GPTWorld — Autonomous World Systems Contract

This document defines how GPTWorld simulation systems should operate and how the daily GPT evolution agent may change them.

## Prime directive

Every persistent system should continue to function independently of the daily world-day evolution. GPT may redesign or rebalance systems, but it should not become the recurring timer that makes them run.

The daily GPT evolution run may:
- change system rules, thresholds, cadence, parameters, interactions, UI, rendering, or implementation;
- add or remove supported state fields using safe/backward-compatible migrations;
- create new autonomous systems;
- connect systems together when the interaction is meaningful;
- perform a one-time repair or migration;
- create deliberate one-time world events as part of a valid numbered day.

The daily GPT evolution run should not:
- manually advance weather, regrowth, NPC schedules, settlement consumption, ecology, aging, presence, or another recurring system just because a new world day began;
- make a browser/localStorage snapshot authoritative for shared valuable state;
- reset persistent system state unless an explicit in-world event or approved repair requires it;
- synchronize every system to the same clock.

## Current systems and independent clocks

### World day / narrative evolution
Owner: daily GPT evolution automation.
Current cadence: once daily at 02:00 America/Denver.
Purpose: introduce one meaningful next chapter after health/stability checks.
Rule: narrative day is not a simulation tick and does not gate other systems.

### Weather
Owner: `netlify/functions/living-systems.mjs`.
Current cadence: deterministic real-time bucket of about 3 hours.
State: `world_state.living_weather`.
GPT may change: cadence, probabilities, temperature/wind model, seasonal behavior, effects on other systems, visuals.
Must remain independently derivable from persisted state/time.

### Settlement needs / consumption
Owner: `netlify/functions/living-systems.mjs`.
Current cadence: deterministic real-time bucket of about 6 hours.
State: `world_state.settlement_needs` plus `settlement_stockpile`.
GPT may change: consumption rates, demand categories, shortage consequences, cadence, dependency on population/weather/NPCs.
Must remain atomic when shared stockpile values change.

### NPC routines and memory
Owner: `netlify/functions/living-systems.mjs` + client NPC renderer.
Current cadence: routine period derives from time; persistent memory updates from world events whenever living-system state refreshes.
State: `world_state.npc_life` and `world_events`.
GPT may change: schedules, destinations, jobs, memory relevance, movement behavior, relationships, reactions, needs.
NPC physical positions should follow server routine destinations without requiring the daily evolution job.

### Resource depletion and regrowth
Owner: `netlify/functions/resource-state.mjs`.
Current cadence: each resource node owns its own regrowth timestamp; defaults are currently wood 60 minutes, stone 90 minutes, herbs 20 minutes.
State: `world_state.resource_nodes`, dynamic resource definitions from `render_entities`, player inventory in `player_inventory`.
GPT may change: node types, capacities, regrow intervals, distribution, ecology/season effects, visuals, resource definitions.
Gathering and inventory changes remain server-authoritative and transaction-safe.

### Persistent rendering
Owner: client world renderer reading shared state.
Current cadence: shared-world refresh loop plus focus/reconnect refresh.
State: `world_state.render_entities`.
GPT may change: buildings, trails, vegetation, objects, terrain, resource nodes, and renderer-supported entity types.
Persistent world objects should be data-driven whenever practical so future evolution can modify them without rewriting the core scene.

### Shared projects / construction
Owner: server-authoritative project functions/state.
Current cadence: event-driven by player actions rather than a timer.
State: project-specific `world_state` records such as `western_crossing`.
GPT may change: requirements, project types, downstream consequences, available projects.
Completion must leave a persistent visible result in the playable world when the project creates a physical object.

### Player identity, position, and inventory
Owner: world/server functions and Neon.
Current cadence: presence/position sync occurs periodically; inventory changes occur only through validated server actions.
State: `players`, `player_inventory`.
GPT may change: presence timeout, sync frequency, supported inventory categories, progression fields, restoration behavior.
Must preserve identity and valuable state across world-day updates.

### Multiplayer presence
Owner: shared world sync backend/client sync.
Current cadence: client presence updates and server online-time window.
State: `players.last_seen_at`, coordinates.
GPT may change: update cadence, timeout, interpolation, rendering implementation.
Visible second-traveler rendering is currently intentionally disabled until a robust implementation is used, but shared presence infrastructure may continue independently.

### World aging and travel wear
Owner: `netlify/functions/living-systems.mjs` + client aging renderer.
Current cadence: age derives from elapsed real time; travel observations currently post periodically while players move/use the world.
State: `world_state.world_aging`.
GPT may change: aging rates, trail thresholds, weather exposure, deterioration/regrowth behavior, milestones, physical rendering.
Aging must continue from timestamps/activity even when no numbered day is released.

### Ecosystem
Owner: `netlify/functions/ecosystem-tick.mjs` scheduled clock, with `netlify/functions/world.mjs` owning the server-authoritative evolution routine.
Current cadence: the scheduled clock checks hourly; the persisted `lastRealDate` guard allows at most one ecological-year advance per UTC calendar date.
State: `world_state.ecosystem`.
Independence rule: ecology must advance even when no player opens the site and regardless of the numbered GPTWorld day. Browser polling and the daily GPT evolution agent are not the ecology clock.
GPT may change: ecological cadence, species model, climate rules, migration/speciation/extinction mechanics, ecosystem→resource interactions.
Extinction/history must remain persistent.

### Chronicle and world events
Owner: server event log + Chronicle UI/documentation.
Current cadence: event-driven.
State: `world_events`, `CHRONICLE.md` for official release history.
GPT may change: event types, summaries, memory mapping, Chronicle presentation.
Not every low-level event belongs in the official Chronicle.

### Runtime stability / synchronization
Owner: client runtime and server health/integrity checks.
Current cadence: reconnect/focus/error/periodic refresh behavior.
GPT may change: retry strategy, cache busting, polling intervals, observability, recovery logic.
Infrastructure maintenance does not advance the numbered world day unless it also implements the next valid in-world evolution.

## Rules for future system configuration

When practical, move tunable behavior out of hard-coded source and into a shared `system_config`/system-specific state record with safe defaults. This allows GPT to rebalance a system without replacing core code while still letting that system run autonomously.

A tunable system should preferably expose:
- `enabled`
- `version`
- its cadence/timing rule
- safe min/max limits
- behavior parameters
- last processed bucket/timestamp when needed
- dependency/input state
- observable status or recent result

Configuration must be treated as untrusted persistent data: validate/clamp values before use and fall back to code defaults when malformed.

## Cross-system evolution

GPT is encouraged to connect systems when history justifies it. Examples:
- prolonged rain raises river/ecology/resource effects;
- shortages alter NPC routines and future settlement projects;
- heavy harvesting slows local regrowth or changes ecology;
- repeated travel creates persistent paths that affect exploration or settlement growth;
- construction consumes stockpile resources and later changes NPC/economic behavior;
- ecological changes alter what can be gathered in different regions.

These interactions should emerge gradually. Avoid creating a brittle dependency chain where failure in one optional system stops the whole world.

## Daily GPT evolution checklist for systems

Before changing a system, the daily agent should ask:
1. Is the system healthy now?
2. What clock/event currently advances it?
3. Can it keep advancing without tomorrow's GPT run?
4. What persistent state must survive this change?
5. Is the proposed change justified by player behavior, world history, balance, performance, or the day's evolution?
6. Can the change be represented as configuration/data rather than a rewrite?
7. Could this affect server authority, concurrency, or inventory integrity?
8. What event/status should be emitted so future GPT runs can understand the result?

If a system cannot answer question 3, improving that independence is infrastructure work and should not by itself advance the numbered world day.
