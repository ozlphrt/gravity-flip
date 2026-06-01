// ============================================================
// ParticleSystem — lock burst and impact sparks
// ============================================================
import * as THREE from 'three';
import type { Color } from '../core/types';

const COLOR_MAP: Record<Color, number> = {
  red:    0xd65a62,
  blue:   0x5b8aae,
  yellow: 0xddb04c,
  green:  0x5c9c8e,
  purple: 0x8c7bb5,
  orange: 0xcd7958,
};

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const SHARED_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const SHARED_CONE_GEO = new THREE.ConeGeometry(0.7, 1, 4);
const SHARED_SPHERE_GEO = new THREE.SphereGeometry(0.5, 4, 4);

export class ParticleSystem {
  private pivot: THREE.Group;
  private particles: Particle[] = [];
  private isUpdating = false;
  private currentGravity: { axis: 'x' | 'y' | 'z'; sign: 1 | -1 } = { axis: 'y', sign: -1 };

  constructor(_scene: THREE.Scene, pivot: THREE.Group) {
    this.pivot = pivot;
  }

  setGravity(gravity: { axis: 'x' | 'y' | 'z'; sign: 1 | -1 }): void {
    this.currentGravity = gravity;
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

  /** Gorgeous 3D explosive burst with sparks and smoke embers */
  spawnExplosion(position: THREE.Vector3, color: Color, poppedCount: number = 1): void {
    const hexColor = COLOR_MAP[color] ?? 0xffffff;
    // Scale particle count dynamically based on poppedCount to guarantee 60fps performance without frame drops
    const baseCount = 30 + Math.floor(Math.random() * 25);
    const count = Math.max(6, Math.floor(baseCount / poppedCount));

    for (let i = 0; i < count; i++) {
      // Dynamic random sizes
      const size = 0.015 + Math.random() * 0.11;
      
      // Randomly mix shared geometries (avoiding instantiation): 60% boxes, 25% tetrahedrons, 15% spheres
      let geo: THREE.BufferGeometry;
      const rGeo = Math.random();
      if (rGeo > 0.4) {
        geo = SHARED_BOX_GEO;
      } else if (rGeo > 0.15) {
        geo = SHARED_CONE_GEO;
      } else {
        geo = SHARED_SPHERE_GEO;
      }
      
      const isFireEmber = Math.random() > 0.65;
      const particleColor = isFireEmber 
        ? (Math.random() > 0.5 ? 0xffbb00 : 0xff2200) // Vibrant fire orange/ruby red
        : hexColor;

      const mat = new THREE.MeshStandardMaterial({
        color: particleColor,
        emissive: new THREE.Color(particleColor),
        emissiveIntensity: isFireEmber ? 4.5 : 2.5,
        transparent: true,
        opacity: 1.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.set(size, size, size);
      mesh.position.copy(position);
      
      // Random initial rotation
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      
      this.pivot.add(mesh);

      // Uniform spherical coordinates with high variation in speed
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const speed = 0.02 + Math.random() * 0.095; // Highly varied blast speeds
      
      const velX = Math.sin(phi) * Math.cos(theta) * speed;
      const velY = Math.sin(phi) * Math.sin(theta) * speed;
      const velZ = Math.cos(phi) * speed;

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(velX, velY, velZ),
        life: 0,
        maxLife: 350 + Math.random() * 650,
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
          if (p.mesh.geometry !== SHARED_BOX_GEO && p.mesh.geometry !== SHARED_CONE_GEO && p.mesh.geometry !== SHARED_SPHERE_GEO) {
            p.mesh.geometry.dispose();
          }
          const mats = Array.isArray(p.mesh.material) ? p.mesh.material : [p.mesh.material];
          mats.forEach(m => m.dispose());
          return false;
        }

        // Apply velocities with realistic air resistance / drag
        p.mesh.position.addScaledVector(p.velocity, 1);
        p.velocity.multiplyScalar(Math.exp(-0.003 * dt)); // realistic deceleration
        // Dynamic gravity pull along active axis
        const gravityStrength = 0.00035 * dt;
        p.velocity[this.currentGravity.axis] += this.currentGravity.sign * gravityStrength;

        // Add some beautiful tumbling rotation over time
        p.mesh.rotation.x += 0.008 * dt;
        p.mesh.rotation.y += 0.012 * dt;

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
