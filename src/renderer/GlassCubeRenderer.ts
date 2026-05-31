// ============================================================
// GlassCubeRenderer — outer transparent glass box + glowing edges
// The "pivot" group rotates with the cube orientation.
// ============================================================
import * as THREE from 'three';
import type { Vec3 } from '../core/types';
import { AnimationManager, Easings } from './AnimationManager';

const EDGE_COLOR = new THREE.Color(0x00b4d8); // Ice blue/teal
const FACE_COLOR = new THREE.Color(0x0d1b2a); // Deep blue-gray slate
const GRID_LINE_COLOR = new THREE.Color(0x00b4d8); // Ice blue/teal matching edge glow

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

export class GlassCubeRenderer {
  /** The root group — everything inside rotates with the cube */
  readonly pivot: THREE.Group;

  private edgeLines: THREE.LineSegments;
  private faces: THREE.Mesh;
  private railLines: THREE.LineSegments;
  private anim: AnimationManager;

  constructor(scene: THREE.Scene, gridSize: Vec3, anim: AnimationManager) {
    this.anim = anim;
    this.pivot = new THREE.Group();
    // Center the pivot at the grid's geometric center
    const cx = (gridSize.x - 1) / 2;
    const cy = (gridSize.y - 1) / 2;
    const cz = (gridSize.z - 1) / 2;
    this.pivot.position.set(cx, cy, cz);
    scene.add(this.pivot);

    // ── Outer transparent glass faces ─────────────────────
    const boxGeo = createRoundedBoxGeometry(gridSize.x, gridSize.y, gridSize.z, 0.22, 5);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: FACE_COLOR,
      opacity: 0.16,
      transparent: true,
      roughness: 0.05,
      metalness: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transmission: 0.9,
      ior: 1.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.faces = new THREE.Mesh(boxGeo, glassMat);
    this.faces.receiveShadow = true;
    this.faces.visible = false; // Make invisible
    this.pivot.add(this.faces);
 
    // Front faces (outer layer, slightly larger)
    const outerGeo = createRoundedBoxGeometry(gridSize.x + 0.01, gridSize.y + 0.01, gridSize.z + 0.01, 0.225, 5);
    const outerMat = new THREE.MeshPhysicalMaterial({
      color: FACE_COLOR,
      opacity: 0.08,
      transparent: true,
      roughness: 0.02,
      metalness: 0.9,
      clearcoat: 1.0,
      transmission: 0.9,
      side: THREE.FrontSide,
      depthWrite: false,
    });
    const outerFaces = new THREE.Mesh(outerGeo, outerMat);
    outerFaces.visible = false; // Make invisible
    this.pivot.add(outerFaces);

    const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(gridSize.x, gridSize.y, gridSize.z));
    const edgeMat = new THREE.LineBasicMaterial({
      color: EDGE_COLOR,
      linewidth: 1,
      transparent: true,
      opacity: 0.85,
    });
    this.edgeLines = new THREE.LineSegments(edgesGeo, edgeMat);
    this.edgeLines.visible = false; // Make invisible to remove outer gridlines
    this.pivot.add(this.edgeLines);

    // ── Inner rail lattice ─────────────────────────────────
    this.railLines = this.buildRailLattice(gridSize);
    this.railLines.visible = false; // Make invisible to remove outer gridlines entirely
    this.pivot.add(this.railLines);
  }

  private buildRailLattice(gs: Vec3): THREE.LineSegments {
    const points: number[] = [];

    const half = {
      x: (gs.x - 1) / 2,
      y: (gs.y - 1) / 2,
      z: (gs.z - 1) / 2,
    };

    // Draw lattice lines at every integer grid boundary (offset from center)
    // X-axis lines (only on outer Y or Z boundaries)
    for (let y = 0; y <= gs.y; y++) {
      for (let z = 0; z <= gs.z; z++) {
        if (y === 0 || y === gs.y || z === 0 || z === gs.z) {
          const py = y - half.y - 0.5;
          const pz = z - half.z - 0.5;
          points.push(-half.x - 0.5, py, pz, half.x + 0.5, py, pz);
        }
      }
    }
    // Y-axis lines (only on outer X or Z boundaries)
    for (let x = 0; x <= gs.x; x++) {
      for (let z = 0; z <= gs.z; z++) {
        if (x === 0 || x === gs.x || z === 0 || z === gs.z) {
          const px = x - half.x - 0.5;
          const pz = z - half.z - 0.5;
          points.push(px, -half.y - 0.5, pz, px, half.y + 0.5, pz);
        }
      }
    }
    // Z-axis lines (only on outer X or Y boundaries)
    for (let x = 0; x <= gs.x; x++) {
      for (let y = 0; y <= gs.y; y++) {
        if (x === 0 || x === gs.x || y === 0 || y === gs.y) {
          const px = x - half.x - 0.5;
          const py = y - half.y - 0.5;
          points.push(px, py, -half.z - 0.5, px, py, half.z + 0.5);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const mat = new THREE.LineBasicMaterial({
      color: GRID_LINE_COLOR,
      transparent: true,
      opacity: 0.08, // Soft, non-intrusive holographic glow
      depthWrite: false,
    });
    return new THREE.LineSegments(geo, mat);
  }

  /**
   * Animate the glass cube rotating by 90° around the given local axis.
   * localAxis: [x, y, z] unit vector in the cube's local frame.
   * The rotation matrix drives the final quaternion.
   */
  animateRotation(
    axis: THREE.Vector3,
    angle: number, // +90° or -90° in radians
    duration: number = 420
  ): Promise<void> {
    const startQuat = this.pivot.quaternion.clone();
    const deltaQuat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const endQuat = new THREE.Quaternion().multiplyQuaternions(deltaQuat, startQuat);

    return new Promise(resolve => {
      this.anim.add(
        [0], [1], duration, Easings.easeOutQuart,
        ([t]) => {
          this.pivot.quaternion.slerpQuaternions(startQuat, endQuat, t);
        },
        resolve
      );
    });
  }

  /** Flash the edges on invalid move attempt */
  flashInvalid(): void {
    const mat = this.edgeLines.material as THREE.LineBasicMaterial;
    const origColor = mat.color.clone();
    mat.color.set(0xff3300);
    this.anim.add(
      [1], [0], 300, Easings.easeOutExpo,
      ([t]) => { mat.opacity = 0.5 + t * 0.4; },
      () => { mat.color.copy(origColor); mat.opacity = 0.9; }
    );
  }

  /** Remove from scene for level reload */
  dispose(): void {
    if (this.pivot.parent) this.pivot.parent.remove(this.pivot);
  }
}
