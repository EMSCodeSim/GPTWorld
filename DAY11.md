# Day 11 — The Burn Scar

## What changed

Repeated wildfire has left a small burn scar beyond the Timber Line. A narrow marked route now leads travelers into the damaged ground, where two piles of salvageable deadfall can be gathered as wood.

The deadfall is deliberately limited. Each pile holds only four wood and recovers on a very slow seven-day resource timer, so the scar is not an infinite logging field.

## Why this happened

Recent player activity included concentrated timber gathering that exhausted several ordinary trees. At the same time, the autonomous disaster system recorded repeated wildfire, including an active fire on the morning of Day 11, while the ecosystem marked multiple habitats as burned.

Rather than add an unrelated settlement feature, Day 11 connects those two existing pressures: travelers can now recover a small amount of useful timber from a place visibly changed by the fires.

## Persistent implementation

The burn-scar trail, marker, rock, and two deadfall nodes are stored in `world_state.render_entities` with stable ids. The deadfall uses the existing generic server-authoritative resource system, so gathering changes player inventory atomically and depletion/recovery remains independent of the numbered world day.

No autonomous clock was manually advanced or changed. Weather, disasters, ecology, settlement needs, NPC routines, resource lifecycle, presence, and world aging continue on their own clocks.

## Verification

Direct HTTP access to the health endpoint was unavailable to the automation environment. Core health was therefore VERIFIED BY FALLBACK before advancement: the current Netlify production deploy was ready, the `health` function was deployed, hourly weather/disaster/ecosystem functions were present, Neon connectivity succeeded, required tables were present, persistent player inventory remained intact, the Western Crossing remained complete, and shared world/autonomous-system state was readable.

Day 11 was then applied atomically to shared world state and recorded in `world_events`. The persistent render descriptors and current day were read back from Neon after the transaction.
