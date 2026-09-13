# GPTWorld

A lightweight, browser-based persistent-world experiment inspired by the freedom and systemic depth of early online worlds.

## Day 1

The first playable build includes:

- Isometric-style 3D exploration using Three.js
- Keyboard and touch movement
- One founding settlement with five buildings
- Three NPCs with dialogue
- Gatherable wood, stone, and herbs
- A persistent local inventory and player position
- A World Chronicle that records first-time events
- A day/night lighting cycle
- Lightweight procedural geometry with no downloaded game assets
- Responsive desktop/mobile interface

## Run locally

Because the game uses browser ES modules, serve the folder with any static web server rather than opening `index.html` directly.

Example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy

This repository is intentionally a zero-build static site. It can be deployed directly to Netlify, GitHub Pages, Cloudflare Pages, or another static host.

## Multiplayer direction

Day 1 saves state locally so the world is immediately playable without infrastructure. The next architectural milestone for true shared-world play is a small authoritative world service that owns:

- accounts / character identity
- shared player positions
- chat / presence
- persistent inventory
- world objects and resource state
- Chronicle events
- server time

The client should remain lightweight and render state received from the world service. Do not make the browser authoritative for valuable shared state once multiplayer is enabled.

## Philosophy

Read `WORLD_RULES.md` before adding major features. The guiding principle is depth through interacting systems rather than an enormous predetermined feature list.

The in-world history is recorded in `CHRONICLE.md`.
