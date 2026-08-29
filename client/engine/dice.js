"use strict";
/** İki zar atar, {a, b, total, isDouble} döner. */
function rollDice() {
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  return { a, b, total: a + b, isDouble: a === b };
}

const DiceModule = { rollDice };
if (typeof module !== "undefined" && module.exports) module.exports = DiceModule;
if (typeof window !== "undefined") window.DiceModule = DiceModule;
