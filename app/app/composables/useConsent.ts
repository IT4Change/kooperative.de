/**
 * Consent for technically necessary cookies / localStorage.
 * Until the user accepts, no cart data may be persisted.
 * The consent flag itself is written via raw localStorage.
 */

// Every key this site writes to localStorage starts with this prefix.
const STORAGE_PREFIX = 'kooperative-'
const CONSENT_KEY = `${STORAGE_PREFIX}consent-v1`

const consentGiven = ref(false)
const showBanner = ref(false)

let initialized = false
let pendingAction: (() => void) | null = null

function init() {
  // import.meta.server is a build-time constant and false in the client build
  // the unit suite runs, so only the `initialized` half is reachable here.
  /* v8 ignore start */
  if (initialized || import.meta.server) return
  /* v8 ignore stop */
  initialized = true
  try {
    consentGiven.value = localStorage.getItem(CONSENT_KEY) === 'true'
  } catch {
    consentGiven.value = false
  }
}

function require(action?: () => void): boolean {
  init()
  if (consentGiven.value) {
    action?.()
    return true
  }
  pendingAction = action ?? null
  showBanner.value = true
  return false
}

function accept() {
  try {
    localStorage.setItem(CONSENT_KEY, 'true')
  } catch {
    // Consent still applies to this session even if it cannot be persisted.
  }
  consentGiven.value = true
  showBanner.value = false
  const action = pendingAction
  pendingAction = null
  action?.()
}

function decline() {
  showBanner.value = false
  pendingAction = null
}

/**
 * Withdraws a consent given earlier (Art. 7 Abs. 3 DSGVO: as easy as giving it).
 * Removes the flag and everything this site stored under its own prefix, so
 * the cart is gone from the device too, not just no longer written.
 */
function revoke() {
  consentGiven.value = false
  pendingAction = null
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // Nothing was persisted if storage is blocked, so there is nothing to remove.
  }
}

export function useConsent() {
  init()
  return {
    consentGiven: readonly(consentGiven),
    showBanner: readonly(showBanner),
    require,
    accept,
    decline,
    revoke,
  }
}
