// ============================================================
// SocketRenderer — socket markers on grid walls
// ============================================================
import * as THREE from 'three';
import type { Socket, Color } from '../core/types';

const COLOR_MAP: Record<Color, number> = {
  red:    0xe63946, // Ruby Red
  blue:   0x0077b6, // Sapphire Blue
  yellow: 0xffb703, // Amber Gold
  green:  0x2a9d8f, // Emerald Green
  purple: 0x8338ec, // Amethyst Purple
  orange: 0xe76f51, // Burnt Copper
};

export class SocketRenderer {
  private groups: Map<string, THREE.Group> = new Map();
  private pivot: THREE.Group;

  constructor(pivot: THREE.Group) {
    this.pivot = pivot;
  }

  initSockets(sockets: Map<string, Socket>): void {
    for (const socket of sockets.values()) {
      this.addSocketMesh(socket);
    }
  }

  private addSocketMesh(socket: Socket): void {
    const group = new THREE.Group();
    const hexColor = COLOR_MAP[socket.requiredColor] ?? 0xffffff;
    const color = new THREE.Color(hexColor);

    // Backing panel (dark square inset)
    const backGeo = new THREE.PlaneGeometry(0.7, 0.7);
    const backMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x0a0d14),
      roughness: 0.8,
    });
    const back = new THREE.Mesh(backGeo, backMat);

    // Glowing ring
    const ringGeo = new THREE.RingGeometry(0.28, 0.36, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.8,
      side: THREE.DoubleSide,
      roughness: 0.2,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);

    // Inner dot
    const dotGeo = new THREE.CircleGeometry(0.1, 16);
    const dotMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.5,
    });
    const dot = new THREE.Mesh(dotGeo, dotMat);

    group.add(back);
    group.add(ring);
    group.add(dot);

    // Position and orient socket panel
    this.placeSocketGroup(group, socket);

    this.pivot.add(group);
    this.groups.set(socket.id, group);
  }

  private placeSocketGroup(group: THREE.Group, socket: Socket): void {
    const { x, y, z } = socket.position;
    const offset = 0.42; // half cell + tiny gap to sit on face

    // Place at cell position
    group.position.set(x, y, z);

    // Orient the panel to face outward from the correct face
    switch (socket.face) {
      case '+x': group.position.x += offset; group.rotation.y = Math.PI / 2; break;
      case '-x': group.position.x -= offset; group.rotation.y = -Math.PI / 2; break;
      case '+y': group.position.y += offset; group.rotation.x = -Math.PI / 2; break;
      case '-y': group.position.y -= offset; group.rotation.x = Math.PI / 2; break;
      case '+z': group.position.z += offset; break;
      case '-z': group.position.z -= offset; group.rotation.y = Math.PI; break;
    }
  }

  /** Pulse glow on lock */
  flashLock(socketId: string): void {
    const group = this.groups.get(socketId);
    if (!group) return;
    group.children.forEach(child => {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat?.emissiveIntensity !== undefined) {
        const original = mat.emissiveIntensity;
        mat.emissiveIntensity = 3.0;
        setTimeout(() => { mat.emissiveIntensity = original; }, 500);
      }
    });
  }

  dispose(): void {
    for (const group of this.groups.values()) {
      this.pivot.remove(group);
    }
    this.groups.clear();
  }
}
