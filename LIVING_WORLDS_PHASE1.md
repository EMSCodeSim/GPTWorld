# Living Worlds Expansion — Phase 1

## Implementation plan

1. Add an incremental schema for one owner-bound private world per registered player.
2. Generate a deterministic landscape once and persist its seed and generated terrain.
3. Add a server-authoritative travel session with idempotency receipts.
4. Add the public-town gateway and a mobile-compatible private-world client using the existing Three.js visual language and controls.
5. Advance private ecology from elapsed time in bounded six-hour steps without touching the public daily evolution schedule.
6. Verify deterministic generation, ownership rules, bounded catch-up, bounds checks, and migration safety.

## Security and persistence

- Every private-world lookup begins with the existing `players.client_id` registration and selects the world by `owner_player_id`; clients cannot choose another world ID.
- Travel changes no inventory rows. Public and private play reference the same authoritative `player_inventory` record, eliminating a transfer/duplication boundary.
- Each travel request requires an idempotency key stored in `world_travel_receipts`.
- Position updates require an active private session owned by the same player.
- The migration only adds tables and indexes. It does not delete, rewrite, or reset existing public-world records.

## Phase boundary

Phase 1 establishes world ownership, deterministic generation, storage, isolation, travel, position persistence, and bounded offline ecology.

## Phase 2 progress — personal gathering

- Trees, stone deposits, and wild herbs are seeded once into `private_world_resources` for every existing or new personal world.
- Gathering requires an active owner session and atomically decrements the private node, credits the shared personal inventory, and records a `private_world_events` history entry.
- `private_world_action_receipts` makes repeat requests idempotent, preventing double credit from taps or retries.
- Trees and herbs recover after elapsed real time; finite stone remains depleted. The scene displays current amounts and visibly shrinks depleted nodes.
- Migration order: apply `001_living_worlds_foundation.sql`, then `002_private_world_gathering.sql` using a direct Neon connection.

Private construction, farming, hunting, history inspection, and the marketplace remain future Phase 2–4 work.

## Phase 2 progress — profession crafting

- Personal worlds include a mobile Field Crafting ledger with Carpentry, Masonry, and Herbalism.
- Initial recipes turn gathered wood, stone, and herbs into durable, maker-marked possessions.
- Success odds improve through practice; outcomes can be standard, fine, or exceptional quality.
- Failed attempts consume only part of the required materials and may still improve the profession.
- Every craft is owner-checked, idempotent, server-authoritative, and recorded in private-world history.
- Crafted items persist independently with their maker, quality, durability, profession, and creation time.
- Apply `003_private_world_crafting.sql` after the first two Living Worlds migrations.
