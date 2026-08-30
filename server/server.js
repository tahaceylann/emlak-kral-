"use strict";
/**
 * Emlak Kralı — gerçek zamanlı çok oyunculu WebSocket sunucusu.
 *
 * Yetkili (authoritative) tur/ekonomi mantığı istemciyle AYNI dosyaları
 * (client/engine/turns.js, economy.js, board.js, cards.js, dice.js)
 * doğrudan require eder — mantık iki yerde ayrı ayrı yazılıp birbirinden
 * sapmasın diye. İstemci sadece server'ın gönderdiği state'i render eder.
 */
const http = require("http");
const { WebSocketServer } = require("ws");
const Rooms = require("./rooms.js");

const Turns = require("../client/engine/turns.js");
const Board = require("../client/engine/board.js");

const KNOWN_TILE_TYPES = new Set(["start", "property", "chance", "tax", "rest"]);

/** İstemciden gelen özel haritayı kabul etmeden önce hafif bir sağlık kontrolü. */
function sanitizeBoardDef(def) {
  if (!Array.isArray(def) || def.length !== Board.BOARD_DEF.length) return undefined;
  if (!def[0] || def[0].type !== "start") return undefined;
  const ok = def.every((t) => t && KNOWN_TILE_TYPES.has(t.type) && typeof t.name === "string" && t.name.trim() &&
    (t.type !== "property" || (Number.isInteger(t.group) && t.group >= 0 && t.group < Board.PROPERTY_GROUPS.length)));
  return ok ? def : undefined;
}

const PORT = process.env.PORT || 8081;
const BOT_DELAY_MS = 900;

function send(socket, obj) {
  if (socket && socket.readyState === socket.OPEN) socket.send(JSON.stringify(obj));
}
function broadcast(room, obj) {
  room.slots.forEach((s) => { if (s && s.socket) send(s.socket, obj); });
}
function sendToSlot(room, slot, obj) {
  const s = room.slots[slot];
  if (s && s.socket) send(s.socket, obj);
}

function roomSummary(room) {
  return {
    type: "room",
    code: room.code,
    hostSlot: room.hostSlot,
    started: room.started,
    players: room.slots.map((s) => s ? { name: s.name, connected: !!s.socket, isHuman: true } : null),
  };
}
function broadcastRoom(room) {
  room.slots.forEach((s, slot) => {
    if (s && s.socket) send(s.socket, Object.assign(roomSummary(room), { yourSlot: slot }));
  });
}

/** İnsan slotu bağlı değilse (koptuysa) sırası geldiğinde bot gibi oynatılır. */
function slotIsPlayable(room, slot) {
  const s = room.slots[slot];
  return !s || !!s.socket; // bot slotu (null) ya da bağlı insan
}

function startGame(room, boardDef) {
  room.started = true;
  const game = Turns.createGame(Rooms.MAX_SLOTS, undefined, boardDef);
  game.players.forEach((p, i) => {
    const s = room.slots[i];
    p.isHuman = !!s; // dolu slot = insan, boş slot = bot
    if (s) p.name = s.name;
  });
  room.game = game;
  broadcast(room, { type: "started" });
  broadcast(room, { type: "state", game });
  serverPlayTurn(room);
}

function serverPlayTurn(room) {
  const game = room.game;
  if (!game || game.over) return;
  const player = Turns.currentPlayer(game);
  if (player.isHuman && slotIsPlayable(room, player.id)) {
    // İnsan oyuncunun 'roll' mesajı beklenir (bkz. ws.on('message')).
    return;
  }
  // Bot (ya da bağlantısı kopmuş insan) — kısa gecikmeyle otomatik oyna.
  setTimeout(() => {
    if (room.game !== game || game.over) return; // oda bu arada kapanmış/yeniden başlamış olabilir
    doRollAndResolve(room);
  }, BOT_DELAY_MS);
}

