// ============================================================
// ProgressManager — LocalStorage save/load
// ============================================================
const KEY = 'gfc_progress';

interface LevelProgress {
  bestMoves: number;
  stars: number;
  completed: boolean;
}

interface SaveData {
  levels: Record<string, LevelProgress>;
  currentLevel: string;
}

function defaultSave(): SaveData {
  return { levels: {}, currentLevel: 'level_001' };
}

export class ProgressManager {
  private data: SaveData;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      this.data = raw ? JSON.parse(raw) : defaultSave();
    } catch {
      this.data = defaultSave();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch { /* ignore quota errors */ }
  }

  isCompleted(levelId: string): boolean {
    return this.data.levels[levelId]?.completed ?? false;
  }

  getStars(levelId: string): number {
    return this.data.levels[levelId]?.stars ?? 0;
  }

  getBestMoves(levelId: string): number {
    return this.data.levels[levelId]?.bestMoves ?? Infinity;
  }

  recordCompletion(levelId: string, moves: number, optimalMoves: number): number {
    const existing = this.data.levels[levelId];
    const bestMoves = existing ? Math.min(existing.bestMoves, moves) : moves;
    const stars = moves <= optimalMoves ? 3 : moves <= optimalMoves * 2 ? 2 : 1;

    this.data.levels[levelId] = {
      completed: true,
      bestMoves,
      stars: Math.max(existing?.stars ?? 0, stars),
    };
    this.save();
    return stars;
  }

  setCurrentLevel(levelId: string): void {
    this.data.currentLevel = levelId;
    this.save();
  }

  getCurrentLevel(): string {
    return this.data.currentLevel || 'level_001';
  }

  reset(): void {
    this.data = defaultSave();
    this.save();
  }
}
