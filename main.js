// ===== Imports =====
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createClient } from '@supabase/supabase-js';

// ===== Supabase (optional global counter) =====
const supabaseUrl = window.SUPABASE_URL;
const supabaseAnonKey = window.SUPABASE_ANON_KEY;
let supabase = null;
if (supabaseUrl && supabaseAnonKey && !supabaseUrl.startsWith('REPLACE')) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

async function fetchCount() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_manifestation');
  if (error) { console.warn('Fetch count error:', error.message); return null; }
  return data;
}
async function incrementCount() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('increment_manifestation');
  if (error) { console.warn('Increment error:', error.message); return null; }
  return data;
}

// ===== DOM =====
const app   = document.getElementById('app');
const canvas= document.getElementById('three');
const hudEl = document.getElementById('counter');
const cta   = document.getElementById('cta');
const toast = document.getElementById('toast');

// ===== Renderer / Scene / Camera =====
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);

const camera = new THREE.PerspectiveCamera(50, app.clientWidth / app.clientHeight, 0.01, 100);
camera.position.set(0.9, 0.6, 1.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

// ===== Lights =====
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(2, 3, 2);
scene.add(dir);
scene.add(new THREE.AmbientLight(0xffffff, 0.6)); // base light so model isn’t black

// ===== Resize =====
window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
  camera.aspect = app.clientWidth / app.clientHeight;
  camera.updateProjectionMatrix();
});

// ===== Assets =====
const MODEL_URL = './assets/casita-draco.glb';   // <- make sure this exists
const FLAME_URL = './assets/f_
