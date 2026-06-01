// ============================================================
// main.ts — entry point
// ============================================================
import { SceneManager } from './renderer/SceneManager';
import { GameController } from './game/GameController';
import { AudioManager } from './audio/AudioManager';
import { SwipeDetector } from './input/SwipeDetector';
import { ButtonController } from './input/ButtonController';
import { ProgressManager } from './game/ProgressManager';
import './styles/main.css';

async function main() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas element not found');

  const scene = new SceneManager(canvas);
  const audio = new AudioManager();
  await audio.loadAll();

  const progress = new ProgressManager();
  const startLevel = progress.getCurrentLevel();

  const controller = new GameController(scene, audio);
  await controller.init(startLevel);

  // Input
  const swiper = new SwipeDetector(canvas);
  const buttons = new ButtonController();
  buttons.bindButtons({
    undo: 'btn-undo', restart: 'btn-restart',
  });

  controller.setupInput(canvas, buttons, swiper);

  // Mute button
  const muteBtn = document.getElementById('btn-mute');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const muted = audio.toggleMute();
      muteBtn.textContent = muted ? '🔇' : '🔊';
    });
  }

  // Start render loop
  scene.startLoop();

  // ── PWA / iOS Safari Viewport Height Fix ─────────────────────────────
  // In iOS standalone (PWA) mode, CSS vh/dvh can report the wrong height
  // at startup. We imperatively set #app's height using the real pixel
  // measurement and re-apply it on every resize / orientation change.
  function applyViewportHeight() {
    const appEl = document.getElementById('app');
    if (!appEl) return;
    // Use innerHeight which is always the correct available pixel height
    const h = window.innerHeight;
    appEl.style.height = h + 'px';
    // Trigger Three.js resize so the canvas matches the new dimensions
    scene.onResize();
  }

  // Apply immediately, then again after a brief delay to catch PWA
  // deferred layout (iOS defers the safe-area insets until after paint)
  applyViewportHeight();
  setTimeout(applyViewportHeight, 100);
  setTimeout(applyViewportHeight, 300);

  window.addEventListener('resize', applyViewportHeight, { passive: true });
  window.addEventListener('orientationchange', () => {
    // Orientation changes need extra time for the viewport to settle
    setTimeout(applyViewportHeight, 200);
  }, { passive: true });
  // ────────────────────────────────────────────────────────────────────

  // Remove loading screen
  document.getElementById('loading')?.remove();
}

main().catch(console.error);
