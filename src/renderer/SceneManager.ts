// ============================================================
// SceneManager — Three.js scene, camera, lights, render loop
// ============================================================
import * as THREE from 'three';
import { AnimationManager } from './AnimationManager';

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly anim: AnimationManager;

  private _rafId: number = -1;
  private onFrameCallbacks: ((dt: number) => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    // ── Renderer ──────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ── Scene ─────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.bgCanvas = document.createElement('canvas');
    this.bgTexture = new THREE.CanvasTexture(this.bgCanvas);
    this.scene.background = this.bgTexture;
    this.scene.fog = null; // Fog fully disabled to match Jarrows fog-free aesthetic

    // ── Camera — direct face view with slight top perspective ──────────────────────────
    this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    // Looking straight at the front face (X=3.0) from slightly above (Y=7.5) and back (Z=23.0)
    this.camera.position.set(3.0, 7.5, 23.0);
    this.camera.lookAt(3.0, 3.0, 3.0);

    // ── Lights ────────────────────────────────────────────
    // Jarrows uses 0.43 intensity white ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.43);
    this.scene.add(ambient);
 
    // Jarrows Dramatic Key Light (position: 22.5, 26, 19.5, intensity: 1.0 - 2.5)
    // We center the grid around (1.5, 1.5, 1.5) instead of Jarrows' (3.5, 0, 3.5),
    // so we offset the position relatively for perfect isometric casting.
    // Jarrows offset from grid center (3.5, 0, 3.5): key position (22.5, 26, 19.5) -> dx=19, dy=26, dz=16
    // Applying same offset to our center (1.5, 1.5, 1.5): key position (20.5, 27.5, 17.5)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(20.5, 27.5, 17.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    keyLight.shadow.radius = 3;
    keyLight.shadow.normalBias = 0.02; // Eliminate shadow acne
    keyLight.shadow.camera.near = 1.0;
    keyLight.shadow.camera.far = 50.0;
    
    // Tight orthographic camera bounds for crisp shadows
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 14;
    keyLight.shadow.camera.bottom = -14;
    this.scene.add(keyLight);
 
    // Jarrows Fill Light (position: -17.5, 12.5, -11, intensity: 0.73)
    // Offset from Jarrows center (3.5, 0, 3.5): dx=-21, dy=12.5, dz=-14.5
    // Applying to our center (1.5, 1.5, 1.5): (-19.5, 14.0, -13.0)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.73);
    fillLight.position.set(-19.5, 14.0, -13.0);
    this.scene.add(fillLight);
 
    // Rim Light (adds a beautiful outline highlight to shapes)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
    rimLight.position.set(-2, 10, -12);
    this.scene.add(rimLight);

    // ── Animation manager ──────────────────────────────────
    this.anim = new AnimationManager();
 
    // Initial draw
    this.drawBackground();

    // ── Resize observer ────────────────────────────────────
    const ro = new ResizeObserver(() => this.onResize());
    ro.observe(canvas);
  }

  onResize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // Redraw background
    this.drawBackground();
  }

  /** Add a callback invoked each frame before rendering */
  onFrame(cb: (dt: number) => void): void {
    this.onFrameCallbacks.push(cb);
  }

  startLoop(): void {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;

      this.anim.update(now);
      for (const cb of this.onFrameCallbacks) cb(dt);

      this.renderer.render(this.scene, this.camera);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);

    // Pause when hidden to save battery
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(this._rafId);
      } else {
        last = performance.now();
        this._rafId = requestAnimationFrame(loop);
      }
    });
  }

  stopLoop(): void {
    cancelAnimationFrame(this._rafId);
  }

  updateCameraFocus(gridSize: any): void {
    const cx = (gridSize.x - 1) / 2;
    const cy = (gridSize.y - 1) / 2;
    const cz = (gridSize.z - 1) / 2;

    const maxDim = Math.max(gridSize.x, gridSize.y, gridSize.z);
    const distanceScale = maxDim * 2.1 + 7.5;

    this.camera.position.set(cx, cy + maxDim * 0.65, cz + distanceScale);
    this.camera.lookAt(cx, cy, cz);
  }

  /** Camera micro-shake effect */
  shake(intensity = 0.08, duration = 150): void {
    const origin = this.camera.position.clone();
    const start = performance.now();
    const doShake = (now: number) => {
      const t = (now - start) / duration;
      if (t >= 1) {
        this.camera.position.copy(origin);
        return;
      }
      const scale = intensity * (1 - t);
      this.camera.position.set(
        origin.x + (Math.random() - 0.5) * scale,
        origin.y + (Math.random() - 0.5) * scale,
        origin.z + (Math.random() - 0.5) * scale
      );
      requestAnimationFrame(doShake);
    };
    requestAnimationFrame(doShake);
  }

  private bgCanvas: HTMLCanvasElement;
  private bgTexture: THREE.CanvasTexture;

  private drawBackground(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    this.bgCanvas.width = w;
    this.bgCanvas.height = h;

    const ctx = this.bgCanvas.getContext('2d')!;

    // 1. Luminous radial gradient studio backdrop (premium darker slate grey)
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h));
    grad.addColorStop(0, '#101216'); // Premium matte darker grey center
    grad.addColorStop(1, '#060709'); // Deep dark charcoal edges
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. High-precision thin background grid lines (extremely subtle and perfectly blended)
    const gridSize = 48;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();

    for (let x = gridSize; x < w; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = gridSize; y < h; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    this.bgTexture.needsUpdate = true;
  }
}
