"use strict";
/** Oda (room) yönetimi: kod üretme, katılma, slot ataması. Bellek içi — DB yok, MVP için yeterli. */

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // karışabilecek karakterler çıkarıldı (0/O, 1/I)
const MAX_SLOTS = 4;

const rooms = new Map(); // code -> room

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function createRoom() {
  const code = generateCode();
  const room = {
    code,
    slots: [null, null, null, null], // her biri null ya da { socket, name, isHuman:true }
    hostSlot: 0,
    started: false,
    game: null,
    pendingBuy: null, // { slot, tile }
  };
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get((code || "").toUpperCase());
}

function findFreeSlot(room) {
  for (let i = 0; i < MAX_SLOTS; i++) if (!room.slots[i]) return i;
  return -1;
}

function joinRoom(room, socket, name) {
  const slot = findFreeSlot(room);
  if (slot === -1) return -1;
  room.slots[slot] = { socket, name: (name || `Oyuncu ${slot + 1}`).slice(0, 20), isHuman: true };
  return slot;
}

/** Socket bağlantısı koptuğunda slotu boşaltır (oyun başlamadıysa) ya da botlaştırır (oyun başladıysa). */
function leaveRoom(room, slot) {
  if (!room.slots[slot]) return;
  if (room.started) {
    room.slots[slot].socket = null; // bağlantı koptu ama sırası geldiğinde bot gibi oynamaya devam eder
  } else {
    room.slots[slot] = null;
  }
}

function roomIsEmpty(room) {
  return room.slots.every((s) => !s || !s.socket);
}

function destroyRoom(code) {
  rooms.delete(code);
}

module.exports = { createRoom, getRoom, joinRoom, leaveRoom, roomIsEmpty, destroyRoom, MAX_SLOTS };
