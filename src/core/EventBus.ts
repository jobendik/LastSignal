/**
 * A tiny typed event bus. Used to decouple game systems.
 *
 * Events are keyed by string; payload shape is resolved from a map type.
 * This keeps subscribers fully type-safe without pulling in a framework.
 */
export type EventMap = Record<string, unknown>;

export type EventHandler<T> = (payload: T) => void;

export class EventBus<TMap extends EventMap = EventMap> {
  private readonly handlers = new Map<keyof TMap, Set<EventHandler<unknown>>>();

  on<K extends keyof TMap>(event: K, handler: EventHandler<TMap[K]>): () => void {
    let bucket = this.handlers.get(event);
    if (!bucket) {
      bucket = new Set();
      this.handlers.set(event, bucket);
    }
    bucket.add(handler as EventHandler<unknown>);
    return () => this.off(event, handler);
  }

  once<K extends keyof TMap>(event: K, handler: EventHandler<TMap[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof TMap>(event: K, handler: EventHandler<TMap[K]>): void {
    const bucket = this.handlers.get(event);
    if (!bucket) return;
    bucket.delete(handler as EventHandler<unknown>);
    if (bucket.size === 0) this.handlers.delete(event);
  }

  emit<K extends keyof TMap>(event: K, payload: TMap[K]): void {
    const bucket = this.handlers.get(event);
    if (!bucket) return;
    // Copy so listeners that unsubscribe mid-emit don't break iteration.
    for (const h of Array.from(bucket)) {
      try {
        (h as EventHandler<TMap[K]>)(payload);
      } catch (err) {
        // Never let one bad listener break the bus.
        // eslint-disable-next-line no-console
        console.error(`[EventBus] handler for "${String(event)}" threw`, err);
      }
    }
  }

  clear(): void { this.handlers.clear(); }
}
