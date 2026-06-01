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
  level_007: level001 as LevelDefinition,
  level_008: level001 as LevelDefinition,
  level_009: level001 as LevelDefinition,
  level_010: level001 as LevelDefinition,
};

export const LEVEL_ORDER = [
  'level_001', 'level_002', 'level_003',
  'level_004', 'level_005', 'level_006',
  'level_007', 'level_008', 'level_009',
  'level_010'
];

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

  // Determine grid size and parameters based on level progression
  let gridSize = { x: 5, y: 5, z: 5 };
  let allowedColors: Color[] = ['red', 'blue'];
  let cubeCount = 20;

  if (levelId === 'level_001') {
    // 3x3x3 grid, 2 colors (Red/Blue), extremely gentle start
    gridSize = { x: 3, y: 3, z: 3 };
    allowedColors = ['red', 'blue'];
    cubeCount = 4;
  } else if (levelId === 'level_002') {
    // 3x3x3 grid, 2 colors, slightly denser cubes
    gridSize = { x: 3, y: 3, z: 3 };
    allowedColors = ['red', 'blue'];
    cubeCount = 6;
  } else if (levelId === 'level_003') {
    // 3x3x3 grid, 3 colors (Red/Blue/Yellow)
    gridSize = { x: 3, y: 3, z: 3 };
    allowedColors = ['red', 'blue', 'yellow'];
    cubeCount = 8;
  } else if (levelId === 'level_004') {
    // 4x4x4 grid, 2 colors
    gridSize = { x: 4, y: 4, z: 4 };
    allowedColors = ['red', 'blue'];
    cubeCount = 10;
  } else if (levelId === 'level_005') {
    // 4x4x4 grid, 3 colors
    gridSize = { x: 4, y: 4, z: 4 };
    allowedColors = ['red', 'blue', 'yellow'];
    cubeCount = 16;
  } else if (levelId === 'level_006') {
    // 4x4x4 grid, 4 colors (Red/Blue/Yellow/Green)
    gridSize = { x: 4, y: 4, z: 4 };
    allowedColors = ['red', 'blue', 'yellow', 'green'];
    cubeCount = 24;
  } else if (levelId === 'level_007') {
    // 5x5x5 grid, 2 colors
    gridSize = { x: 5, y: 5, z: 5 };
    allowedColors = ['red', 'blue'];
    cubeCount = 20;
  } else if (levelId === 'level_008') {
    // 5x5x5 grid, 3 colors
    gridSize = { x: 5, y: 5, z: 5 };
    allowedColors = ['red', 'blue', 'yellow'];
    cubeCount = 35;
  } else if (levelId === 'level_009') {
    // 5x5x5 grid, 4 colors
    gridSize = { x: 5, y: 5, z: 5 };
    allowedColors = ['red', 'blue', 'yellow', 'green'];
    cubeCount = 48;
  } else if (levelId === 'level_010') {
    // Mega sandbox level: 6x6x6 grid with all 6 desaturated colors!
    gridSize = { x: 6, y: 6, z: 6 };
    allowedColors = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'];
    cubeCount = 90;
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
    allowedColors,
  };

  return { state, grid };
}


