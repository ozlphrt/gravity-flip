// ============================================================
// GravitySystem — cube-relative rotation (Q3 decision)
//
// The outer cube has a cumulative orientation tracked as a
// 3×3 integer rotation matrix (entries: -1, 0, 1).
//
// Cube-relative rotation means each swipe rotates around the
// cube's current local X or Y axis, not world axes.
//
// Gravity direction = orientationMatrix × initialGravityVector
// ============================================================
import type { GravityDir, AxisSign, RotMat3, SwipeDirection, Vec3 } from './types';

// Identity matrix
export const IDENTITY: RotMat3 = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
];

// ── 3×3 matrix helpers ────────────────────────────────────

/** Multiply two 3×3 matrices (row-major) */
export function matMul(A: RotMat3, B: RotMat3): RotMat3 {
  const result = new Array(9).fill(0) as RotMat3;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += A[row * 3 + k] * B[k * 3 + col];
      }
      result[row * 3 + col] = sum;
    }
  }
  return result;
}

/** Apply rotation matrix to an integer Vec3 */
export function matVec(M: RotMat3, v: Vec3): Vec3 {
  return {
    x: M[0] * v.x + M[1] * v.y + M[2] * v.z,
    y: M[3] * v.x + M[4] * v.y + M[5] * v.z,
    z: M[6] * v.x + M[7] * v.y + M[8] * v.z,
  };
}

export function cloneMatrix(M: RotMat3): RotMat3 {
  return [...M] as RotMat3;
}

// ── Basic 90° rotation matrices ───────────────────────────
// These are the four local-axis rotations available to the player.
// They are applied in the cube's LOCAL frame (Q3: cube-relative).
//
// Naming: "around local +Y by -90°" = looks like tilting the top toward you
//
// Right-handed coordinate system, Y-up:
//   Rotate +90° around X:  Y→-Z, Z→+Y
//   Rotate -90° around X:  Y→+Z, Z→-Y
//   Rotate +90° around Y:  Z→-X, X→+Z
//   Rotate -90° around Y:  Z→+X, X→-Z

// Swipe RIGHT → cube's top tilts right → rotate around local +Y by -90°
const R_RIGHT: RotMat3 = [
   0, 0, 1,
   0, 1, 0,
  -1, 0, 0,
];

// Swipe LEFT → rotate around local +Y by +90°
const R_LEFT: RotMat3 = [
  0, 0, -1,
  0, 1,  0,
  1, 0,  0,
];

// Swipe UP → cube's top tilts away (backward) → rotate around local +X by +90°
const R_UP: RotMat3 = [
  1,  0, 0,
  0,  0, 1,
  0, -1, 0,
];

// Swipe DOWN → cube's top tilts toward player → rotate around local +X by -90°
const R_DOWN: RotMat3 = [
  1, 0,  0,
  0, 0, -1,
  0, 1,  0,
];

const LOCAL_ROTATIONS: Record<SwipeDirection, RotMat3> = {
  right: R_RIGHT,
  left:  R_LEFT,
  up:    R_UP,
  down:  R_DOWN,
};

// ── GravitySystem ─────────────────────────────────────────

/**
 * Convert a GravityDir to an integer unit Vec3.
 * e.g. { axis:'y', sign:-1 } → { x:0, y:-1, z:0 }
 */
export function gravityToVec(g: GravityDir): Vec3 {
  return {
    x: g.axis === 'x' ? g.sign : 0,
    y: g.axis === 'y' ? g.sign : 0,
    z: g.axis === 'z' ? g.sign : 0,
  };
}

/**
 * Convert a unit Vec3 back to GravityDir.
 * Exactly one component must be ±1, others 0.
 */
export function vecToGravity(v: Vec3): GravityDir {
  if (v.x !== 0) return { axis: 'x', sign: v.x as AxisSign };
  if (v.y !== 0) return { axis: 'y', sign: v.y as AxisSign };
  return { axis: 'z', sign: v.z as AxisSign };
}

/**
 * Apply a player swipe to the current orientation matrix.
 *
 * Cube-relative: the local rotation matrix is composed on the RIGHT.
 *   newOrientation = currentOrientation × localRotation
 *
 * This means each swipe is interpreted in the cube's current local frame.
 */
export function applySwipeToOrientation(
  current: RotMat3,
  direction: SwipeDirection
): RotMat3 {
  const localRot = LOCAL_ROTATIONS[direction];
  return matMul(localRot, current);
}

/**
 * Compute the current world-space gravity direction given:
 * - the cumulative orientation matrix
 * - the level's initial gravity direction
 *
 * The "floor" of the cube in world space = where gravity points.
 * As the cube rotates, gravity rotates with it.
 */
export function computeGravity(
  orientation: RotMat3,
  initialGravity: GravityDir
): GravityDir {
  const initVec = gravityToVec(initialGravity);
  // Screen-relative: local gravity = R^T * world_gravity (where initialGravity represents the fixed world gravity, always down)
  const newVec = matVec(matTranspose(orientation), initVec);
  return vecToGravity(newVec);
}

/**
 * Get the unit step vector for sliding along current gravity.
 * e.g. gravity { axis:'y', sign:-1 } → step { x:0, y:-1, z:0 }
 */
export function gravityStep(g: GravityDir): Vec3 {
  return gravityToVec(g);
}

/**
 * For sorting cubes in farthest-first order:
 * Returns the scalar coordinate of a Vec3 along the gravity axis.
 * Cubes with HIGHER values along the gravity direction should be
 * processed first (they are closest to the gravity wall).
 */
export function gravityCoord(v: Vec3, g: GravityDir): number {
  return v[g.axis] * g.sign;
}

/** Inverse of a 3×3 integer rotation matrix (= transpose for orthogonal matrices) */
export function matTranspose(M: RotMat3): RotMat3 {
  return [
    M[0], M[3], M[6],
    M[1], M[4], M[7],
    M[2], M[5], M[8],
  ];
}
