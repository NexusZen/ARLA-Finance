import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import confetti from 'canvas-confetti';
import { quizQuestions } from './quiz.js';
import { sound } from './audio.js';

// DOM References
const banknoteIntro = document.getElementById('banknote-intro');
const quizCard = document.getElementById('quiz-card');
const quizProgressWrapper = document.getElementById('quiz-progress-wrapper');
const quizProgressBar = document.getElementById('quiz-progress-bar');
const quizProgressLabel = document.getElementById('quiz-progress-label');

const quizWaitingArea = document.getElementById('quiz-waiting-area');
const quizQuestionArea = document.getElementById('quiz-question-area');
const quizCongratsArea = document.getElementById('quiz-congrats-area');

const quizQuestionNumber = document.getElementById('quiz-qnum');
const quizQuestionText = document.getElementById('quiz-qtext');
const quizOptions = document.getElementById('quiz-options');

const syncPill = document.getElementById('sync-pill');
const syncText = document.getElementById('sync-text');
const btnSound = document.getElementById('btn-sound');
const iconSoundOn = document.getElementById('icon-sound-on');
const iconSoundOff = document.getElementById('icon-sound-off');

// Name Registration DOM
const nameModal = document.getElementById('name-modal');
const formNameEntry = document.getElementById('form-name-entry');
const inputUserName = document.getElementById('input-user-name');
const waitingNameDisplay = document.getElementById('waiting-name-display');
const btnEditName = document.getElementById('btn-edit-name');
const cardHolderTitle = document.getElementById('card-holder-title');

// 3D Card DOM
const card3DContainer = document.getElementById('card-3d-container');

const optionLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

// State
let participantName = localStorage.getItem('arla_participant_name') || '';

let currentState = {
  status: 'waiting',
  currentIndex: 0,
  totalQuestions: quizQuestions.length,
  currentQuestion: null
};

let localStatus = null;
let localIndex = -1;
let introCompleted = false;

// 3D Card Engine Variables
let cardScene = null;
let cardCamera = null;
let cardRenderer = null;
let cardControls = null;
let cardModel = null;
let backMesh = null;
let isCardInitialized = false;
let isCardAnimating = false;
let cardAnimationId = null;

/* ==========================================================================
   Participant Name Registration
   ========================================================================== */
let nameConfirmed = false; // Always prompt at the start of the quiz

function updateParticipantName(name) {
  participantName = (name || '').trim();
  if (participantName) {
    localStorage.setItem('arla_participant_name', participantName);
  } else {
    participantName = 'Participant';
  }

  if (waitingNameDisplay) {
    waitingNameDisplay.textContent = participantName;
  }
  if (cardHolderTitle) {
    cardHolderTitle.textContent = participantName;
  }

  // If 3D card is active, re-engrave with updated name
  if (backMesh && isCardInitialized) {
    applyEngravedTexture(participantName);
  }
}

function checkParticipantName() {
  const savedName = localStorage.getItem('arla_participant_name') || '';
  if (inputUserName) {
    inputUserName.value = savedName;
  }
  
  // Prompt at the start of the quiz
  if (!nameConfirmed) {
    if (nameModal) {
      nameModal.classList.remove('hidden');
      setTimeout(() => {
        if (inputUserName) {
          inputUserName.focus();
          inputUserName.select();
        }
      }, 200);
    }
  } else {
    if (nameModal) {
      nameModal.classList.add('hidden');
    }
  }

  updateParticipantName(savedName || 'Participant');
}

if (formNameEntry) {
  formNameEntry.addEventListener('submit', (e) => {
    e.preventDefault();
    const entered = inputUserName ? inputUserName.value : '';
    if (entered && entered.trim()) {
      sound.playClick();
      nameConfirmed = true;
      sessionStorage.setItem('arla_name_confirmed', 'true');
      updateParticipantName(entered.trim());
      if (nameModal) nameModal.classList.add('hidden');
    }
  });
}

if (btnEditName) {
  btnEditName.addEventListener('click', () => {
    sound.playClick();
    if (inputUserName) inputUserName.value = participantName === 'Participant' ? '' : participantName;
    if (nameModal) nameModal.classList.remove('hidden');
    setTimeout(() => {
      if (inputUserName) {
        inputUserName.focus();
        inputUserName.select();
      }
    }, 200);
  });
}

// Check name on startup
checkParticipantName();

/* ==========================================================================
   3D Banknote Intro Sequence (Entrance into Quiz Card)
   ========================================================================== */
