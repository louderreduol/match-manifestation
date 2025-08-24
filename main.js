import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// your GLB is in the repo root with a capital M:
const MODEL_URL = './Manofestation.glb';

const app = document.getElementById('app');
const canvas = document.getElementById('three');
const statusEl = document.getElementById('status');
const visEl = document.getElementById('vis');
const btn = document.getElementById('btn');

// renderer / scene / camera
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(app.clientWidth, app.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);

const camera = new THREE.PerspectiveCamera(50, app.clientWidth / app.clientHeight, 0.01, 100);
camera.position.set(1.4, 0.9, 1.8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(2.5, 3.5, 2.5);
scene.add(dir);

// resize handler
window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight, false);
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
});

// loader with DRACO (safe even if not compressed)
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);

let root = null;
let fire = null;

function updateVisLabel() {
  visEl.textContent = fire ? String(fire.visible) : 'n/a';
}

function frameObject(obj) {
  const box = new THREE.Box3(); obj.updateMatrixWorld(true);
  obj.traverse(n => { if (n.isMesh) box.expandByObject(n); });
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!maxDim) return;

  const scale = 0.8 / maxDim; // leave margin in view
  obj.scale.multiplyScalar(scale);
  obj.position.sub(center.multiplyScalar(scale));

  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
}

// load model
loader.load(
  MODEL_URL,
  (gltf) => {
    statusEl.textContent = '✅ loaded: ' + MODEL_URL;

    root = gltf.scene;
    root.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; }});
    scene.add(root);

    // find mesh named exactly "fire" (Object name in Blender Outliner)
    fire = root.getObjectByName('fire') || null;
    if (!fire) {
      statusEl.textContent += ' | ⚠️ mesh "fire" not found';
    } else {
      fire.visible = false; // start hidden
    }
    updateVisLabel();

    frameObject(root);
  },
  (p) => {
    if (p.total) {
      const pct = ((p.loaded / p.total) * 100).toFixed(0);
      statusEl.textContent = `loading… ${pct}%`;
    }
  },
  (err) => {
    console.error('GLB load error', err);
    statusEl.textContent = '❌ load failed (see console)';
  }
);

// toggle fire on canvas click or button
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
function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
