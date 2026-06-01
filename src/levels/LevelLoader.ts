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

const LEVEL_REGISTRY: Record<string, LevelDefinition> = {};
export const LEVEL_ORDER: string[] = [];

// Programmatically register levels 1 to 50
for (let i = 1; i <= 50; i++) {
  const pad = String(i).padStart(3, '0');
  const levelId = `level_${pad}`;
  LEVEL_ORDER.push(levelId);

  // Assign original definitions to 1-6, fallback template definition to others
  if (i === 1) LEVEL_REGISTRY[levelId] = level001 as LevelDefinition;
  else if (i === 2) LEVEL_REGISTRY[levelId] = level002 as LevelDefinition;
  else if (i === 3) LEVEL_REGISTRY[levelId] = level003 as LevelDefinition;
  else if (i === 4) LEVEL_REGISTRY[levelId] = level004 as LevelDefinition;
  else if (i === 5) LEVEL_REGISTRY[levelId] = level005 as LevelDefinition;
  else if (i === 6) LEVEL_REGISTRY[levelId] = level006 as LevelDefinition;
  else {
    LEVEL_REGISTRY[levelId] = level001 as LevelDefinition;
  }
}

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
    // Ultimate relaxing victory lap: 4x4x4 grid, 3 colors, 24 cubes!
    gridSize = { x: 4, y: 4, z: 4 };
    allowedColors = ['red', 'blue', 'yellow'];
    cubeCount = 24;
  } else {
    // Levels 11 to 50 - procedural generation
    const levelNum = parseInt(levelId.replace('level_', ''), 10);
    
    // Grid size, color variety, and cube count progression:
    if (levelNum === 50) {
      // Grand finale: massive 5x5x5, all 6 colors, very satisfying density!
      gridSize = { x: 5, y: 5, z: 5 };
      allowedColors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
      cubeCount = 72;
    } else if (levelNum % 10 === 0) {
      // Relaxing victory lap every 10 levels (levels 20, 30, 40)
      gridSize = { x: 4, y: 4, z: 4 };
      const maxColors = Math.min(3 + Math.floor(levelNum / 20), 5);
      allowedColors = ['red', 'blue', 'yellow', 'green', 'orange'].slice(0, maxColors) as Color[];
      cubeCount = 24 + Math.floor(levelNum / 5);
    } else if (levelNum < 15) {
      // Levels 11-14: stepping stones introducing standard 4x4x4 and 5x5x5 mixes
      gridSize = (levelNum % 2 === 0) ? { x: 5, y: 5, z: 5 } : { x: 4, y: 4, z: 4 };
      allowedColors = ['red', 'blue', 'yellow', 'green'];
      cubeCount = (gridSize.x === 4) ? 22 : 30;
    } else if (levelNum < 20) {
      // Levels 15-19: intro to orange & purple gravity weights
      gridSize = { x: 4, y: 4, z: 4 };
      allowedColors = ['red', 'blue', 'yellow', 'orange', 'purple'];
      cubeCount = 28;
    } else if (levelNum < 30) {
      // Levels 21-29: 5x5x5 challenges with 4-5 colors
      gridSize = { x: 5, y: 5, z: 5 };
      const sliceEnd = Math.min(4 + (levelNum % 2), 6);
      allowedColors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'].slice(0, sliceEnd) as Color[];
      cubeCount = 36 + (levelNum - 20) * 2;
    } else if (levelNum < 40) {
      // Levels 31-39: introduce the giant 6x6x6 grid!
      if (levelNum % 3 === 0) {
        gridSize = { x: 6, y: 6, z: 6 };
        allowedColors = ['red', 'blue', 'yellow', 'green', 'purple'];
        cubeCount = 70;
      } else {
        gridSize = { x: 5, y: 5, z: 5 };
        allowedColors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
        cubeCount = 48 + (levelNum - 30) * 2;
      }
    } else {
      // Levels 41-49: ultimate high-level challenges
      if (levelNum % 2 === 0) {
        gridSize = { x: 6, y: 6, z: 6 };
        allowedColors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
        cubeCount = 80;
      } else {
        gridSize = { x: 5, y: 5, z: 5 };
        allowedColors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
        cubeCount = 62;
      }
    }
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


