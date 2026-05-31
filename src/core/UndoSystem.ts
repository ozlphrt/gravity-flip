// ============================================================
// UndoSystem — snapshot-based undo with 20-move cap (Q4)
// ============================================================
import type {
  GameState,
  MoveRecord,
  CubeSnapshot,
  SocketSnapshot,
  RotMat3,
  GravityDir,
  SwipeDirection,
} from './types';
import { cloneMatrix } from './GravitySystem';
import { Grid } from './Grid';
import { rebuildSocketState } from './SocketSystem';

const MAX_UNDO_DEPTH = 20;

export class UndoSystem {
  private history: MoveRecord[] = [];

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  get depth(): number {
    return this.history.length;
  }

  /** Snapshot current state before a move is applied */
  push(
    rotation: SwipeDirection,
    gravityBefore: GravityDir,
    gravityAfter: GravityDir,
    orientationBefore: RotMat3,
    orientationAfter: RotMat3,
    state: GameState
  ): void {
    const cubesBefore: CubeSnapshot[] = Array.from(state.cubes.values()).map(c => ({
      id: c.id,
      position: { ...c.position },
      isLocked: c.isLocked,
      socketId: c.socketId,
    }));

    const socketsBefore: SocketSnapshot[] = Array.from(state.sockets.values()).map(s => ({
      id: s.id,
      isOccupied: s.isOccupied,
      occupiedByCubeId: s.occupiedByCubeId,
    }));

    const record: MoveRecord = {
      rotation,
      gravityBefore,
      gravityAfter,
      orientationBefore: cloneMatrix(orientationBefore),
      orientationAfter: cloneMatrix(orientationAfter),
      cubesBefore,
      socketsBefore,
      lockedCountBefore: state.lockedCount,
      moveCountBefore: state.moveCount,
    };

    this.history.push(record);

    // Q4: Cap at 20 — drop oldest if over limit
    if (this.history.length > MAX_UNDO_DEPTH) {
      this.history.shift();
    }
  }

  /**
   * Pop last record and restore GameState.
   * Rebuilds grid from cube snapshots.
   */
  pop(state: GameState, grid: Grid): MoveRecord | null {
    const record = this.history.pop();
    if (!record) return null;

    // Restore gravity and orientation
    state.gravity = { ...record.gravityBefore };
    state.orientationMatrix = cloneMatrix(record.orientationBefore);

    // Clear all cube cells from grid
    for (const cube of state.cubes.values()) {
      grid.clearCube(cube.position);
    }

    // Restore cube snapshots
    for (const snap of record.cubesBefore) {
      const cube = state.cubes.get(snap.id);
      if (!cube) continue;
      cube.position = { ...snap.position };
      cube.isLocked = snap.isLocked;
      cube.socketId = snap.socketId;

      // Re-place in grid
      const cell = grid.getCell(cube.position);
      grid.setCell(cube.position, {
        type: cube.isLocked ? 'locked' : 'movable',
        cubeId: cube.id,
        socketId: cell.socketId,
      });
    }

    // Restore socket snapshots
    for (const snap of record.socketsBefore) {
      const socket = state.sockets.get(snap.id);
      if (!socket) continue;
      socket.isOccupied = snap.isOccupied;
      socket.occupiedByCubeId = snap.occupiedByCubeId;
    }

    // Restore counts
    state.lockedCount = record.lockedCountBefore;
    state.moveCount = record.moveCountBefore;
    state.isComplete = false;

    // Rebuild socket state for full consistency
    rebuildSocketState(state, grid);

    return record;
  }

  clear(): void {
    this.history = [];
  }
}
