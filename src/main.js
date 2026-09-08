import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import confetti from 'canvas-confetti';
import { getRandomJoke } from './jokes.js';
import { sound } from './audio.js';

// DOM Elements
const canvasContainer = document.getElementById('canvas-container');
const loaderElement = document.getElementById('loader');
const loaderColorMask = document.getElementById('loader-color-mask');
const loaderText = document.getElementById('loader-text');

const btnClickMoney = document.getElementById('btn-click-money');
const btnSound = document.getElementById('btn-sound');
const iconSoundOn = document.getElementById('icon-sound-on');
const iconSoundOff = document.getElementById('icon-sound-off');
const btnResetView = document.getElementById('btn-reset-view');

const cardModal = document.getElementById('card-modal');
const modalBackdrop = document.getElementById('modal-backdrop');
const banknoteCard = document.getElementById('banknote-card');
const banknoteFlipper = document.getElementById('banknote-flipper');
const cardGlare = document.getElementById('card-glare');
const btnAnotherJoke = document.getElementById('btn-another-joke');
const btnCloseCard = document.getElementById('btn-close-card');

const jokeCategory = document.getElementById('joke-category');
const jokeSetup = document.getElementById('joke-setup');
const jokePunchline = document.getElementById('joke-punchline');

// State
let currentJokeIndex = -1;
let euroModel = null;
let defaultCameraPos = new THREE.Vector3(0, 1.5, 4.0);
let targetCameraPos = defaultCameraPos.clone();
let isResettingCamera = false;
let flipTimeout = null;

/* ==========================================================================
   Three.js Scene Setup
   ========================================================================== */
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.copy(defaultCameraPos);

// WebGL Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasContainer.appendChild(renderer.domElement);

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.9; // Slow, elegant rotation
controls.maxPolarAngle = Math.PI / 2 + 0.12;
controls.minPolarAngle = 0.15;
controls.minDistance = 1.8;
controls.maxDistance = 7.0;
controls.target.set(0, 0.25, 0);

/* ==========================================================================
   Lighting & Studio Ambience (with physical glow behind money)
   ========================================================================== */
// Soft Ambient Light
const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
scene.add(ambientLight);

// Key Directional Light
const keyLight = new THREE.DirectionalLight(0xfffaf0, 2.8);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.bias = -0.0001;
scene.add(keyLight);

// Fill Light
const fillLight = new THREE.DirectionalLight(0xa7f3d0, 1.4);
fillLight.position.set(-5, 3, -2);
scene.add(fillLight);

// Rim Light
const rimLight = new THREE.DirectionalLight(0xfef08a, 1.6);
rimLight.position.set(0, -3, -5);
scene.add(rimLight);

// Physical Glow Point Light directly behind the 3D Euro stack
const backGlowLight = new THREE.PointLight(0x10b981, 4.0, 9);
backGlowLight.position.set(0, 0.35, -0.9);
scene.add(backGlowLight);

const backGoldLight = new THREE.PointLight(0xf59e0b, 2.5, 8);
backGoldLight.position.set(0, 0.15, -1.2);
scene.add(backGoldLight);

// Subtle Contact Shadow Floor Plane
const shadowPlaneGeo = new THREE.PlaneGeometry(10, 10);
const shadowPlaneMat = new THREE.ShadowMaterial({
  opacity: 0.35
});
const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -0.55;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// Floor subtle glow disc
const discGeo = new THREE.RingGeometry(0.01, 2.5, 64);
const discMat = new THREE.MeshBasicMaterial({
  color: 0x10b981,
  transparent: true,
  opacity: 0.08,
  side: THREE.DoubleSide
});
const disc = new THREE.Mesh(discGeo, discMat);
disc.rotation.x = -Math.PI / 2;
disc.position.y = -0.54;
scene.add(disc);

/* ==========================================================================
   GLTF Model Loading
   ========================================================================== */
const loader = new GLTFLoader();
const modelUrl = '/euro_bundle.glb';

loader.load(
  modelUrl,
  (gltf) => {
    euroModel = gltf.scene;

    euroModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.roughness = 0.55;
          child.material.metalness = 0.15;
        }
      }
    });

    // Compute bounding box and center the model
    const box = new THREE.Box3().setFromObject(euroModel);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    euroModel.position.sub(center);
    euroModel.position.y += 0.25;

    // Angle initial rotation to showcase front bill
    euroModel.rotation.y = -Math.PI * 0.25;

    // Normalize scale
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 2.4 / maxDim;
      euroModel.scale.setScalar(scale);
    }

    scene.add(euroModel);

    // Fill logo to 100% before fading out
    loaderColorMask.style.clipPath = 'inset(0% 0 0 0)';
    loaderText.textContent = 'Ready';

    setTimeout(() => {
      loaderElement.style.opacity = '0';
      setTimeout(() => {
        loaderElement.style.display = 'none';
      }, 600);
    }, 600);
  },
  (xhr) => {
    if (xhr.lengthComputable) {
      const percent = Math.round((xhr.loaded / xhr.total) * 100);
      // Reveal colored logo from bottom-to-top: inset(top% 0 0 0)
      const topInset = 100 - percent;
      loaderColorMask.style.clipPath = `inset(${topInset}% 0 0 0)`;
      loaderText.textContent = `Loading 3D Euro Model: ${percent}%`;
    }
  },
  (error) => {
    console.error('Error loading 3D model:', error);
    loaderColorMask.style.clipPath = 'inset(0% 0 0 0)';
    loaderText.textContent = 'Ready';
    setTimeout(() => {
      loaderElement.style.opacity = '0';
      setTimeout(() => {
        loaderElement.style.display = 'none';
      }, 600);
    }, 800);
  }
);

