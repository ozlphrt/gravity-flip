// ============================================================
// MovementResolver — farthest-first deterministic slide
// ============================================================
import type { GameState, Vec3, SlidePayload, GravityDir } from './types';
import { Grid, addVec, eqVec } from './Grid';
import { gravityStep, gravityCoord } from './GravitySystem';

/**
 * Compute the final position of a cube sliding along gravity.
 * Uses the live grid to detect blocking cells.
 * Cubes that have been moved earlier in the resolution pass
 * are already updated in the grid, so they correctly block later cubes.
 */
function computeFinalPos(
  startPos: Vec3,
  grid: Grid,
  gravity: GravityDir
): Vec3 {
  const step = gravityStep(gravity);
  let pos = { ...startPos };

  while (true) {
    const next = addVec(pos, step);
    // Stop if next cell is out of bounds or occupied/blocking
    if (grid.isBlocking(next)) break;
    pos = next;
  }

  return pos;
}

/**
 * Resolve all cube slides after a gravity change.
 * Mutates the GameState in-place.
 * Returns the list of slide payloads for animation.
 *
 * Algorithm: farthest-first
 *   1. Collect all unlocked movable cubes.
 *   2. Sort by their coordinate along gravity direction (highest = farthest → first).
 *   3. For each cube: compute final position using current grid state.
 *   4. Update grid and cube position immediately (so subsequent cubes see settled ones).
 */
export function resolveSlides(
  state: GameState,
  grid: Grid
): SlidePayload[] {
  const slides: SlidePayload[] = [];

  // 1. Collect movable (not locked) cubes
  const movableCubes = Array.from(state.cubes.values()).filter(c => !c.isLocked);

  // 2. Sort farthest-first along gravity axis
  //    gravityCoord returns sign * coord[axis], so higher = closer to gravity wall
  const sorted = movableCubes.sort(
    (a, b) => gravityCoord(b.position, state.gravity) - gravityCoord(a.position, state.gravity)
  );

  // 3 & 4. Process each cube
  for (const cube of sorted) {
    const finalPos = computeFinalPos(cube.position, grid, state.gravity);

    if (!eqVec(cube.position, finalPos)) {
      slides.push({ cubeId: cube.id, from: { ...cube.position }, to: { ...finalPos } });

      // Update grid: clear old cell, mark new cell
      grid.clearCube(cube.position);
      const destCell = grid.getCell(finalPos);
      grid.setCell(finalPos, {
        type: 'movable',
        cubeId: cube.id,
        socketId: destCell.socketId, // preserve socket info if present
      });

      // Update cube position in state
      cube.position = finalPos;
    }
  }

  return slides;
}

/**
 * Preview: compute where each unlocked cube would slide to
 * WITHOUT mutating state or grid. Used for ghost-cube display.
 */
export function previewSlides(
  state: GameState,
  grid: Grid,
  gravity: GravityDir
): SlidePayload[] {
  // Build a temporary grid copy for simulation
  const tempCells = grid.cloneCells();
  const tempGrid = new Grid(grid.size, tempCells);
  const previews: SlidePayload[] = [];

  const movableCubes = Array.from(state.cubes.values()).filter(c => !c.isLocked);
  const sorted = movableCubes.sort(
    (a, b) => gravityCoord(b.position, gravity) - gravityCoord(a.position, gravity)
  );

  for (const cube of sorted) {
    const finalPos = computeFinalPos(cube.position, tempGrid, gravity);
    if (!eqVec(cube.position, finalPos)) {
      previews.push({ cubeId: cube.id, from: { ...cube.position }, to: { ...finalPos } });
      tempGrid.clearCube(cube.position);
      const destCell = tempGrid.getCell(finalPos);
      tempGrid.setCell(finalPos, {
        type: 'movable',
        cubeId: cube.id,
        socketId: destCell.socketId,
      });
    }
  }

  return previews;
}
