// ===== Imports =====
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createClient } from '@supabase/supabase-js';

// ===== Minimal HUD refs (already in index.html) =====
const app    = document.getElementById('app');
const canvas = document.getElementById('three');
const hudEl  = document.getElementById('counter');
const cta    = document.getElementById('cta');

// ===== Renderer / Scene / Camera =====
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);

const camera = new THREE.PerspectiveCamera(50, app.clientWidth / app.clientHeight, 0.01, 100);
camera.position.set(1.8, 1.2, 2.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// ===== Lights (bright so nothing is black) =====
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(2.5, 3.5, 2.5);
scene.add(dir);

// Helpers to prove where “center” is
scene.add(new THREE.AxesHelper(0.25));
scene.add(new THREE.GridHelper(10, 10, 0x666666, 0x333333));

// ===== Resize =====
window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
});

// ===== Flame sprite (kept) =====
const flameTex = new THREE.TextureLoader().load('./assets/flame.png');
flameTex.colorSpace = THREE.SRGBColorSpace;
const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false }));
flame.scale.set(0.06, 0.12, 1);
flame.visible = false;
scene.add(flame);

const matchLight = new THREE.PointLight(0xffc46b, 1.3, 0.25, 2);
matchLight.visible = false;
scene.add(matchLight);

// ===== Model Loader (tries both filenames, with DRACO) =====
const candidates = ['./assets/casita-draco.glb', './assets/casita-file.glb'];

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
// Use THREE’s hosted decoders (works on GitHub Pages)
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
gltfLoader.setDRACOLoader(draco);

let modelRoot = null;

function frameObject(obj) {
  // Compute tight box on meshes only
  const box = new THREE.Box3();
  obj.updateMatrixWorld(true);
  obj.traverse(n => { if (n.isMesh) box.expandByObject(n); });

  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);

  // If the model is absurdly small/huge, normalize it
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!isFinite(maxDim) || maxDim === 0) return;

  // Scale to ~80% of view box
  const scale = 0.8 / maxDim;
  obj.scale.multiplyScalar(scale);
  obj.position.sub(center.multiplyScalar(scale));

  // Add a visible box so we can see what’s framed
  const helper = new THREE.Box3Helper(new THREE.Box3().setFromObject(obj), 0x44aa88);
  scene.add(helper);

  // Place camera back based on box size
  const fitHeightDistance = (size.y * scale) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
  const fitWidthDistance  = (size.x * scale) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))) / camera.aspect;
  const distance = Math.max(fitHeightDistance, fitWidthDistance);
  const dirVec = new THREE.Vector3(1, 0.6, 1).normalize(); // nice diagonal view
  const newPos = dirVec.multiplyScalar(distance * 1.6);     // pad a bit
  camera.position.copy(newPos);
  controls.target.set(0, 0, 0);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
}

function tryLoad(i = 0) {
  if (i >= candidates.length) {
    console.error('❌ Could not load model from any known path:', candidates);
    return;
  }
  const url = candidates[i];
  console.log('Trying model URL:', url);

  gltfLoader.load(url, (gltf) => {
    console.log('✅ Loaded:', url);
    modelRoot = gltf.scene;

    // Light up all meshes properly
    modelRoot.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.needsUpdate = true; } } });

    scene.add(modelRoot);
    frameObject(modelRoot);

  }, undefined, (err) => {
    console.warn('⚠️ Failed:', url, err?.message || err);
    tryLoad(i + 1);
  });
}
tryLoad();

// ===== Interaction =====
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function toRay(e) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
}

function ignite(point, mesh) {
  flame.position.copy(point);
  matchLight.position.copy(point);
  flame.visible = true; matchLight.visible = true;

  let mat = mesh?.material;
  const hadEm = mat && mat.emissive;
  const prev = hadEm ? mat.emissiveIntensity : 0;
  if (hadEm) { mat.emissive = new THREE.Color(0xffa000); mat.emissiveIntensity = 2.0; }

  const t0 = performance.now(), life = 1500;
  const tick = (t) => {
    const k = Math.min((t - t0) / life, 1);
    flame.scale.setScalar(1).set(0.06 * (1 + 0.1 * Math.sin(t * 0.02)), 0.12 * (1 + 0.1 * Math.sin(t * 0.02)), 1);
    matchLight.intensity = 1.3 * (1 - k * 0.6);
    if (k < 1) requestAnimationFrame(tick);
    else { flame.visible = false; matchLight.visible = false; if (hadEm) mat.emissiveIntensity = prev; }
  };
  requestAnimationFrame(tick);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!modelRoot) return;
  toRay(e);
  const targets = [];
  modelRoot.traverse(o => { if (o.isMesh) targets.push(o); });
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length) ignite(hits[0].point, hits[0].object);
});

// ===== Counter (local fallback only here; hook Supabase later) =====
(function initCount(){
  const v = parseInt(localStorage.getItem('manifestation_count') || '0', 10);
  hudEl.textContent = v + ' (local)';
})();

// ===== Render loop =====
function loop(){ controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
