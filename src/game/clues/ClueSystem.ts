import { CLUE_BY_ID } from '../../data/clues';
import type { ClueData } from '../../core/Types';
import { Events } from '../../core/Events';

/**
 * ClueSystem — tracks which clues have been discovered and emits events
 * for UI notifications, the notebook, and the puzzle resolver. Discovery
 * is idempotent; the same clue only fires once.
 */
export class ClueSystem {
  private readonly discovered = new Set<string>();

  discover(id: string): ClueData | null {
    if (this.discovered.has(id)) return null;
    const clue = CLUE_BY_ID.get(id);
    if (!clue) return null;
    this.discovered.add(id);
    Events.emit('clue:discovered', {
      id: clue.id, title: clue.title, description: clue.description, source: clue.source,
    });
    return clue;
  }

  has(id: string): boolean { return this.discovered.has(id); }

  list(): ClueData[] {
    return Array.from(this.discovered)
      .map(id => CLUE_BY_ID.get(id))
      .filter((c): c is ClueData => !!c);
  }

  serialize(): string[] { return Array.from(this.discovered); }

  restore(ids: readonly string[]): void {
    this.discovered.clear();
    for (const id of ids) if (CLUE_BY_ID.has(id)) this.discovered.add(id);
  }

  clear(): void { this.discovered.clear(); }
}
