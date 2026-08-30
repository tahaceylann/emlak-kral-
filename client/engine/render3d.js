"use strict";
/**
 * Three.js sahnesi: stilize/izometrik tahta render'ı, piyon hareket
 * animasyonu, parmak/fare ile sürükleyerek kamera döndürme (OrbitControls
 * vendörlemek yerine tahaceylan/room.js'teki gibi hafif bir özel
 * implementasyon — tek bağımlılık three.min.js olarak kalsın diye).
 */
const RenderModule = (() => {
  const Board = window.BoardModule;
  const Pieces = window.PiecesModule;

  let renderer, scene, camera, container;
  let cameraTarget = new THREE.Vector3(0, 0, 0);
  let cameraRadius = 22, cameraTheta = Math.PI / 4, cameraPhi = 0.9; // küresel koordinatlar
  let zoomFactor = 1; // fare tekerleği/pinch ile ayarlanır — 1 = tahtayı tam sığdır
  const pawns = {}; // playerId -> THREE.Group
  const tileMeshes = [];
  let running = false;
  let toonGradient = null;
  let activeRing = null;

  /** 4 basamaklı toon-shading gradyanı — "stilize/toy" bir görünüm verir. */
  function makeToonGradient() {
    const canvas = document.createElement("canvas");
    canvas.width = 4; canvas.height = 1;
    const ctx = canvas.getContext("2d");
    const shades = ["#4a4a55", "#8d8d9c", "#c9c9d6", "#ffffff"];
    shades.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i, 0, 1, 1); });
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  /**
   * Kare ismini/değerini, referans alınan görseldeki gibi (Business Tour'a
   * benzer bir tahta oyunu) karonun renkli yüzeyine doğrudan basılmış gibi
   * üretir: arkasında koyu bir kutu YOK, sadece siyah kontur/gölgeli beyaz
   * metin — karonun kendi rengi arkadan görünür. Düz bir THREE.Mesh
   * (PlaneGeometry, sprite değil) ve TÜM karolar için AYNI sabit yönde
   * (LABEL_BASIS) yerleştirilir; bu yüzden hiçbir kare ters/baş aşağı
   * durmaz — referans görseldeki gibi tahtanın her kenarı aynı anda,
   * tutarlı biçimde okunaklıdır.
   */
  function makeTileLabelMesh(text, sub) {
    const canvas = document.createElement("canvas");
    canvas.width = 220; canvas.height = 190;
    const ctx = canvas.getContext("2d");
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.font = "800 26px system-ui, sans-serif";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.fillStyle = "#fff";
    wrapText(ctx, text.toUpperCase(), 110, 78, 200, 30, true);
    if (sub) {
      ctx.font = "800 24px system-ui, sans-serif";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(sub, 110, 148);
      ctx.fillStyle = "#ffd54f";
      ctx.fillText(sub, 110, 148);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1.5, 1.3);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 3;
    return mesh;
  }

  // Tüm etiketler için TEK ve sabit bir yön — hiçbir kare, hangi kenarda
  // olursa olsun, ters/baş aşağı durmaz.
  const LABEL_UP = new THREE.Vector3(0, 0, -1);
  const LABEL_RIGHT = new THREE.Vector3().crossVectors(LABEL_UP, new THREE.Vector3(0, 1, 0)).normalize();
  const LABEL_BASIS = new THREE.Matrix4().makeBasis(LABEL_RIGHT, LABEL_UP, new THREE.Vector3(0, 1, 0));

  /**
   * Yön her karoda SABİT (LABEL_BASIS) kalır — hiçbiri ters durmaz.
   * Ama konum, referans görseldeki gibi tahtanın MERKEZİNDEN değil,
   * karonun DIŞ kenarına yakın bir yerden — her kare kendi dış yönünde
   * (outwardOffset kadar) kaydırılır.
   */
  function orientLabelOnTile(mesh, x, z, y, outwardOffset) {
    const outward = new THREE.Vector3(x, 0, z);
    if (outward.lengthSq() < 1e-6) outward.set(0, 0, 1); else outward.normalize();
    mesh.position.set(x + outward.x * outwardOffset, y, z + outward.z * outwardOffset);
    mesh.quaternion.setFromRotationMatrix(LABEL_BASIS);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, withStroke) {
    const words = text.split(" ");
    let line = "", lines = [];
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    }
    lines.push(line);
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => {
      if (withStroke) ctx.strokeText(l, x, startY + i * lineHeight);
      ctx.fillText(l, x, startY + i * lineHeight);
    });
  }

  function tileColor(tile) {
    if (tile.type === "property") return Board.PROPERTY_GROUPS[tile.group].color;
    if (tile.type === "start") return 0x2e7d32;
    if (tile.type === "chance") return 0x8e24aa;
    if (tile.type === "tax") return 0xc62828;
    return 0x616161; // rest
  }

  function init(canvas) {
    container = canvas.parentElement;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    }
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1b2a);
    scene.fog = new THREE.Fog(0x0d1b2a, 30, 55);
    toonGradient = makeToonGradient();

    // Ortografik (izometrik) kamera: mesafe değişse de tahtanın tamamı her
    // zaman kadraja sığar — mobil dar/uzun ekranlarda perspektif FOV
    // matematiğiyle uğraşmaktan kurtarır, board-game türüne de daha uygun
    // "flat/toy" bir görünüm verir.
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
    updateCameraPosition();

    const hemi = new THREE.HemisphereLight(0x9fc9ff, 0x1a1024, 0.7);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff2d8, 1.15);
    dir.position.set(14, 22, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -12; dir.shadow.camera.right = 12;
    dir.shadow.camera.top = 12; dir.shadow.camera.bottom = -12;
    dir.shadow.camera.far = 40;
    dir.shadow.bias = -0.0015;
    scene.add(dir);

    const groundGeo = new THREE.CircleGeometry(13, 48);
    const groundMat = new THREE.MeshToonMaterial({ color: 0x0f2438, gradientMap: toonGradient });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    scene.add(ground);

    // Aktif oyuncunun piyonunun altında parıldayan, yavaşça dönen bir halka.
    const ringGeo = new THREE.RingGeometry(0.55, 0.7, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    activeRing = new THREE.Mesh(ringGeo, ringMat);
    activeRing.rotation.x = -Math.PI / 2;
    activeRing.visible = false;
    scene.add(activeRing);

    wireDragRotate(canvas);
    handleResize();
    window.addEventListener("resize", handleResize);
  }

  function buildBoardTiles(board) {
    tileMeshes.forEach((m) => scene.remove(m));
    tileMeshes.length = 0;
    const isPropertyOrCorner = (t) => Board.isCorner(t.index);

    board.forEach((tile) => {
      const corner = isPropertyOrCorner(tile);
      const size = corner ? 2 : 1.9;
      const height = 0.28;
      const geo = new THREE.BoxGeometry(size, height, size);
      const mat = new THREE.MeshToonMaterial({ color: tileColor(tile), gradientMap: toonGradient });
      const mesh = new THREE.Mesh(geo, mat);
      const pos = Board.tilePosition(tile.index);
      mesh.position.set(pos.x, height / 2, pos.z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.userData.tileIndex = tile.index;
      scene.add(mesh);
      tileMeshes.push(mesh);

      const sub = tile.type === "property" ? `${tile.price}₺`
        : tile.type === "tax" ? `-${tile.amount}₺`
        : tile.type === "rest" && tile.bonus ? `+${tile.bonus}₺` : "";
      const label = makeTileLabelMesh(tile.name, sub);
      orientLabelOnTile(label, pos.x, pos.z, height + 0.008, size * 0.19);
      scene.add(label);
      tileMeshes.push(label);
    });
  }

  function pawnOffset(playerId) {
    const offsets = [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]];
    return offsets[playerId % offsets.length];
  }

  function createPawns(players) {
    Object.values(pawns).forEach((p) => scene.remove(p));
    players.forEach((player) => {
      const mesh = Pieces.buildPawnMesh(THREE, player.color, player.shape, toonGradient);
      const pos = Board.tilePosition(player.position);
      const off = pawnOffset(player.id);
      mesh.position.set(pos.x + off[0], 0.28, pos.z + off[1]);
      scene.add(mesh);
      pawns[player.id] = mesh;
    });
  }

  /** Aktif oyuncunun piyonunun altındaki halkayı o piyona taşır/gösterir. */
  function updateActiveRing(playerId) {
    if (!activeRing) return;
    const mesh = pawns[playerId];
    if (!mesh) { activeRing.visible = false; return; }
    activeRing.position.set(mesh.position.x, 0.03, mesh.position.z);
    activeRing.visible = true;
  }

  /**
   * Kısa ömürlü bir renkli parçacık patlaması (satın alma/kira/maaş gibi
   * ekonomi olaylarını "hissettirmek" için). tileIndex verilmezse origin
   * kullanılır.
   */
  function spawnBurstAtTile(tileIndex, color) {
    const pos = Board.tilePosition(tileIndex);
    const origin = new THREE.Vector3(pos.x, 0.5, pos.z);
    const count = 12;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x; positions[i * 3 + 1] = origin.y; positions[i * 3 + 2] = origin.z;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.9 + Math.random() * 1.3;
      velocities.push({ x: Math.cos(angle) * speed, y: 2.0 + Math.random() * 1.4, z: Math.sin(angle) * speed });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.22, transparent: true, opacity: 1, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    const start = performance.now();
    const duration = 650;
    function animate(now) {
      const t = (now - start) / duration;
      if (t >= 1) { scene.remove(points); geo.dispose(); mat.dispose(); return; }
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        arr[i * 3] = origin.x + velocities[i].x * t;
        arr[i * 3 + 1] = origin.y + velocities[i].y * t - 4 * t * t;
        arr[i * 3 + 2] = origin.z + velocities[i].z * t;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - t;
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }

  /** Piyon bir kareye vardığında hafif bir "sekme" (squash & stretch) yapar. */
  function bouncePawn(playerId) {
    const mesh = pawns[playerId];
    if (!mesh) return;
    const start = performance.now();
    const duration = 260;
    function animate(now) {
      const t = Math.min(1, (now - start) / duration);
      const squash = Math.sin(t * Math.PI);
      mesh.scale.set(1 + squash * 0.18, 1 - squash * 0.22, 1 + squash * 0.18);
      if (t < 1) requestAnimationFrame(animate);
      else mesh.scale.set(1, 1, 1);
    }
    requestAnimationFrame(animate);
  }

  /** Piyonu, tahta üzerinde kare kare zıplayarak from→to yoluna taşır. */
  function movePawnAlongPath(playerId, path, boardSize, onComplete) {
    const mesh = pawns[playerId];
    if (!mesh || path.length < 2) { if (onComplete) onComplete(); return; }
    const off = pawnOffset(playerId);
    let hop = 0;
    const hopDuration = 220;

    function doHop() {
      if (hop >= path.length - 1) { bouncePawn(playerId); if (onComplete) onComplete(); return; }
      const fromPos = Board.tilePosition(path[hop]);
      const toPos = Board.tilePosition(path[hop + 1]);
      const start = performance.now();
      function animate(now) {
        const t = Math.min(1, (now - start) / hopDuration);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const x = fromPos.x + (toPos.x - fromPos.x) * ease + off[0];
        const z = fromPos.z + (toPos.z - fromPos.z) * ease + off[1];
        const arc = Math.sin(Math.PI * t) * 0.45;
        mesh.position.set(x, 0.28 + arc, z);
        mesh.rotation.y = Math.atan2(toPos.x - fromPos.x, toPos.z - fromPos.z) || mesh.rotation.y;
        if (t < 1) requestAnimationFrame(animate);
        else { hop++; doHop(); }
      }
      requestAnimationFrame(animate);
    }
    doHop();
  }

  // Tahtanın köşeleri (etiketler biraz yukarıda durduğu için y'de de pay bırak).
  const BOARD_FIT_CORNERS = [
    new THREE.Vector3(-8.3, 1.6, -8.3), new THREE.Vector3(8.3, 1.6, -8.3),
    new THREE.Vector3(-8.3, 1.6, 8.3), new THREE.Vector3(8.3, 1.6, 8.3),
  ];

  /**
   * Kamera her hangi açıya döndürülürse döndürülsün (sürükleme dahil),
   * tahtanın tamamının kadraja sığmasını sağlar. Sabit bir VIEW_HALF_HEIGHT
   * yerine kameranın YEREL eksenlerinde köşelerin gerçek izdüşümünü ölçüp
   * ortografik frustum'u ona göre kurar — açıya göre en dar/geniş kenar
   * hangisiyse otomatik uyum sağlar.
   */
  function fitOrthoFrustum() {
    if (!container) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    camera.updateMatrixWorld(true);
    let maxRight = 0.1, maxUp = 0.1;
    BOARD_FIT_CORNERS.forEach((p) => {
      const local = camera.worldToLocal(p.clone());
      maxRight = Math.max(maxRight, Math.abs(local.x));
      maxUp = Math.max(maxUp, Math.abs(local.y));
    });
    const marginRight = maxRight * 1.32, marginUp = maxUp * 1.38;
    const halfHeight = Math.max(marginUp, marginRight / aspect) * zoomFactor;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.updateProjectionMatrix();
  }

  function updateCameraPosition() {
    const x = cameraTarget.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
    const y = cameraTarget.y + cameraRadius * Math.cos(cameraPhi);
    const z = cameraTarget.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
    camera.position.set(x, y, z);
    camera.lookAt(cameraTarget);
    fitOrthoFrustum();
  }

  function wireDragRotate(canvas) {
    let dragging = false, lastX = 0, lastY = 0;
    const start = (x, y) => { dragging = true; lastX = x; lastY = y; };
    const move = (x, y) => {
      if (!dragging) return;
      cameraTheta -= (x - lastX) * 0.006;
      cameraPhi = Math.min(1.4, Math.max(0.55, cameraPhi - (y - lastY) * 0.006));
      lastX = x; lastY = y;
      updateCameraPosition();
    };
    const end = () => { dragging = false; };
    canvas.addEventListener("pointerdown", (e) => start(e.clientX, e.clientY));
    window.addEventListener("pointermove", (e) => move(e.clientX, e.clientY));
    window.addEventListener("pointerup", end);

    // Fare tekerleği ile yakınlaştır (PC) — ortografik kamerada radius'un
    // kendisi görünen alanı değiştirmez (fitOrthoFrustum otomatik sığdırır),
    // o yüzden gerçek zum için ayrı bir çarpan kullanıyoruz.
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomFactor = Math.min(1.6, Math.max(0.5, zoomFactor + e.deltaY * 0.001));
      fitOrthoFrustum();
    }, { passive: false });
  }

  function handleResize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    fitOrthoFrustum();
  }

  function startLoop() {
    if (running) return;
    running = true;
    function tick() {
      if (!running) return;
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function stopLoop() { running = false; }

  return {
    init, buildBoardTiles, createPawns, movePawnAlongPath,
    startLoop, stopLoop, handleResize, spawnBurstAtTile, updateActiveRing,
  };
})();
window.RenderModule = RenderModule;
