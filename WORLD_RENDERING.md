# GPTWorld persistent rendering contract

Daily world evolution may add persistent visual changes by writing `world_state.key = render_entities` as either an array or `{ "entities": [...] }`.

The client renderer supports these entity types:

- `building`: `id`, `x`, `z`, `width`, `depth`, optional `height`, `wallColor`, `roofColor`, `roofHeight`.
- `trail`: `id`, `points` as `[[x,z], ...]`, optional `width`, `color`.
- `vegetation`: `id`, `x`, `z`, optional `kind` (`tree`, `rock`, `herbs`) and `scale`.
- `object`: `id`, `x`, `z`, optional `width`, `height`, `depth`, `color`.
- `terrain`: `id`, `x`, `z`, optional `width`, `depth`, `height`, `color`.
- `resource`: `id`, `x`, `z`, `resource` (`wood`, `stone`, `herbs`), optional `scale`.

Each `id` must be stable and unique. Updating a descriptor with the same id replaces the visual object. Removing the descriptor removes it from the playable world on the next world refresh.

Example:

```json
{
  "entities": [
    {"id":"north-watch-hut","type":"building","x":14,"z":21,"width":4,"depth":3,"height":2.8,"wallColor":"#8b7658","roofColor":"#4c3529"},
    {"id":"north-trail","type":"trail","points":[[4,7],[8,11],[12,16],[14,21]],"width":1.1,"color":"#8e806d"},
    {"id":"north-pines","type":"vegetation","kind":"tree","x":17,"z":23,"scale":0.9},
    {"id":"north-stone-1","type":"resource","resource":"stone","x":19,"z":20,"scale":0.8}
  ]
}
```

Rules for daily evolution:

1. Never overwrite unrelated persistent entities.
2. Preserve stable ids when an existing object changes.
3. Prefer small visual changes that reflect actual world history and player activity.
4. Do not create scenery that contradicts terrain, completed projects, or existing structures.
5. Resource visuals must only be treated as gatherable when the server-side resource configuration recognizes their id. Until generic dynamic resource registration is enabled, use existing registered node ids for gameplay-critical resources.
6. Persistent visual changes do not advance the world day by themselves; they are infrastructure used by a valid day evolution.
