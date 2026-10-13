# Simulation

`bun run sim` plays whole games in virtual time: real phone code (PhoneRuntime) against the real Worker code (SQLite in memory) and a fake public beacon. It checks that nobody errors, no turn gets stuck, every phone shows the same standings, and the winners the Worker accepted are exactly what an independent computation from the public values gives. Cases: 6 players; 4, 12 and 20 players; a team race; a crowd of 100 players.

`lib/beacon.mjs` is the fake beacon (deterministic per round and seed).
