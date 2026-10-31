# Snakes and Ladders on the common engine (branch feat/snakes-on-engine-2026-10-31)

Step 1 (done): `vendor/game-core` pinned to core 0.1.0 (bdecf43) with `bun tools/vendor.ts`. Not imported by any live file; live behaviour is unchanged.

Plan (each step a small commit, all behind a flag, default OFF, like Bingo's ?flow=new):
2. Server adapter `apps/edge/src/engine.ts`: map the live game config to `snakesRules` setup (boards, rolls and fate stay site-side and are passed in).
3. Flag `engine=1` (per game config, set only by the Organizer in the new flow) selects the adapter; without it the live code runs.
4. Organizer six-step flow from the shared pack, Auto/Manual prizes via `planPrizes`.
5. Pause/resume (Organizer/Host), late-join window, 20 h erase, caps 2000 / rehearsal 10 via the core manifest.

## Questions where the engine rules may differ from live (not changed; need the boss's ruling)
- Survivors per round: new (spec 410). With 0 the module plays the live race exactly. Default for the new flow?
- Team race and Table mode are NOT in the module. Live has them. Keep them on the live code path only?
- Board "equal hardness" test (R11) and presence-window checks stay site-side.
- Golden button wording "You won" and auto-claim: the live prizes already follow finisher position, so no change expected; to be checked in the player page.
- Live sound/turn-cap/ends-when wording (1.4.1) must be kept when the adapter drives the turns.
