# GPTWorld — Simulations Inside the Game

GPTWorld is one persistent multiplayer game containing multiple autonomous simulations. No simulation owns the others. They exchange effects through shared server-authoritative world state and player actions.

## 1. Ecology simulation
State: `world_state.ecosystem`.
Clock: `ecosystem-tick` independently checks hourly; ecology currently advances at most once per UTC date.
Owns: species, populations, habitats, ecological climate adaptation, extinction/speciation history.
Rendering: `world-v2` converts persisted ecology into visible plants and moving animal representations in the normal world render stream. Ecology visuals are not created by the daily GPT evolution.
Player interaction: players can directly alter ecology through validated server actions such as planting habitat or clearing brush. These actions are logged.

## 2. Weather and seasons simulation
State: `world_state.weather_sim`.
Clock: `weather-tick` hourly.
Owns: world hour/day, season/season day, temperature, precipitation, wind, soil moisture and drought.
Rule: narrative Day N never manually advances weather or seasons.

## 3. Natural disaster simulation
State: `world_state.disaster_sim`.
Clock: `disaster-tick` hourly.
Owns: wildfire, flood, severe-storm and disease risk; active disasters; disaster history; player mitigation/response.
Inputs: weather/season state, ecology state and accumulated mitigation.
Player interaction: players can reduce environmental risk and respond to active disasters. Responses are persistent and logged.

## 4. Daily GPT evolution
State/history: `current_day`, Chronicle, DAY files, world state and events.
Clock: scheduled daily evolution at 02:00 America/Denver.
Owns: one meaningful narrative/gameplay evolution per numbered world day.
Daily GPT observes the autonomous simulations and player history but does not act as their timer. It may change their rules or connect them when justified, but it must preserve their independent clocks and persistent state.

## 5. Players
Players live inside all simulations rather than above them. Player actions may affect one or more simulations when the interaction makes physical/gameplay sense. Valuable mutations must be server-authoritative, validated and logged. Examples: habitat work affects ecology; brush clearing affects ecology and wildfire mitigation; disaster response affects active disaster outcomes; future construction may affect flood paths, habitat, shelter or resource pressure.

## Cross-simulation rule
Simulations may read outputs from other simulations but should remain independently recoverable. A failure in an optional simulation must not reset the narrative day, player identity, inventory or unrelated simulation state.

Example chain: dry weather raises drought -> ecology changes -> wildfire risk rises -> a disaster may begin -> players respond or ignore it -> persistent consequences become part of world history -> a later Daily GPT evolution may react to what actually happened.

## Current implementation note
This architecture is infrastructure and does not advance the numbered world day. It was introduced while the narrative world remained on Day 4.
