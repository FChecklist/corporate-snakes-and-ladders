// Bundled to apps/web/public/zgame.js (window.ZG): everything the phone page and the organizer page need from the shared logic.
import { spokenRoll } from "../../shared/src/audio";
import { rankName, activeBreak, callRoundR, callRoundFull, scheduleFull, unshiftedRound, activeIntermission, luckyRound, luckyWinners, RoundStore, raceCfgOf, tableCfgOf, playGame, settleGame } from "./game";
import { INVITE_CATEGORIES, GRACE_ROUNDS, LATE_LAG_ROUNDS, INTERMISSION_ROUNDS, MAX_ROUNDS, roundEid, MAX_BREAKS, PATTERN_ORDER, PRIZE_HOUSES, HOUSE_ORDER, HOUSES_LINE, maxWinnersFor, houseLabel, LEGACY_MAX_ORDINAL, breakShift, defaultCfg, keysInPlay, linesFor, validateCfg } from "./config";
import { PhoneRuntime } from "./phone-runtime";
import { QUICKNET, fetchRound, roundAt, roundTimeMs } from "./index";
import { callRound, resolveControl, cfgOf, scheduleWithControl } from "./control";
import { generateBoard, squareXY, limits, BOARD_SIZES, targetTurnsFor } from "./board";
import { rollFor, fateOf, step } from "./play";
import { playRace, rankPlayers, crowdOf, teamTable, teamsOf, DEFAULT_TURN_CAP, DEFAULT_MILESTONE } from "./race";
import { turnRounds, betaOffset, WINDOWS, DEFAULT_WINDOW } from "./schedule";
import { spectatorView } from "./view";

(globalThis as any).ZG = {
  rankName, fateOf, spokenRoll, PRIZE_HOUSES, HOUSE_ORDER, HOUSES_LINE, maxWinnersFor, houseLabel, LEGACY_MAX_ORDINAL, INVITE_CATEGORIES, GRACE_ROUNDS, LATE_LAG_ROUNDS, INTERMISSION_ROUNDS, MAX_ROUNDS,
  activeIntermission, callRoundR, unshiftedRound, roundEid, luckyRound, luckyWinners, activeBreak, callRoundFull, scheduleFull, MAX_BREAKS, PATTERN_ORDER, breakShift, defaultCfg, keysInPlay, linesFor, validateCfg,
  PhoneRuntime, RoundStore, QUICKNET, fetchRound, roundAt, roundTimeMs, callRound, resolveControl, cfgOf, scheduleWithControl,
  // the game
  generateBoard, squareXY, limits, BOARD_SIZES, targetTurnsFor, rollFor, step, playRace, rankPlayers, crowdOf, teamTable, teamsOf, spectatorView, raceCfgOf, tableCfgOf, playGame, settleGame,
  turnRounds, betaOffset, WINDOWS, DEFAULT_WINDOW, DEFAULT_TURN_CAP, DEFAULT_MILESTONE,
};
