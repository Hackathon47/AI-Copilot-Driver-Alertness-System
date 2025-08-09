// app.js - improved/robust alert logic (replace your old file with this)

const videoElement = document.getElementById('inputVideo');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');

const blinkCountEl = document.getElementById('blinkCount');
const yawnCountEl = document.getElementById('yawnCount');
const avgBlinkEl = document.getElementById('avgBlink');
const alertnessEl = document.getElementById('alertnessScore');
const eventLogTbody = document.querySelector('#eventLog tbody');
const videoCard = document.getElementById('videoCard');
const alertSound = document.getElementById('alertSound');
// Add to app.js (at the very beginning)
document.addEventListener('DOMContentLoaded', () => {
  const loader = document.getElementById('sci-fi-loader');
  const progressBar = document.querySelector('.progress-bar');
  const progressText = document.querySelector('.progress-text');
  const loadingLines = document.querySelectorAll('.loading-line');
  
  // Simulate loading progress
  let progress = 0;
  const loadingInterval = setInterval(() => {
    progress += Math.random() * 5 + 1;
    if (progress > 100) progress = 100;
    
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${Math.floor(progress)}%`;
    
    // Animate loading lines sequentially
    loadingLines.forEach((line, index) => {
      if (progress > (index + 1) * 20) {
        line.style.opacity = '1';
      } else {
        line.style.opacity = '0.5';
      }
    });
    
    if (progress === 100) {
      clearInterval(loadingInterval);
      setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => {
          loader.remove();
          // Initialize your main app here if needed
        }, 500);
      }, 800);
    }
  }, 100);
  
  // Add random glitch effect
  setInterval(() => {
    if (Math.random() > 0.9) {
      loader.classList.add('glitch');
      setTimeout(() => loader.classList.remove('glitch'), 200);
    }
  }, 3000);
});


canvasElement.width = 800;
canvasElement.height = 600;

/* --------- PARAMETERS (tweak these) --------- */
const EMA_ALPHA = 0.18;

const EAR_THRESHOLD = 0.23;         // eye aspect ratio threshold (closed)
const LONG_BLINK_MS = 550;          // blink longer than this -> "long blink"
const DROWSY_MS = 1500;             // eyes closed continuously -> drowsiness alert

const MAR_REL_FACTOR = 2.0;         // mouth opening must be this * baseline to be considered a yawn
const YAWN_HOLD_MS = 700;           // mouth open for this long -> yawn

const HEAD_TURN_OFFSET = 0.22;      // nose.x deviation from 0.5 to count as turned
const HEAD_TURN_MS = 1200;          // must hold for this long

const ALERT_COOLDOWN_MS = 3500;     // minimum time between two strong alerts
const LOG_COOLDOWN_MS = 1200;       // debounce for logging repeated small events
/* ------------------------------------------- */

let blinkCount = 0;
let yawnCount = 0;
let blinkDurations = [];
let alertnessScore = 100;

// smoothing states
let smoothedEAR = null;
let smoothedMAR = null;

// event timing states
let eyeClosed = false;
let eyeClosedStart = 0;

let mouthOpen = false;
let mouthOpenStart = 0;

// adaptive baseline for mouth (to reduce false positives across faces)
let mouthBaselineAccumulator = [];
let mouthBaseline = null;
let mouthBaselineFramesTarget = 50; // collect ~50 frames to build baseline

let headTurn = false;
let headTurnStart = 0;

let lastAlertTime = 0;
let lastLogTime = 0;

/* ---------- helpers ---------- */
function euclidean(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function ema(prev, current) {
  if (prev === null) return current;
  return EMA_ALPHA * current + (1 - EMA_ALPHA) * prev;
}

function logEvent(eventText) {
  const now = Date.now();
  if (now - lastLogTime < LOG_COOLDOWN_MS) return; // debounce logs
  lastLogTime = now;
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${new Date().toLocaleTimeString()}</td><td>${eventText}</td>`;
  eventLogTbody.prepend(tr);
  // keep log length reasonable
  while (eventLogTbody.children.length > 120) eventLogTbody.removeChild(eventLogTbody.lastChild);
}

function triggerAlert(type) {
  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) {
    logEvent(`${type} (suppressed)`);
    return;
  }
  lastAlertTime = now;

  // Play beep sound first
  const beepSound = document.getElementById('beepSound');
  beepSound.currentTime = 0; // Rewind to start
  beepSound.play().then(() => {
    // After beep finishes, play vocal alert
    setTimeout(() => {
      // Visual alert (existing code)
      if (videoCard) videoCard.classList.add('alert-active');
      setTimeout(() => videoCard && videoCard.classList.remove('alert-active'), 2600);
      
      drawCanvasOverlay(type);
      
      // Vocal alert (existing code)
      if ('speechSynthesis' in window) {
        let message = '';
        if (type.toLowerCase().includes('drowsiness')) {
          message = 'Please wake up and stay alert!';
        } else if (type.toLowerCase().includes('yawn')) {
          message = 'It\'s time to take a rest. Please yawn and relax.';
        } else if (type.toLowerCase().includes('distracted')) {
          message = 'Look here, please pay attention to the road.';
        } else if (type.toLowerCase().includes('long blink')) {
          message = 'Keep your eyes on the road, stay focused.';
        } else {
          message = 'Alert! Please pay attention.';
        }

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'en-US';
        utterance.rate = 1;
        utterance.pitch = 1.1;
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
      }
    }, 300); // Short delay after beep
  }).catch(e => console.error("Beep sound error:", e));

  // Score adjustment and logging (existing code)
  if (type === 'Drowsiness' || type.toLowerCase().includes('drowsiness')) alertnessScore = Math.max(0, alertnessScore - 20);
  else if (type.toLowerCase().includes('yawn')) alertnessScore = Math.max(0, alertnessScore - 10);
  else if (type.toLowerCase().includes('distracted')) alertnessScore = Math.max(0, alertnessScore - 8);
  else alertnessScore = Math.max(0, alertnessScore - 5);

  alertnessEl.textContent = `${alertnessScore}%`;
  logEvent(type);
}


/* Draw a semi-transparent red overlay and big text for a short time */
function drawCanvasOverlay(text) {
  const showMs = 2200;
  const start = performance.now();

  function frame(t) {
    const elapsed = t - start;
    // redraw current frame below the overlay (we don't have the original image here,
    // but FaceMesh draws image every frame so overlay will be transient and visible)
    // draw overlay
    canvasCtx.save();
    canvasCtx.fillStyle = 'rgba(200,20,20,0.18)';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.fillStyle = 'rgba(255,255,255,0.95)';
    canvasCtx.font = 'bold 36px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText(text, canvasElement.width / 2, 80);
    canvasCtx.restore();

    if (elapsed < showMs) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ---------- EAR and MAR calculations ---------- */
/* Eye indices chosen to match MediaPipe FaceMesh landmarks */
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

function computeEAR(landmarks, leftIdx, rightIdx) {
  // EAR per Tereza Soukupova and Jan Cech method (pairs of vertical / horizontal)
  function eyeEAR(idxs) {
    const p0 = landmarks[idxs[0]];
    const p1 = landmarks[idxs[1]];
    const p2 = landmarks[idxs[2]];
    const p3 = landmarks[idxs[3]];
    const p4 = landmarks[idxs[4]];
    const p5 = landmarks[idxs[5]];

    const vert1 = euclidean(p1, p5);
    const vert2 = euclidean(p2, p4);
    const hor = euclidean(p0, p3);
    if (hor === 0) return 0;
    return (vert1 + vert2) / (2.0 * hor);
  }
  const leftEAR = eyeEAR(leftIdx);
  const rightEAR = eyeEAR(rightIdx);
  return (leftEAR + rightEAR) / 2.0;
}

/* ---------- main onResults (called each frame by MediaPipe) ---------- */
function onResults(results) {
  // draw camera frame
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results.image) canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  // status text default
  let statusText = 'Monitoring';

  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    // no face detected
    canvasCtx.fillStyle = 'rgba(0,0,0,0.45)';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.fillStyle = '#fff';
    canvasCtx.font = '22px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('No face detected — please center your face', canvasElement.width / 2, canvasElement.height / 2);
    canvasCtx.restore();
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];

  // 1) EAR (eyes)
  const ear = computeEAR(landmarks, LEFT_EYE, RIGHT_EYE);
  smoothedEAR = ema(smoothedEAR, ear);

  // 2) MAR (mouth) - adaptive baseline
  // Use inner-lip vertical pair (13 upper-lip center, 14 lower-lip center)
  // and mouth corners 61 and 291 for width (common Mediapipe indices)
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];
  const mouthLeft = landmarks[61];
  const mouthRight = landmarks[291];

  const mouthVertical = euclidean(upperLip, lowerLip);
  const mouthWidth = Math.max(1e-6, euclidean(mouthLeft, mouthRight));
  const mar = mouthVertical / mouthWidth;
  smoothedMAR = ema(smoothedMAR, mar);

  // Build baseline for MAR during first N "calm" frames
  if (mouthBaseline === null && mouthBaselineAccumulator.length < mouthBaselineFramesTarget) {
    mouthBaselineAccumulator.push(smoothedMAR || mar);
    if (mouthBaselineAccumulator.length === mouthBaselineFramesTarget) {
      // compute median-ish baseline
      const sum = mouthBaselineAccumulator.reduce((a, b) => a + b, 0);
      mouthBaseline = sum / mouthBaselineAccumulator.length;
      // prevent accidental tiny baseline
      if (mouthBaseline < 0.0001) mouthBaseline = 0.02;
      console.log('Mouth baseline set to', mouthBaseline.toFixed(4));
    }
  }

  // 3) Nose / head x to detect looking-away
  const noseTip = landmarks[1]; // approximate nose tip index in Mediapipe mesh
  const noseX = noseTip.x; // normalized [0..1] within image

  // ---------- Eye closure / blink detection ----------
  const now = Date.now();
  if (smoothedEAR < EAR_THRESHOLD) {
    if (!eyeClosed) {
      eyeClosed = true;
      eyeClosedStart = now;
    } else {
      const closedMs = now - eyeClosedStart;
      // if closed beyond drowsy threshold -> drowsiness alert
      if (closedMs >= DROWSY_MS) {
        statusText = 'DROWSY';
        triggerAlert('Drowsiness — eyes closed');
        // reset so we don't continuously re-trigger during the same long closure
        eyeClosed = false;
        blinkStart = null;
      }
    }
  } else {
    // eyes open (end of blink if we had closure)
    if (eyeClosed) {
      const duration = now - eyeClosedStart;
      blinkDurations.push(duration);
      blinkCount++;
      blinkCountEl.textContent = blinkCount;
      const avg = Math.round(blinkDurations.reduce((a, b) => a + b, 0) / blinkDurations.length);
      avgBlinkEl.textContent = `${avg} ms`;

      if (duration >= LONG_BLINK_MS) {
        // long blink detected (but not long enough for drowsy)
        logEvent('Long blink');
        // small alert for long blink
        triggerAlert('Long blink');
      } else {
        // normal blink - don't flood logs
      }
      // reset closed state
      eyeClosed = false;
    }
  }

  // ---------- Yawn detection (adaptive) ----------
  if (mouthBaseline !== null) {
    if (smoothedMAR > mouthBaseline * MAR_REL_FACTOR) {
      if (!mouthOpen) {
        mouthOpen = true;
        mouthOpenStart = now;
      } else {
        const mMs = now - mouthOpenStart;
        if (mMs >= YAWN_HOLD_MS) {
          // Yawn detected
          yawnCount++;
          yawnCountEl.textContent = yawnCount;
          triggerAlert('Yawn detected');
          mouthOpen = false; // reset so we don't re-trigger immediately
        }
      }
    } else {
      // mouth not open enough
      mouthOpen = false;
    }
  } else {
    // still building baseline -> don't detect yawns yet
    // small hint overlay until baseline ready
  }

  // ---------- Head turn / looking away ----------
  if (noseX < 0.5 - HEAD_TURN_OFFSET || noseX > 0.5 + HEAD_TURN_OFFSET) {
    if (!headTurn) {
      headTurn = true;
      headTurnStart = now;
    } else {
      if (now - headTurnStart >= HEAD_TURN_MS) {
        triggerAlert('Driver distracted (looking away)');
        headTurn = false; // reset until next turn
      }
    }
  } else {
    headTurn = false;
  }

  // ---------- Draw small HUD on canvas ----------
  canvasCtx.save();
  // status badge
  canvasCtx.fillStyle = 'rgba(0,0,0,0.45)';
  canvasCtx.fillRect(10, 10, 270, 92);
  canvasCtx.fillStyle = '#fff';
  canvasCtx.font = '16px Arial';
  canvasCtx.textAlign = 'left';
  canvasCtx.fillText(`EAR: ${smoothedEAR ? smoothedEAR.toFixed(3) : '–'}`, 20, 34);
  canvasCtx.fillText(`MAR: ${smoothedMAR ? smoothedMAR.toFixed(3) : '–'}`, 20, 56);
  canvasCtx.fillText(`Alertness: ${alertnessScore}%`, 20, 78);

  // big status text if drowsy or yawn
  if (now - lastAlertTime < 2500) {
    canvasCtx.fillStyle = 'rgba(255, 40, 40, 0.9)';
    canvasCtx.font = 'bold 34px Arial';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('ALERT — ' + (statusText || 'Attention'), canvasElement.width / 2, 40);
  }
  canvasCtx.restore();

  canvasCtx.restore();
}

/* ---------- MediaPipe setup ---------- */
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});
faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.55,
  minTrackingConfidence: 0.55
});
faceMesh.onResults(onResults);

