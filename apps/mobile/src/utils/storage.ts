const memoryStorage = new Map<string, string>()

type LocalStorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function getLocalStorage(): LocalStorageLike | null {
  const candidate = (globalThis as typeof globalThis & { localStorage?: LocalStorageLike }).localStorage
  return candidate ?? null
}

export const storage = {
  getItem(key: string): string | null {
    const backend = getLocalStorage()
    if (backend) return backend.getItem(key)
    return memoryStorage.get(key) ?? null
  },
  setItem(key: string, value: string): void {
    const backend = getLocalStorage()
    if (backend) {
      backend.setItem(key, value)
      return
    }
    memoryStorage.set(key, value)
  },
  removeItem(key: string): void {
    const backend = getLocalStorage()
    if (backend) {
      backend.removeItem(key)
      return
    }
    memoryStorage.delete(key)
  },
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = storage.getItem(key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON<T>(key: string, value: T): void {
  storage.setItem(key, JSON.stringify(value))
}
