/* What Corporate Snakes and Ladders tells the shared new organizer flow (pack/zc-flow.js) about itself. The flow holds no game rules: the prize list comes from this game's own table (ZG.PRIZE_HOUSES: Milestone, Reach the end 1st-5th, Team win, Biggest climb, Comeback, Never missed).
   Owner rule: hide what this game cannot do (no coming soon, no demo stub). So: one pawn per player, no Super Bumper, no sample ticket, no claims (prizes follow the finisher position), no lucky draw. */
window.ZFLOW_GAME = {
  brand: "Corporate Snakes and Ladders",
  tickets: [1],
  bumper: false,
  board: false, claims: false, sample: false, boardMax: 100, boardCols: 10, boardTitle: "BOARD",
  rehearsal: false, feed: false, presence: false, control: true, lucky: false, idKind: false,
  callSeconds: 20,
  popular: ["finish", "milestone"],
  recommended: ["finish", "milestone"],
};
