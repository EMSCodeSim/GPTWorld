# GPTWorld — World Rules

GPTWorld is a living, persistent-world experiment. It begins small and evolves over time through player activity and deliberate development.

## Core rules

1. The world must remain playable after every change.
2. Start small. Expand geography only when there is a reason for new land to exist.
3. Prefer systems that interact over isolated content.
4. Prefer discovery and consequences over quest markers and scripted rails.
5. Skills should improve through use when a skill system is introduced.
6. The player is a participant in the world, not the center of the universe.
7. NPCs should gain routines, needs, relationships, possessions, jobs, and memories as those systems become practical.
8. Resources should have origins. Avoid infinite economies where possible.
9. Exploration should reveal useful, strange, historical, or beautiful things.
10. Failure may have consequences, but it should not casually erase months of progress.
11. Important events become history.
12. Player-created settlements, businesses, roads, guilds, discoveries, and monuments may become permanent parts of the world.
13. New players enter the world that already exists rather than receiving a private copy.
14. No player should easily master every profession once specialization systems exist.
15. No pay-to-win systems.
16. Keep the technology lightweight and understandable.
17. Do not copy Ultima Online content, names, maps, art, creatures, lore, or proprietary systems. Its persistent-world philosophy is inspiration only.
18. Do not explain every mystery.
19. Occasionally introduce an unexpected but internally plausible change.
20. No predetermined endpoint.

## Evolution rules

21. Civilization begins with limited knowledge, infrastructure, and technology.
22. Eras emerge from world conditions rather than a fixed calendar.
23. Discoveries unlock possibilities instead of merely awarding points.
24. Collective player behavior can influence what develops next.
25. There is no guaranteed technological, magical, political, or cultural future.
26. Major events enter the World Chronicle.
27. The world should remember meaningful changes when technically practical.
28. Development should respond to the history players create.
29. New systems must solve a problem, create meaningful interactions, deepen the simulation, or enable discovery. "Other games have it" is not enough.
30. Each development cycle should make at least one meaningful improvement while protecting stability.

## Autonomous system rules

31. Every persistent simulation system should be capable of advancing without the daily GPT evolution run. The daily evolution agent is a designer and steward, not the clock that makes weather, NPC routines, resource regrowth, settlement needs, ecology, aging, presence, or other recurring systems move forward.
32. Each autonomous system owns its own cadence. Its clock may be based on real elapsed time, world time, activity thresholds, event triggers, or another deterministic rule appropriate to that system.
33. Systems must tolerate missed browser sessions and missed scheduled agent runs. When practical, derive the current state from persisted timestamps/buckets so the world can resume correctly after inactivity.
34. GPT may change a system's rules, cadence, thresholds, parameters, interactions, presentation, or implementation when world history, player behavior, balance, performance, or a new evolution justifies it.
35. GPT may add new autonomous systems and retire or merge old systems, but changes must preserve important persistent state and must not silently erase player/world history.
36. GPT should normally change system definitions or configuration rather than manually forcing recurring outcomes. One-time state edits are acceptable for migrations, repairs, or a deliberate in-world event.
37. Autonomous systems may interact. Weather may influence ecology; travel may influence trails; settlement demand may influence stockpiles; ecology may influence resources; NPC routines may react to shortages or events. Interactions should remain understandable enough to debug.
38. Different systems do not need synchronized clocks. A resource may regrow in minutes, NPC routines may change by world-time period, weather may change every few hours, settlement consumption may tick several times a day, and ecology may advance on a much slower clock.
39. The daily world-day number is narrative history, not the universal simulation clock. Advancing Day N must not be required for existing autonomous systems to continue running.
40. Every autonomous system must have a safe default behavior if its optional configuration is absent, malformed, or temporarily unavailable.
41. Server-authoritative systems must remain authoritative after GPT modifies them. Browser state may display/cache state but must not become the source of truth for valuable inventory, shared resources, projects, economy, construction, or other consequential state.
42. System changes must remain backward compatible when practical. If a schema migration is required, it must be non-destructive unless explicitly approved.
43. GPT should observe system output and player behavior before making large balance changes. Quiet periods and no-change outcomes are valid.
44. New autonomous behavior should emit meaningful world events when useful so NPC memory, Chronicle logic, future evolution, and diagnostics can understand what happened.
45. The detailed current system contract is maintained in `WORLD_SYSTEMS.md`. Daily evolution must read it before modifying system behavior.

## Living ecosystem rules

46. The ecosystem evolves independently of the daily development agent.
47. Climate, food availability, predation, competition, and inherited traits should drive ecological change.
48. New species should emerge from surviving populations and environmental pressure rather than arbitrary scheduled creation.
49. Extinction is permanent history. Extinct species remain in the fossil record even when no living examples remain.
50. Players may influence ecological pressure through ordinary actions, but players never receive direct control over evolution.
51. Ecological change should usually be gradual. Long quiet periods are valid and desirable.
52. Player time and ecological time are separate. One real-world day may advance multiple generations or a simulated year without forcing the player world to age at the same rate.
53. Ecological systems should create consequences for gathering, hunting, settlement growth, agriculture, travel, and future systems whenever practical.
54. The simulation should preserve ancestry so a later species can be traced back through its lineage.
55. The ecosystem has no predetermined final form.

## Founding premise

A small group has established a settlement in an unfamiliar valley after leaving a homeland that is deliberately unexplained at the beginning. Five buildings stand along a dirt road. A river marks the western edge of known settlement territory. The surrounding land has not been properly mapped.

The world's backstory should be discovered and created gradually rather than written completely in advance.

## Development loop

Player activity changes the world → the world records history → development examines that history → a new feature, consequence, place, character, mystery, or system is introduced → players respond → the world evolves again.

At the same time, autonomous systems continue on their own clocks:

weather changes → NPC routines change → resources deplete/regrow → settlement needs consume supplies → travel wears paths → world aging accumulates → ecology advances → events are recorded → future players and future GPT evolution inherit the consequences.

## World Chronicle

Every meaningful release should add an entry to `CHRONICLE.md` describing what changed in-world rather than only describing code changes. Infrastructure-only maintenance that does not create an in-world historical event does not need to advance the world day.
