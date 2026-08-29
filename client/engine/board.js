"use strict";
/**
 * Tahta veri modeli.
 *
 * 28 karelik kare bir döngü: 4 köşe + her kenarda 6 ara kare (7 kare/kenar,
 * köşeler komşu kenarlarla paylaşılır → 4*(8-1) = 28 benzersiz kare).
 *
 * Kare tipleri:
 *  - "start"    : Başlangıç. Üzerinden geçince/üzerine gelince maaş verir.
 *  - "property" : Satın alınabilir mülk. `group` aynı renk grubundaki
 *                 mülkleri işaret eder (grubun tamamı bir oyuncudaysa kira 2x).
 *  - "chance"   : Şans kartı çekilir (bkz. cards.js).
 *  - "tax"      : Sabit bir miktar bankaya ödenir.
 *  - "rest"     : Dinlenme/köşe karesi, şimdilik etkisiz (M2/M3'te
 *                 bonus/hapishane gibi mekanikler eklenebilir).
 */

// Renk grubu paleti — 8 grup, ucuzdan pahalıya doğru sıralı.
const PROPERTY_GROUPS = [
  { id: 0, name: "Kadıköy Yakası", color: 0x8d6e63 },
  { id: 1, name: "Beşiktaş Sahili", color: 0x5c6bc0 },
  { id: 2, name: "Nişantaşı", color: 0xab47bc },
  { id: 3, name: "Maslak Ofis", color: 0xffa726 },
  { id: 4, name: "Levent Plaza", color: 0xef5350 },
  { id: 5, name: "Bebek Koyu", color: 0x29b6f6 },
  { id: 6, name: "Karaköy Loft", color: 0x66bb6a },
  { id: 7, name: "Taksim Meydanı", color: 0xffd54f },
];

function priceForGroup(groupId) {
  return 120 + groupId * 90;
}
function rentForGroup(groupId) {
  return Math.round(priceForGroup(groupId) * 0.12);
}

// Ham tahta tanımı — sırayla 28 kare. group referansı PROPERTY_GROUPS index'i.
const BOARD_DEF = [
  { type: "start", name: "Başlangıç" },
  { type: "property", name: "Kadıköy Çarşı", group: 0 },
  { type: "property", name: "Moda Sırtları", group: 0 },
  { type: "chance", name: "Şans" },
  { type: "property", name: "Beşiktaş Meydan", group: 1 },
  { type: "property", name: "Ortaköy Sahil", group: 1 },
  { type: "tax", name: "Vergi Dairesi", amount: 100 },
  { type: "rest", name: "Dinlenme Molası" },
  { type: "property", name: "Nişantaşı Cadde", group: 2 },
  { type: "property", name: "Teşvikiye", group: 2 },
  { type: "chance", name: "Şans" },
  { type: "property", name: "Maslak Kule", group: 3 },
  { type: "property", name: "Maslak Plaza", group: 3 },
  { type: "tax", name: "Gümrük Vergisi", amount: 150 },
  { type: "rest", name: "Gözlem Noktası" },
  { type: "property", name: "Levent 4.Levent", group: 4 },
  { type: "property", name: "Levent Zorlu", group: 4 },
  { type: "chance", name: "Şans" },
  { type: "property", name: "Bebek Koyu", group: 5 },
  { type: "property", name: "Arnavutköy", group: 5 },
  { type: "tax", name: "Vergi Dairesi", amount: 120 },
  { type: "rest", name: "Şehir Meydanı", bonus: 200 },
  { type: "property", name: "Karaköy Loft", group: 6 },
  { type: "property", name: "Galata Kule", group: 6 },
  { type: "chance", name: "Şans" },
  { type: "property", name: "Cihangir", group: 7 },
  { type: "property", name: "Taksim Meydanı", group: 7 },
  { type: "tax", name: "Lüks Konut Vergisi", amount: 250 },
];

/** Tahtayı, tur içindeki her ekonomik alanın fiyat/kira bilgisiyle üretir. */
function buildBoard() {
  return BOARD_DEF.map((def, index) => {
    const tile = { index, ...def };
    if (tile.type === "property") {
      tile.price = priceForGroup(tile.group);
      tile.rent = rentForGroup(tile.group);
      tile.ownerId = null;
    }
    return tile;
  });
}

/** 28 kareyi kare bir döngüde 3D koordinatlara yerleştirir (2 birim/kare). */
function tilePosition(index) {
  const step = 2;
  const tilesPerSide = 7;
  const half = (tilesPerSide * step) / 2; // 7 — köşeden merkeze mesafe
  let x = 0, z = 0;
  if (index < 7) { // alt kenar: sağdan sola
    x = half - index * step; z = half;
  } else if (index < 14) { // sol kenar: aşağıdan yukarı
    x = -half; z = half - (index - 7) * step;
  } else if (index < 21) { // üst kenar: soldan sağa
    x = -half + (index - 14) * step; z = -half;
  } else { // sağ kenar: yukarıdan aşağı
    x = half; z = -half + (index - 21) * step;
  }
  return { x, z };
}

function isCorner(index) {
  return index === 0 || index === 7 || index === 14 || index === 21;
}

// Node (test scripti) ve tarayıcı (plain <script>) ikisinde de çalışsın.
const BoardModule = {
  PROPERTY_GROUPS, BOARD_DEF, buildBoard, tilePosition, isCorner,
  priceForGroup, rentForGroup,
};
if (typeof module !== "undefined" && module.exports) module.exports = BoardModule;
if (typeof window !== "undefined") window.BoardModule = BoardModule;
