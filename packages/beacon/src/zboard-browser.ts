// Browser entry for the engine-flag board: bundled by `bun run build:zboard` into apps/web/public/zboard.js (global `ZBoard`). Not loaded by any live page.
import * as Z from "./zboard";
(globalThis as any).ZBoard = Z;
