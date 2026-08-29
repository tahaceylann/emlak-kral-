"use strict";
/**
 * DOM/Three.js olmadan çalışan, saf mantık testleri. Çalıştırma:
 *   node test/engine.test.js
 */
const assert = require("assert");
const path = require("path");

const Board = require(path.join(__dirname, "../client/engine/board.js"));
const Economy = require(path.join(__dirname, "../client/engine/economy.js"));
const Turns = require(path.join(__dirname, "../client/engine/turns.js"));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok - ${name}`);
  } catch (e) {
    console.error(`  FAIL - ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

console.log("board.js");
test("28 kare üretir", () => {
  const board = Board.buildBoard();
  assert.strictEqual(board.length, 28);
});
test("köşeler doğru indekste", () => {
  assert.ok(Board.isCorner(0) && Board.isCorner(7) && Board.isCorner(14) && Board.isCorner(21));
  assert.ok(!Board.isCorner(1) && !Board.isCorner(20));
});
test("her mülk kare bir fiyat/kira taşır", () => {
  const board = Board.buildBoard();
  board.filter((t) => t.type === "property").forEach((t) => {
    assert.ok(t.price > 0);
    assert.ok(t.rent > 0);
    assert.strictEqual(t.ownerId, null);
  });
});

console.log("economy.js");
test("oyuncu 1500₺ ile başlar", () => {
  const p = Economy.createPlayer(0, true);
  assert.strictEqual(p.cash, 1500);
});
test("yetersiz nakitte mülk satın alınamaz", () => {
  const p = Economy.createPlayer(0, true);
  p.cash = 50;
  const board = Board.buildBoard();
  const tile = board.find((t) => t.type === "property");
  const bought = Economy.buyProperty(p, tile);
  assert.strictEqual(bought, false);
  assert.strictEqual(tile.ownerId, null);
});
test("grubun tamamı elindeyse kira 2 katına çıkar", () => {
  const board = Board.buildBoard();
  const owner = Economy.createPlayer(0, true);
  const groupTiles = board.filter((t) => t.type === "property" && t.group === 0);
  groupTiles.forEach((t) => Economy.buyProperty(owner, t));
  const rent = Economy.rentDue(board, groupTiles[0]);
  assert.strictEqual(rent, groupTiles[0].rent * 2);
});
test("negatif bakiye oyuncuyu iflas ettirir", () => {
  const p = Economy.createPlayer(0, true);
  const bankrupt = Economy.pay(p, 5000);
  assert.strictEqual(bankrupt, true);
  assert.strictEqual(p.bankrupt, true);
});

console.log("turns.js");
test("createGame 4 oyuncu üretir, ilki insan", () => {
  const game = Turns.createGame(4);
  assert.strictEqual(game.players.length, 4);
  assert.strictEqual(game.players[0].isHuman, true);
  assert.strictEqual(game.players[1].isHuman, false);
});
test("moveCurrentPlayer pozisyonu 0-27 arasında tutar", () => {
  const game = Turns.createGame(2);
  for (let i = 0; i < 50; i++) {
    Turns.moveCurrentPlayer(game);
    const p = Turns.currentPlayer(game);
    assert.ok(p.position >= 0 && p.position < Turns.BOARD_SIZE);
  }
});
test("başlangıçtan geçince maaş verilir", () => {
  const game = Turns.createGame(2);
  const player = Turns.currentPlayer(game);
  player.position = 26; // start'a (0) yakın, 2+ atışta geçecek
  const startCash = player.cash;
  let sawSalary = false;
  for (let i = 0; i < 5 && !sawSalary; i++) {
    const before = player.cash;
    const info = Turns.moveCurrentPlayer(game);
    if (info.passedStart) { sawSalary = true; assert.ok(player.cash >= before); }
    player.position = 26; // tekrar başlangıca yakın konuma sabitle
  }
  assert.ok(sawSalary, "en az bir denemede başlangıçtan geçilmeliydi");
});
test("resolveLanding offer-buy döner (sahipsiz mülk)", () => {
  const game = Turns.createGame(2);
  const player = Turns.currentPlayer(game);
  const tile = game.board.find((t) => t.type === "property");
  const result = Turns.resolveLanding(game, player, tile);
  assert.strictEqual(result.kind, "offer-buy");
});
test("resolveLanding rent döner (başkasının mülkü)", () => {
  const game = Turns.createGame(2);
  const owner = game.players[1];
  const tile = game.board.find((t) => t.type === "property");
  Economy.buyProperty(owner, tile);
  const player = game.players[0];
  const cashBefore = player.cash;
  const result = Turns.resolveLanding(game, player, tile);
  assert.strictEqual(result.kind, "rent");
  assert.strictEqual(player.cash, cashBefore - result.amount);
});
test("advanceTurn iflas edenleri atlar", () => {
  const game = Turns.createGame(3);
  game.players[1].bankrupt = true;
  game.currentIndex = 0;
  Turns.advanceTurn(game);
  assert.strictEqual(game.currentIndex, 2);
});
test("checkGameOver tek oyuncu kalınca biter", () => {
  const game = Turns.createGame(3);
  game.players[1].bankrupt = true;
  game.players[2].bankrupt = true;
  const over = Turns.checkGameOver(game);
  assert.strictEqual(over, true);
  assert.strictEqual(game.winner.id, 0);
});

console.log(`\n${passed} test geçti.`);
