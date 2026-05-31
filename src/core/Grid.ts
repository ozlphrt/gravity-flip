// ============================================================
// Grid — 3D sparse grid with bounds checking
// ============================================================
import type { Vec3, GridCell, CellType } from './types';

export function vecKey(v: Vec3): string {
  return `${v.x},${v.y},${v.z}`;
}

export function addVec(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function eqVec(a: Vec3, b: Vec3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function cloneVec(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}

export class Grid {
  readonly size: Vec3;
  private cells: Map<string, GridCell>;

  constructor(size: Vec3, cells?: Map<string, GridCell>) {
    this.size = size;
    this.cells = cells ?? new Map();
  }

  inBounds(v: Vec3): boolean {
    return (
      v.x >= 0 && v.x < this.size.x &&
      v.y >= 0 && v.y < this.size.y &&
      v.z >= 0 && v.z < this.size.z
    );
  }

  getCell(v: Vec3): GridCell {
    const key = vecKey(v);
    return this.cells.get(key) ?? { type: 'empty', cubeId: null, socketId: null };
  }

  setCell(v: Vec3, cell: GridCell): void {
    this.cells.set(vecKey(v), cell);
  }

  setType(v: Vec3, type: CellType): void {
    const existing = this.getCell(v);
    this.cells.set(vecKey(v), { ...existing, type });
  }

  setCubeId(v: Vec3, cubeId: string | null): void {
    const existing = this.getCell(v);
    this.cells.set(vecKey(v), { ...existing, cubeId });
  }

  clearCube(v: Vec3): void {
    const cell = this.getCell(v);
    if (cell.socketId) {
      // Keep socket, just remove cube from cell but keep type as socket
      this.cells.set(vecKey(v), { type: 'socket', cubeId: null, socketId: cell.socketId });
    } else {
      this.cells.set(vecKey(v), { type: 'empty', cubeId: null, socketId: null });
    }
  }

  /** Returns true if the cell is passable (empty or socket-only) for a sliding cube */
  isPassable(v: Vec3): boolean {
    if (!this.inBounds(v)) return false;
    const cell = this.getCell(v);
    return cell.type === 'empty' || cell.type === 'socket';
  }

  /** Returns true if the cell is occupied by something that blocks movement */
  isBlocking(v: Vec3): boolean {
    if (!this.inBounds(v)) return true; // out of bounds = wall = blocking
    const cell = this.getCell(v);
    return cell.type === 'blocker' || cell.type === 'locked' || cell.type === 'movable';
  }

  /** Clone the underlying cells map for snapshot purposes */
  cloneCells(): Map<string, GridCell> {
    return new Map(
      Array.from(this.cells.entries()).map(([k, v]) => [k, { ...v }])
    );
  }
}
