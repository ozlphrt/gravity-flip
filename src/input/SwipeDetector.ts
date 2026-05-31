// ============================================================
// SwipeDetector — touch & mouse gesture + tap + press-and-hold preview
// ============================================================
import type { SwipeDirection } from '../core/types';

const MIN_SWIPE_PX = 30;
const MAX_TAP_DURATION_MS = 300;
const MAX_TAP_MOVE_PX = 15;
const HOLD_THRESHOLD_MS = 300;

export class SwipeDetector {
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private active = false;
  private element: HTMLElement;

  private swipeCallbacks: ((dir: SwipeDirection) => void)[] = [];
  private previewStartCallbacks: ((dir: SwipeDirection) => void)[] = [];
  private previewEndCallbacks: (() => void)[] = [];

  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private isPreviewActive = false;

  constructor(element: HTMLElement) {
    this.element = element;

    // Use pointer events for unified touch and mouse support
    element.addEventListener('pointerdown', this.onPointerDown.bind(this));
    element.addEventListener('pointermove', this.onPointerMove.bind(this));
    element.addEventListener('pointerup', this.onPointerUp.bind(this));
    element.addEventListener('pointercancel', this.onPointerCancel.bind(this));

    // Disable context menu on canvas to avoid holding triggering browser right-click popup
    element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onSwipe(cb: (dir: SwipeDirection) => void): void {
    this.swipeCallbacks.push(cb);
  }

  onPreviewStart(cb: (dir: SwipeDirection) => void): void {
    this.previewStartCallbacks.push(cb);
  }

  onPreviewEnd(cb: () => void): void {
    this.previewEndCallbacks.push(cb);
  }

  private getDirectionFromPos(clientX: number, clientY: number): SwipeDirection {
    const rect = this.element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = clientX - cx;
    const dy = clientY - cy;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'down' : 'up';
    }
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return; // only left click / primary touch
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startTime = Date.now();
    this.active = true;
    this.isPreviewActive = false;

    try {
      this.element.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    // Set hold timer for preview (Q5 decision)
    this.holdTimer = setTimeout(() => {
      if (this.active) {
        this.isPreviewActive = true;
        const dir = this.getDirectionFromPos(e.clientX, e.clientY);
        this.previewStartCallbacks.forEach(cb => cb(dir));
      }
    }, HOLD_THRESHOLD_MS);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.active) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const distSq = dx * dx + dy * dy;

    // If moved too far during hold timer, cancel hold to prevent preview triggering on dynamic swipe
    if (distSq > MAX_TAP_MOVE_PX * MAX_TAP_MOVE_PX && this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    // If preview is already active, dynamically update preview direction if they move cursor
    if (this.isPreviewActive) {
      const dir = this.getDirectionFromPos(e.clientX, e.clientY);
      this.previewStartCallbacks.forEach(cb => cb(dir));
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.active) return;
    this.active = false;

    try {
      this.element.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    // Clear active preview
    if (this.isPreviewActive) {
      this.previewEndCallbacks.forEach(cb => cb());
    }

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const duration = Date.now() - this.startTime;
    const distSq = dx * dx + dy * dy;

    // 1. Check if tap rotation
    if (duration < MAX_TAP_DURATION_MS && distSq < MAX_TAP_MOVE_PX * MAX_TAP_MOVE_PX) {
      const dir = this.getDirectionFromPos(e.clientX, e.clientY);
      this.swipeCallbacks.forEach(cb => cb(dir));
      return;
    }

    // 2. Check if hold execution
    if (this.isPreviewActive) {
      const dir = this.getDirectionFromPos(e.clientX, e.clientY);
      this.swipeCallbacks.forEach(cb => cb(dir));
      return;
    }

    // 3. Check if swipe rotation
    if (Math.abs(dx) < MIN_SWIPE_PX && Math.abs(dy) < MIN_SWIPE_PX) return;

    let dir: SwipeDirection;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? 'right' : 'left';
    } else {
      dir = dy > 0 ? 'down' : 'up';
    }

    this.swipeCallbacks.forEach(cb => cb(dir));
  }

  private onPointerCancel(e: PointerEvent): void {
    this.active = false;
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    if (this.isPreviewActive) {
      this.previewEndCallbacks.forEach(cb => cb());
    }
    try {
      this.element.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }
}
