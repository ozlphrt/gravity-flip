// ============================================================
// BlockerRenderer — fixed obstacle cubes (glossy rounded obsidian)
// ============================================================
import * as THREE from 'three';
import type { FixedBlocker } from '../core/types';

function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
  segments: number
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const w = width - radius * 2;
  const h = height - radius * 2;
  const x = -w / 2;
  const y = -h / 2;

  shape.moveTo(x, y + h);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  shape.lineTo(x + w, y);
  shape.quadraticCurveTo(x + w + radius, y, x + w + radius, y + radius);
  shape.lineTo(x + w, y + h);
  shape.quadraticCurveTo(x + w + radius, y + h + radius, x + w, y + h + radius);
  shape.lineTo(x + radius, y + h + radius);
  shape.quadraticCurveTo(x, y + h + radius, x, y + h);

  const extrudeSettings = {
    depth: depth - radius * 2,
    bevelEnabled: true,
    bevelSegments: segments,
    steps: 1,
    bevelSize: radius,
    bevelThickness: radius,
    curveSegments: segments
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  return geo;
}

export class BlockerRenderer {
  private meshes: Map<string, THREE.Mesh> = new Map();
  private pivot: THREE.Group;

  constructor(pivot: THREE.Group) {
    this.pivot = pivot;
  }

  initBlockers(blockers: Map<string, FixedBlocker>): void {
    for (const blocker of blockers.values()) {
      this.addBlockerMesh(blocker);
    }
  }

  private addBlockerMesh(blocker: FixedBlocker): void {
    const geo = createRoundedBoxGeometry(0.88, 0.88, 0.88, 0.1, 4);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x151b26), // beautiful deep obsidian dark blue-gray
      roughness: 0.1,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(blocker.position.x, blocker.position.y, blocker.position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.pivot.add(mesh);
    this.meshes.set(blocker.id, mesh);
  }

  dispose(): void {
    for (const m of this.meshes.values()) {
      this.pivot.remove(m);
      m.geometry.dispose();
      if (Array.isArray(m.material)) {
        m.material.forEach(mat => mat.dispose());
      } else {
        m.material.dispose();
      }
    }
    this.meshes.clear();
  }
}