/* ==========================================================================
   Animation Loop
   ========================================================================== */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();

  // Oscillate back glow point lights for living atmosphere
  backGlowLight.intensity = 3.6 + Math.sin(elapsedTime * 2.2) * 0.9;
  backGoldLight.intensity = 2.2 + Math.cos(elapsedTime * 1.8) * 0.6;

  // Smooth camera reset animation
  if (isResettingCamera) {
    camera.position.lerp(targetCameraPos, 0.08);
    controls.target.lerp(new THREE.Vector3(0, 0.25, 0), 0.08);
    if (camera.position.distanceTo(targetCameraPos) < 0.02) {
      camera.position.copy(targetCameraPos);
      controls.target.set(0, 0.25, 0);
      isResettingCamera = false;
    }
  }

  // Float model subtly
  if (euroModel) {
    euroModel.position.y = 0.25 + Math.sin(elapsedTime * 1.5) * 0.04;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

/* ==========================================================================
   Window Resize Handler
   ========================================================================== */
window.addEventListener('resize', onWindowResize);

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  if (width < 640) {
    defaultCameraPos.set(0, 2.2, 4.4);
  } else {
    defaultCameraPos.set(0, 1.5, 4.0);
  }
}

if (window.innerWidth < 640) {
  defaultCameraPos.set(0, 2.2, 4.4);
  camera.position.copy(defaultCameraPos);
}

/* ==========================================================================
   Interactive Joke & Banknote Card Modal with 3D Flip
   ========================================================================== */
function displayNewJoke() {
  const { joke, index } = getRandomJoke(currentJokeIndex);
  currentJokeIndex = index;

  jokeCategory.textContent = joke.category.toUpperCase();
  jokeSetup.textContent = joke.setup;
  jokePunchline.textContent = joke.punchline;
}

function triggerAutomaticFlip() {
  if (flipTimeout) clearTimeout(flipTimeout);

  // Automatically flip after 1.5 seconds
  flipTimeout = setTimeout(() => {
    sound.playBanknoteSlide();
    banknoteFlipper.classList.add('is-flipped');
  }, 1500);
}

function openCardModal() {
  sound.playBanknoteSlide();
  displayNewJoke();

  // Reset to front face initially
  banknoteFlipper.classList.remove('is-flipped');

  cardModal.classList.remove('hidden');
  banknoteCard.classList.remove('card-emerging');

  // Trigger reflow to restart emergence animation
  void banknoteCard.offsetWidth;
  banknoteCard.classList.add('card-emerging');

  // Green & Gold celebratory confetti
  confetti({
    particleCount: 45,
    spread: 70,
    origin: { y: 0.65 },
    colors: ['#10b981', '#34d399', '#f59e0b', '#fbbf24', '#ffffff']
  });

  // Start the 1.5s automatic flip timer
  triggerAutomaticFlip();
}

function closeCardModal() {
  if (flipTimeout) clearTimeout(flipTimeout);
  sound.playClick();
  cardModal.classList.add('hidden');
  banknoteFlipper.classList.remove('is-flipped');
}

// 3D Parallax Tilt on Banknote Card
banknoteCard.addEventListener('mousemove', (e) => {
  const rect = banknoteCard.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  const rotateX = ((y - centerY) / centerY) * -10;
  const rotateY = ((x - centerX) / centerX) * 12;

  banknoteCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

  if (cardGlare) {
    cardGlare.style.opacity = '1';
    cardGlare.style.background = `radial-gradient(circle at ${(x / rect.width) * 100}% ${(y / rect.height) * 100}%, rgba(255, 255, 255, 0.25) 0%, transparent 60%)`;
  }
});

banknoteCard.addEventListener('mouseleave', () => {
  banknoteCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  if (cardGlare) {
    cardGlare.style.opacity = '0';
  }
});

// Event Listeners
btnClickMoney.addEventListener('click', openCardModal);
modalBackdrop.addEventListener('click', closeCardModal);
btnCloseCard.addEventListener('click', closeCardModal);

btnAnotherJoke.addEventListener('click', () => {
  sound.playBanknoteSlide();

  // Reset to front face
  banknoteFlipper.classList.remove('is-flipped');

  // Load new joke
  displayNewJoke();

  confetti({
    particleCount: 25,
    spread: 50,
    origin: { y: 0.65 },
    colors: ['#10b981', '#f59e0b', '#ffffff']
  });

  // Automatically flip after 1.5 seconds again
  triggerAutomaticFlip();
});

// Reset Camera Button
btnResetView.addEventListener('click', () => {
  sound.playClick();
  targetCameraPos.copy(defaultCameraPos);
  isResettingCamera = true;
});

// Sound Toggle Button
btnSound.addEventListener('click', () => {
  const isMuted = sound.toggleMute();
  if (isMuted) {
    iconSoundOn.classList.add('hidden');
    iconSoundOff.classList.remove('hidden');
  } else {
    iconSoundOn.classList.remove('hidden');
    iconSoundOff.classList.add('hidden');
    sound.playClick();
  }
});

// ESC key closes modal
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !cardModal.classList.contains('hidden')) {
    closeCardModal();
  }
});
