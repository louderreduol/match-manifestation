import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// We try both paths to avoid case-sensitivity 404s on GitHub Pages.
const MODEL_CANDIDATES = [
  './Manofestation.glb',   // capital M (your current file)
  './manofestation.glb'    // lowercase fallback
];

const app = document.getElementById('app');
const canvas = document.getElementById('three');
const statusEl = document.getElementById('status');
const visEl = document.getElementById('vis');
const btn = document.getElementById('btn');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(app.clientWidth, app.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);

const camera = new THREE.PerspectiveCamera(50, app.clientWidth/app.clientHeight, 0.01, 100);
camera.position.set(1.4, 0.9, 1.8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// bright basic lights
scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(2.5, 3.5, 2.5);
scene.add(dir);

// responsive
window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
});

// loader with DRACO (works even if the GLB isn't draco-compressed)
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);

let root = null;
let fire = null;

function updateVisLabel() {
  visEl.textContent = fire ? String(fire.visible) : '—';
}

function frameObject(obj) {
  const box = new THREE.Box3(); obj.updateMatrixWorld(true);
  obj.traverse(n => { if (n.isMesh) box.expandByObject(n); });
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!maxDim || !isFinite(maxDim)) return;

  const scale = 0.8 / maxDim;            // leave some margin
  obj.scale.multiplyScalar(scale);
  obj.position.sub(center.multiplyScalar(scale));

  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
}

// Try candidates one-by-one until one loads
function loadFirstWorking(i = 0) {
  if (i >= MODEL_CANDIDATES.length) {
    statusEl.textContent = '❌ load failed (see console)';
    return;
  }
  const url = MODEL_CANDIDATES[i];
  statusEl.textContent = 'loading… ' + url;

  loader.load(
    url,
    (gltf) => {
      statusEl.textContent = '✅ loaded: ' + url;

      root = gltf.scene;
      root.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; }});
      scene.add(root);

      // Find the mesh named exactly "fire" (Object name in Blender Outliner)
      fire = root.getObjectByName('fire') || null;
      if (!fire) {
        statusEl.textContent += ' | ⚠️ mesh "fire" not found';
      } else {
        fire.visible = false; // start unlit
      }
      updateVisLabel();
      frameObject(root);
    },
    (p) => {
      if (p.total) statusEl.textContent = `loading… ${((p.loaded/p.total)*100|0)}%`;
    },
    (err) => {
      console.warn('load failed:', url, err);
      loadFirstWorking(i + 1); // try next candidate
    }
  );
}
loadFirstWorking();

// Toggle "fire" on canvas click or button
renderer.domElement.addEventListener('pointerdown', () => {
  if (!fire) return;
  fire.visible = !fire.visible;
  updateVisLabel();
});
btn.addEventListener('click', () => {
  if (!fire) return;
  fire.visible = !fire.visible;
  updateVisLabel();
});

// render loop
function loop(){ controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
