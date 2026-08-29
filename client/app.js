"use strict";
/**
 * Uygulama kabuğu ve oyun döngüsü orkestrasyonu. engine/* modüllerindeki
 * saf mantığı DOM olaylarına ve Three.js animasyonlarına bağlar.
 */
(function () {
  const Turns = window.TurnsModule;
  const Render = window.RenderModule;

  const NUM_PLAYERS = 4;
  const BOT_MOVE_DELAY = 700;

  let game = null;
  let awaitingHuman = false;

  const el = (id) => document.getElementById(id);
  const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  function newGame() {
    game = Turns.createGame(NUM_PLAYERS);
    Render.buildBoardTiles(game.board);
    Render.createPawns(game.players);
    Turns.logEvent(game, "Yeni oyun başladı. İyi şanslar!");
    render();
    el("winModal").classList.add("hidden");
    el("modalOverlay").classList.add("hidden");
    setControlsEnabled(true);
  }

  function setControlsEnabled(enabled) {
    el("rollBtn").disabled = !enabled;
  }

  function render() {
    el("turnNumber").textContent = game.turnNumber;
    renderPlayerPanel();
    renderLog();
  }

  function renderPlayerPanel() {
    const panel = el("playerPanel");
    panel.innerHTML = "";
    game.players.forEach((p) => {
      const row = document.createElement("div");
      row.className = "player-row" +
        (p.id === game.currentIndex ? " active" : "") +
        (p.bankrupt ? " bankrupt" : "");
      const swatch = `<span class="swatch" style="background:#${p.color.toString(16).padStart(6, "0")}"></span>`;
      row.innerHTML = `${swatch}<span class="pname">${p.name}${p.bankrupt ? " (iflas)" : ""}</span>` +
        `<span class="pcash">${p.cash}₺</span><span class="pprops">${p.properties.length} mülk</span>`;
      panel.appendChild(row);
    });
  }

  function renderLog() {
    const logPanel = el("logPanel");
    logPanel.innerHTML = game.log.slice(0, 6).map((line) => `<div>${line}</div>`).join("");
  }

  function showDice(roll) {
    const disp = el("diceDisplay");
    disp.classList.remove("hidden");
    el("diceA").textContent = DICE_FACES[roll.a];
    el("diceB").textContent = DICE_FACES[roll.b];
    disp.classList.add("roll-anim");
    setTimeout(() => disp.classList.remove("roll-anim"), 400);
  }

  function buildPath(from, to, boardSize) {
    const path = [from];
    let cur = from;
    while (cur !== to) {
      cur = (cur + 1) % boardSize;
      path.push(cur);
    }
    return path;
  }

  function showBuyModal(tile) {
    return new Promise((resolve) => {
      const groupName = window.BoardModule.PROPERTY_GROUPS[tile.group].name;
      el("buyTileName").textContent = tile.name;
      el("buyTileInfo").textContent =
        `${groupName} bölgesi · Fiyat: ${tile.price}₺ · Kira: ${tile.rent}₺ (aynı bölge tamamsa ${tile.rent * 2}₺)`;
      el("modalOverlay").classList.remove("hidden");
      el("buyModal").classList.remove("hidden");

      function cleanup(result) {
        el("modalOverlay").classList.add("hidden");
        el("buyModal").classList.add("hidden");
        yesBtn.removeEventListener("click", onYes);
        noBtn.removeEventListener("click", onNo);
        resolve(result);
      }
      const yesBtn = el("buyYesBtn"), noBtn = el("buyNoBtn");
      const onYes = () => cleanup(true);
      const onNo = () => cleanup(false);
      yesBtn.addEventListener("click", onYes);
      noBtn.addEventListener("click", onNo);
    });
  }

  function showWinModal() {
    el("winTitle").textContent = game.winner ? `🏆 ${game.winner.name} kazandı!` : "Oyun bitti";
    el("winSubtitle").textContent = game.winner
      ? `${game.winner.cash}₺ nakit ve ${game.winner.properties.length} mülk ile şehrin kralı oldu.`
      : "Tüm oyuncular iflas etti.";
    el("modalOverlay").classList.remove("hidden");
    el("winModal").classList.remove("hidden");
  }

  async function playTurn() {
    setControlsEnabled(false);
    const player = Turns.currentPlayer(game);
    const moveInfo = Turns.moveCurrentPlayer(game);
    showDice(moveInfo.roll);
    render();

    const path = buildPath(moveInfo.from, moveInfo.to, Turns.BOARD_SIZE);
    await new Promise((resolve) =>
      Render.movePawnAlongPath(player.id, path, Turns.BOARD_SIZE, resolve)
    );

    const tile = game.board[player.position];
    const result = Turns.resolveLanding(game, player, tile);
    render();

    if (result.kind === "offer-buy") {
      let buy;
      if (player.isHuman) {
        buy = await showBuyModal(tile);
      } else {
        buy = Turns.botShouldBuy(player, tile);
      }
      Turns.applyBuyDecision(game, player, tile, buy);
      Render.buildBoardTiles(game.board); // fiyat/renk etiketlerini güncelle
      Render.createPawns(game.players); // piyonları da yeniden yerleştir (mevcut tile üzerinde kalır)
      // Piyonları hemen konumlandırdığımız için mini bir sıçrama yok; kabul edilebilir bir basitleştirme.
      render();
    }

    render();

    const over = Turns.checkGameOver(game);
    if (over) {
      setControlsEnabled(false);
      showWinModal();
      return;
    }

    Turns.advanceTurn(game);
    render();

    const next = Turns.currentPlayer(game);
    if (next.isHuman) {
      setControlsEnabled(true);
    } else {
      setTimeout(playTurn, BOT_MOVE_DELAY);
    }
  }

  function wireEvents() {
    el("rollBtn").addEventListener("click", () => {
      if (!game || game.over) return;
      playTurn();
    });
    el("restartBtn").addEventListener("click", () => {
      if (confirm("Oyunu yeniden başlatmak istiyor musun?")) newGame();
    });
    el("winRestartBtn").addEventListener("click", newGame);
    window.addEventListener("resize", Render.handleResize);
  }

  function init() {
    const canvas = el("boardCanvas");
    Render.init(canvas);
    Render.startLoop();
    wireEvents();
    newGame();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
