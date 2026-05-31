// ============================================================
// Gravity Flip Cube — Core Types
// Pure TypeScript — no Three.js dependency
// ============================================================

export type Color = 'red' | 'blue' | 'yellow' | 'green' | 'purple' | 'orange';

export type CellType = 'empty' | 'movable' | 'blocker' | 'locked' | 'socket';

export type GravityAxis = 'x' | 'y' | 'z';
export type AxisSign = 1 | -1;

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

// Integer-valued 3D vector (grid coordinates)
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface GravityDir {
  axis: GravityAxis;
  sign: AxisSign;
}

// 3x3 integer rotation matrix stored row-major
// Valid entries: -1, 0, 1
// Represents all 24 valid orientations of a cube
export type RotMat3 = [
  number, number, number,
  number, number, number,
  number, number, number
];

// ── Grid Cells ────────────────────────────────────────────
export interface GridCell {
  type: CellType;
  cubeId: string | null;
  socketId: string | null;
}

// ── Movable Cube ──────────────────────────────────────────
export interface MovableCube {
  id: string;
  color: Color;
  /** Icon key per face [+x, -x, +y, -y, +z, -z] */
  icons: [string, string, string, string, string, string];
  position: Vec3;
  isLocked: boolean;
  socketId: string | null;
}

// ── Fixed Blocker ─────────────────────────────────────────
export interface FixedBlocker {
  id: string;
  position: Vec3;
  icon?: string;
}

// ── Socket ────────────────────────────────────────────────
export type FaceDir = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export interface Socket {
  id: string;
  position: Vec3;
  requiredColor: Color;
  face: FaceDir;
  isOccupied: boolean;
  occupiedByCubeId: string | null;
}

// ── Level Definition (matches JSON on disk) ───────────────
export interface LevelCubeData {
  id: string;
  color: Color;
  position: Vec3;
  icons?: string[];
}

export interface LevelBlockerData {
  id: string;
  position: Vec3;
  icon?: string;
}

export interface LevelSocketData {
  id: string;
  position: Vec3;
  requiredColor: Color;
  face: FaceDir;
}

export interface LevelDefinition {
  id: string;
  title: string;
  author?: string;
  difficulty: 'tutorial' | 'easy' | 'medium' | 'hard' | 'expert';
  optimalMoves: number;
  hint?: string;
  tags?: string[];
  gridSize: Vec3;
  initialGravity: GravityDir;
  cubes: LevelCubeData[];
  blockers: LevelBlockerData[];
  sockets: LevelSocketData[];
}

// ── Live Game State ───────────────────────────────────────
export interface GameState {
  levelId: string;
  gridSize: Vec3;
  /** Sparse map: `${x},${y},${z}` → GridCell */
  grid: Map<string, GridCell>;
  cubes: Map<string, MovableCube>;
  sockets: Map<string, Socket>;
  blockers: Map<string, FixedBlocker>;
  gravity: GravityDir;
  /** Cumulative orientation of the outer cube (cube-relative rotation) */
  orientationMatrix: RotMat3;
  moveCount: number;
  lockedCount: number;
  totalRequired: number;
  isComplete: boolean;
}

// ── Undo ──────────────────────────────────────────────────
export interface CubeSnapshot {
  id: string;
  position: Vec3;
  isLocked: boolean;
  socketId: string | null;
}

export interface SocketSnapshot {
  id: string;
  isOccupied: boolean;
  occupiedByCubeId: string | null;
}

export interface MoveRecord {
  rotation: SwipeDirection;
  gravityBefore: GravityDir;
  gravityAfter: GravityDir;
  orientationBefore: RotMat3;
  orientationAfter: RotMat3;
  cubesBefore: CubeSnapshot[];
  socketsBefore: SocketSnapshot[];
  lockedCountBefore: number;
  moveCountBefore: number;
}

// ── Animation Payloads (passed from sim to renderer) ──────
export interface SlidePayload {
  cubeId: string;
  from: Vec3;
  to: Vec3;
}

export interface LockPayload {
  cubeId: string;
  position: Vec3;
}

export interface MoveResult {
  type: 'no-op' | 'move';
  slides: SlidePayload[];
  locks: LockPayload[];
  isComplete: boolean;
}
