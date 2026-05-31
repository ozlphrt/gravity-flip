// ============================================================
// CubeRenderer — colored movable cubes + ghost preview cubes
// ============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { MovableCube, Color, Vec3 } from '../core/types';
import type { SlidePayload, LockPayload } from '../core/types';
import { AnimationManager, Easings } from './AnimationManager';

const CUBE_SIZE = 0.94;

const COLOR_MAP: Record<Color, number> = {
  red:    0xe63946, // Ruby Red
  blue:   0x0077b6, // Sapphire Blue
  yellow: 0xffb703, // Amber Gold
  green:  0x2a9d8f, // Emerald Green
  purple: 0x8338ec, // Amethyst Purple
  orange: 0xe76f51, // Burnt Copper
};

/** World-space position of a grid cell inside the pivot's local frame */
function gridToLocal(v: Vec3): THREE.Vector3 {
  return new THREE.Vector3(v.x - 3.0, v.y - 3.0, v.z - 3.0);
}

export const COLOR_PHYSICS: Record<Color, { durationMult: number, pitchOffset: number, volume: number }> = {
  yellow: { durationMult: 0.35, pitchOffset: 1.5,  volume: 0.10 }, // Super light / fast, high-pitched paper-thin micro-click
  red:    { durationMult: 0.45, pitchOffset: 1.15, volume: 0.15 }, // Light, snappy click
  green:  { durationMult: 0.55, pitchOffset: 0.9,  volume: 0.18 }, // Standard organic woodblock click
  blue:   { durationMult: 0.65, pitchOffset: 0.72, volume: 0.22 }, // Heavy, solid plastic click
  orange: { durationMult: 0.75, pitchOffset: 0.58, volume: 0.27 }, // Very heavy, dense impact
  purple: { durationMult: 0.85, pitchOffset: 0.42, volume: 0.35 }, // Massive lead weight, very deep resonant thud
};

export class CubeRenderer {
  private meshes: Map<string, THREE.Mesh> = new Map();
  private ghostMeshes: Map<string, THREE.Mesh> = new Map();
  private pivot: THREE.Group;
  private anim: AnimationManager;

  constructor(_scene: THREE.Scene, pivot: THREE.Group, anim: AnimationManager) {
    this.pivot = pivot;
    this.anim = anim;
  }

  /** Build meshes for all cubes in the level */
  initCubes(cubes: Map<string, MovableCube>): void {
    for (const cube of cubes.values()) {
      this.addCubeMesh(cube);
    }
  }

  addCubeMesh(cube: MovableCube): THREE.Mesh {
    const geo = new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 5, 0.08);
    const hexColor = COLOR_MAP[cube.color] ?? 0xffffff;

