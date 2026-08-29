"use strict";
/**
 * Şans kartı destesi. Her kart bir metin ve bir para etkisi taşır
 * (pozitif = kazanç, negatif = kayıp). `apply` her zaman `cash` alanına
 * göre çalışır; oyuncu state'ine dokunmaz — çağıran taraf (turns.js) uygular.
 */
const CHANCE_CARDS = [
  { text: "Kısa bir kira geliri yakaladın.", cash: 150 },
  { text: "Beklenmedik onarım masrafı çıktı.", cash: -100 },
  { text: "Emlak piyasası senin lehine hareket etti.", cash: 200 },
  { text: "Vergi iadesi hesabına yattı.", cash: 100 },
  { text: "Bir komisyon ödemesi yapman gerekti.", cash: -75 },
  { text: "Yatırım fonundan temettü geldi.", cash: 250 },
  { text: "Beklenmedik bir ceza ödedin.", cash: -150 },
  { text: "Şanslı bir gün, küçük bir ikramiye kazandın.", cash: 50 },
];

function drawCard() {
  return CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)];
}

const CardsModule = { CHANCE_CARDS, drawCard };
if (typeof module !== "undefined" && module.exports) module.exports = CardsModule;
if (typeof window !== "undefined") window.CardsModule = CardsModule;
