// ============================================================
// GameController — orchestrates input → simulation → animation → UI
// ============================================================
import * as THREE from 'three';
import type { GameState, SwipeDirection, GravityDir, MovableCube, Color } from '../core/types';
import { Grid } from '../core/Grid';
import {
  applySwipeToOrientation, cloneMatrix
} from '../core/GravitySystem';
import { resolveSlides, previewSlides } from '../core/MovementResolver';
import { resolveColorMatches } from '../core/MatchSystem';
import { resolveSocketLocks, checkWinCondition } from '../core/SocketSystem';
import { UndoSystem } from '../core/UndoSystem';
import { loadLevel, LEVEL_ORDER } from '../levels/LevelLoader';

import { SceneManager } from '../renderer/SceneManager';
import { GlassCubeRenderer } from '../renderer/GlassCubeRenderer';
import { CubeRenderer, COLOR_PHYSICS } from '../renderer/CubeRenderer';
import { SocketRenderer } from '../renderer/SocketRenderer';
import { BlockerRenderer } from '../renderer/BlockerRenderer';
import { GravityArrow } from '../renderer/GravityArrow';
import { ParticleSystem } from '../renderer/ParticleSystem';
import { SwipeDetector } from '../input/SwipeDetector';
import { ButtonController } from '../input/ButtonController';
import { AudioManager } from '../audio/AudioManager';
import { ProgressManager } from './ProgressManager';



export class GameController {
  private scene: SceneManager;
  private glassRenderer!: GlassCubeRenderer;
  private cubeRenderer!: CubeRenderer;
  private socketRenderer!: SocketRenderer;
  private blockerRenderer!: BlockerRenderer;
  private gravityArrow!: GravityArrow;
  private particles!: ParticleSystem;
  private audio: AudioManager;
  private progress: ProgressManager;
  private undo: UndoSystem;

  private state!: GameState;
  private grid!: Grid;
  private currentLevelId!: string;

  private locked = false; // input lock during animation

  // UI element references
  private elMoveCount!: HTMLElement;
  private elProgress!: HTMLElement;
  private elGravityLabel!: HTMLElement | null;
  private elUndoBtn!: HTMLElement;
  private elLevelTitle!: HTMLElement;
  private elModal!: HTMLElement;
  private elModalStars!: HTMLElement;
  private elModalMoves!: HTMLElement;

  private userInteracted = false;
  private currentTheme: 'classic' | 'symbol' = 'classic';

  constructor(scene: SceneManager, audio: AudioManager) {
    this.scene = scene;
    this.audio = audio;
    this.progress = new ProgressManager();
    this.undo = new UndoSystem();

    const savedTheme = localStorage.getItem('gravity-flip-theme') as any;
    if (savedTheme === 'classic' || savedTheme === 'symbol') {
      this.currentTheme = savedTheme;
    }

    const setInteracted = () => {
      this.userInteracted = true;
      window.removeEventListener('click', setInteracted);
      window.removeEventListener('keydown', setInteracted);
      window.removeEventListener('touchstart', setInteracted);
    };
    window.addEventListener('click', setInteracted, { passive: true });
    window.addEventListener('keydown', setInteracted, { passive: true });
    window.addEventListener('touchstart', setInteracted, { passive: true });
  }

  private safeVibrate(pattern: number | number[]): void {
    try {
      if (!this.userInteracted || typeof navigator === 'undefined' || !navigator.vibrate) return;
      const userActivation = (navigator as any).userActivation;
      if (userActivation && !userActivation.hasBeenActive) return;
      navigator.vibrate(pattern);
    } catch (e) {}
  }

  // ── Initialization ────────────────────────────────────────