    // Premium solid glossy plastic domino tile material (no texture warping)
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hexColor),
      roughness: 0.12, // Low roughness for beautiful shiny highlights
      metalness: 0.0,  // Pure shiny plastic domino tile material
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(gridToLocal(cube.position));
    mesh.userData.cubeId = cube.id;
    mesh.userData.color = cube.color;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.pivot.add(mesh);
    this.meshes.set(cube.id, mesh);
    return mesh;
  }

  getMesh(cubeId: string): THREE.Mesh | undefined {
    return this.meshes.get(cubeId);
  }

  /** Animate cube sliding from `from` to `to` position */
  animateSlide(payload: SlidePayload): Promise<void> {
    const mesh = this.meshes.get(payload.cubeId);
    if (!mesh) return Promise.resolve();

    const fromPos = gridToLocal(payload.from);
    const toPos = gridToLocal(payload.to);

    const color = (mesh.userData.color ?? 'green') as Color;
    const phys = COLOR_PHYSICS[color] ?? { durationMult: 1.0 };

    const dist = fromPos.distanceTo(toPos);
    // Scale duration based on color density: lighter = faster, heavier = slower
    const duration = Math.min(180 * dist * phys.durationMult, 400 * phys.durationMult);

    return new Promise(resolve => {
      this.anim.add(
        [fromPos.x, fromPos.y, fromPos.z],
        [toPos.x, toPos.y, toPos.z],
        duration,
        Easings.easeInCubic,
        ([x, y, z]) => { mesh.position.set(x, y, z); },
        resolve
      );
    });
  }

  /** Bounce effect: overshoot then snap back */
  animateBounce(cubeId: string, direction: THREE.Vector3): Promise<void> {
    const mesh = this.meshes.get(cubeId);
    if (!mesh) return Promise.resolve();

    const origin = mesh.position.clone();
    const overshoot = origin.clone().addScaledVector(direction, 0.06);

    return new Promise(resolve => {
      // Phase 1: overshoot
      this.anim.add(
        [origin.x, origin.y, origin.z],
        [overshoot.x, overshoot.y, overshoot.z],
        60, Easings.linear,
        ([x,y,z]) => mesh.position.set(x, y, z),
        () => {
          // Phase 2: snap back
          this.anim.add(
            [overshoot.x, overshoot.y, overshoot.z],
            [origin.x, origin.y, origin.z],
            80, Easings.easeOutExpo,
            ([x,y,z]) => mesh.position.set(x, y, z),
            resolve
          );
        }
      );
    });
  }

  /** Animate cube popping/disappearing (shrinks to 0) */
  animatePop(cubeId: string): Promise<void> {
    const mesh = this.meshes.get(cubeId);
    if (!mesh) return Promise.resolve();

    return new Promise(resolve => {
      this.anim.add(
        [1.0], [0.0], 220, Easings.easeOutExpo,
        ([s]) => { mesh.scale.set(s, s, s); },
        () => {
          this.pivot.remove(mesh);
          this.meshes.delete(cubeId);
          mesh.geometry.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach(m => m.dispose());
          resolve();
        }
      );
    });
  }

  /** Glow pulse when locked into socket */
  animateLock(payload: LockPayload): void {
    const mesh = this.meshes.get(payload.cubeId);
    if (!mesh) return;

    const mats = Array.isArray(mesh.material)
      ? (mesh.material as THREE.MeshStandardMaterial[])
      : [mesh.material as THREE.MeshStandardMaterial];

    // Pulse emissive intensity: 0 → 1.2 → 0.35
    this.anim.add(
      [0.08], [1.2], 200, Easings.easeOutExpo,
      ([v]) => mats.forEach(m => m.emissiveIntensity = v),
      () => {
        this.anim.add(
          [1.2], [0.35], 400, Easings.easeOutQuart,
          ([v]) => mats.forEach(m => m.emissiveIntensity = v)
        );
      }
    );
  }

  /** Snap cube mesh position to grid position (no animation) */
  snapPosition(cubeId: string, pos: Vec3): void {
    const mesh = this.meshes.get(cubeId);
    if (mesh) mesh.position.copy(gridToLocal(pos));
  }

  /** Remove all cube meshes */
  dispose(): void {
    for (const mesh of this.meshes.values()) {
      this.pivot.remove(mesh);
    }
    this.meshes.clear();
    this.clearGhosts();
  }

  // ── Ghost cubes for movement preview (Q5: on hold) ────
  showGhosts(slides: SlidePayload[], cubes: Map<string, MovableCube>): void {
    this.clearGhosts();
    for (const slide of slides) {
      const cube = cubes.get(slide.cubeId);
      if (!cube) continue;

      const geo = new RoundedBoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE, 5, 0.08);
      const hexColor = COLOR_MAP[cube.color] ?? 0xffffff;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hexColor),
        transparent: true,
        opacity: 0.22,
        roughness: 0.4,
        depthWrite: false,
      });
      const ghost = new THREE.Mesh(geo, mat);
      ghost.position.copy(gridToLocal(slide.to));
      this.pivot.add(ghost);
      this.ghostMeshes.set(slide.cubeId, ghost);
    }
  }

  clearGhosts(): void {
    for (const g of this.ghostMeshes.values()) {
      this.pivot.remove(g);
      g.geometry.dispose();
    }
    this.ghostMeshes.clear();
  }
}
