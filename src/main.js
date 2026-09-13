import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import confetti from 'canvas-confetti';
import { quizQuestions, congratsMessage } from './quiz.js';
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

const quizModal = document.getElementById('quiz-modal');
const modalBackdrop = document.getElementById('modal-backdrop');

const quizProgressBar = document.getElementById('quiz-progress-bar');
const quizProgressLabel = document.getElementById('quiz-progress-label');
const quizProgressWrapper = document.querySelector('.quiz-progress-bar-wrapper');
const quizQuestionArea = document.getElementById('quiz-question-area');
const quizQuestionNumber = document.getElementById('quiz-question-number');
const quizQuestionText = document.getElementById('quiz-question-text');
const quizOptions = document.getElementById('quiz-options');
const quizCongratsArea = document.getElementById('quiz-congrats-area');
const quizWaitingArea = document.getElementById('quiz-waiting-area');
const btnCloseQuiz = document.getElementById('btn-close-quiz');

const banknoteIntro = document.getElementById('banknote-intro');
const quizCard = document.getElementById('quiz-card');

// State
let currentQuestionIndex = 0;
let euroModel = null;
let defaultCameraPos = new THREE.Vector3(0, 1.5, 4.0);
let targetCameraPos = defaultCameraPos.clone();
let isResettingCamera = false;

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
controls.autoRotateSpeed = 60 / 11; // Full 360° rotation in exactly 11 seconds (~5.45)
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

// Floor subtle radial gradient glow disc (smooth fade, zero cutoff)
function createFloorGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, 'rgba(16, 185, 129, 0.28)');
  gradient.addColorStop(0.3, 'rgba(16, 185, 129, 0.16)');
  gradient.addColorStop(0.6, 'rgba(16, 185, 129, 0.05)');
  gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  return new THREE.CanvasTexture(canvas);
}

const discGeo = new THREE.PlaneGeometry(7, 7);
const discMat = new THREE.MeshBasicMaterial({
  map: createFloorGlowTexture(),
  transparent: true,
  depthWrite: false,
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
      loaderText.textContent = `Loading...`;
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

  const delta = clock.getDelta();
  const elapsedTime = clock.elapsedTime;

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

  controls.update(delta);
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
   Interactive Quiz Modal & Live Controller Sync
   ========================================================================== */
const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

// Server Synchronization State
let serverQuizState = {
  status: 'waiting',
  currentIndex: 0,
  totalQuestions: quizQuestions.length,
  currentQuestion: null
};

let localStatus = 'waiting';
let localIndex = -1;

function updateProgressBar(index, total) {
  const percent = ((index + 1) / total) * 100;
  quizProgressBar.style.width = `${percent}%`;
  quizProgressLabel.textContent = `Question ${index + 1} of ${total}`;
}

function renderQuestion(index) {
  const q = quizQuestions[index] || serverQuizState.currentQuestion;
  if (!q) return;

  quizQuestionNumber.textContent = String(index + 1).padStart(2, '0');
  quizQuestionText.textContent = q.question;

  // Clear old options
  quizOptions.innerHTML = '';

  q.options.forEach((optText, i) => {
    const letter = optionLetters[i] || String.fromCharCode(97 + i);
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.id = `quiz-option-${index}-${i}`;
    btn.innerHTML = `
      <span class="option-letter">${letter}.</span>
      <span class="option-text">${optText}</span>
    `;
    btn.addEventListener('click', () => handleOptionClick(btn));
    quizOptions.appendChild(btn);
  });

  updateProgressBar(index, serverQuizState.totalQuestions || quizQuestions.length);

  // Animate entrance
  quizQuestionArea.classList.remove('quiz-slide-in');
  void quizQuestionArea.offsetWidth; // trigger reflow
  quizQuestionArea.classList.add('quiz-slide-in');
}

function handleOptionClick(btn) {
  sound.playClick();

  // Visual feedback: highlight the clicked option
  const allBtns = quizOptions.querySelectorAll('.quiz-option-btn');
  allBtns.forEach(b => {
    b.classList.remove('selected');
  });
  btn.classList.add('selected');
}

function showCongrats() {
  sound.playBanknoteSlide();

  // Update progress bar to 100%
  quizProgressBar.style.width = '100%';
  quizProgressLabel.textContent = 'Completed!';

  // Hide question & waiting area, show congrats
  quizWaitingArea.classList.add('hidden');
  quizQuestionArea.classList.add('hidden');
  quizCongratsArea.classList.remove('hidden');

  // Big celebration confetti
  confetti({
    particleCount: 120,
    spread: 100,
    origin: { y: 0.55 },
    colors: ['#10b981', '#34d399', '#f59e0b', '#fbbf24', '#ffffff', '#a78bfa']
  });

  // Second wave
  setTimeout(() => {
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.6 },
      colors: ['#10b981', '#f59e0b', '#ffffff']
    });
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.6 },
      colors: ['#10b981', '#f59e0b', '#ffffff']
    });
  }, 400);
}

