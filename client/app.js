"use strict";
/**
 * Uygulama kabuğu ve oyun döngüsü orkestrasyonu. engine/* modüllerindeki
 * saf mantığı DOM olaylarına ve Three.js animasyonlarına bağlar.
 */
(function () {
  const Turns = window.TurnsModule;
  const Render = window.RenderModule;
  const Pieces = window.PiecesModule;

  const NUM_PLAYERS = 4;
  const BOT_MOVE_DELAY = 700;
  const CUSTOM_STORAGE_KEY = "emlak-kral-custom-v1";
  const DICE_THEMES = [
    { id: "gold", name: "Altın", color: "#ffd54f" },
    { id: "blue", name: "Mavi", color: "#42a5f5" },
    { id: "red", name: "Kırmızı", color: "#ef5350" },
    { id: "green", name: "Yeşil", color: "#66bb6a" },
  ];

  let game = null;
  let custom = loadCustom();

  const el = (id) => document.getElementById(id);
  const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  function loadCustom() {
    try {
      const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (raw) return Object.assign({ shape: "pawn", dice: "gold" }, JSON.parse(raw));
    } catch (e) { /* localStorage yoksa/bozuksa varsayılana düş */ }
    return { shape: "pawn", dice: "gold" };
  }
  function saveCustom() {
    try { localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(custom)); } catch (e) { /* yok say */ }
  }

  function applyDiceTheme() {
    const theme = DICE_THEMES.find((t) => t.id === custom.dice) || DICE_THEMES[0];
    document.documentElement.style.setProperty("--dice-accent", theme.color);
  }

  function newGame() {
    game = Turns.createGame(NUM_PLAYERS, custom.shape);
    Render.buildBoardTiles(game.board);
    Render.createPawns(game.players);
    Render.updateActiveRing(game.currentIndex);
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

  function showChanceToast(card) {
    const toast = el("chanceToast");
    el("chanceText").textContent = card.text;
    const amountEl = el("chanceAmount");
    amountEl.textContent = `${card.cash >= 0 ? "+" : ""}${card.cash}₺`;
    amountEl.className = card.cash >= 0 ? "positive" : "negative";
    toast.classList.remove("hidden");
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(showChanceToast._t);
    showChanceToast._t = setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.classList.add("hidden"), 250);
    }, 1600);
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

  // --- Özelleştirme modalı (M3) ---------------------------------------
  function renderCustomizePickers() {
    const shapeGrid = el("shapePicker");
    shapeGrid.innerHTML = "";
    Pieces.PIECE_SHAPES.forEach((s) => {
      const opt = document.createElement("div");
      opt.className = "picker-option" + (custom.shape === s.id ? " selected" : "");
      opt.innerHTML = `<span class="emoji">${s.emoji}</span>${s.label}`;
      opt.addEventListener("click", () => {
        custom.shape = s.id;
        renderCustomizePickers();
      });
      shapeGrid.appendChild(opt);
    });

    const diceGrid = el("dicePicker");
    diceGrid.innerHTML = "";
    DICE_THEMES.forEach((t) => {
      const opt = document.createElement("div");
      opt.className = "picker-option dice-swatch" + (custom.dice === t.id ? " selected" : "");
      opt.innerHTML = `<span class="dot" style="background:${t.color}"></span>${t.name}`;
      opt.addEventListener("click", () => {
        custom.dice = t.id;
        renderCustomizePickers();
      });
      diceGrid.appendChild(opt);
    });
  }

  function openCustomizeModal() {
    renderCustomizePickers();
    el("modalOverlay").classList.remove("hidden");
    el("customizeModal").classList.remove("hidden");
  }
  function closeCustomizeModal() {
    el("modalOverlay").classList.add("hidden");
    el("customizeModal").classList.add("hidden");
  }

  // --- Tur döngüsü -------------------------------------------------------
  async function playTurn() {
    setControlsEnabled(false);
    const player = Turns.currentPlayer(game);
    const moveInfo = Turns.moveCurrentPlayer(game);
    showDice(moveInfo.roll);
    render();
    if (moveInfo.passedStart) Render.spawnBurstAtTile(0, 0xffd54f);

    const path = buildPath(moveInfo.from, moveInfo.to, Turns.BOARD_SIZE);
    await new Promise((resolve) =>
      Render.movePawnAlongPath(player.id, path, Turns.BOARD_SIZE, resolve)
    );
    Render.updateActiveRing(player.id);

    const tile = game.board[player.position];
    const result = Turns.resolveLanding(game, player, tile);
    render();

    if (result.kind === "chance") {
      showChanceToast(result.card);
      Render.spawnBurstAtTile(tile.index, result.card.cash >= 0 ? 0x66bb6a : 0xef5350);
    } else if (result.kind === "tax") {
      Render.spawnBurstAtTile(tile.index, 0xef5350);
    } else if (result.kind === "rent") {
      Render.spawnBurstAtTile(tile.index, 0xef5350);
    } else if (result.kind === "rest" && result.bonus) {
      Render.spawnBurstAtTile(tile.index, 0xffd54f);
    }

    if (result.kind === "offer-buy") {
      let buy;
      if (player.isHuman) {
        buy = await showBuyModal(tile);
      } else {
        buy = Turns.botShouldBuy(player, tile);
      }
      const bought = Turns.applyBuyDecision(game, player, tile, buy);
      if (bought) Render.spawnBurstAtTile(tile.index, 0x66bb6a);
      Render.buildBoardTiles(game.board); // fiyat/renk etiketlerini güncelle
      Render.createPawns(game.players); // piyonları da yeniden yerleştir (mevcut tile üzerinde kalır)
      Render.updateActiveRing(player.id);
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
    Render.updateActiveRing(game.currentIndex);
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
    el("customizeBtn").addEventListener("click", openCustomizeModal);
    el("customizeCloseBtn").addEventListener("click", closeCustomizeModal);
    el("customizeApplyBtn").addEventListener("click", () => {
      saveCustom();
      applyDiceTheme();
      closeCustomizeModal();
      newGame();
    });
    window.addEventListener("resize", Render.handleResize);
  }

  function init() {
    const canvas = el("boardCanvas");
    applyDiceTheme();
    Render.init(canvas);
    Render.startLoop();
    wireEvents();
    newGame();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
