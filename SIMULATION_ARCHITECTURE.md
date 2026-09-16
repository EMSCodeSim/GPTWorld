# GPTWorld — Autonomous World + GPT Game Developer

GPTWorld is one persistent multiplayer game with two deliberately separate layers:

1. **The World Engine runs the world autonomously.**
2. **Daily GPT develops the playable game around the world.**

The world must continue operating if GPT never runs again. GPT is not a runtime dependency for weather, ecology, disasters, NPC life, resources, settlement activity, or any other recurring simulation.

## World Engine contract

The World Engine owns physical and living state. Its systems use persisted state, deterministic rules, controlled randomness, elapsed/world time, and player actions. No autonomous simulation may require an OpenAI/GPT call to advance.

### Ecology simulation
State: `world_state.ecosystem`.
Owns plants, animals, populations, food chains, reproduction, predation, migration, habitats, succession, adaptation, extinction/speciation history and ecological consequences.

### Weather and seasons simulation
State: `world_state.weather_sim`.
Owns world hour/day, seasons, temperature, precipitation, wind, soil moisture, drought and weather transitions.

### Natural disaster simulation
State: `world_state.disaster_sim`.
Owns wildfire, flood, severe weather, disease risk, active disasters, mitigation and persistent disaster history.

### NPC / settlement simulation
Owns NPC needs, routines, work, relationships, production/consumption, settlement shortages and later population/economic behavior. GPT may enhance NPC language, but NPC life must have a non-AI fallback and continue without GPT.

### Resources and world state
Server-authoritative systems own gathering, inventory, regeneration, construction inputs and other consequential shared state. Browser state is never authoritative for valuable world mutations.

## Daily GPT contract — evolving game developer

State/history: current world day, Chronicle, world events, player behavior, simulation summaries and existing game code.
Clock: scheduled daily evolution at 02:00 America/Denver.

Daily GPT is the evolving **game designer and developer**, not the simulation engine. It observes what the autonomous world and players actually produced, then adds or deepens playable systems when justified.

Primary development areas include:
- money, trade and economy gameplay
- skills and progression
- crafting, recipes, tools and equipment
- building and construction
- farming and domestication gameplay
- professions and specialization
- exploration and new playable areas
- combat and survival mechanics
- transportation
- player organizations and cooperation
- NPC interaction mechanics
- interfaces and quality-of-life improvements
- new gameplay systems that emerge logically from world/player history

Daily GPT may write real game code and add new autonomous rules. Once a rule/system is created, the World Engine runs it without GPT. Example: GPT may introduce farming, but crop growth thereafter belongs to the autonomous simulation.

## Hard separation rules

1. GPT does not manufacture weather, animal population changes, plant growth, NPC hunger, disasters, resource regeneration or other recurring simulation outcomes.
2. GPT does not overwrite simulation truth to justify a feature.
3. GPT may create/change simulation **rules**, migrations, interfaces and connections, but recurring execution remains autonomous.
4. New gameplay should preferably have an in-world cause in recorded history, available resources, player behavior or existing conditions.
5. GPT must preserve persistent state and recorded history.
6. If the GPT/API layer is unavailable, the world continues living and players can continue playing; only new GPT-created development pauses.
7. Simulation infrastructure/maintenance does not advance the numbered narrative World Day.
8. The numbered World Day records meaningful GPTWorld development/history; it is not the universal simulation clock.

## Information flow

`Autonomous World Sims → persisted state/events → Daily GPT observes → gameplay code/rules/features → autonomous World Engine runs new rules → players interact → new state/events`

GPT interprets, connects and expands consequences. It does not replace the systems producing those consequences.

## Example

Weather creates a drought → ecology reduces available forage → animals migrate → NPC/player gathering patterns change → events record the consequences → Daily GPT notices the emerging pressure and may create irrigation, water-storage, farming or trade gameplay → those new mechanics thereafter run under autonomous rules.

This architecture is infrastructure and does not itself advance the numbered world day.
