"use strict";
/**
 * Oyuncu piyonu mesh üretimi. M3 (karakter özelleştirme) burada üç seçilebilir
 * forma çıktı: "pawn" (klasik), "cube" (küp kule), "gem" (elmas). Çağıran
 * taraf (render3d.js) sadece `buildPawnMesh(THREE, color, shapeId, gradientMap)`
 * çağırır — yeni bir form eklemek bu dosyanın dışını etkilemez.
 */
const PIECE_SHAPES = [
  { id: "pawn", label: "Klasik Piyon", emoji: "♟️" },
  { id: "cube", label: "Küp Kule", emoji: "🧊" },
  { id: "gem", label: "Elmas", emoji: "💎" },
];

function toonMat(THREE, color, gradientMap) {
  return gradientMap
    ? new THREE.MeshToonMaterial({ color, gradientMap })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
}

function buildPawnShape(THREE, color, gradientMap) {
  const group = new THREE.Group();
  const mat = toonMat(THREE, color, gradientMap);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.12, 20), mat);
  base.position.y = 0.06;
  base.castShadow = true;
  group.add(base);

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.55, 20), mat);
  body.position.y = 0.12 + 0.275;
  body.castShadow = true;
  group.add(body);

  const headMat = toonMat(THREE, 0xffffff, gradientMap);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), headMat);
  head.position.y = 0.12 + 0.55 + 0.12;
  head.castShadow = true;
  group.add(head);

  return group;
}

function buildCubeShape(THREE, color, gradientMap) {
  const group = new THREE.Group();
  const mat = toonMat(THREE, color, gradientMap);
  const sizes = [0.44, 0.34, 0.24];
  let y = 0;
  sizes.forEach((s) => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
    y += s / 2;
    cube.position.y = y;
    cube.rotation.y = Math.PI / 8;
    cube.castShadow = true;
    group.add(cube);
    y += s / 2;
  });
  return group;
}

function buildGemShape(THREE, color, gradientMap) {
  const group = new THREE.Group();
  const mat = toonMat(THREE, color, gradientMap);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.14, 16), mat);
  base.position.y = 0.07;
  base.castShadow = true;
  group.add(base);

  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), mat);
  gem.position.y = 0.14 + 0.32;
  gem.castShadow = true;
  group.add(gem);

  return group;
}

const SHAPE_BUILDERS = { pawn: buildPawnShape, cube: buildCubeShape, gem: buildGemShape };

function buildPawnMesh(THREE, color, shapeId, gradientMap) {
  const builder = SHAPE_BUILDERS[shapeId] || buildPawnShape;
  return builder(THREE, color, gradientMap);
}

const PiecesModule = { buildPawnMesh, PIECE_SHAPES };
if (typeof module !== "undefined" && module.exports) module.exports = PiecesModule;
if (typeof window !== "undefined") window.PiecesModule = PiecesModule;
