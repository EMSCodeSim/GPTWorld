# Day 12 — The Firebreak Stone Spur

## What changed

A short stone spur now branches from the Western Firebreak route. A field marker leads to two small scree deposits that travelers can gather for stone.

Each scree node holds five stone and uses a 12-hour resource lifecycle. The deposits are intentionally modest: they make the existing firebreak project easier to support without turning the area into an unlimited quarry.

## Why this happened

Recent activity was concentrated almost entirely on wood gathering. A traveler harvested twelve wood from two ordinary trees and exhausted both sites, while the shared forest remained at critical pressure with 333 recorded wood harvests and 54 depleted sites.

At the same time, the Western Firebreak remained unfinished at 0/6 wood and 0/24 stone, and the autonomous disaster system was still recording active wildfire. Day 12 therefore deepens an existing unfinished response instead of adding another unrelated feature or encouraging more logging.

## Persistent implementation

The stone spur, marker, and two scree nodes are stored in `world_state.render_entities` with stable ids:

- `firebreak-stone-spur`
- `firebreak-stone-marker`
- `firebreak-scree-stone-1`
- `firebreak-scree-stone-2`

The scree nodes use the existing generic server-authoritative resource system. Gathering remains distance-validated and updates persistent player inventory through the database. Resource lifecycle continues independently of the numbered world day.

No autonomous simulation clock was advanced or changed. Weather, disasters, ecology, NPC routines, settlement needs, resource lifecycle, presence, and world aging continue on their existing independent schedules.

## Verification

Production health was verified directly through the live Netlify health endpoint from a GitHub-hosted runner before the release.

Day 12 was then applied to the production database as a guarded one-time release from Day 11 only. The release created world event 6715, advanced `current_day` to 12, and persisted the stone-spur render entities.

Post-release direct health returned `ok=true` and `status=healthy`. It confirmed Day 12, all required persistence tables, 58 players, 58 inventory rows, 58 players with inventory, zero orphan inventory rows, the completed Western Crossing, and intact shared world-event persistence. A live world-memory read also confirmed the Day 12 render entities and the new release event.
