# Day 5 — Trail Signs

Heavy gathering and repeated travel have made the settlement materially secure enough for travelers to begin leaving deliberate marks on the routes they use.

## Playable Day 5 evolution

- Travelers can now place a persistent trail marker at their current location.
- Each marker costs 2 wood and 1 stone from the placing traveler's server-authoritative inventory.
- Placement is validated and deducted atomically on the server.
- Every marker is appended to the shared persistent rendering state and recorded in `world_events`.
- Markers remain visible to future travelers and future world days unless an in-world change later removes them.
- Existing identity, position, inventory, Western Crossing, storehouse, ecology, weather, NPC life, resource clocks, and other autonomous systems remain intact.

## Why it matters

Recent activity was dominated by gathering, stockpile deposits, and continued travel after the Western Survey. Rather than expanding the map arbitrarily, Day 5 lets players use those materials to shape how exploration is remembered.

For the first time, an ordinary traveler can place a small persistent object into the shared landscape. The world can now accumulate player-made wayfinding history one marker at a time.
