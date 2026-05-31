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

  // Remove loading screen
  document.getElementById('loading')?.remove();
}

main().catch(console.error);
