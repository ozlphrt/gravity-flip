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
  let lastHeight = 0;
  function applyViewportHeight() {
    const appEl = document.getElementById('app');
    if (!appEl) return;
    // Use innerHeight which is always the correct available pixel height
    const h = window.innerHeight;
    if (h === lastHeight) return; // Performance gate: skip redundant renders
    lastHeight = h;
    appEl.style.height = h + 'px';
    // Trigger Three.js resize so the canvas matches the new dimensions
    scene.onResize();
  }

  // Poll the height frequently during the first 5 seconds of cold start to catch PWA safe-area layout shifts
  applyViewportHeight();
  const startupInterval = setInterval(applyViewportHeight, 100);
  setTimeout(() => clearInterval(startupInterval), 5000);

  window.addEventListener('resize', applyViewportHeight, { passive: true });
  window.addEventListener('orientationchange', () => {
    // Orientation changes can be slow, so poll frequently for 1.2 seconds afterwards
    let count = 0;
    const orientationInterval = setInterval(() => {
      applyViewportHeight();
      if (++count > 6) clearInterval(orientationInterval);
    }, 200);
  }, { passive: true });
  // ────────────────────────────────────────────────────────────────────

  // ── Version Verification Flow ───────────────────────────────────────
  const CLIENT_VERSION = '1.0.0';
  const CLIENT_BUILD = 26;
  const versionBadge = document.getElementById('app-version');
  if (versionBadge) versionBadge.textContent = `Commit ${CLIENT_BUILD}`;

  async function checkVersion() {
    try {
      const res = await fetch(`./version.json?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.version && (data.version !== CLIENT_VERSION || data.build !== CLIENT_BUILD)) {
        showUpdateModal();
      }
    } catch (e) {
      console.warn('Failed to check version:', e);
    }
  }

  function showUpdateModal() {
    const modal = document.getElementById('modal-update');
    if (!modal) return;
    modal.classList.remove('hidden');

    const btnNow = document.getElementById('btn-update-now');
    const btnLater = document.getElementById('btn-update-later');

    btnNow?.addEventListener('click', async () => {
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        } catch (e) {}
      }
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        } catch (e) {}
      }
      window.location.reload();
    });

    btnLater?.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  checkVersion();
  setInterval(checkVersion, 60000);
  // ────────────────────────────────────────────────────────────────────

  // Remove loading screen
  document.getElementById('loading')?.remove();
}

main().catch(console.error);
