"use strict";
/** Oyuncu state'i ve para hareketleri. */

const STARTING_CASH = 1500;
const SALARY = 200;

const PLAYER_COLORS = [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835];
const PLAYER_LABELS = ["Sen", "Bot 1", "Bot 2", "Bot 3"];

function createPlayer(id, isHuman) {
  return {
    id,
    name: PLAYER_LABELS[id] || `Oyuncu ${id + 1}`,
    isHuman: !!isHuman,
    color: PLAYER_COLORS[id % PLAYER_COLORS.length],
    cash: STARTING_CASH,
    position: 0,
    properties: [],
    bankrupt: false,
  };
}

/** Oyuncudan miktarı düş; yetersizse iflas eder (kalan borç bilgisiyle döner). */
function pay(player, amount) {
  player.cash -= amount;
  if (player.cash < 0) {
    player.bankrupt = true;
  }
  return player.bankrupt;
}

function receive(player, amount) {
  player.cash += amount;
}

/** Bir renk grubundaki tüm mülkler aynı oyuncuya mı ait, kontrol eder. */
function ownsFullGroup(board, player, groupId) {
  const groupTiles = board.filter((t) => t.type === "property" && t.group === groupId);
  return groupTiles.length > 0 && groupTiles.every((t) => t.ownerId === player.id);
}

function buyProperty(player, tile) {
  if (tile.type !== "property" || tile.ownerId !== null) return false;
  if (player.cash < tile.price) return false;
  player.cash -= tile.price;
  tile.ownerId = player.id;
  player.properties.push(tile.index);
  return true;
}

/** Kirayı hesaplar: grubun tamamı elindeyse 2x. */
function rentDue(board, tile) {
  const owner = tile.ownerId;
  if (owner === null) return 0;
  const fullGroup = board
    .filter((t) => t.type === "property" && t.group === tile.group)
    .every((t) => t.ownerId === owner);
  return fullGroup ? tile.rent * 2 : tile.rent;
}

const EconomyModule = {
  STARTING_CASH, SALARY, PLAYER_COLORS, PLAYER_LABELS,
  createPlayer, pay, receive, ownsFullGroup, buyProperty, rentDue,
};
if (typeof module !== "undefined" && module.exports) module.exports = EconomyModule;
if (typeof window !== "undefined") window.EconomyModule = EconomyModule;
