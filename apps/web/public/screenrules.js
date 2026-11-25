// Which parts a player screen shows (owner rules, 30 Oct 2026). Plain data, no DOM: z.js and the tests use the same answers.
// states: invite, waiting, notlisted, playing, ended. Rules row only inside the game. Thank-you strip only after the game.
(function (root) {
  var STATES = ["invite", "waiting", "notlisted", "playing", "ended"];
  function showRules(state) { return state === "playing"; }
  function showThanksStrip(state) { return state === "ended"; }
  function richElement(state) { return state === "playing" ? "board" : "none"; } // the board is the only rich element
  function look(theme) { return theme === "modern" ? "modern" : "retro"; }
  var api = { STATES: STATES, showRules: showRules, showThanksStrip: showThanksStrip, richElement: richElement, look: look };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SLRules = api;
})(typeof self !== "undefined" ? self : this);
