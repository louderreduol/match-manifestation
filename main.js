import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const app = document.getElementById('app');
const canvas = document.getElementById('three');
const statusEl = document.getElementById('status');
const visEl = document.getElementById('vis');
const btn = document.getElementById('btn');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);

const camera = new THREE.PerspectiveCamera(50, app.clientWidth/app.clientHeight, 0.01, 100);
camera.position.set(0.9, 0.6, 1.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(2.5, 3.5, 2.5);
scene.add(dir);

// Helpers (optional; comment out if you don't want)
scene.add(new THREE.AxesHelper(0.2));
// scene.add(new THREE.GridHelper(2, 20, 0x666666, 0x333333));

window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
});

// --- CHANGE THIS if your file name differs ---
const candidates = [
  './assets/casita-draco.glb',
  './assets/casita-file.glb'
];

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
gltfLoader.setDRACOLoader(draco);

let root = null;
let fire = null;

function updateVisLabel() {
  visEl.textContent = fire ? String(fire.visible) : 'n/a';
}

function frameObject(obj) {
  const box = new THREE.Box3(); obj.updateMatrixWorld(true);
  obj.traverse(n => { if (n.isMesh) box.expandByObject(n); });
  const size = new THREE.Vector3(); const center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  if (!maxDim || !isFinite(maxDim)) return;

  const scale = 0.8 / maxDim; // leave margin
  obj.scale.multiplyScalar(scale);
  obj.position.sub(center.multiplyScalar(scale));

  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
}

function tryLoad(i=0){
  if (i >= candidates.length) { statusEl.textContent = '❌ none loaded'; return; }
  const url = candidates[i];
  statusEl.textContent = 'Loading ' + url + ' …';

  gltfLoader.load(url, (res) => {
    statusEl.textContent = '✅ loaded: ' + url;
    root = res.scene;
    root.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; }});
    scene.add(root);

    // Find the mesh named exactly "fire"
    fire = root.getObjectByName('fire'); // <-- your mesh name
    if (!fire) {
      statusEl.textContent += ' | ⚠️ mesh "fire" not found';
    } else {
      // Start unlit
      fire.visible = false;
      updateVisLabel();
    }

    frameObject(root);

  }, undefined, (err) => {
    console.warn('load fail:', url, err);
    tryLoad(i+1);
  });
}
tryLoad();

btn.addEventListener('click', () => {
  if (!fire) { statusEl.textContent = '⚠️ no "fire" mesh in scene'; return; }
  fire.visible = !fire.visible;
  updateVisLabel();
});

// also toggle on canvas click
renderer.domElement.addEventListener('pointerdown', () => {
  if (!fire) return;
  fire.visible = !fire.visible;
  updateVisLabel();
});

function loop(){ controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