let introTimeout1 = null;
let introTimeout2 = null;
let introTimeout3 = null;

function clearIntroTimeouts() {
  if (introTimeout1) clearTimeout(introTimeout1);
  if (introTimeout2) clearTimeout(introTimeout2);
  if (introTimeout3) clearTimeout(introTimeout3);
  introTimeout1 = null;
  introTimeout2 = null;
  introTimeout3 = null;
}

function openQuizModal() {
  clearIntroTimeouts();
  sound.playBanknoteSlide();

  const isWaiting = serverQuizState.status === 'waiting';
  const isEnded = serverQuizState.status === 'ended';

  if (isWaiting) {
    if (quizProgressWrapper) quizProgressWrapper.classList.add('hidden');
    if (quizProgressLabel) quizProgressLabel.classList.add('hidden');
    quizWaitingArea.classList.remove('hidden');
    quizQuestionArea.classList.add('hidden');
    quizCongratsArea.classList.add('hidden');
  } else if (isEnded) {
    if (quizProgressWrapper) quizProgressWrapper.classList.remove('hidden');
    if (quizProgressLabel) {
      quizProgressLabel.classList.remove('hidden');
      quizProgressLabel.textContent = 'Completed!';
    }
    quizProgressBar.style.width = '100%';
    quizWaitingArea.classList.add('hidden');
    quizQuestionArea.classList.add('hidden');
    quizCongratsArea.classList.remove('hidden');
  } else {
    // Active
    if (quizProgressWrapper) quizProgressWrapper.classList.remove('hidden');
    if (quizProgressLabel) quizProgressLabel.classList.remove('hidden');
    quizWaitingArea.classList.add('hidden');
    quizQuestionArea.classList.remove('hidden');
    quizCongratsArea.classList.add('hidden');
    renderQuestion(serverQuizState.currentIndex);
  }

  // Reset intro & quiz card state
  banknoteIntro.classList.remove('banknote-emerge', 'banknote-exit', 'intro-hidden');
  quizCard.classList.remove('quiz-card-enter');
  quizCard.classList.add('quiz-card-hidden');

  // Force reflow so emergence animation restarts cleanly
  void banknoteIntro.offsetWidth;
  banknoteIntro.classList.add('banknote-emerge');

  // Show modal
  quizModal.classList.remove('hidden');

  // After banknote emerges and rests (800ms), smoothly 3D-flip into quiz card
  introTimeout1 = setTimeout(() => {
    sound.playBanknoteSlide();
    banknoteIntro.classList.add('banknote-exit');

    // Quiz card flips in as banknote rotates edge-on
    introTimeout2 = setTimeout(() => {
      quizCard.classList.remove('quiz-card-hidden');
      quizCard.classList.add('quiz-card-enter');
    }, 240);

    // Hide intro from pointer events after flip completes
    introTimeout3 = setTimeout(() => {
      banknoteIntro.classList.add('intro-hidden');
    }, 600);
  }, 800);
}

function closeQuizModal() {
  clearIntroTimeouts();
  sound.playClick();
  quizModal.classList.add('hidden');

  // Reset intro state for next time
  banknoteIntro.classList.remove('banknote-emerge', 'banknote-exit', 'intro-hidden');
  quizCard.classList.remove('quiz-card-enter');
  quizCard.classList.add('quiz-card-hidden');
}

// Apply updates received from /quiz or /api/quiz/stream
function applyServerState(state) {
  serverQuizState = state;
  const { status, currentIndex } = state;

  if (status === 'waiting') {
    localStatus = 'waiting';
    localIndex = -1;
  } else if (status === 'active') {
    localStatus = 'active';
    localIndex = currentIndex;
  } else if (status === 'ended') {
    localStatus = 'ended';
  }
}

// Connect to Server-Sent Events (SSE) stream for real-time live synchronization
function initLiveSync() {
  function connect() {
    const evtSource = new EventSource('/api/quiz/stream');
    evtSource.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        applyServerState(state);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };
    evtSource.onerror = () => {
      evtSource.close();
      // Reconnect after 1.5s
      setTimeout(connect, 1500);
    };
  }

  // Initial fetch
  fetch('/api/quiz')
    .then(res => res.json())
    .then(state => applyServerState(state))
    .catch(err => console.error('Initial fetch failed:', err));

  connect();

  // Backup short poll every 2 seconds in case SSE drops
  setInterval(() => {
    fetch('/api/quiz')
      .then(res => res.json())
      .then(state => applyServerState(state))
      .catch(() => {});
  }, 2000);
}

// Start live sync
initLiveSync();

// Event Listeners
btnClickMoney.addEventListener('click', () => {
  sound.playClick();
  window.location.href = '/quiz';
});
modalBackdrop.addEventListener('click', closeQuizModal);
btnCloseQuiz.addEventListener('click', closeQuizModal);

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
  if (e.key === 'Escape' && !quizModal.classList.contains('hidden')) {
    closeQuizModal();
  }
});
