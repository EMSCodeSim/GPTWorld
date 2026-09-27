# Day 13 — Firebreak Staging Point

## What changed

A persistent stone staging cairn now stands beside the Western Firebreak route. It gives travelers a visible rallying and material-staging point at the unfinished shared defense project without completing the project for them.

The cairn is stored in `world_state.render_entities` with the stable id:

- `firebreak-staging-cairn`

## Why this happened

Day 12 placed two modest scree deposits near the Western Firebreak so travelers could obtain stone without opening another timber route. Travelers subsequently exhausted both new scree deposits, but the Western Firebreak remained unfunded.

Day 13 therefore records that activity in the landscape rather than inventing an unrelated expansion. The staging cairn makes continued work around the existing firebreak visibly persistent while leaving project contributions and eventual completion in player hands.

## Persistent implementation

The cairn is persisted in the shared server-authoritative rendering state rather than browser storage. The guarded Day 13 release only applies when the authoritative world is on Day 12, appends the cairn without duplicating it, advances `current_day` to 13 in the same database operation, and records the `day13_firebreak_staging_opened` world event.

No recurring autonomous simulation is manually ticked by this release. Weather, disasters, ecology, resource lifecycle, NPC routines, settlement needs, presence, and world aging remain governed by their independent clocks.

## Verification

The production Day 13 release was applied successfully and the release workflow was corrected to verify both first-run and idempotent responses. Post-release production health was verified directly as healthy, with the authoritative world on Day 13 and the Day 13 rendering/event state present.

This document repairs the historical documentation gap after the playable Day 13 implementation had already been released. It does not create or advance another world day.