function playIntroSequence(callback) {
  if (introCompleted) {
    if (callback) callback();
    return;
  }

  sound.playBanknoteSlide();
  banknoteIntro.classList.remove('banknote-emerge', 'banknote-exit', 'intro-hidden');
  quizCard.classList.remove('quiz-card-enter');
  quizCard.classList.add('quiz-card-hidden');

  void banknoteIntro.offsetWidth; // force reflow
  banknoteIntro.classList.add('banknote-emerge');

  setTimeout(() => {
    sound.playBanknoteSlide();
    banknoteIntro.classList.add('banknote-exit');

    setTimeout(() => {
      quizCard.classList.remove('quiz-card-hidden');
      quizCard.classList.add('quiz-card-enter');
      introCompleted = true;
      if (callback) callback();
    }, 240);

    setTimeout(() => {
      banknoteIntro.classList.add('intro-hidden');
    }, 600);
  }, 750);
}

function updateProgressBar(index, total) {
  const percent = ((index + 1) / total) * 100;
  if (quizProgressBar) quizProgressBar.style.width = `${percent}%`;
  if (quizProgressLabel) quizProgressLabel.textContent = `Question ${index + 1} of ${total}`;
}

function renderQuestion(index) {
  const q = quizQuestions[index] || currentState.currentQuestion;
  if (!q) return;

  if (quizProgressWrapper) quizProgressWrapper.classList.remove('hidden');
  if (quizProgressLabel) quizProgressLabel.classList.remove('hidden');

  quizWaitingArea.classList.add('hidden');
  quizCongratsArea.classList.add('hidden');
  quizQuestionArea.classList.remove('hidden');

  quizQuestionNumber.textContent = String(index + 1).padStart(2, '0');
  quizQuestionText.textContent = q.question;

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
    btn.addEventListener('click', () => {
      sound.playClick();
      const allBtns = quizOptions.querySelectorAll('.quiz-option-btn');
      allBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    quizOptions.appendChild(btn);
  });

  updateProgressBar(index, currentState.totalQuestions || quizQuestions.length);

  quizQuestionArea.classList.remove('quiz-slide-in');
  void quizQuestionArea.offsetWidth;
  quizQuestionArea.classList.add('quiz-slide-in');
}

/* ==========================================================================
   3D Card Model & Engraving System (card.glb)
   ========================================================================== */
function createEngravedCardCanvas(name) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2100;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/card_back.png';
    img.onload = async () => {
      // Draw the card background artwork
      ctx.drawImage(img, 0, 0, 2100, 1200);

      // Ensure Roboto Bold / Black is loaded
      try {
        await Promise.all([
          document.fonts.load('900 135px Roboto'),
          document.fonts.load('bold 135px Roboto')
        ]);
      } catch (e) {}

      const cleanName = (name || 'HONORARY MEMBER').trim();

      // Dynamic sizing to fit blank area with extra large prominent bold font
      let fontSize = 135;
      ctx.font = `900 ${fontSize}px Roboto, sans-serif`;
      let textWidth = ctx.measureText(cleanName).width;
      const maxWidth = 680;
      if (textWidth > maxWidth) {
        fontSize = Math.floor(fontSize * (maxWidth / textWidth));
        ctx.font = `900 ${fontSize}px Roboto, sans-serif`;
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Blank spot position: x = 741, y = 560 (centered in blank box above green line at y = 640)
      const textX = 741;
      const textY = 560;

      // Crisp bright bevel/emboss reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(cleanName, textX, textY + 3);

      // Deep high-contrast official Arla green font
      ctx.fillStyle = '#072615';
      ctx.fillText(cleanName, textX, textY);

      resolve(canvas);
    };

    img.onerror = () => {
      console.warn('Could not load card_back.png, falling back to canvas');
      resolve(canvas);
    };
  });
}

function createEngravedCardTexture(name) {
  return createEngravedCardCanvas(name).then((canvas) => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.flipY = false; // GLTF mapping requires flipY = false to maintain right-side up
    return texture;
  });
}

function applyEngravedTexture(name) {
  if (!backMesh) return;
  createEngravedCardTexture(name).then((texture) => {
    if (texture && backMesh) {
      backMesh.material.map = texture;
      backMesh.material.roughness = 0.38;
      backMesh.material.metalness = 0.08;
      backMesh.material.needsUpdate = true;
    }
  });
}

