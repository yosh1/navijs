import type { GuideEvents } from "./types.js";

export type EventName = keyof GuideEvents;

type Handler<E extends EventName> = GuideEvents[E];

export class EventEmitter {
  private readonly handlers = new Map<EventName, Set<(...args: unknown[]) => void>>();

  on<E extends EventName>(event: E, handler: Handler<E>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (...args: unknown[]) => void);
    return () => this.off(event, handler);
  }

  off<E extends EventName>(event: E, handler: Handler<E>): void {
    this.handlers.get(event)?.delete(handler as (...args: unknown[]) => void);
  }

  emit<E extends EventName>(event: E, ...args: Parameters<Handler<E>>): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) {
      try {
        h(...args);
      } catch (err) {
        // Don't let user handlers break the controller.
        console.error("[navijs] event handler threw:", err);
      }
    }
  }
}
