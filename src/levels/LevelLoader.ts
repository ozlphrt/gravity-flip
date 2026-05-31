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
  Vec3,
  Color,
} from '../core/types';
import { Grid } from '../core/Grid';
import { IDENTITY, cloneMatrix } from '../core/GravitySystem';

// Import all levels statically (Vite resolves JSON imports)
import level001 from './data/level_001.json';
import level002 from './data/level_002.json';
import level003 from './data/level_003.json';
import level004 from './data/level_004.json';
import level005 from './data/level_005.json';
import level006 from './data/level_006.json';

const LEVEL_REGISTRY: Record<string, LevelDefinition> = {
  level_001: level001 as LevelDefinition,
  level_002: level002 as LevelDefinition,
  level_003: level003 as LevelDefinition,
  level_004: level004 as LevelDefinition,
  level_005: level005 as LevelDefinition,
  level_006: level006 as LevelDefinition,
};

export const LEVEL_ORDER = ['level_001', 'level_002', 'level_003', 'level_004', 'level_005', 'level_006'];

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

  // Determine grid size and parameters based on level
  let gridSize = { x: 5, y: 5, z: 5 };
  let allowedColors: Color[] = ['red', 'blue'];
  let cubeCount = 20;

  if (levelId === 'level_001') {
    gridSize = { x: 4, y: 4, z: 4 };
    allowedColors = ['red', 'blue'];
    cubeCount = 12;
  } else if (levelId === 'level_002') {
    gridSize = { x: 5, y: 5, z: 5 };
    allowedColors = ['red', 'blue', 'yellow'];
    cubeCount = 30;
  } else if (levelId === 'level_003') {
    gridSize = { x: 6, y: 6, z: 6 };
    allowedColors = ['red', 'blue', 'yellow', 'green'];
    cubeCount = 60;
  } else if (levelId === 'level_004') {
    gridSize = { x: 7, y: 7, z: 7 };
    allowedColors = ['red', 'blue', 'yellow', 'green', 'purple'];
    cubeCount = 100;
  } else if (levelId === 'level_005') {
    gridSize = { x: 8, y: 8, z: 8 };
    allowedColors = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'];
    cubeCount = 160;
  } else if (levelId === 'level_006') {
    gridSize = { x: 10, y: 10, z: 10 };
    allowedColors = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'];
    cubeCount = 300;
  }

  const gridMap = new Map<string, GridCell>();
  const grid = new Grid(gridSize, gridMap);

  // Sockets and blockers are completely removed
  const blockers = new Map<string, FixedBlocker>();
  const sockets = new Map<string, Socket>();

  // Gather all positions in the grid
  const availablePositions: Vec3[] = [];
  for (let x = 0; x < gridSize.x; x++) {
    for (let y = 0; y < gridSize.y; y++) {
      for (let z = 0; z < gridSize.z; z++) {
        availablePositions.push({ x, y, z });
      }
    }
  }

  // Shuffle availablePositions
  for (let i = availablePositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = availablePositions[i];
    availablePositions[i] = availablePositions[j];
    availablePositions[j] = temp;
  }

  // Build cube map
  const cubes = new Map<string, MovableCube>();
  const targetCount = Math.min(cubeCount, availablePositions.length);
  for (let i = 0; i < targetCount; i++) {
    const color = allowedColors[Math.floor(Math.random() * allowedColors.length)];
    const cubeId = `cube_${i + 1}`;
    const cube: MovableCube = {
      id: cubeId,
      color,
      icons: ['dot', 'dot', 'dot', 'dot', 'dot', 'dot'],
      position: { ...availablePositions[i] },
      isLocked: false,
      socketId: null,
    };
    cubes.set(cubeId, cube);
    grid.setCell(cube.position, {
      type: 'movable',
      cubeId,
      socketId: null,
    });
  }

  const state: GameState = {
    levelId,
    gridSize,
    grid: gridMap,
    cubes,
    sockets,
    blockers,
    gravity: { ...def.initialGravity },
    orientationMatrix: cloneMatrix(IDENTITY),
    moveCount: 0,
    lockedCount: 0,
    totalRequired: 0,
    isComplete: false,
  };

  return { state, grid };
}


