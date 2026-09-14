# GPTWorld persistent rendering contract

Daily world evolution may add persistent visual changes by writing `world_state.key = render_entities` as either an array or `{ "entities": [...] }`.

The client renderer supports these entity types:

- `building`: `id`, `x`, `z`, `width`, `depth`, optional `height`, `wallColor`, `roofColor`, `roofHeight`.
- `trail`: `id`, `points` as `[[x,z], ...]`, optional `width`, `color`.
- `vegetation`: `id`, `x`, `z`, optional `kind` (`tree`, `rock`, `herbs`) and `scale`.
- `object`: `id`, `x`, `z`, optional `width`, `height`, `depth`, `color`.
- `terrain`: `id`, `x`, `z`, optional `width`, `depth`, `height`, `color`.
- `resource`: `id`, `x`, `z`, `resource` (`wood`, `stone`, `herbs`), optional `scale`, `max`, `regrowMinutes`.

Each `id` must be stable and unique. Resource ids must be 40 characters or fewer. Updating a descriptor with the same id replaces the visual object. Removing the descriptor removes it from the playable world on the next world refresh.

## Generic resource registration

Persistent entities whose `type` is `resource` are automatically recognized by the server-authoritative resource system. Daily evolution does not need to edit application code or a hard-coded node registry when it creates a new resource node.

The server derives the node configuration from `render_entities`, validates the resource type, and manages depletion/regrowth in shared `resource_nodes` world state. Gathering remains server authoritative and updates `player_inventory` atomically.

Defaults when `max` or `regrowMinutes` are omitted:

- wood: max 6, regrows in 60 minutes
- stone: max 4, regrows in 90 minutes
- herbs: max 3, regrows in 20 minutes

Allowed limits are 1–100 units per node and 1–10,080 minutes for regrowth. Existing founding-era resource ids remain registered by the built-in base configuration and cannot be overridden by a dynamic entity with the same id.

Example:

```json
{
  "entities": [
    {"id":"north-watch-hut","type":"building","x":14,"z":21,"width":4,"depth":3,"height":2.8,"wallColor":"#8b7658","roofColor":"#4c3529"},
    {"id":"north-trail","type":"trail","points":[[4,7],[8,11],[12,16],[14,21]],"width":1.1,"color":"#8e806d"},
    {"id":"north-pines","type":"vegetation","kind":"tree","x":17,"z":23,"scale":0.9},
    {"id":"north-stone-1","type":"resource","resource":"stone","x":19,"z":20,"scale":0.8,"max":5,"regrowMinutes":120}
  ]
}
```

Rules for daily evolution:

1. Never overwrite unrelated persistent entities.
2. Preserve stable ids when an existing object changes.
3. Prefer small visual changes that reflect actual world history and player activity.
4. Do not create scenery that contradicts terrain, completed projects, or existing structures.
5. Use `type: resource` only for genuinely gatherable nodes. Decorative trees, rocks, or plants should use `type: vegetation`.
6. Do not reuse founding-era resource ids for new nodes.
7. Persistent visual changes do not advance the world day by themselves; they are infrastructure used by a valid day evolution.
