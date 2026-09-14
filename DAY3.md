# Day 3 — The Storehouse Opens

Travelers spent much of Day 2 gathering wood, stone, and herbs after completing the Western Crossing. The settlement now has enough activity to need a shared place for supplies.

## Playable Day 3 system

- The existing storehouse now serves as the settlement's communal stockpile.
- Travelers carrying gathered wood, stone, or herbs can approach the storehouse and deposit resources.
- Deposits are validated and deducted from the player's server-authoritative persistent inventory.
- Shared stockpile totals are stored in Neon world state and are visible to every traveler.
- Each successful deposit is recorded as a world event.
- Deposits use an atomic server action so concurrent players cannot duplicate or overwrite shared resources.
- Player identity, position, inventory, the completed Western Crossing, and existing world history remain intact.

## Why it matters

Day 3 turns gathering from an individual activity into the beginning of a settlement economy. Resources now have a persistent communal destination that later world systems can respond to without inventing supplies from nowhere.

The evolution follows actual player behavior: repeated gathering was the dominant recent activity, so the world developed a modest institution around storing what travelers were already collecting.
