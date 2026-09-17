# Day 6 — Campcraft

The settlement's heavy gathering has begun turning raw materials into practical tools for living beyond the town road.

## Playable Day 6 evolution

- Private living worlds now support server-authoritative profession crafting using wood, stone, and herbs carried by the same traveler who visits the public settlement.
- Carpentry, masonry, and herbalism improve through use; simple founding recipes are reliable while harder work depends on growing skill.
- Crafted objects persist with maker, quality, durability, and placement state rather than existing only in browser memory.
- Campfire kits can be placed in a private world and visibly burn with animated flame, providing a functional light/heat/protection object.
- Wooden crates provide persistent personal storage; other founding recipes establish tools, hearths, poultices, and weather preparations.
- Craft attempts and consequential inventory changes are validated server-side and use idempotent actions so retries cannot duplicate materials or items.
- Existing public-world identity, position, inventory, Western Crossing, storehouse, trail markers, ecology, weather, NPC life, resource clocks, and autonomous simulations remain intact.

## Why it matters

Recent player activity remains strongly resource-focused, including repeated wood harvesting. Day 5 let travelers leave small marks on public routes; Day 6 gives gathered materials a deeper purpose in the player's own persistent living world. The first real production skills now connect gathering to making, storage, shelter support, and future specialization without requiring the daily world-day process to simulate those activities.