function init3DCardStage(name) {
  if (!card3DContainer) return;

  if (isCardInitialized) {
    applyEngravedTexture(name);
    return;
  }

  isCardInitialized = true;

  const width = card3DContainer.clientWidth || 600;
  const height = card3DContainer.clientHeight || 440;

  // 1. Scene
  cardScene = new THREE.Scene();

  // 2. Camera (zoomed in closer for a much larger, prominent card)
  cardCamera = new THREE.PerspectiveCamera(40, width / height, 0.01, 100);
  cardCamera.position.set(0, 0, 0.098);

  // 3. Renderer
  cardRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  cardRenderer.setSize(width, height);
  cardRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  cardRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  cardRenderer.toneMappingExposure = 1.15;
  card3DContainer.innerHTML = '';
  card3DContainer.appendChild(cardRenderer.domElement);

  // 4. Studio Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
  cardScene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(2, 4, 3);
  cardScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x34d399, 1.2);
  fillLight.position.set(-3, -1, 2);
  cardScene.add(fillLight);

  const backLight = new THREE.DirectionalLight(0xffffff, 1.6);
  backLight.position.set(0, 3, -3);
  cardScene.add(backLight);

  // 5. Controls
  cardControls = new OrbitControls(cardCamera, cardRenderer.domElement);
  cardControls.enableDamping = true;
  cardControls.dampingFactor = 0.06;
  cardControls.enableZoom = true;
  cardControls.minDistance = 0.06;
  cardControls.maxDistance = 0.22;
  cardControls.minPolarAngle = Math.PI / 2 - 0.35;
  cardControls.maxPolarAngle = Math.PI / 2 + 0.35;
  cardControls.autoRotate = false;

  // 6. Load card.glb
  const loader = new GLTFLoader();
  loader.load(
    '/card.glb',
    (gltf) => {
      cardModel = gltf.scene;

      // Find the back_artwork mesh to apply engraving
      cardModel.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.name === 'back_artwork' || child.material?.name === 'Back_Artwork') {
            backMesh = child;
            // Clone material so texture mutation doesn't bleed
            backMesh.material = child.material.clone();
          }
        }
      });

      // Center and initial orientation: face honorary member side forward upright
      cardModel.rotation.set(0, Math.PI, 0);
      cardScene.add(cardModel);

      // Apply initial engraved name texture
      applyEngravedTexture(name || participantName);
    },
    undefined,
    (err) => {
      console.error('Failed to load card.glb:', err);
    }
  );

  // Resize handler
  window.addEventListener('resize', () => {
    if (!card3DContainer || !cardCamera || !cardRenderer) return;
    const newW = card3DContainer.clientWidth;
    const newH = card3DContainer.clientHeight;
    if (newW && newH) {
      cardCamera.aspect = newW / newH;
      cardCamera.updateProjectionMatrix();
      cardRenderer.setSize(newW, newH);
    }
  });

  // Animation Loop: Spinning 3D Card
  let clock = new THREE.Clock();
  let userInteracting = false;

  cardControls.addEventListener('start', () => { userInteracting = true; });
  cardControls.addEventListener('end', () => {
    // Resume gentle spin after release
    setTimeout(() => { userInteracting = false; }, 800);
  });

  function animateCard() {
    cardAnimationId = requestAnimationFrame(animateCard);
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    if (cardModel) {
      // Very gentle, slow 3D spin so participant can easily read their engraved name
      if (!userInteracting) {
        cardModel.rotation.y += delta * 0.10;
      }
      // Subtle floating bobbing motion
      cardModel.position.y = Math.sin(elapsed * 1.8) * 0.003;
    }

    cardControls.update();
    cardRenderer.render(cardScene, cardCamera);
  }

  isCardAnimating = true;
  animateCard();
}

