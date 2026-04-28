import { describe, it, expect } from 'vitest';
import { Config } from '../app/config';

describe('Puzzle code derivation', () => {
  it('code matches tape digits A-B-C', () => {
    const { tapeDigits, code } = Config.puzzle;
    expect(code).toHaveLength(3);
    expect(code[0]).toBe(tapeDigits.A.toString());
    expect(code[1]).toBe(tapeDigits.B.toString());
    expect(code[2]).toBe(tapeDigits.C.toString());
  });

  it('tape digits are valid single digits 0-9', () => {
    const { A, B, C } = Config.puzzle.tapeDigits;
    for (const d of [A, B, C]) {
      expect(Number.isInteger(d)).toBe(true);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(9);
    }
  });
});
