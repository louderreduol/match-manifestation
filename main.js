import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const canvas = document.getElementById('three');
const app = document.getElementById('app');

const statusEl = document.getElementById('status');
const visEl = document.getElementById('vis');
const countEl = document.getElementById('count');
const btn = document.getElementById('btn');

const scene = new THREE.Scene();
window.scene = scene;
scene.background = new THREE.Color(0x0b0b0b);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(app.clientWidth, app.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(45, app.clientWidth / app.clientHeight, 0.01, 100);
camera.position.set(2.5, 1.8, 2.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.9;
controls.zoomSpeed = 0.9;
controls.panSpeed = 0.6;

// Lights
scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(2.5, 3.5, 2.5);
scene.add(dir);

// Responsive
window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
});

// Loader (DRACO safe even if you don’t use draco)
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);

let root = null;
let fire = null;

// ---------- COUNT (local) ----------
const COUNT_KEY = 'manofestation_count';

function getCount() {
  const n = Number(localStorage.getItem(COUNT_KEY));
  return Number.isFinite(n) ? n : 0;
}

function setCount(n) {
  localStorage.setItem(COUNT_KEY, String(n));
}

function incrementCount() {
  const next = getCount() + 1;
  setCount(next);
  updateCountLabel();
}

function updateCountLabel() {
  countEl.textContent = String(getCount());
}

updateCountLabel();
// ----------------------------------

function updateVisLabel() {
  visEl.textContent = fire ? String(fire.visible) : '—';
}

function frameObject(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim <= 0) return;

  // Scale to a friendly size
  const scale = 1.0 / maxDim;
  obj.scale.multiplyScalar(scale);

  // Recompute after scaling
  const box2 = new THREE.Box3().setFromObject(obj);
  const center2 = new THREE.Vector3();
  box2.getCenter(center2);
  obj.position.sub(center2);

  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
}

function setFire(nextOn) {
  if (!fire) return;

  const wasOn = fire.visible;
  fire.visible = nextOn;

  // Only count when turning OFF -> ON
  if (!wasOn && nextOn) {
    incrementCount();
  }

  updateVisLabel();
}

function loadFirstWorking(i = 0) {
  const candidates = [
    './Manofestation.glb',
    './Manofestation.glb?v=' + Date.now(), // cache-buster fallback
  ];
  const url = candidates[i];
  if (!url) {
    statusEl.textContent = '❌ no working model URL';
    return;
  }

  loader.load(
    url,
    (gltf) => {
      statusEl.textContent = '✅ loaded: ' + url;

      root = gltf.scene;
      scene.add(root);

      // Find "Fire" (your Blender object name)
      fire = root.getObjectByName('Fire') || root.getObjectByName('fire') || null;

      if (!fire) {
        statusEl.textContent += ' | ⚠️ mesh "Fire" not found';
      } else {
        // IMPORTANT: start with fire OFF
        fire.visible = false;
      }

      updateVisLabel();
      frameObject(root);
    },
    (p) => {
      if (p.total) statusEl.textContent = `loading… ${((p.loaded / p.total) * 100) | 0}%`;
    },
    (err) => {
      console.warn('load failed:', url, err);
      loadFirstWorking(i + 1);
    }
  );
}

loadFirstWorking();

// Toggle fire via canvas click or button
renderer.domElement.addEventListener('pointerdown', () => {
  if (!fire) return;
  setFire(!fire.visible);
});

btn.addEventListener('click', () => {
  if (!fire) return;
  setFire(!fire.visible);
});

// Render loop
function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
