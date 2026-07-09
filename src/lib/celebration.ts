"use client";

const CONFETTI_COLORS = ["#38bdf8", "#0ea5e9", "#22d3ee", "#3b82f6", "#f0f9ff"];
const CONFETTI_PIECE_COUNT = 28;

export function burstConfetti() {
  if (typeof document === "undefined") return;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.pointerEvents = "none";
  container.style.zIndex = "9999";
  container.setAttribute("aria-hidden", "true");

  for (let i = 0; i < CONFETTI_PIECE_COUNT; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    container.appendChild(piece);
  }

  document.body.appendChild(container);
  setTimeout(() => container.remove(), 1800);
}

let audioCtx: AudioContext | null = null;

export function unlockAudio() {
  if (audioCtx || typeof window === "undefined") return;
  const Ctor = window.AudioContext;
  if (!Ctor) return;
  audioCtx = new Ctor();
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
}

export function playCling() {
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(1800, now + 0.12);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.5);
}

const ORIGINAL_TITLE = typeof document !== "undefined" ? document.title : "";
let flashInterval: ReturnType<typeof setInterval> | null = null;
let visibilityListener: (() => void) | null = null;

export function startTitleFlash(message: string) {
  if (typeof document === "undefined" || flashInterval) return;

  let showAlt = true;
  flashInterval = setInterval(() => {
    document.title = showAlt ? message : ORIGINAL_TITLE;
    showAlt = !showAlt;
  }, 1000);

  visibilityListener = () => {
    if (!document.hidden) stopTitleFlash();
  };
  document.addEventListener("visibilitychange", visibilityListener);
}

export function stopTitleFlash() {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
  if (visibilityListener) {
    document.removeEventListener("visibilitychange", visibilityListener);
    visibilityListener = null;
  }
  if (typeof document !== "undefined") {
    document.title = ORIGINAL_TITLE;
  }
}

export function celebrateCalled() {
  burstConfetti();
  playCling();
  if (typeof document !== "undefined" && document.hidden) {
    startTitleFlash("🧊 Giliranmu!");
  }
}
