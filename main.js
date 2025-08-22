import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createClient } from '@supabase/supabase-js';

// ---------- Supabase (global counter) ----------
const supabaseUrl = window.SUPABASE_URL;
const supabaseAnonKey = window.SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseAnonKey && !supabaseUrl.startsWith('REPLACE')) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

async function fetchCount() {
  if (!supabase) return null;
  // We expose a simple RPC get_manifestation() that returns a single row with count
  const { data, error } = await supabase.rpc('get_manifestation');
  if (error) {
    console.warn('Fetch count error:', error.message);
    return null;
  }
  return data; // should be a number
}

async function incrementCount() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('increment_manifestation');
  if (error) {
    console.warn('Increment error:', error.message);
    return null;
  }
  return data;
}

// ---------- Three.js setup ----------
const app = document.getElementById('app');
const canvas = document.getElementById('three');
const hud = document.getElementById('counter');
const cta = document.getElementById('cta');
const toast = document.getElementById('toast');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);

const camera = new THREE.PerspectiveCamera(50, app.clientWidth / app.clientHeight, 0.01, 100);
camera.position.set(0.6, 0.35, 0.9);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.2, 0);

// Lighting
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(2, 3, 2);
scene.add(dir);
scene.add(new THREE.AmbientLight(0xffffff, 0.6)); // 👈 extra base light so the model isn’t black


// Load model
const loader = new GLTFLoader();
const modelUrl = './assets/casita-file.glb';
let modelGroup = new THREE.Group();
scene.add(modelGroup);

loader.load(modelUrl, (gltf) => {
  const root = gltf.scene;

  // --- center & scale the model so it fits the camera view ---
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 0.8 / maxDim;            // scale a bit smaller so it fits nicely
  root.scale.setScalar(scale);
  root.position.sub(center.multiplyScalar(scale)); // move model to origin

  root.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  modelGroup.add(root);

  // --- aim the camera at the model & pull back a bit ---
  controls.target.set(0, 0, 0);
  camera.position.set(0.9, 0.6, 1.4);
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
}, undefined, (err) => {
  console.error('GLB load error', err);
});

// Flame sprite
const flameTex = new THREE.TextureLoader().load('./assets/flame.png');
flameTex.colorSpace = THREE.SRGBColorSpace;
const flameMat = new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false });
const flame = new THREE.Sprite(flameMat);
flame.scale.set(0.06, 0.12, 1); // adjust as needed
flame.visible = false;
scene.add(flame);

// Match light (warm)
const matchLight = new THREE.PointLight(0xffc46b, 1.3, 0.25, 2);
matchLight.visible = false;
scene.add(matchLight);

let lastClickAt = 0;

// Handle resize
window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
});

// Raycaster
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function screenToRaycast(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ( (event.clientX - rect.left) / rect.width ) * 2 - 1;
  const y = - ( (event.clientY - rect.top) / rect.height ) * 2 + 1;
  pointer.set(x, y);
  raycaster.setFromCamera(pointer, camera);
}

function igniteAt(point, targetMesh) {
  // Place sprite & light
  flame.position.copy(point);
  matchLight.position.copy(point);
  flame.visible = true;
  matchLight.visible = true;

  // Emissive pop on the hit mesh if supported
  let material = targetMesh && targetMesh.material;
  const hadEmissive = material && material.emissive;
  let originalEmissiveIntensity = hadEmissive ? material.emissiveIntensity : 0;
  if (hadEmissive) {
    material.emissive = new THREE.Color(0xffa000);
    material.emissiveIntensity = 2.0;
  }

  // Subtle animation/fade
  const start = performance.now();
  const life = 1500; // ms
  const animateFlame = (t) => {
    const elapsed = t - start;
    const k = Math.min(elapsed / life, 1);
    const pulse = 1 + 0.1 * Math.sin(t * 0.02);
    flame.scale.set(0.06 * pulse, 0.12 * pulse, 1);
    matchLight.intensity = 1.3 * (1 - k * 0.6);
    if (k < 1) requestAnimationFrame(animateFlame);
    else {
      flame.visible = false;
      matchLight.visible = false;
      if (hadEmissive) material.emissiveIntensity = originalEmissiveIntensity;
    }
  };
  requestAnimationFrame(animateFlame);
}

function maybeIncrement() {
  const now = Date.now();
  const cooldown = window.CLICK_COOLDOWN_MS || 10000;
  if (now - lastClickAt < cooldown) {
    showToast('Please wait a moment before manifesting again.');
    return;
  }
  lastClickAt = now;
  if (!supabase) {
    // Local fallback
    const local = parseInt(localStorage.getItem('manifestation_count') || '0', 10) + 1;
    localStorage.setItem('manifestation_count', String(local));
    hud.textContent = String(local) + ' (local)';
    return;
  }
  incrementCount().then((count) => {
    if (typeof count === 'number') {
      hud.textContent = String(count);
    }
  });
}

function showToast(msg) {
  toast.textContent = msg;
  toast.style.display = 'block';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.style.display = 'none'), 1500);
}

// Pointer events
function handlePointer(event) {
  screenToRaycast(event);
  const targets = [];
  modelGroup.traverse((o) => { if (o.isMesh) targets.push(o); });
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length > 0) {
    const hit = hits[0];
    igniteAt(hit.point, hit.object);
    maybeIncrement();
  }
}
renderer.domElement.addEventListener('pointerdown', handlePointer);

// Accessibility button
cta.addEventListener('click', () => {
  // Ignites at controls target as a fallback
  const point = controls.target.clone();
  point.y += 0.05;
  igniteAt(point, null);
  maybeIncrement();
});

// Initial count
(async () => {
  // Try Supabase; fallback to local storage
  let count = null;
  if (supabase) {
    count = await fetchCount();
    if (typeof count === 'number') {
      hud.textContent = String(count);
    }
  }
  if (count === null) {
    const local = parseInt(localStorage.getItem('manifestation_count') || '0', 10);
    hud.textContent = String(local) + ' (local)';
  }
})();

// Render loop
function loop(t) {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
