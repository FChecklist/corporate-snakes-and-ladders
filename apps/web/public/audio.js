/*
 * Dice voice: the phone's own speech voice says what the dice did (no audio files are used).
 *   roll 4, ladder to 28 -> "You rolled four. A ladder! Up to square 28."
 * The words come from ZG.spokenRoll(roll, kind, to) (packages/shared/src/audio.ts, bundled into zgame.js); if zgame.js is not loaded yet a plain fallback is spoken.
 * Voice: the same as Corporate Tambola: Indian English (en-IN), a female voice when the phone has one, otherwise any en-IN, otherwise any English voice. Rolls: rate 0.82, pitch 1.05; announcements: rate 0.9.
 */
(function () {
  const ONES = ["zero", "one", "two", "three", "four", "five", "six"];
  const VERSION = "v2-en-in-speech";
  const A = (window.TBAudio = { VERSION, enabled: true, unlocked: false, ctx: null, mode: "speech" });

  // Call from a tap (Join audio). Phones only allow sound after a tap.
  A.unlock = async () => {
    try {
      A.ctx = A.ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (A.ctx.state === "suspended") await A.ctx.resume();
      A.unlocked = true;
      if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); }
    } catch { A.unlocked = true; }
    return A.unlocked;
  };
  A.preload = async () => 0; // nothing to download: the voice is the phone's own

  const pickVoice = () => { const vs = speechSynthesis.getVoices(); return vs.find((v) => v.lang === "en-IN" && /female|heera|neerja|veena|raveena|natural|google/i.test(v.name)) || vs.find((v) => v.lang === "en-IN") || vs.find((v) => /^en/.test(v.lang) && /female|zira|samantha|natural/i.test(v.name)) || vs.find((v) => /^en/.test(v.lang)); };
  const speak = (text, rate, pitch = 1) => {
    if (!A.enabled || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate; u.pitch = pitch; u.lang = "en-IN";
      const pick = pickVoice(); if (pick) u.voice = pick;
      speechSynthesis.speak(u);
    } catch {}
  };
  /** The wording for one throw. kind: "move" | "ladder" | "snake" | "overshoot" | "finish"; `to` is the square a ladder or snake leads to. */
  A.phrase = (roll, kind, to) => {
    if (window.ZG && typeof window.ZG.spokenRoll === "function") return window.ZG.spokenRoll(roll, kind || "move", to);
    return "You rolled " + (ONES[roll] || roll) + ".";
  };
  /** Says one throw aloud. */
  A.roll = (roll, kind, to) => speak(A.phrase(roll, kind, to), 0.82, 1.05);
  A.play = A.roll;
  // A spoken message (the organizer's announcement, or the sound check). Uses the phone's own voice, so it costs nothing.
  A.say = (text, lead = "Message from the organizer. ") => speak(lead + text, 0.9);
  A.test = () => { A.unlock(); A.roll(4, "ladder", 28); };
  A.stop = () => { try { window.speechSynthesis && speechSynthesis.cancel(); } catch {} };
})();
