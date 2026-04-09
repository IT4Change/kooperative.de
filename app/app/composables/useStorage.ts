/**
 * Safe localStorage wrapper.
 * Shows a popup when storage is needed but unavailable.
 * Reusable for cart, auth, preferences, etc.
 */

const available = ref<boolean | null>(null) // null = not yet checked
const showWarning = ref(false)

function check(): boolean {
  if (available.value !== null) return available.value
  if (import.meta.server) { available.value = false; return false }
  // The head script sets this flag when localStorage was blocked and replaced with a fallback
  available.value = !(window as any).__storageBlocked
  return available.value
}

/** Require storage — returns true if available, shows popup if not */
function require(): boolean {
  const ok = check()
  if (!ok) showWarning.value = true
  return ok
}

function get(key: string): string | null {
  if (!check()) return null
  try { return localStorage.getItem(key) } catch { return null }
}

function set(key: string, value: string): void {
  if (!check()) return
  try { localStorage.setItem(key, value) } catch {}
}

function remove(key: string): void {
  if (!check()) return
  try { localStorage.removeItem(key) } catch {}
}

function dismissWarning() {
  showWarning.value = false
}

export function useStorage() {
  return {
    available: readonly(available),
    showWarning: readonly(showWarning),
    require,
    check,
    get,
    set,
    remove,
    dismissWarning,
  }
}
