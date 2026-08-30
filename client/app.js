"use strict";
/**
 * Uygulama kabuğu ve oyun döngüsü orkestrasyonu. engine/* modüllerindeki
 * saf mantığı DOM olaylarına ve Three.js animasyonlarına bağlar.
 *
 * İki mod var:
 *  - "local"  — bu dosya Turns.* çağırarak kendi başına yetkilidir (M1-M3).
 *  - "online" — net/client.js üzerinden sunucuya bağlanılır, sunucu
 *    yetkilidir; bu dosya sadece sunucudan gelen olayları sırayla işleyip
 *    (enqueueNet) aynı render fonksiyonlarını çağırır (M4).
 */
(function () {
  const Turns = window.TurnsModule;
  const Render = window.RenderModule;
  const Pieces = window.PiecesModule;
  const Net = window.NetModule;
  const Editor = window.EditorModule;

  const NUM_PLAYERS = 4;
  const BOT_MOVE_DELAY = 700;
  const CUSTOM_STORAGE_KEY = "emlak-kral-custom-v1";
  const SERVER_URL_KEY = "emlak-kral-server-url";
  const NAME_KEY = "emlak-kral-name";
  const DICE_THEMES = [
    { id: "gold", name: "Altın", color: "#ffd54f" },
    { id: "blue", name: "Mavi", color: "#42a5f5" },
    { id: "red", name: "Kırmızı", color: "#ef5350" },
    { id: "green", name: "Yeşil", color: "#66bb6a" },
  ];

  let game = null;
  let custom = loadCustom();
  let mode = "local"; // "local" | "online"
  let mySlot = null;
  let isHost = false;
  let editorDef = null; // harita editöründeki mevcut taslak

  const el = (id) => document.getElementById(id);
  const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  function loadCustom() {
    try {
      const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
      if (raw) return Object.assign({ shape: "pawn", dice: "gold", useCustomBoard: false }, JSON.parse(raw));
    } catch (e) { /* localStorage yoksa/bozuksa varsayılana düş */ }
    return { shape: "pawn", dice: "gold", useCustomBoard: false };
  }
  function getActiveBoardDef() {
    if (!custom.useCustomBoard) return undefined;
    return Editor.loadSavedDef() || undefined;
  }
  function saveCustom() {
    try { localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(custom)); } catch (e) { /* yok say */ }
  }

  function applyDiceTheme() {
    const theme = DICE_THEMES.find((t) => t.id === custom.dice) || DICE_THEMES[0];
    document.documentElement.style.setProperty("--dice-accent", theme.color);
  }

  function newGame() {
    game = Turns.createGame(NUM_PLAYERS, custom.shape, getActiveBoardDef());
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

  // Ekranın dört köşesine sabit kutucuklar — oyuncu sırasına göre bl→tl→tr→br.
  const PLAYER_CORNER_CLASSES = ["corner-bl", "corner-tl", "corner-tr", "corner-br"];

  function renderPlayerPanel() {
    const container = el("playerCorners");
    container.innerHTML = "";
    game.players.forEach((p) => {
      const box = document.createElement("div");
      box.className = "player-box " + (PLAYER_CORNER_CLASSES[p.id] || "corner-bl") +
        (p.id === game.currentIndex ? " active" : "") +
        (p.bankrupt ? " bankrupt" : "");
      const swatch = `<span class="swatch" style="background:#${p.color.toString(16).padStart(6, "0")}"></span>`;
      const youTag = mode === "online" && p.id === mySlot ? " (sen)" : "";
      box.innerHTML =
        `<div class="pname">${swatch}${p.name}${youTag}${p.bankrupt ? " (iflas)" : ""}</div>` +
        `<div class="pcash">${p.cash}₺</div>` +
        `<div class="pprops">${p.properties.length} mülk</div>`;
      container.appendChild(box);
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

  /** Şans/kira/vergi/bonus için ortak "juice": local ve online modda aynı. */
  function handleLandingEffects(result) {
    if (result.kind === "chance") {
      showChanceToast(result.card);
      Render.spawnBurstAtTile(result.tile.index, result.card.cash >= 0 ? 0x66bb6a : 0xef5350);
    } else if (result.kind === "tax" || result.kind === "rent") {
      Render.spawnBurstAtTile(result.tile.index, 0xef5350);
    } else if (result.kind === "rest" && result.bonus) {
      Render.spawnBurstAtTile(result.tile.index, 0xffd54f);
    }
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

  // --- Harita editörü (M5) -------------------------------------------
  function buildEditorRow(tile, index) {
    const row = document.createElement("div");
    row.className = "editor-row";

    const idx = document.createElement("div");
    idx.className = "idx";
    idx.textContent = index;
    row.appendChild(idx);

    const typeSelect = document.createElement("select");
    if (index === 0) {
      typeSelect.disabled = true;
      const opt = document.createElement("option");
      opt.textContent = "Başlangıç"; opt.value = "start";
      typeSelect.appendChild(opt);
    } else {
      Editor.TILE_TYPES.forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t.id; opt.textContent = t.label;
        if (tile.type === t.id) opt.selected = true;
        typeSelect.appendChild(opt);
      });
    }
    row.appendChild(typeSelect);

    const nameInput = document.createElement("input");
    nameInput.type = "text"; nameInput.value = tile.name; nameInput.maxLength = 24;
    nameInput.addEventListener("input", () => { tile.name = nameInput.value; });
    row.appendChild(nameInput);

    const extraContainer = document.createElement("div");
    row.appendChild(extraContainer);

    function renderExtra() {
      extraContainer.innerHTML = "";
      if (tile.type === "property") {
        const groupSelect = document.createElement("select");
        window.BoardModule.PROPERTY_GROUPS.forEach((g) => {
          const opt = document.createElement("option");
          opt.value = g.id; opt.textContent = g.name;
          if (tile.group === g.id) opt.selected = true;
          groupSelect.appendChild(opt);
        });
        groupSelect.addEventListener("change", () => {
          tile.group = Number(groupSelect.value);
          delete tile.price; delete tile.rent; // grup değişince otomatik yeniden hesaplansın
        });
        extraContainer.appendChild(groupSelect);
      } else if (tile.type === "tax") {
        const num = document.createElement("input");
        num.type = "number"; num.min = "0"; num.step = "10";
        num.value = tile.amount != null ? tile.amount : 100;
        num.addEventListener("input", () => { tile.amount = Number(num.value) || 0; });
        extraContainer.appendChild(num);
      } else if (tile.type === "rest") {
        const num = document.createElement("input");
        num.type = "number"; num.min = "0"; num.step = "10";
        num.placeholder = "bonus";
        num.value = tile.bonus || "";
        num.addEventListener("input", () => {
          const v = Number(num.value);
          if (v > 0) tile.bonus = v; else delete tile.bonus;
        });
        extraContainer.appendChild(num);
      } else {
        const span = document.createElement("span");
        span.className = "extra-empty"; span.textContent = "—";
        extraContainer.appendChild(span);
      }
    }
    renderExtra();

    if (index !== 0) {
      typeSelect.addEventListener("change", () => {
        delete tile.group; delete tile.price; delete tile.rent; delete tile.amount; delete tile.bonus;
        tile.type = typeSelect.value;
        if (tile.type === "property") tile.group = 0;
        if (tile.type === "tax") tile.amount = 100;
        renderExtra();
      });
    }

    return row;
  }

  function renderEditorRows(def) {
    const container = el("editorRows");
    container.innerHTML = "";
    def.forEach((tile, i) => container.appendChild(buildEditorRow(tile, i)));
  }

  function openEditorModal() {
    editorDef = Editor.loadSavedDef() || Editor.getDefaultDef();
    el("editorUseToggle").checked = !!custom.useCustomBoard;
    el("editorShareCode").value = "";
    el("editorError").classList.add("hidden");
    renderEditorRows(editorDef);
    el("modalOverlay").classList.remove("hidden");
    el("editorModal").classList.remove("hidden");
  }
  function closeEditorModal() {
    el("modalOverlay").classList.add("hidden");
    el("editorModal").classList.add("hidden");
  }
  function showEditorError(msg) {
    const e = el("editorError");
    e.textContent = msg;
    e.classList.remove("hidden");
  }

  // --- Çevrimiçi oda (M4) ------------------------------------------------
  const netQueue = [];
  let netBusy = false;
  function enqueueNet(fn) {
    netQueue.push(fn);
    drainNetQueue();
  }
  async function drainNetQueue() {
    if (netBusy) return;
    netBusy = true;
    while (netQueue.length) {
      const fn = netQueue.shift();
      try { await fn(); } catch (e) { console.error(e); }
    }
    netBusy = false;
  }

  function defaultServerUrl() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.hostname}:8081`;
  }

  function showNetError(msg) {
    const e = el("netError");
    e.textContent = msg;
    e.classList.remove("hidden");
  }

  function openNetworkModal() {
    el("netError").classList.add("hidden");
    el("netSetupView").classList.remove("hidden");
    el("netLobbyView").classList.add("hidden");
    el("netServerUrl").value = localStorage.getItem(SERVER_URL_KEY) || defaultServerUrl();
    el("netName").value = localStorage.getItem(NAME_KEY) || "";
    el("modalOverlay").classList.remove("hidden");
    el("networkModal").classList.remove("hidden");
  }
  function closeNetworkModal() {
    el("modalOverlay").classList.add("hidden");
    el("networkModal").classList.add("hidden");
  }

  async function ensureConnected() {
    if (Net.isConnected()) return;
    const url = el("netServerUrl").value.trim();
    localStorage.setItem(SERVER_URL_KEY, url);
    await Net.connect(url);
  }

  function renderLobby(msg) {
    el("netSetupView").classList.add("hidden");
    el("netLobbyView").classList.remove("hidden");
    el("netRoomCode").textContent = msg.code;
    const list = el("netPlayerList");
    list.innerHTML = "";
    msg.players.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "net-player-row" + (p ? "" : " empty");
      if (p) {
        const tag = i === msg.hostSlot ? "Ev sahibi" : "";
        row.innerHTML = `<span>${p.name}${i === msg.yourSlot ? " (sen)" : ""}${!p.connected ? " — koptu" : ""}</span><span class="tag">${tag}</span>`;
      } else {
        row.innerHTML = `<span>Boş slot (bot olacak)</span>`;
      }
      list.appendChild(row);
    });
    el("netStartBtn").classList.toggle("hidden", msg.yourSlot !== msg.hostSlot || msg.started);
    el("netLobbyHint").textContent = msg.started
      ? "Oyun başladı."
      : msg.yourSlot === msg.hostSlot
        ? "Hazır olduğunda oyunu başlat — boş slotlar bot olarak doldurulur."
        : "Ev sahibinin oyunu başlatmasını bekle...";
  }

  function updateOnlineRollButton() {
    if (mode !== "online" || !game) return;
    setControlsEnabled(!game.over && game.currentIndex === mySlot);
  }

  function leaveOnlineRoom() {
    Net.disconnect();
    mode = "local";
    mySlot = null; isHost = false;
    el("restartBtn").disabled = false;
    closeNetworkModal();
    newGame();
  }

  function wireNetHandlers() {
    Net.on("room", (msg) => {
      mySlot = msg.yourSlot;
      isHost = msg.hostSlot === msg.yourSlot;
      renderLobby(msg);
    });
    Net.on("started", () => {
      mode = "online";
      closeNetworkModal();
      el("restartBtn").disabled = true;
      setControlsEnabled(false);
    });
    Net.on("move", (msg) => enqueueNet(async () => {
      showDice(msg.roll);
      if (msg.passedStart) Render.spawnBurstAtTile(0, 0xffd54f);
      const path = buildPath(msg.from, msg.to, Turns.BOARD_SIZE);
      await new Promise((resolve) => Render.movePawnAlongPath(msg.playerId, path, Turns.BOARD_SIZE, resolve));
      Render.updateActiveRing(msg.playerId);
    }));
    Net.on("landing", (msg) => enqueueNet(async () => { handleLandingEffects(msg.result); }));
    Net.on("buy_offer", (msg) => enqueueNet(async () => {
      const tile = game.board[msg.tileIndex];
      const buy = await showBuyModal(tile);
      Net.buyDecision(buy);
    }));
    Net.on("buy_result", (msg) => enqueueNet(async () => {
      if (msg.bought) Render.spawnBurstAtTile(msg.tileIndex, 0x66bb6a);
    }));
    Net.on("state", (msg) => enqueueNet(async () => {
      game = msg.game;
      Render.buildBoardTiles(game.board);
      Render.createPawns(game.players);
      Render.updateActiveRing(game.currentIndex);
      render();
      updateOnlineRollButton();
    }));
    Net.on("game_over", () => enqueueNet(async () => {
      setControlsEnabled(false);
      showWinModal();
    }));
    Net.on("error", (msg) => showNetError(msg.message));
    Net.on("close", () => {
      if (mode === "online") {
        alert("Sunucu bağlantısı koptu. Yerel oyuna dönülüyor.");
        mode = "local";
        el("restartBtn").disabled = false;
        newGame();
      }
    });
  }

  // --- Yerel tur döngüsü (M1-M3) ------------------------------------------
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
    handleLandingEffects(result);

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
      if (mode === "online") {
        if (game.currentIndex !== mySlot) return;
        setControlsEnabled(false);
        Net.roll();
      } else {
        playTurn();
      }
    });
    el("restartBtn").addEventListener("click", () => {
      if (mode === "online") return;
      if (confirm("Oyunu yeniden başlatmak istiyor musun?")) newGame();
    });
    el("winRestartBtn").addEventListener("click", () => {
      if (mode === "online") { el("winModal").classList.add("hidden"); el("modalOverlay").classList.add("hidden"); return; }
      newGame();
    });
    el("customizeBtn").addEventListener("click", openCustomizeModal);
    el("customizeCloseBtn").addEventListener("click", closeCustomizeModal);
    el("customizeApplyBtn").addEventListener("click", () => {
      if (mode === "online") { closeCustomizeModal(); alert("Çevrimiçi oyunda özelleştirme değiştirilemez — önce odadan ayrıl."); return; }
      saveCustom();
      applyDiceTheme();
      closeCustomizeModal();
      newGame();
    });

    el("networkBtn").addEventListener("click", openNetworkModal);
    el("netSetupCloseBtn").addEventListener("click", closeNetworkModal);
    el("netCreateBtn").addEventListener("click", async () => {
      el("netError").classList.add("hidden");
      try {
        await ensureConnected();
        const name = el("netName").value.trim() || "Oyuncu";
        localStorage.setItem(NAME_KEY, name);
        Net.createRoom(name);
      } catch (e) {
        showNetError("Sunucuya bağlanılamadı: " + e.message);
      }
    });
    el("netJoinBtn").addEventListener("click", async () => {
      el("netError").classList.add("hidden");
      const code = el("netJoinCode").value.trim().toUpperCase();
      if (!code) { showNetError("Bir oda kodu gir."); return; }
      try {
        await ensureConnected();
        const name = el("netName").value.trim() || "Oyuncu";
        localStorage.setItem(NAME_KEY, name);
        Net.joinRoom(code, name);
      } catch (e) {
        showNetError("Sunucuya bağlanılamadı: " + e.message);
      }
    });
    el("netStartBtn").addEventListener("click", () => Net.startGame(getActiveBoardDef()));
    el("netLeaveBtn").addEventListener("click", leaveOnlineRoom);

    el("editorBtn").addEventListener("click", openEditorModal);
    el("editorCloseBtn").addEventListener("click", closeEditorModal);
    el("editorResetBtn").addEventListener("click", () => {
      editorDef = Editor.getDefaultDef();
      renderEditorRows(editorDef);
    });
    el("editorSaveBtn").addEventListener("click", () => {
      if (!Editor.isValidDef(editorDef)) {
        showEditorError("Harita geçersiz — her karenin bir ismi olmalı ve mülk karolarının bir bölgesi seçili olmalı.");
        return;
      }
      Editor.saveDef(editorDef);
      custom.useCustomBoard = el("editorUseToggle").checked;
      saveCustom();
      el("editorShareCode").value = Editor.encodeShareCode(editorDef);
      el("editorError").classList.add("hidden");
    });
    el("editorImportBtn").addEventListener("click", () => {
      try {
        editorDef = Editor.decodeShareCode(el("editorShareCode").value);
        renderEditorRows(editorDef);
        el("editorError").classList.add("hidden");
      } catch (e) {
        showEditorError("Kod okunamadı: " + e.message);
      }
    });

    window.addEventListener("resize", Render.handleResize);
    // Bazı tarayıcılarda orientationchange sırasında clientWidth/Height bir
    // an eski değeri taşıyor — kısa bir gecikmeyle tekrar dene.
    window.addEventListener("orientationchange", () => {
      Render.handleResize();
      setTimeout(Render.handleResize, 300);
    });

    // PC kısayolu: Boşluk/Enter ile zar at (bir input/select'e yazarken değil).
    window.addEventListener("keydown", (e) => {
      if (e.code !== "Space" && e.code !== "Enter") return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      if (el("rollBtn").disabled) return;
      e.preventDefault();
      el("rollBtn").click();
    });
  }

  /** Ana ekrana eklenmiş (standalone) PWA'da yatay kilit dener; sekmede
   * çalışırken tarayıcılar genelde reddeder — bu durumda #rotateOverlay
   * (CSS) devreye girer, burada sessizce yok sayılır. */
  function tryLockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(() => {});
      }
    } catch (e) { /* desteklenmiyor — sorun değil */ }
  }

  function init() {
    const canvas = el("boardCanvas");
    applyDiceTheme();
    tryLockLandscape();
    Render.init(canvas);
    Render.startLoop();
    wireNetHandlers();
    wireEvents();
    newGame();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
