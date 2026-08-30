"use strict";
/**
 * Harita editörü — saf yardımcı fonksiyonlar (doğrulama, localStorage,
 * paylaşım kodu). Form/DOM inşası app.js'te (diğer modallarla aynı
 * desende); burası engine/board.js'in BOARD_DEF şekline bağlı kalır ki
 * `Board.buildBoard(customDef)` doğrudan kabul edebilsin.
 */
const EditorModule = (() => {
  const Board = typeof require !== "undefined" ? require("./../engine/board.js") : window.BoardModule;
  const STORAGE_KEY = "emlak-kral-custom-board-v1";
  const TILE_TYPES = [
    { id: "property", label: "Mülk" },
    { id: "chance", label: "Şans" },
    { id: "tax", label: "Vergi" },
    { id: "rest", label: "Dinlenme" },
  ];

  function getDefaultDef() {
    return Board.cloneDefaultDef();
  }

  function loadSavedDef() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const def = JSON.parse(raw);
      return isValidDef(def) ? def : null;
    } catch (e) { return null; }
  }

  function saveDef(def) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(def)); } catch (e) { /* yok say */ }
  }

  function clearSavedDef() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* yok say */ }
  }

  /** Uzunluk + her karonun tipe göre zorunlu alanları var mı, temel kontrol. */
  function isValidDef(def) {
    if (!Array.isArray(def) || def.length !== Board.BOARD_DEF.length) return false;
    if (!def[0] || def[0].type !== "start") return false;
    return def.every((t) => {
      if (!t || typeof t.name !== "string" || !t.name.trim()) return false;
      if (t.type === "property") return Number.isInteger(t.group) && t.group >= 0 && t.group < Board.PROPERTY_GROUPS.length;
      if (t.type === "tax") return typeof t.amount === "number" && t.amount >= 0;
      if (t.type === "rest" || t.type === "chance" || t.type === "start") return true;
      return false;
    });
  }

  /** Paylaşım kodu: kompakt JSON'u base64'e sarar (URL/mesajla kopyalanabilir). */
  function encodeShareCode(def) {
    const json = JSON.stringify(def);
    return btoa(unescape(encodeURIComponent(json)));
  }
  function decodeShareCode(code) {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const def = JSON.parse(json);
    if (!isValidDef(def)) throw new Error("Kod geçersiz ya da bozuk bir harita içeriyor.");
    return def;
  }

  return {
    TILE_TYPES, getDefaultDef, loadSavedDef, saveDef, clearSavedDef,
    isValidDef, encodeShareCode, decodeShareCode,
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = EditorModule;
if (typeof window !== "undefined") window.EditorModule = EditorModule;
