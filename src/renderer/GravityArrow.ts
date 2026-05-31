// ============================================================
// GravityArrow — 3D world-space gravity direction indicator
// Sits above the glass cube, always points in world gravity direction
// ============================================================
import * as THREE from 'three';
import type { GravityDir } from '../core/types';
import { AnimationManager, Easings } from './AnimationManager';

export class GravityArrow {
  private group: THREE.Group;
  private anim: AnimationManager;

  constructor(_scene: THREE.Scene, anim: AnimationManager) {
    this.anim = anim;
    this.group = new THREE.Group();
    // scene.add(this.group); // Removed the 3D gravity arrow overlay from the scene

    // Arrow shaft
    const shaftGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00b4d8,
      emissive: new THREE.Color(0x00b4d8),
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
    const shaft = new THREE.Mesh(shaftGeo, mat);
    shaft.position.y = 0.4;
    this.group.add(shaft);

    // Arrow head (cone)
    const headGeo = new THREE.ConeGeometry(0.14, 0.3, 8);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = -0.15; // tip points down (toward gravity)
    head.rotation.z = Math.PI;
    this.group.add(head);

    // Position the arrow above the cube (for 4×4×4 at center 1.5,1.5,1.5 → above at y~5)
    this.group.position.set(1.5, 5.8, 1.5);

    // Pulse animation — continuous breathing glow
    this.startPulse(mat);
  }

  private startPulse(mat: THREE.MeshStandardMaterial): void {
    let forward = true;
    const pulse = () => {
      this.anim.add(
        [forward ? 0.8 : 1.6], [forward ? 1.6 : 0.8], 900, Easings.easeInOutCubic,
        ([v]) => { mat.emissiveIntensity = v; },
        () => { forward = !forward; pulse(); }
      );
    };
    pulse();
  }

  /**
   * Update arrow direction to match current world-space gravity.
   * Smoothly rotates the group.
   */
  updateGravity(_gravity: GravityDir): void {
    // Screen-relative: world-space gravity is always down (0, -1, 0).
    // The visual arrow in world space always points straight down.
    this.group.quaternion.identity();
  }

  /** Wobble on invalid move */
  wobble(): void {
    const startQuat = this.group.quaternion.clone();
    this.anim.add(
      [0], [1], 200, Easings.easeOutElastic,
      ([t]) => {
        const offset = Math.sin(t * Math.PI * 3) * 0.15;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, offset));
        this.group.quaternion.copy(startQuat).multiply(q);
      },
      () => { this.group.quaternion.copy(startQuat); }
    );
  }
}
