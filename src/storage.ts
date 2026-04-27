import type { GuideState, GuideStorage, StorageKind } from "./types.js";

const STORAGE_PREFIX = "navijs:";
const VERSION = 1;

export function resolveStorage(kind: StorageKind | GuideStorage = "localStorage"): GuideStorage {
  if (typeof kind !== "string") return kind;
  if (kind === "memory") return memoryStorage();
  return localStorageBacked();
}

export function emptyState(guideId: string): GuideState {
  return { guideId, currentStep: 0, completed: false, version: VERSION };
}

function memoryStorage(): GuideStorage {
  const map = new Map<string, GuideState>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, state) => { map.set(key, state); },
    remove: (key) => { map.delete(key); },
  };
}

function localStorageBacked(): GuideStorage {
  return {
    get(key) {
      try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as GuideState;
        if (parsed.version !== VERSION) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    set(key, state) {
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(state));
      } catch {
        // quota / privacy mode — fall through silently
      }
    },
    remove(key) {
      try {
        window.localStorage.removeItem(STORAGE_PREFIX + key);
      } catch {
        // ignore
      }
    },
  };
}
