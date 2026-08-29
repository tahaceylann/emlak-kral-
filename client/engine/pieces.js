"use strict";
/**
 * Oyuncu piyonu mesh üretimi. M1'de tek bir sabit "pawn" formu var; M3'te
 * (karakter özelleştirme) burası seçilebilir birden çok forma çıkarılacak
 * — çağıran taraf (render3d.js) sadece `buildPawnMesh(color)` çağırır,
 * dolayısıyla o zamanki değişiklik render3d.js'i etkilemeyecek.
 */
function buildPawnMesh(THREE, color) {
  const group = new THREE.Group();

  const baseGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.12, 20);
  const baseMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.06;
  base.castShadow = true;
  group.add(base);

  const bodyGeo = new THREE.ConeGeometry(0.26, 0.55, 20);
  const body = new THREE.Mesh(bodyGeo, baseMat);
  body.position.y = 0.12 + 0.275;
  body.castShadow = true;
  group.add(body);

  const headGeo = new THREE.SphereGeometry(0.16, 16, 16);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.12 + 0.55 + 0.12;
  head.castShadow = true;
  group.add(head);

  return group;
}

const PiecesModule = { buildPawnMesh };
if (typeof module !== "undefined" && module.exports) module.exports = PiecesModule;
if (typeof window !== "undefined") window.PiecesModule = PiecesModule;
