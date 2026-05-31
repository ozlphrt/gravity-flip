// ============================================================
// MatchSystem — 3D flood-fill cluster match-3 resolver
// ============================================================
import type { GameState, Vec3, Color } from './types';
import { Grid, addVec } from './Grid';

export interface PopPayload {
  cubeId: string;
  color: Color;
  position: Vec3;
}

const NEIGHBORS: Vec3[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

/**
 * Scan the grid for connected components of same-color cubes of size >= 3.
 * Mutates state and grid in-place to remove popped cubes.
 * Returns the popped cubes' payload for animation.
 */
export function resolveColorMatches(state: GameState, grid: Grid): PopPayload[] {
  const visited = new Set<string>();
  const toPop: string[] = [];
  const poppedPayloads: PopPayload[] = [];

  // Find all movable cubes
  for (const cube of state.cubes.values()) {
    if (cube.isLocked || visited.has(cube.id)) continue;

    // Run BFS to find all connected cubes of the same color
    const cluster: typeof cube[] = [];
    const queue: typeof cube[] = [cube];
    visited.add(cube.id);

    const color = cube.color;

    while (queue.length > 0) {
      const current = queue.shift()!;
      cluster.push(current);

      // Check all 6 face-adjacent neighbors
      for (const offset of NEIGHBORS) {
        const neighborPos = addVec(current.position, offset);
        if (neighborPos.x < 0 || neighborPos.x >= grid.size.x ||
            neighborPos.y < 0 || neighborPos.y >= grid.size.y ||
            neighborPos.z < 0 || neighborPos.z >= grid.size.z) {
          continue;
        }

        const cell = grid.getCell(neighborPos);
        if (cell && cell.type === 'movable' && cell.cubeId) {
          const neighborCube = state.cubes.get(cell.cubeId);
          if (neighborCube && !neighborCube.isLocked && neighborCube.color === color) {
            if (!visited.has(neighborCube.id)) {
              visited.add(neighborCube.id);
              queue.push(neighborCube);
            }
          }
        }
      }
    }

    // If cluster size is 3 or more, pop them!
    if (cluster.length >= 3) {
      for (const popped of cluster) {
        toPop.push(popped.id);
        poppedPayloads.push({
          cubeId: popped.id,
          color: popped.color,
          position: { ...popped.position },
        });
      }
    }
  }

  // Mutate state and grid to remove popped cubes
  for (const id of toPop) {
    const cube = state.cubes.get(id);
    if (cube) {
      grid.clearCube(cube.position);
      state.cubes.delete(id);
    }
  }

  return poppedPayloads;
}