  async init(levelId: string): Promise<void> {
    this.currentLevelId = levelId;
    await this.loadAndBuildLevel(levelId);
    this.bindUI();
    this.updateUI();
    this.showTutorialHint(levelId);

    // Automatically trigger tumbling physics on level load without waiting for player swipe!
    const initialSlides = resolveSlides(this.state, this.grid);
    const initialLocks = resolveSocketLocks(this.state, this.grid);
    if (initialSlides.length > 0 || initialLocks.length > 0) {
      this.locked = true;
      // Settle camera brief delay of 450ms, then let blocks tumble down beautifully!
      setTimeout(async () => {
        await this.runPhysicsCascade(initialSlides, initialLocks, this.state.gravity);
        
        // Re-check win just in case cascades solved the level
        const won = checkWinCondition(this.state);
        if (won) {
          this.state.isComplete = true;
          await new Promise(r => setTimeout(r, 400));
          this.handleWin();
        }
        this.updateUI();
        this.locked = false;
      }, 450);
    }
  }

  private async loadAndBuildLevel(levelId: string): Promise<void> {
    const { state, grid } = loadLevel(levelId);
    this.state = state;
    this.grid = grid;
    this.undo.clear();

    // Clear old renderers if they exist
    if (this.glassRenderer) {
      this.scene.scene.remove(this.glassRenderer.pivot);
    }

    // Build renderers
    this.glassRenderer = new GlassCubeRenderer(
      this.scene.scene, state.gridSize, this.scene.anim
    );
    this.cubeRenderer = new CubeRenderer(
      this.scene.scene, this.glassRenderer.pivot, this.scene.anim, state.gridSize
    );
    this.cubeRenderer.updateTheme(this.currentTheme, state.cubes);
    this.scene.updateCameraFocus(state.gridSize);
    this.socketRenderer = new SocketRenderer(this.glassRenderer.pivot);
    this.blockerRenderer = new BlockerRenderer(this.glassRenderer.pivot);
    this.particles = new ParticleSystem(this.scene.scene, this.glassRenderer.pivot);
    this.particles.setGravity(state.gravity);
    this.gravityArrow = new GravityArrow(this.scene.scene, this.scene.anim);

    // Initialize visuals
    this.cubeRenderer.initCubes(state.cubes);
    this.socketRenderer.initSockets(state.sockets);
    this.blockerRenderer.initBlockers(state.blockers);
    this.gravityArrow.updateGravity(state.gravity);
  }

  // ── Input setup ───────────────────────────────────────────

