/**
 * In-process project-scoped pub/sub for dashboard live updates.
 *
 * Limitation: events are delivered only within a single API process.
 * Multiple API replicas will not share subscriptions until a distributed
 * backend replaces this implementation.
 */
export type ProjectEventType = "trace.created";

export interface ProjectEvent {
  readonly type: ProjectEventType;
  readonly projectId: string;
  readonly agentId: string;
  readonly eventId: string;
  readonly occurredAt: string;
}

export type ProjectEventListener = (event: ProjectEvent) => void;

export interface ProjectEventBus {
  publish(projectId: string, event: ProjectEvent): void;
  subscribe(projectId: string, listener: ProjectEventListener): () => void;
  listenerCount(projectId?: string): number;
}

export class InMemoryProjectEventBus implements ProjectEventBus {
  private readonly listeners = new Map<string, Set<ProjectEventListener>>();

  publish(projectId: string, event: ProjectEvent): void {
    const set = this.listeners.get(projectId);
    if (!set || set.size === 0) return;
    for (const listener of set) {
      try {
        listener(event);
      } catch {
        // Listener failures must not break publishers.
      }
    }
  }

  subscribe(projectId: string, listener: ProjectEventListener): () => void {
    let set = this.listeners.get(projectId);
    if (!set) {
      set = new Set();
      this.listeners.set(projectId, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) {
        this.listeners.delete(projectId);
      }
    };
  }

  listenerCount(projectId?: string): number {
    if (projectId !== undefined) {
      return this.listeners.get(projectId)?.size ?? 0;
    }
    let total = 0;
    for (const set of this.listeners.values()) {
      total += set.size;
    }
    return total;
  }
}

/** Shared default bus for the API process. Tests may inject a fresh instance. */
export const defaultProjectEventBus = new InMemoryProjectEventBus();
