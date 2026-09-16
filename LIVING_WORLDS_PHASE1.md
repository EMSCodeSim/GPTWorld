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

Phase 1 establishes world ownership, deterministic generation, storage, isolation, travel, position persistence, and bounded offline ecology. Private harvesting, construction, farming, hunting, history inspection, and the marketplace belong to Phases 2–4 and are not represented as complete.
