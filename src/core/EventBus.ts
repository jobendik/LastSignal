/**
 * Lightweight publish/subscribe bus. Used to decouple UI from game systems.
 */
export type EventHandler<T> = (payload: T) => void;
export interface GameEventMap {
  "credits:changed": number;
  "tower:built": unknown;
  "tower:sold": unknown;
  "tower:selected": unknown;
  "tower:upgraded": unknown;
  "tower:specialized": unknown;
  "game:over": void;
  "game:victory": void;
  "sector:started": unknown;
  "speed:changed": unknown;
  "ui:esc": void;
  "ui:cleared": void;
}

export class EventBus {
  private listeners = new Map<string, Set<EventHandler<unknown>>>();

  on<K extends keyof GameEventMap>(event: K, handler: EventHandler<GameEventMap[K]>): () => void;
  on<T>(event: string, handler: EventHandler<T>): () => void;
  on<T>(event: string, handler: EventHandler<T>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => this.off(event, handler);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<K extends keyof GameEventMap>(event: K, payload?: GameEventMap[K]): void;
  emit<T>(event: string, payload?: T): void;
  emit<T>(event: string, payload?: T): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const h of set) (h as EventHandler<T | undefined>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
