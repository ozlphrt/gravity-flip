// ============================================================
// SocketSystem — lock detection and win condition
// ============================================================
import type { GameState, LockPayload } from './types';
import { Grid } from './Grid';

/**
 * After resolveSlides(), check every unlocked cube.
 * If a cube is resting on a matching socket → lock it.
 * Mutates GameState in-place.
 * Returns list of lock events for animation.
 */
export function resolveSocketLocks(
  state: GameState,
  grid: Grid
): LockPayload[] {
  const locks: LockPayload[] = [];

  for (const cube of state.cubes.values()) {
    if (cube.isLocked) continue;

    const cell = grid.getCell(cube.position);
    if (!cell.socketId) continue;

    const socket = state.sockets.get(cell.socketId);
    if (!socket) continue;
    if (socket.requiredColor !== cube.color) continue;
    if (socket.isOccupied) continue;

    // Lock the cube into this socket
    cube.isLocked = true;
    cube.socketId = socket.id;
    socket.isOccupied = true;
    socket.occupiedByCubeId = cube.id;
    state.lockedCount++;

    // Update grid cell to locked type
    grid.setCell(cube.position, {
      type: 'locked',
      cubeId: cube.id,
      socketId: socket.id,
    });

    locks.push({ cubeId: cube.id, position: { ...cube.position } });
  }

  return locks;
}

/**
 * Check if the level is won.
 * All required sockets must be occupied.
 */
export function checkWinCondition(state: GameState): boolean {
  if (state.totalRequired === 0) return false; // Sandbox mode has no win condition
  if (state.lockedCount >= state.totalRequired) {
    // Extra safety: verify all sockets are occupied
    let allFilled = true;
    for (const socket of state.sockets.values()) {
      if (!socket.isOccupied) {
        allFilled = false;
        break;
      }
    }
    return allFilled;
  }
  return false;
}

/**
 * Rebuild socket occupancy state from cube data.
 * Used after undo to ensure socket and cube states are in sync.
 */
export function rebuildSocketState(state: GameState, grid: Grid): void {
  // Clear all socket occupancy
  for (const socket of state.sockets.values()) {
    socket.isOccupied = false;
    socket.occupiedByCubeId = null;
  }

  state.lockedCount = 0;

  // Re-scan locked cubes
  for (const cube of state.cubes.values()) {
    if (cube.isLocked && cube.socketId) {
      const socket = state.sockets.get(cube.socketId);
      if (socket) {
        socket.isOccupied = true;
        socket.occupiedByCubeId = cube.id;
        state.lockedCount++;
      }

      // Ensure grid cell is correctly typed
      grid.setCell(cube.position, {
        type: 'locked',
        cubeId: cube.id,
        socketId: cube.socketId,
      });
    } else if (!cube.isLocked) {
      // Ensure unlocked cubes are correctly typed in grid
      const cell = grid.getCell(cube.position);
      grid.setCell(cube.position, {
        type: 'movable',
        cubeId: cube.id,
        socketId: cell.socketId, // preserve socket overlay if any
      });
    }
  }
}
