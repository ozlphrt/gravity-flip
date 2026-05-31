// ============================================================
// ButtonController — HUD action buttons (undo, restart)
// ============================================================

export class ButtonController {
  private undoCallbacks: (() => void)[] = [];
  private restartCallbacks: (() => void)[] = [];

  bindButtons(ids: { undo: string; restart: string }): void {
    const undoEl = document.getElementById(ids.undo);
    const restartEl = document.getElementById(ids.restart);
    undoEl?.addEventListener('click', () => this.undoCallbacks.forEach(cb => cb()));
    restartEl?.addEventListener('click', () => this.restartCallbacks.forEach(cb => cb()));
  }

  onUndo(cb: () => void): void { this.undoCallbacks.push(cb); }
  onRestart(cb: () => void): void { this.restartCallbacks.push(cb); }
}
