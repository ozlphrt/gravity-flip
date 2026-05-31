// ============================================================
// ParticleSystem — lock burst and impact sparks
// ============================================================
import * as THREE from 'three';
import type { Color } from '../core/types';

const COLOR_MAP: Record<Color, number> = {
  red:    0xff3344,
  blue:   0x2288ff,
  yellow: 0xffcc00,
  green:  0x22dd66,
  purple: 0xaa44ff,
  orange: 0xff7722,
};

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private pivot: THREE.Group;
  private particles: Particle[] = [];
  private isUpdating = false;

  constructor(_scene: THREE.Scene, pivot: THREE.Group) {
    this.pivot = pivot;
  }

  /** Burst of particles on socket lock */
  spawnLockBurst(position: THREE.Vector3, color: Color): void {
    const hexColor = COLOR_MAP[color] ?? 0xffffff;
    const count = 10;

    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.04, 4, 4);
      const mat = new THREE.MeshStandardMaterial({
        color: hexColor,
        emissive: new THREE.Color(hexColor),
        emissiveIntensity: 2.0,
        transparent: true,
        opacity: 1.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      this.pivot.add(mesh);

      const angle = (i / count) * Math.PI * 2;
      const speed = 0.015 + Math.random() * 0.02;
      const velX = Math.cos(angle) * speed;
      const velY = (0.01 + Math.random() * 0.015);
      const velZ = Math.sin(angle) * speed;

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(velX, velY, velZ),
        life: 0,
        maxLife: 600 + Math.random() * 200,
      });
    }

    if (!this.isUpdating) this.startUpdate();
  }

  /** Small impact sparks when cube hits wall */
  spawnImpact(position: THREE.Vector3): void {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.025, 4, 4);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xaaccff,
        emissive: new THREE.Color(0x4488ff),
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.8,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      this.pivot.add(mesh);

      const speed = 0.008 + Math.random() * 0.012;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          0.005 + Math.random() * 0.008,
          Math.sin(angle) * speed
        ),
        life: 0,
        maxLife: 300 + Math.random() * 100,
      });
    }

    if (!this.isUpdating) this.startUpdate();
  }

  private startUpdate(): void {
    this.isUpdating = true;
    let last = performance.now();

    const update = (now: number) => {
      const dt = now - last;
      last = now;

      this.particles = this.particles.filter(p => {
        p.life += dt;
        const t = p.life / p.maxLife;

        if (t >= 1) {
          this.pivot.remove(p.mesh);
          p.mesh.geometry.dispose();
          return false;
        }

        p.mesh.position.addScaledVector(p.velocity, 1);
        p.velocity.y -= 0.0004 * dt; // gravity pull on particles

        const mat = p.mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = 1 - t;

        return true;
      });

      if (this.particles.length > 0) {
        requestAnimationFrame(update);
      } else {
        this.isUpdating = false;
      }
    };

    requestAnimationFrame(update);
  }
}