/* ---------- camera start ---------- */
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
  width: 800,
  height: 600
});
camera.start();

/* ---------- small unlock trick: try to enable alert audio on first user gesture ---------- */
function unlockAudioOnGesture() {
  const tryPlay = () => {
    // Try playing both sounds
    Promise.all([
      alertSound.play().then(() => {
        alertSound.pause();
        alertSound.currentTime = 0;
      }),
      beepSound.play().then(() => {
        beepSound.pause();
        beepSound.currentTime = 0;
      })
    ]).then(() => {
      document.removeEventListener('click', tryPlay);
      document.removeEventListener('keydown', tryPlay);
    }).catch(() => {
      // Still blocked - keep listeners
    });
  };
  
  document.addEventListener('click', tryPlay);
  document.addEventListener('keydown', tryPlay);
}
unlockAudioOnGesture();

const modeToggleBtn = document.getElementById('modeToggle');

modeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('night-mode');
  
  // Update button icon and text dynamically
  if (document.body.classList.contains('night-mode')) {
    modeToggleBtn.textContent = '☀️ Day Mode';
  } else {
    modeToggleBtn.textContent = '🌙 Night Mode';
  }
});


const canvas = document.getElementById('ripple-canvas');
const ctx = canvas.getContext('2d');

let width, height;
function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Store active ripples
const ripples = [];

class Ripple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.maxRadius = 100;
    this.lineWidth = 4;
    this.alpha = 0.7;
  }

  update() {
    this.radius += 3; // speed of ripple expansion
    this.alpha -= 0.02; // fade out
    if (this.alpha < 0) this.alpha = 0;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(30,144,255,${this.alpha})`; // DodgerBlue with fading alpha
    ctx.lineWidth = this.lineWidth;
    ctx.shadowColor = `rgba(30,144,255,${this.alpha})`;
    ctx.shadowBlur = 20;
    ctx.stroke();
  }

  isDead() {
    return this.alpha <= 0;
  }
}

function animate() {
  ctx.clearRect(0, 0, width, height);
  for (let i = ripples.length - 1; i >= 0; i--) {
    ripples[i].update();
    ripples[i].draw(ctx);
    if (ripples[i].isDead()) {
      ripples.splice(i, 1);
    }
  }
  requestAnimationFrame(animate);
}
animate();

// Create ripple on mouse move
window.addEventListener('mousemove', (e) => {
  ripples.push(new Ripple(e.clientX, e.clientY));
});


