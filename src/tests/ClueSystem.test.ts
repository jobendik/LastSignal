import { describe, it, expect, beforeEach } from 'vitest';
import { ClueSystem } from '../game/clues/ClueSystem';
import { CLUES } from '../data/clues';

describe('ClueSystem', () => {
  let clues: ClueSystem;
  beforeEach(() => { clues = new ClueSystem(); });

  it('starts empty', () => {
    expect(clues.list()).toHaveLength(0);
    expect(clues.has('clue-field-log')).toBe(false);
  });

  it('discover() returns the clue on first call and null on subsequent calls', () => {
    const first = clues.discover('clue-field-log');
    expect(first).not.toBeNull();
    expect(first!.id).toBe('clue-field-log');
    expect(clues.has('clue-field-log')).toBe(true);

    const second = clues.discover('clue-field-log');
    expect(second).toBeNull(); // already discovered
    expect(clues.list()).toHaveLength(1);
  });

  it('discover() returns null for unknown ids', () => {
    expect(clues.discover('non-existent-clue')).toBeNull();
    expect(clues.list()).toHaveLength(0);
  });

  it('serialize/restore round-trips', () => {
    for (const c of CLUES.slice(0, 3)) clues.discover(c.id);
    const ids = clues.serialize();
    expect(ids).toHaveLength(3);

    const other = new ClueSystem();
    other.restore(ids);
    expect(other.list().map(c => c.id).sort()).toEqual(ids.slice().sort());
  });

  it('restore() ignores unknown clue ids', () => {
    clues.restore(['clue-field-log', 'no-such-clue']);
    expect(clues.list()).toHaveLength(1);
  });

  it('clear() empties state', () => {
    clues.discover('clue-field-log');
    clues.clear();
    expect(clues.list()).toHaveLength(0);
  });
});