function showCongrats() {
  sound.playBanknoteSlide();

  if (quizProgressBar) quizProgressBar.style.width = '100%';
  if (quizProgressLabel) {
    quizProgressLabel.classList.remove('hidden');
    quizProgressLabel.textContent = 'Completed!';
  }

  quizWaitingArea.classList.add('hidden');
  quizQuestionArea.classList.add('hidden');
  quizCongratsArea.classList.remove('hidden');

  if (cardHolderTitle) {
    cardHolderTitle.textContent = participantName || 'Participant';
  }

  // Initialize and display spinning 3D Card with engraved name
  init3DCardStage(participantName);

  // Celebration confetti waves
  confetti({
    particleCount: 120,
    spread: 100,
    origin: { y: 0.55 },
    colors: ['#10b981', '#34d399', '#f59e0b', '#fbbf24', '#ffffff', '#a78bfa']
  });

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

function applyState(state) {
  currentState = state;
  const { status, currentIndex } = state;

  if (status === 'waiting') {
    localStatus = 'waiting';
    localIndex = -1;
    if (quizProgressWrapper) quizProgressWrapper.classList.add('hidden');
    if (quizProgressLabel) quizProgressLabel.classList.add('hidden');
    if (quizProgressBar) quizProgressBar.style.width = '0%';
    quizQuestionArea.classList.add('hidden');
    quizCongratsArea.classList.add('hidden');
    quizWaitingArea.classList.remove('hidden');

    // If name not confirmed for this session, make sure modal is displayed
    if (!nameConfirmed && nameModal) {
      nameModal.classList.remove('hidden');
    }

    if (waitingNameDisplay) {
      waitingNameDisplay.textContent = participantName || 'Participant';
    }

    if (!introCompleted) {
      playIntroSequence();
    }
  } else if (status === 'active') {
    if (!introCompleted) {
      playIntroSequence(() => {
        localStatus = 'active';
        localIndex = currentIndex;
        renderQuestion(currentIndex);
      });
    } else {
      if (localStatus !== 'active' || localIndex !== currentIndex) {
        localStatus = 'active';
        localIndex = currentIndex;
        renderQuestion(currentIndex);
      }
    }
  } else if (status === 'ended') {
    if (!introCompleted) {
      playIntroSequence(() => {
        localStatus = 'ended';
        showCongrats();
      });
    } else {
      if (localStatus !== 'ended') {
        localStatus = 'ended';
        showCongrats();
      }
    }
  }
}

// Sound toggle
if (btnSound) {
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
}

// SSE Real-time Synchronization
function initSync() {
  function connect() {
    const evtSource = new EventSource('/api/quiz/stream');
    evtSource.onopen = () => {
      if (syncPill) syncPill.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      if (syncText) syncText.textContent = 'LIVE SYNC';
    };
    evtSource.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        applyState(state);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };
    evtSource.onerror = () => {
      evtSource.close();
      if (syncPill) syncPill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      if (syncText) syncText.textContent = 'RECONNECTING';
      setTimeout(connect, 1500);
    };
  }

  // Initial Fetch
  fetch('/api/quiz')
    .then(res => res.json())
    .then(state => applyState(state))
    .catch(err => console.error('Initial state fetch error:', err));

  connect();

  // Safety fallback polling
  setInterval(() => {
    fetch('/api/quiz')
      .then(res => res.json())
      .then(state => applyState(state))
      .catch(() => {});
  }, 2000);
}

// Start sync on page load
initSync();

/* ==========================================================================
   2-Page PDF Download Generator (card_front.png + Engraved card_back)
   ========================================================================== */
const btnDownloadCardPdf = document.getElementById('btn-download-card-pdf');
const btnDownloadText = document.getElementById('btn-download-text');

async function downloadCardPDF() {
  if (!btnDownloadCardPdf) return;
  sound.playClick();

  const originalText = btnDownloadText ? btnDownloadText.textContent : 'Download PDF Card';
  if (btnDownloadText) btnDownloadText.textContent = 'Generating PDF...';
  btnDownloadCardPdf.classList.add('generating');

  try {
    const { jsPDF } = await import('jspdf');

    // Standard CR80 Card dimensions: 85.6 mm x 54 mm landscape
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [85.6, 54]
    });

    // --- Page 1: Card Front ---
    const frontImg = new Image();
    frontImg.crossOrigin = 'anonymous';
    frontImg.src = '/card_front.png';
    await new Promise((resolve, reject) => {
      if (frontImg.complete) return resolve();
      frontImg.onload = resolve;
      frontImg.onerror = reject;
    });

    pdf.addImage(frontImg, 'PNG', 0, 0, 85.6, 54, '', 'FAST');

    // --- Page 2: Card Back with Engraved Name ---
    pdf.addPage([85.6, 54], 'landscape');

    const backCanvas = await createEngravedCardCanvas(participantName || 'HONORARY MEMBER');
    const backDataUrl = backCanvas.toDataURL('image/jpeg', 0.96);
    pdf.addImage(backDataUrl, 'JPEG', 0, 0, 85.6, 54, '', 'FAST');

    // File name
    const safeName = (participantName || 'Honorary_Member').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Arla_FLIT_Membership_Card_${safeName}.pdf`;
    pdf.save(filename);

    if (btnDownloadText) btnDownloadText.textContent = 'Card Downloaded!';
    setTimeout(() => {
      if (btnDownloadText) btnDownloadText.textContent = originalText;
      btnDownloadCardPdf.classList.remove('generating');
    }, 2400);
  } catch (err) {
    console.error('Error generating PDF:', err);
    if (btnDownloadText) btnDownloadText.textContent = 'Failed to generate';
    setTimeout(() => {
      if (btnDownloadText) btnDownloadText.textContent = originalText;
      btnDownloadCardPdf.classList.remove('generating');
    }, 2400);
  }
}

if (btnDownloadCardPdf) {
  btnDownloadCardPdf.addEventListener('click', downloadCardPDF);
}
