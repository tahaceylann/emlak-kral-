"use strict";
/**
 * Çok oyunculu WebSocket istemcisi. Sunucudan gelen mesajları `on(type, fn)`
 * ile kayıtlı dinleyicilere iletir; app.js bu dinleyicileri game döngüsüne
 * bağlar. Oyun mantığının hiçbiri burada değil — sunucu yetkilidir.
 */
const NetModule = (() => {
  let ws = null;
  const handlers = {};

  function on(type, fn) { handlers[type] = fn; }

  function connect(url) {
    return new Promise((resolve, reject) => {
      try {
        ws = new WebSocket(url);
      } catch (e) { reject(e); return; }
      const onOpenOnce = () => { ws.removeEventListener("error", onErrorOnce); resolve(); };
      const onErrorOnce = () => { reject(new Error("Sunucuya bağlanılamadı.")); };
      ws.addEventListener("open", onOpenOnce, { once: true });
      ws.addEventListener("error", onErrorOnce, { once: true });
      ws.addEventListener("message", (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        const h = handlers[msg.type];
        if (h) h(msg);
      });
      ws.addEventListener("close", () => { if (handlers.close) handlers.close(); });
    });
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  function createRoom(name) { send({ type: "create_room", name }); }
  function joinRoom(code, name) { send({ type: "join_room", code, name }); }
  function startGame(boardDef) { send({ type: "start_game", boardDef }); }
  function roll() { send({ type: "roll" }); }
  function buyDecision(buy) { send({ type: "buy_decision", buy }); }
  function disconnect() { if (ws) { ws.close(); ws = null; } }
  function isConnected() { return !!ws && ws.readyState === WebSocket.OPEN; }

  return { on, connect, disconnect, isConnected, createRoom, joinRoom, startGame, roll, buyDecision };
})();
window.NetModule = NetModule;