  setupInput(_canvas: HTMLElement, buttons: ButtonController, swiper: SwipeDetector): void {
    swiper.onSwipe(dir => this.handleRotation(dir));
    swiper.onPreviewStart(dir => this.showPreview(dir));
    swiper.onPreviewEnd(() => this.hidePreview());

    buttons.onUndo(() => this.handleUndo());
    buttons.onRestart(() => this.handleRestart());

    // Bind keyboard Arrow keys and WASD keys to rotation controls
    window.addEventListener('keydown', (e) => {
      if (this.locked || this.state.isComplete) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.handleRotation('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.handleRotation('right');
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.handleRotation('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        this.handleRotation('down');
      }
    });
  }

  // ── Core move handler ─────────────────────────────────────

  private async handleRotation(dir: SwipeDirection): Promise<void> {
    if (this.locked || this.state.isComplete) return;
    this.locked = true;
    this.hidePreview();

    const gravityBefore = { ...this.state.gravity };
    const orientationBefore = cloneMatrix(this.state.orientationMatrix);

    // Compute camera-relative axes in world space to ensure flipping always
    // happens straight up/down/left/right relative to the player's screen
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(this.scene.camera.matrixWorld, 0).normalize();

    let rotationAxis = new THREE.Vector3();
    let rotationAngle = 0;

    if (dir === 'left') {
      rotationAxis.set(0, 1, 0); // World Up axis keeps rotation perfectly upright
      rotationAngle = -Math.PI / 2; // Inverted
    } else if (dir === 'right') {
      rotationAxis.set(0, 1, 0); // World Up axis keeps rotation perfectly upright
      rotationAngle = Math.PI / 2;  // Inverted
    } else if (dir === 'up') {
      rotationAxis.copy(cameraRight);
      rotationAngle = -Math.PI / 2; // Inverted
    } else if (dir === 'down') {
      rotationAxis.copy(cameraRight);
      rotationAngle = Math.PI / 2;  // Inverted
    }

    // Compute the target quaternion after screen-relative rotation
    const currentQuat = this.glassRenderer.pivot.quaternion.clone();
    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(rotationAxis, rotationAngle);
    const targetQuat = new THREE.Quaternion().multiplyQuaternions(deltaQuat, currentQuat);

    // Compute exact local gravity by transforming world down vector (0, -1, 0)
    // using the conjugate (inverse) of the target quaternion
    const worldDown = new THREE.Vector3(0, -1, 0);
    const localDown = worldDown.clone().applyQuaternion(targetQuat.clone().conjugate());

    // Snapping localDown to the nearest major grid axis (x, y, or z)
    let maxVal = -1;
    let targetAxis: 'x' | 'y' | 'z' = 'y';
    let targetSign: 1 | -1 = -1;

    const ax = Math.abs(localDown.x);
    const ay = Math.abs(localDown.y);
    const az = Math.abs(localDown.z);

    if (ax > maxVal) { maxVal = ax; targetAxis = 'x'; targetSign = localDown.x > 0 ? 1 : -1; }
    if (ay > maxVal) { maxVal = ay; targetAxis = 'y'; targetSign = localDown.y > 0 ? 1 : -1; }
    if (az > maxVal) { maxVal = az; targetAxis = 'z'; targetSign = localDown.z > 0 ? 1 : -1; }

    const newGravity: GravityDir = { axis: targetAxis, sign: targetSign };

    // Apply to state
    this.state.gravity = newGravity;
    this.particles.setGravity(newGravity);
    // Keep dummy orientation matrix for state compatibility
    const newOrientation = applySwipeToOrientation(this.state.orientationMatrix, dir);
    this.state.orientationMatrix = newOrientation;

    const rotPromise = this.glassRenderer.animateRotation(rotationAxis, rotationAngle, 420);

    // Resolve slides & locks (compute positions immediately)
    const slides = resolveSlides(this.state, this.grid);
    const locks = resolveSocketLocks(this.state, this.grid);

    // No-op: no cubes moved at all → don't count the move
    if (slides.length === 0 && locks.length === 0) {
      // Revert state
      this.state.orientationMatrix = orientationBefore;
      this.state.gravity = gravityBefore;

      // Play wobble feedback
      this.glassRenderer.flashInvalid();
      this.gravityArrow.wobble();
      await rotPromise; // still play the attempted animation? Or cancel.
      // Better: cancel and instead do micro-wobble only
      this.locked = false;
      return;
    }

    // Push undo record (before state changes were applied by resolver)
    this.undo.push(dir, gravityBefore, newGravity, orientationBefore, newOrientation, {
      ...this.state,
      // pass pre-lock state (slides already applied, locks not yet)
      lockedCount: this.state.lockedCount - locks.length,
    });

    this.state.moveCount++;
    this.audio.play('slide');

    // Wait for rotation, then resolve cascading slides and pop matches
    await rotPromise;

    await this.runPhysicsCascade(slides, locks, newGravity);

    // Check win
    const won = checkWinCondition(this.state);
    if (won) {
      this.state.isComplete = true;
      await new Promise(r => setTimeout(r, 400));
      this.handleWin();
    }

    this.updateUI();
    this.locked = false;
  }

  /**
   * Dedicated reusable cascade slide/pop loop for swiping and startup tumbling.
   */
  private async runPhysicsCascade(
    initialSlides: typeof resolveSlides extends (...args: any[]) => infer R ? R : any,
    initialLocks: typeof resolveSocketLocks extends (...args: any[]) => infer R ? R : any,
    newGravity: GravityDir
  ): Promise<void> {
    let currentSlides = initialSlides;
    let currentLocks = initialLocks;
    let anyExplosion = false;
    let hasSpawnedThisTurn = false;

    while (true) {
      // 1. Animate current slide batch
      if (currentSlides.length > 0) {
        const lanesMap = new Map<string, typeof currentSlides>();
        const axis = newGravity.axis;
        const nonGravityAxes = (axis === 'x') ? ['y', 'z'] : (axis === 'y') ? ['x', 'z'] : ['x', 'y'];

        for (const slide of currentSlides) {
          const key = `${slide.from[nonGravityAxes[0] as 'x' | 'y' | 'z']}_${slide.from[nonGravityAxes[1] as 'x' | 'y' | 'z']}`;
          if (!lanesMap.has(key)) lanesMap.set(key, []);
          lanesMap.get(key)!.push(slide);
        }

        const lanePromises = Array.from(lanesMap.entries()).map(async ([key, laneSlides]) => {
          const [v1, v2] = key.split('_').map(Number);
          
          const leadSlide = laneSlides[0];
          const leadCubeObj = this.state.cubes.get(leadSlide.cubeId)!;
          const phys = COLOR_PHYSICS[leadCubeObj.color] ?? { durationMult: 1.0 };
          const weightDelay = (phys.durationMult - 0.65) * 110;

          // Spatial diagonal stagger + weight-based inertia + minor organic jitter
          const laneStartDelay = (v1 + v2) * 20 + weightDelay + Math.random() * 12;
          await new Promise(r => setTimeout(r, laneStartDelay));

          // Run slides in parallel with a staggered start delay for a beautifully natural flow!
          const slidePromises = laneSlides.map(async (slide, i) => {
            if (i > 0) {
              await new Promise(r => setTimeout(r, i * 45));
            }
            await this.cubeRenderer.animateSlide(slide);
            
            const cubeObj = this.state.cubes.get(slide.cubeId)!;
            this.audio.play('impact', cubeObj.color);
            
            // Heavier cubes shake the screen slightly more
            const shakePhys = COLOR_PHYSICS[cubeObj.color] ?? { volume: 0.18 };
            this.scene.shake(0.003 * (shakePhys.volume / 0.18), 25);
          });
          await Promise.all(slidePromises);
        });

        await Promise.all(lanePromises);
      }

      // 2. Animate current socket locks
      if (currentLocks.length > 0) {
        for (const lock of currentLocks) {
          const cube = this.state.cubes.get(lock.cubeId)!;
          this.audio.play('lock');
          this.cubeRenderer.animateLock(lock);
          this.socketRenderer.flashLock(cube.socketId!);
          this.safeVibrate(40);

          const mesh = this.cubeRenderer.getMesh(lock.cubeId);
          if (mesh) {
            const worldPos = new THREE.Vector3();
            mesh.getWorldPosition(worldPos);
            this.particles.spawnLockBurst(
              this.glassRenderer.pivot.worldToLocal(worldPos.clone()),
              cube.color
            );
          }
        }
        await new Promise(r => setTimeout(r, 300));
      }

      // 3. Scan for color matches (>= 3 same-color adjacent cubes)
      const popped = resolveColorMatches(this.state, this.grid);
      if (popped.length > 0) {
        anyExplosion = true;
        // Play bubble pop sound
        this.audio.play('pop');

        // Animate pops shrinking in parallel + particle explosions
        const popPromises = popped.map(async (pop) => {
          const mesh = this.cubeRenderer.getMesh(pop.cubeId);
          if (mesh) {
            const worldPos = new THREE.Vector3();
            mesh.getWorldPosition(worldPos);
            this.particles.spawnExplosion(
              this.glassRenderer.pivot.worldToLocal(worldPos.clone()),
              pop.color,
              popped.length
            );
          }
          await this.cubeRenderer.animatePop(pop.cubeId);
        });
        await Promise.all(popPromises);

        // Pop creates new voids! Trigger next cascading slide pass!
        currentSlides = resolveSlides(this.state, this.grid);
        currentLocks = resolveSocketLocks(this.state, this.grid);
      } else {
        // No matches left in this cascade pass.
        // If there were NO explosions at all this turn, spawn new cubes from the ceiling!
        if (!anyExplosion && !hasSpawnedThisTurn) {
          hasSpawnedThisTurn = true;

          const g = newGravity;
          // Ceiling is opposite to gravity direction. If sign is -1, ceiling is at gridSize-1. If sign is 1, ceiling is at 0.
          const ceilingVal = (g.sign === -1) ? (this.state.gridSize[g.axis] - 1) : 0;

          const emptyCeilingCells: { x: number; y: number; z: number }[] = [];
          const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
          const otherAxes = axes.filter(a => a !== g.axis);

          const limit1 = this.state.gridSize[otherAxes[0]];
          const limit2 = this.state.gridSize[otherAxes[1]];

          for (let i = 0; i < limit1; i++) {
            for (let j = 0; j < limit2; j++) {
              const pos = {} as any;
              pos[g.axis] = ceilingVal;
              pos[otherAxes[0]] = i;
              pos[otherAxes[1]] = j;

              if (this.grid.getCell(pos).type === 'empty') {
                emptyCeilingCells.push(pos);
              }
            }
          }

          if (emptyCeilingCells.length > 0) {
            // Spawn N new cubes (e.g. random count between 3 and 5, capped by empty ceiling cells)
            const spawnCount = Math.min(emptyCeilingCells.length, 3 + Math.floor(Math.random() * 3));

            // Shuffle ceiling cells to get random spawn positions
            for (let i = emptyCeilingCells.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              const temp = emptyCeilingCells[i];
              emptyCeilingCells[i] = emptyCeilingCells[j];
              emptyCeilingCells[j] = temp;
            }

            // SMART CLUSTER SPAWNING: Choose a primary color and secondary color for drop groupings
            const colors: Color[] = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'];
            const primaryColor = colors[Math.floor(Math.random() * colors.length)];
            const secondaryColor = colors[Math.floor(Math.random() * colors.length)];

            for (let k = 0; k < spawnCount; k++) {
              const cell = emptyCeilingCells[k];
              const newId = `spawned_${Date.now()}_${k}_${Math.floor(Math.random() * 1000)}`;
              // 70% chance to spawn same primary color (produces awesome cluster matches!)
              const color = Math.random() > 0.3 ? primaryColor : secondaryColor;
              const newCube: MovableCube = {
                id: newId,
                color,
                icons: ['dot', 'dot', 'dot', 'dot', 'dot', 'dot'],
                position: cell,
                isLocked: false,
                socketId: null
              };

              this.state.cubes.set(newId, newCube);
              this.grid.setCell(cell, { type: 'movable', cubeId: newId, socketId: null });
              this.cubeRenderer.addCubeMesh(newCube);
            }

            // Resolve slides and locks immediately for the newly spawned cubes!
            currentSlides = resolveSlides(this.state, this.grid);
            currentLocks = resolveSocketLocks(this.state, this.grid);
            if (currentSlides.length > 0 || currentLocks.length > 0) {
              continue;
            }
          }
        }

        // No matches left and no spawning to do, stable!
        break;
      }
    }
  }

  // ── Undo ──────────────────────────────────────────────────

  private handleUndo(): void {
    if (this.locked || !this.undo.canUndo) return;
    this.locked = true;

    const record = this.undo.pop(this.state, this.grid);
    if (!record) { this.locked = false; return; }

    // Snap all cube visuals to restored positions
    for (const cube of this.state.cubes.values()) {
      this.cubeRenderer.snapPosition(cube.id, cube.position);
    }

    // Reverse the glass cube rotation animation
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(this.scene.camera.matrixWorld, 0).normalize();

    let rotationAxis = new THREE.Vector3();
    let rotationAngle = 0;

    if (record.rotation === 'left') {
      rotationAxis.set(0, 1, 0); // World Up axis keeps rotation perfectly upright
      rotationAngle = Math.PI / 2; // Inverted reverse of left (-PI/2)
    } else if (record.rotation === 'right') {
      rotationAxis.set(0, 1, 0); // World Up axis keeps rotation perfectly upright
      rotationAngle = -Math.PI / 2; // Inverted reverse of right (PI/2)
    } else if (record.rotation === 'up') {
      rotationAxis.copy(cameraRight);
      rotationAngle = Math.PI / 2; // Inverted reverse of up (-PI/2)
    } else if (record.rotation === 'down') {
      rotationAxis.copy(cameraRight);
      rotationAngle = -Math.PI / 2; // Inverted reverse of down (PI/2)
    }

    this.glassRenderer.animateRotation(rotationAxis, rotationAngle, 300).then(() => {
      this.gravityArrow.updateGravity(this.state.gravity);
      this.particles.setGravity(this.state.gravity);
      this.updateUI();
      this.locked = false;
    });
  }

  // ── Restart ───────────────────────────────────────────────

  private async handleRestart(): Promise<void> {
    if (this.locked) return;
    this.locked = true;

    // Reload level from scratch
    const { state, grid } = loadLevel(this.currentLevelId);
    this.state = state;
    this.grid = grid;
    this.undo.clear();

    // Snap all meshes back
    for (const cube of this.state.cubes.values()) {
      this.cubeRenderer.snapPosition(cube.id, cube.position);
    }

    // Reset glass pivot rotation to identity
    this.glassRenderer.pivot.quaternion.identity();
    this.gravityArrow.updateGravity(this.state.gravity);
    this.particles.setGravity(this.state.gravity);

    // Also reset locked cube materials
    this.cubeRenderer.dispose();
    this.cubeRenderer.initCubes(this.state.cubes);

    this.updateUI();
    this.locked = false;
  }

  // ── Preview (Q5: on-hold) ─────────────────────────────────

  private showPreview(dir: SwipeDirection): void {
    // Compute camera-relative axes in world space to ensure flipping preview matches screen orientation
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(this.scene.camera.matrixWorld, 0).normalize();

    let rotationAxis = new THREE.Vector3();
    let rotationAngle = 0;

    if (dir === 'left') {
      rotationAxis.set(0, 1, 0); // World Up axis keeps rotation perfectly upright
      rotationAngle = -Math.PI / 2; // Inverted
    } else if (dir === 'right') {
      rotationAxis.set(0, 1, 0); // World Up axis keeps rotation perfectly upright
      rotationAngle = Math.PI / 2;  // Inverted
    } else if (dir === 'up') {
      rotationAxis.copy(cameraRight);
      rotationAngle = -Math.PI / 2; // Inverted
    } else if (dir === 'down') {
      rotationAxis.copy(cameraRight);
      rotationAngle = Math.PI / 2;  // Inverted
    }

    const currentQuat = this.glassRenderer.pivot.quaternion.clone();
    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(rotationAxis, rotationAngle);
    const targetQuat = new THREE.Quaternion().multiplyQuaternions(deltaQuat, currentQuat);

    const worldDown = new THREE.Vector3(0, -1, 0);
    const localDown = worldDown.clone().applyQuaternion(targetQuat.clone().conjugate());

    let maxVal = -1;
    let targetAxis: 'x' | 'y' | 'z' = 'y';
    let targetSign: 1 | -1 = -1;

    const ax = Math.abs(localDown.x);
    const ay = Math.abs(localDown.y);
    const az = Math.abs(localDown.z);

    if (ax > maxVal) { maxVal = ax; targetAxis = 'x'; targetSign = localDown.x > 0 ? 1 : -1; }
    if (ay > maxVal) { maxVal = ay; targetAxis = 'y'; targetSign = localDown.y > 0 ? 1 : -1; }
    if (az > maxVal) { maxVal = az; targetAxis = 'z'; targetSign = localDown.z > 0 ? 1 : -1; }

    const newGravity = { axis: targetAxis, sign: targetSign } as any;

    const slides = previewSlides(this.state, this.grid, newGravity);
    this.cubeRenderer.showGhosts(slides, this.state.cubes);
  }

  private hidePreview(): void {
    this.cubeRenderer.clearGhosts();
  }

  // ── Win ───────────────────────────────────────────────────

  private handleWin(): void {
    // Haptic
    this.safeVibrate([50, 30, 80]);

    // Get level optimal moves (would need level def — use stored metadata)
    const stars = this.progress.recordCompletion(this.currentLevelId, this.state.moveCount, 99);

    this.showModal(this.state.moveCount, stars);
  }

  private showModal(moves: number, stars: number): void {
    if (!this.elModal) return;
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    if (this.elModalStars) this.elModalStars.textContent = starStr;
    if (this.elModalMoves) this.elModalMoves.textContent = `${moves}`;
    this.elModal.classList.remove('hidden');
  }

  // ── Level navigation ──────────────────────────────────────

  async nextLevel(): Promise<void> {
    const idx = LEVEL_ORDER.indexOf(this.currentLevelId);
    const nextId = LEVEL_ORDER[idx + 1];
    if (!nextId) return;
    this.elModal?.classList.add('hidden');
    this.currentLevelId = nextId;
    this.progress.setCurrentLevel(nextId);
    await this.loadAndBuildLevel(nextId);
    this.updateUI();
  }

  async replayLevel(): Promise<void> {
    this.elModal?.classList.add('hidden');
    await this.handleRestart();
  }

  // ── UI ───────────────────────────────────────────────────

  private bindUI(): void {
    this.elMoveCount = document.getElementById('move-count')!;
    this.elProgress = document.getElementById('level-progress')!;
    this.elGravityLabel = document.getElementById('gravity-label');
    this.elUndoBtn = document.getElementById('btn-undo')!;
    this.elLevelTitle = document.getElementById('level-title')!;
    this.elModal = document.getElementById('modal-complete')!;
    this.elModalStars = document.getElementById('modal-stars')!;
    this.elModalMoves = document.getElementById('modal-moves')!;

    document.getElementById('btn-next-level')?.addEventListener('click', () => this.nextLevel());
    document.getElementById('btn-replay')?.addEventListener('click', () => this.replayLevel());

    const themeBtn = document.getElementById('btn-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const nextTheme = this.currentTheme === 'classic' ? 'symbol' : 'classic';
        this.currentTheme = nextTheme;
        localStorage.setItem('gravity-flip-theme', nextTheme);
        this.cubeRenderer.updateTheme(nextTheme, this.state.cubes);
        
        // Update button icon: classic theme (colored cubes) shows eye, symbol theme (white cubes with symbols) shows palette
        themeBtn.textContent = nextTheme === 'classic' ? '👁️' : '🎨';
      });
      // Initial text content
      themeBtn.textContent = this.currentTheme === 'classic' ? '👁️' : '🎨';
    }
  }

  private updateUI(): void {
    if (this.elMoveCount) this.elMoveCount.textContent = `${this.state.moveCount}`;
    if (this.elProgress) this.elProgress.textContent = `${this.state.lockedCount}/${this.state.totalRequired}`;
    if (this.elGravityLabel) this.elGravityLabel.textContent = this.gravityLabel(this.state.gravity);
    if (this.elUndoBtn) this.elUndoBtn.classList.toggle('disabled', !this.undo.canUndo);
    if (this.elLevelTitle) {
      const num = LEVEL_ORDER.indexOf(this.currentLevelId) + 1;
      this.elLevelTitle.textContent = `Level ${num}`;
    }
  }

  private gravityLabel(g: GravityDir): string {
    const labels: Record<string, string> = {
      'x+1': '→ RIGHT', 'x-1': '← LEFT',
      'y+1': '↑ UP',    'y-1': '↓ DOWN',
      'z+1': '↗ FRONT', 'z-1': '↙ BACK',
    };
    return `GRAVITY: ${labels[`${g.axis}${g.sign}`] ?? '?'}`;
  }

  private showTutorialHint(levelId: string): void {
    const hintEl = document.getElementById('tutorial-hint');
    if (!hintEl) return;
    const hints: Record<string, string> = {
      level_001: 'Swipe or tap screen quadrants to rotate! Hold for preview.',
      level_002: 'Each cube must find its matching socket. Think about the order!',
    };
    const hint = hints[levelId];
    if (hint) {
      hintEl.textContent = hint;
      hintEl.classList.remove('hidden');
      setTimeout(() => hintEl.classList.add('hidden'), 4000);
    } else {
      hintEl.classList.add('hidden');
    }
  }

  // ── Dispose ───────────────────────────────────────────────
  private disposeMethods = ['glassRenderer', 'cubeRenderer', 'socketRenderer', 'blockerRenderer'] as const;

  dispose(): void {
    for (const key of this.disposeMethods) {
      (this[key] as any)?.dispose?.();
    }
  }
}
