// ============================================================
// LevelLoader — parse and validate level JSON into GameState
// ============================================================
import type {
  LevelDefinition,
  GameState,
  MovableCube,
  FixedBlocker,
  Socket,
  GridCell,
} from '../core/types';
import { Grid, vecKey } from '../core/Grid';
import { IDENTITY, cloneMatrix } from '../core/GravitySystem';

// Import all levels statically (Vite resolves JSON imports)
import level001 from './data/level_001.json';
import level002 from './data/level_002.json';
import level003 from './data/level_003.json';
import level004 from './data/level_004.json';
import level005 from './data/level_005.json';

const LEVEL_REGISTRY: Record<string, LevelDefinition> = {
  level_001: level001 as LevelDefinition,
  level_002: level002 as LevelDefinition,
  level_003: level003 as LevelDefinition,
  level_004: level004 as LevelDefinition,
  level_005: level005 as LevelDefinition,
};

export const LEVEL_ORDER = ['level_001'];

export function getLevelIds(): string[] {
  return LEVEL_ORDER;
}

/**
 * Load a level by ID and return a fresh GameState + Grid.
 * Throws a descriptive error if validation fails.
 */
export function loadLevel(
  levelId: string
): { state: GameState; grid: Grid } {
  const def = LEVEL_REGISTRY[levelId];
  if (!def) throw new Error(`Unknown level: ${levelId}`);

  validateLevel(def);

  const gridMap = new Map<string, GridCell>();
  const grid = new Grid(def.gridSize, gridMap);

  // ── Build cube map ─────────────────────────────────────
  const cubes = new Map<string, MovableCube>();
  for (const cd of def.cubes) {
    const defaultIcons: [string,string,string,string,string,string] =
      ['dot','dot','dot','dot','dot','dot'];
    const icons = cd.icons
      ? (cd.icons.slice(0,6) as [string,string,string,string,string,string])
      : defaultIcons;

    const cube: MovableCube = {
      id: cd.id,
      color: cd.color,
      icons,
      position: { ...cd.position },
      isLocked: false,
      socketId: null,
    };
    cubes.set(cd.id, cube);

    // Mark grid cell
    grid.setCell(cube.position, { type: 'movable', cubeId: cube.id, socketId: null });
  }

  // ── Build blocker map ──────────────────────────────────
  const blockers = new Map<string, FixedBlocker>();
  for (const bd of def.blockers) {
    const blocker: FixedBlocker = {
      id: bd.id,
      position: { ...bd.position },
      icon: bd.icon,
    };
    blockers.set(bd.id, blocker);
    grid.setCell(blocker.position, { type: 'blocker', cubeId: null, socketId: null });
  }

  // ── Build socket map ───────────────────────────────────
  const sockets = new Map<string, Socket>();
  for (const sd of def.sockets) {
    const socket: Socket = {
      id: sd.id,
      position: { ...sd.position },
      requiredColor: sd.requiredColor,
      face: sd.face,
      isOccupied: false,
      occupiedByCubeId: null,
    };
    sockets.set(sd.id, socket);

    // Sockets can share a cell with a cube (cube sits on socket)
    const existing = grid.getCell(socket.position);
    grid.setCell(socket.position, {
      type: existing.cubeId ? existing.type : 'socket',
      cubeId: existing.cubeId,
      socketId: socket.id,
    });
  }

  const state: GameState = {
    levelId,
    gridSize: { ...def.gridSize },
    grid: gridMap,
    cubes,
    sockets,
    blockers,
    gravity: { ...def.initialGravity },
    orientationMatrix: cloneMatrix(IDENTITY),
    moveCount: 0,
    lockedCount: 0,
    totalRequired: sockets.size,
    isComplete: false,
  };

  return { state, grid };
}

// ── Validation ────────────────────────────────────────────
function validateLevel(def: LevelDefinition): void {
  const inBounds = (v: { x: number; y: number; z: number }) =>
    v.x >= 0 && v.x < def.gridSize.x &&
    v.y >= 0 && v.y < def.gridSize.y &&
    v.z >= 0 && v.z < def.gridSize.z;

  const occupiedCells = new Set<string>();

  // Validate cubes
  const cubeIds = new Set<string>();
  for (const c of def.cubes) {
    if (cubeIds.has(c.id)) throw new Error(`Duplicate cube id: ${c.id}`);
    cubeIds.add(c.id);
    if (!inBounds(c.position)) throw new Error(`Cube ${c.id} is out of bounds`);
    const key = vecKey(c.position);
    if (occupiedCells.has(key)) throw new Error(`Cube ${c.id} overlaps another object at ${key}`);
    occupiedCells.add(key);
  }

  // Validate blockers
  const blockerIds = new Set<string>();
  for (const b of def.blockers) {
    if (blockerIds.has(b.id)) throw new Error(`Duplicate blocker id: ${b.id}`);
    blockerIds.add(b.id);
    if (!inBounds(b.position)) throw new Error(`Blocker ${b.id} is out of bounds`);
    const key = vecKey(b.position);
    if (occupiedCells.has(key)) throw new Error(`Blocker ${b.id} overlaps another object at ${key}`);
    occupiedCells.add(key);
  }

  // Validate sockets (can share cell with cubes — sockets are floor/wall markers)
  const socketIds = new Set<string>();
  for (const s of def.sockets) {
    if (socketIds.has(s.id)) throw new Error(`Duplicate socket id: ${s.id}`);
    socketIds.add(s.id);
    if (!inBounds(s.position)) throw new Error(`Socket ${s.id} is out of bounds`);
  }

  // Ensure at least one cube
  if (def.cubes.length === 0) throw new Error('Level has no cubes');
}
