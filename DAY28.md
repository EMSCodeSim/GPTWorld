# Day 28 — Edda's Blight Watch

Production release verified October 25, 2026. The historical world day advanced exactly once from 27 to 28; world event 9298 (`day28_edda_blight_watch`).

A crop disease event (9270) struck the gardens, increasing herb demand and draining crop health faster. A traveler then harvested three herbs from Edda's garden (events 9271–9273), while settlement herb reserves remained at zero. Rather than create free medicine or disable the disease, Edda marked a small observation area beside the existing winter herb relay.

The playable shared world now permanently includes a blight watch inspection path, a weathered herb inspection bed, and an inspectable blight watch board. The board directs travelers toward existing gathering and stockpile contributions. These marks do not modify live crop disease, herb regrowth, resource inventories, or construction progress.

Production persistence verification: Day 28; three Day 28 render entities; exactly one Day 28 release event (9298); 80 total persistent render entities; 66 players; 66 inventories; zero orphan inventories. Netlify production had published the Day 28 release function from main (commit 9bd01b2f3b048da6521351dcbf60b99b8866c2fc) before the guarded database release. Focused Day 28 Node tests and syntax validation passed in an isolated local copy; a full repository test run was not independently confirmed.

Weather, disasters, ecology, crop disease, resource recovery, settlement consumption, NPC routines, farming, and world aging continue on their independent clocks.
