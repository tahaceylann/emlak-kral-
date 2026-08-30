"use strict";
/**
 * Tur/oyun durum makinesi. Saf mantık — DOM'a veya Three.js'e dokunmaz;
 * app.js bu modülün ürettiği "olay" nesnelerine bakıp arayüzü/animasyonu
 * sürer. Böylece mantık test edilebilir (bkz. test/engine.test.js) ve
 * render katmanından bağımsız kalır.
 */

// Node'da require, tarayıcıda global script sırası ile yüklenir.
const Board = typeof require !== "undefined" ? require("./board.js") : window.BoardModule;
const Economy = typeof require !== "undefined" ? require("./economy.js") : window.EconomyModule;
const Cards = typeof require !== "undefined" ? require("./cards.js") : window.CardsModule;
const Dice = typeof require !== "undefined" ? require("./dice.js") : window.DiceModule;

const BOARD_SIZE = 28;

function createGame(numPlayers, humanShape, customBoardDef) {
  const players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push(Economy.createPlayer(i, i === 0, i === 0 ? humanShape : undefined));
  }
  return {
    board: Board.buildBoard(customBoardDef),
    players,
    currentIndex: 0,
    turnNumber: 1,
    log: [],
    over: false,
    winner: null,
  };
}

function logEvent(game, text) {
  game.log.unshift(text);
  if (game.log.length > 50) game.log.length = 50;
}

function currentPlayer(game) {
  return game.players[game.currentIndex];
}

/** Zar atıp oyuncuyu ilerletir. Başlangıçtan geçtiyse maaş verir. */
function moveCurrentPlayer(game) {
  const player = currentPlayer(game);
  const roll = Dice.rollDice();
  const from = player.position;
  const to = (from + roll.total) % BOARD_SIZE;
  const passedStart = to < from || (from + roll.total) >= BOARD_SIZE;
  player.position = to;
  if (passedStart) {
    Economy.receive(player, Economy.SALARY);
    logEvent(game, `${player.name} başlangıçtan geçti, +${Economy.SALARY}₺ maaş aldı.`);
  }
  return { roll, from, to, passedStart };
}

/**
 * Oyuncunun üzerine geldiği kareyi çözer. `kind` alanına göre app.js
 * gerekli UI/animasyonu tetikler. Mülk satın alma kararı hariç her şey
 * burada doğrudan uygulanır.
 */
function resolveLanding(game, player, tile) {
  switch (tile.type) {
    case "start":
      return { kind: "start", tile };

    case "rest": {
      if (tile.bonus) {
        Economy.receive(player, tile.bonus);
        logEvent(game, `${player.name} ${tile.name}'de ${tile.bonus}₺ bonus buldu.`);
      } else {
        logEvent(game, `${player.name} ${tile.name}'de mola verdi.`);
      }
      return { kind: "rest", tile, bonus: tile.bonus || 0 };
    }

    case "tax": {
      const wentBankrupt = Economy.pay(player, tile.amount);
      logEvent(game, `${player.name}, ${tile.name} için ${tile.amount}₺ ödedi.`);
      return { kind: "tax", tile, amount: tile.amount, wentBankrupt };
    }

    case "chance": {
      const card = Cards.drawCard();
      if (card.cash >= 0) Economy.receive(player, card.cash);
      const wentBankrupt = card.cash < 0 ? Economy.pay(player, -card.cash) : false;
      logEvent(game, `${player.name}: "${card.text}" (${card.cash >= 0 ? "+" : ""}${card.cash}₺)`);
      return { kind: "chance", tile, card, wentBankrupt };
    }

    case "property": {
      if (tile.ownerId === null) {
        return { kind: "offer-buy", tile };
      }
      if (tile.ownerId === player.id) {
        return { kind: "own-property", tile };
      }
      const owner = game.players[tile.ownerId];
      const amount = Economy.rentDue(game.board, tile);
      const wentBankrupt = Economy.pay(player, amount);
      Economy.receive(owner, amount);
      logEvent(game, `${player.name}, ${owner.name}'e ${tile.name} için ${amount}₺ kira ödedi.`);
      return { kind: "rent", tile, amount, toPlayerId: owner.id, wentBankrupt };
    }

    default:
      return { kind: "noop", tile };
  }
}

function applyBuyDecision(game, player, tile, buy) {
  if (!buy) {
    logEvent(game, `${player.name}, ${tile.name}'i almadı.`);
    return false;
  }
  const bought = Economy.buyProperty(player, tile);
  if (bought) logEvent(game, `${player.name}, ${tile.name}'i ${tile.price}₺ karşılığında satın aldı.`);
  return bought;
}

/** Basit bot kararı: elinde yeterli tampon nakit varsa mülkü satın alır. */
function botShouldBuy(player, tile) {
  return player.cash - tile.price >= 200;
}

/** Sıradaki iflas etmemiş oyuncuya geçer; tur numarasını günceller. */
function advanceTurn(game) {
  const n = game.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (game.currentIndex + i) % n;
    if (!game.players[idx].bankrupt) {
      if (idx <= game.currentIndex) game.turnNumber++;
      game.currentIndex = idx;
      return;
    }
  }
}

function checkGameOver(game) {
  const alive = game.players.filter((p) => !p.bankrupt);
  if (alive.length <= 1) {
    game.over = true;
    game.winner = alive[0] || null;
  }
  return game.over;
}

const TurnsModule = {
  BOARD_SIZE, createGame, currentPlayer, moveCurrentPlayer, resolveLanding,
  applyBuyDecision, botShouldBuy, advanceTurn, checkGameOver, logEvent,
};
if (typeof module !== "undefined" && module.exports) module.exports = TurnsModule;
if (typeof window !== "undefined") window.TurnsModule = TurnsModule;