function doRollAndResolve(room) {
  const game = room.game;
  const player = Turns.currentPlayer(game);
  const moveInfo = Turns.moveCurrentPlayer(game);
  broadcast(room, { type: "move", playerId: player.id, ...moveInfo });

  const tile = game.board[player.position];
  const result = Turns.resolveLanding(game, player, tile);
  broadcast(room, { type: "landing", playerId: player.id, tileIndex: tile.index, result });
  broadcast(room, { type: "state", game });

  if (result.kind === "offer-buy") {
    if (player.isHuman && slotIsPlayable(room, player.id)) {
      room.pendingBuy = { slot: player.id, tileIndex: tile.index };
      sendToSlot(room, player.id, { type: "buy_offer", tileIndex: tile.index });
      return; // buy_decision mesajı bekleniyor
    }
    const buy = Turns.botShouldBuy(player, tile);
    Turns.applyBuyDecision(game, player, tile, buy);
    broadcast(room, { type: "state", game });
  }
  finishStep(room);
}

function finishStep(room) {
  const game = room.game;
  if (Turns.checkGameOver(game)) {
    broadcast(room, { type: "state", game });
    broadcast(room, { type: "game_over" });
    return;
  }
  Turns.advanceTurn(game);
  broadcast(room, { type: "state", game });
  serverPlayTurn(room);
}

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("Emlak Kralı çok oyunculu sunucusu çalışıyor.\n");
});
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (socket) => {
  let roomCode = null;
  let mySlot = null;

  socket.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }

    if (msg.type === "create_room") {
      const room = Rooms.createRoom();
      mySlot = Rooms.joinRoom(room, socket, msg.name);
      roomCode = room.code;
      broadcastRoom(room);
      return;
    }

    if (msg.type === "join_room") {
      const room = Rooms.getRoom(msg.code);
      if (!room) { send(socket, { type: "error", message: "Oda bulunamadı." }); return; }
      if (room.started) { send(socket, { type: "error", message: "Oyun zaten başladı." }); return; }
      const slot = Rooms.joinRoom(room, socket, msg.name);
      if (slot === -1) { send(socket, { type: "error", message: "Oda dolu." }); return; }
      mySlot = slot;
      roomCode = room.code;
      broadcastRoom(room);
      return;
    }

    if (!roomCode) return;
    const room = Rooms.getRoom(roomCode);
    if (!room) return;

    if (msg.type === "start_game") {
      if (mySlot !== room.hostSlot || room.started) return;
      startGame(room, sanitizeBoardDef(msg.boardDef));
      return;
    }

    if (msg.type === "roll") {
      if (!room.started || !room.game || room.game.over) return;
      const current = Turns.currentPlayer(room.game);
      if (current.id !== mySlot || room.pendingBuy) return; // sıra sende değil ya da bekleyen bir karar var
      doRollAndResolve(room);
      return;
    }

    if (msg.type === "buy_decision") {
      if (!room.pendingBuy || room.pendingBuy.slot !== mySlot) return;
      const game = room.game;
      const player = Turns.currentPlayer(game);
      const tile = game.board[room.pendingBuy.tileIndex];
      const bought = Turns.applyBuyDecision(game, player, tile, !!msg.buy);
      room.pendingBuy = null;
      broadcast(room, { type: "buy_result", playerId: player.id, tileIndex: tile.index, bought });
      broadcast(room, { type: "state", game });
      finishStep(room);
      return;
    }
  });

  socket.on("close", () => {
    if (!roomCode || mySlot === null) return;
    const room = Rooms.getRoom(roomCode);
    if (!room) return;
    Rooms.leaveRoom(room, mySlot);
    if (Rooms.roomIsEmpty(room)) { Rooms.destroyRoom(roomCode); return; }
    broadcastRoom(room);
    // Sıra, bağlantısı kopan oyuncudaysa bot moduna düşüp devam etsin.
    if (room.started && room.game && !room.game.over) {
      const current = Turns.currentPlayer(room.game);
      if (current.id === mySlot) serverPlayTurn(room);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Emlak Kralı WebSocket sunucusu :${PORT} üzerinde dinliyor.`);
});
