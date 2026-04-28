import { describe, it, expect } from 'vitest';
import { EventBus } from '../core/EventBus';

interface TestMap extends Record<string, unknown> {
  'a': { n: number };
  'b': string;
}

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus<TestMap>();
    let received: number | null = null;
    bus.on('a', (p) => { received = p.n; });
    bus.emit('a', { n: 42 });
    expect(received).toBe(42);
  });

  it('off() prevents further delivery', () => {
    const bus = new EventBus<TestMap>();
    let count = 0;
    const handler = (): void => { count++; };
    bus.on('a', handler);
    bus.emit('a', { n: 1 });
    bus.off('a', handler);
    bus.emit('a', { n: 1 });
    expect(count).toBe(1);
  });

  it('once() only fires a single time', () => {
    const bus = new EventBus<TestMap>();
    let count = 0;
    bus.once('b', () => { count++; });
    bus.emit('b', 'x');
    bus.emit('b', 'y');
    expect(count).toBe(1);
  });

  it('continues to deliver to remaining listeners if one throws', () => {
    const bus = new EventBus<TestMap>();
    let delivered = 0;
    const err = console.error;
    console.error = (): void => { /* quiet */ };
    try {
      bus.on('a', () => { throw new Error('boom'); });
      bus.on('a', () => { delivered++; });
      bus.emit('a', { n: 0 });
    } finally {
      console.error = err;
    }
    expect(delivered).toBe(1);
  });

  it('unsubscribing during emit does not skip listeners', () => {
    const bus = new EventBus<TestMap>();
    const order: string[] = [];
    const h1 = (): void => { order.push('1'); bus.off('a', h1); };
    const h2 = (): void => { order.push('2'); };
    bus.on('a', h1);
    bus.on('a', h2);
    bus.emit('a', { n: 1 });
    expect(order).toEqual(['1', '2']);
    // Second emit should only hit h2
    bus.emit('a', { n: 2 });
    expect(order).toEqual(['1', '2', '2']);
  });
});
